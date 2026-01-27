const { spawn } = require('child_process');
const path = require('path');
const { readFile, writeFile, readdir, mkdir, unlink, stat } = require('fs/promises');
const { PermissionService } = require('./permission-service.js');
const ConversationConverter = require('./conversationConverter.js');
const {
  PROJECTS_ROOT_DIR,
  SESSION_TTL_MS,
  findProjectPathBySessionId,
  folderNameToPath,
  extractTextFromEvents,
  readRequestBody,
  sendJson,
  ensureMcpConfigFile,
  generateId,
} = require('./utils.js');

// 配置
const hostname = '127.0.0.1';
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
const CLAUDE_CMD = process.platform === 'win32' ? 'claude.exe' : 'claude';
const DEFAULT_ENV = {
  API_TIMEOUT_MS: '300000',
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:3457/',
  ANTHROPIC_AUTH_TOKEN: 'sk-123456',
};
const model = process.env.ANTHROPIC_MODEL || DEFAULT_ENV.ANTHROPIC_MODEL;

// 服务
const permissionService = new PermissionService();
const sessions = new Map();


// ============================================
// 会话管理函数
// ============================================

function sendEvent(streamingId, payload) {
  const session = sessions.get(streamingId);
  if (!session) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of session.clients) {
    res.write(data);
  }
  session.events.push(payload);
}

function closeSession(streamingId, code) {
  const session = sessions.get(streamingId);
  if (!session) return;
  session.closed = true;
  sendEvent(streamingId, {
    type: 'process_end',
    code,
    timestamp: new Date().toISOString(),
  });
  for (const res of session.clients) res.end();
  session.clients.clear();
  setTimeout(() => sessions.delete(streamingId), SESSION_TTL_MS);
}

function registerPermissionsFromMessage(msg, streamingId) {
  if (msg?.type !== 'message' || !Array.isArray(msg.content)) return;
  for (const block of msg.content) {
    if (block?.type === 'tool_use' && block?.name) {
      console.log('[permission] detected tool_use', {
        streamingId,
        toolName: block.name,
        toolInput: block.input,
        toolUseId: block.id,
      });

      const requiresPermission = ['Write', 'Edit', 'Bash', 'Read'].includes(block.name);

      if (requiresPermission) {
        const req = permissionService.add(block.name, block.input || {}, streamingId);
        console.log('[permission] registered permission request', {
          streamingId,
          permissionId: req.id,
          toolName: block.name,
        });

        if (streamingId) {
          sendEvent(streamingId, {
            type: 'permission_request',
            permission: req,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }
}

// ============================================
// 路由处理函数
// ============================================

async function handleChat(req, res) {
  try {
    const body = await readRequestBody(req);
    const userMessage = body?.message;
    if (!userMessage) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'message 必填' }));
      return;
    }

    const claudePath = CLAUDE_CMD;
    const args = ['-p', userMessage, '--output-format', 'stream-json', '--verbose'];
    const env = { ...DEFAULT_ENV };

    console.log('[chat] spawn claude', {
      cli: claudePath,
      args,
      env: {
        ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: env.ANTHROPIC_MODEL || model,
        API_TIMEOUT_MS: env.API_TIMEOUT_MS,
        ANTHROPIC_AUTH_TOKEN: env.ANTHROPIC_AUTH_TOKEN ? `(masked ${env.ANTHROPIC_AUTH_TOKEN.length} chars)` : 'missing',
      },
      messagePreview: userMessage.slice(0, 120),
    });

    const child = spawn(claudePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let rawText = '';
    let stderr = '';
    const events = [];

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      rawText += chunk.toString();
      console.log('[chat] stdout chunk', {
        length: chunk.length,
        snippet: chunk.toString().slice(0, 200),
      });
      for (const line of chunk.toString().split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          events.push(msg);
          console.log('[chat] parsed event', {
            type: msg.type,
            subtype: msg.subtype,
            keys: Object.keys(msg),
          });
        } catch {
          // 非 JSON 片段忽略
        }
      }
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      console.error('[chat] stderr chunk', {
        length: chunk.length,
        snippet: chunk.toString().slice(0, 400),
      });
    });

    child.on('error', (error) => {
      console.error('[chat] spawn error', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `启动 Claude CLI 失败: ${error}` }));
    });

    child.on('close', (code) => {
      console.log('[chat] process closed', {
        code,
        stdoutLength: rawText.length,
        stderrLength: stderr.length,
        eventCount: events.length,
      });
      const reply = extractTextFromEvents(events) || rawText.trim();
      if (!reply && stderr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Claude CLI 返回错误', detail: stderr }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        reply: reply || '(无返回)',
        stderr: stderr || undefined,
        events,
      }));
    });
  } catch (error) {
    console.error('[chat] handler error', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(error) }));
  }
}

async function handleChatStart(req, res) {
  try {
    const body = await readRequestBody(req);
    const userMessage = body?.message;
    const useMock = !!body?.mock;
    const eventName = body?.eventName || 'default';
    const session = body?.session;

    if (!userMessage) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'message 必填' }));
      return;
    }

    if (useMock) {
      return handleChatTestStart(res, userMessage, eventName);
    }

    const streamingId = generateId();
    const claudePath = CLAUDE_CMD;
    const args = session
      ? ['--resume', session, `"${userMessage}"`, '--output-format', 'stream-json', '--verbose']
      : ['-p', `"${userMessage}"`, '--output-format', 'stream-json', '--verbose'];

    let cwd = process.cwd();
    if (session) {
      const folder = await findProjectPathBySessionId(session);
      if (folder) {
        cwd = await folderNameToPath(folder.name);
        console.log(`[chat:start] Found project path for session ${session}: ${cwd}`);
      } else {
        console.warn(`[chat:start] Could not find project path for session ${session}, using default cwd`);
      }
    }

    const mcpConfigPath = await ensureMcpConfigFile(streamingId, hostname, port);
    args.push('--mcp-config', mcpConfigPath);
    args.push('--permission-prompt-tool', 'mcp__demo-permissions__approval_prompt');
    args.push('--allowedTools', 'mcp__demo-permissions__approval_prompt');

    const env = {
      ...DEFAULT_ENV,
      MCP_STREAMING_ID: streamingId,
    };

    console.log('[chat:start] spawning', {
      streamingId,
      cli: claudePath,
      args,
      mcpConfigPath,
      useMock,
      cwd,
      session: session || 'none',
    });

    console.log(`[chat:start-cmd] ${claudePath} ${args.join(' ')}`);

    const child = spawn(claudePath, args, {
      cwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      env,
    });

    child.on('error', (error) => {
      console.error('[chat:start] spawn error', {
        streamingId,
        error: error.message,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        path: error.path,
      });
      sendEvent(streamingId, {
        type: 'error',
        stderr: `Spawn error: ${error.message}`,
      });
    });

    sessions.set(streamingId, { child, clients: new Set(), events: [] });

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      const fullText = chunk.toString();
      console.log('[chat:start] stdout chunk', { streamingId, length: fullText.length });
      for (const line of fullText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          console.log('[chat:start] parsed message', { streamingId, type: msg.type, subtype: msg.subtype });
          registerPermissionsFromMessage(msg, streamingId);
          sendEvent(streamingId, msg);
        } catch (err) {
          console.log('[chat:start] failed to parse line', { streamingId, line: trimmed });
          sendEvent(streamingId, { type: 'raw', data: trimmed });
        }
      }
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      const stderrText = chunk.toString();
      console.error('[chat:start] stderr chunk', {
        streamingId,
        length: stderrText.length,
        text: stderrText,
      });
      sendEvent(streamingId, { type: 'error', stderr: stderrText });
    });

    child.on('close', (code, signal) => {
      console.log('[chat:start] process closed', {
        streamingId,
        code,
        signal,
        command: `${claudePath} ${args.join(' ')}`,
      });

      if (code !== 0) {
        console.error('[chat:start] ERROR: process exited with non-zero code', {
          streamingId,
          exitCode: code,
          signal,
          sessionIdUsed: session || 'none',
        });
      }

      sendEvent(streamingId, { type: 'process_end', code });
      const sessionData = sessions.get(streamingId);
      if (sessionData) {
        for (const res of sessionData.clients) res.end();
      }
      sessions.delete(streamingId);
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ streamingId, streamUrl: `/api/stream/${streamingId}` }));
  } catch (error) {
    console.error('[chat:start] handler error', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(error) }));
  }
}

function handleStream(req, res, streamingId) {
  const session = sessions.get(streamingId);
  if (!session) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('stream not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');

  session.clients.add(res);
  for (const evt of session.events) {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }

  if (session.closed) {
    res.end();
    return;
  }

  req.on('close', () => {
    session.clients.delete(res);
  });
}

function handlePermissionNotify(res, body) {
  const { toolName, toolInput, streamingId } = body || {};
  if (!toolName) {
    sendJson(res, 400, { error: 'toolName is required' });
    return;
  }

  console.log('[permission] notify received', {
    toolName,
    toolInput,
    streamingId,
    timestamp: new Date().toISOString(),
  });

  const request = permissionService.add(toolName, toolInput, streamingId);

  console.log('[permission] permission request created', {
    permissionId: request.id,
    toolName,
    streamingId,
    status: request.status,
  });

  if (streamingId) {
    sendEvent(streamingId, {
      type: 'permission_request',
      permission: request,
      timestamp: new Date().toISOString(),
    });
  }
  sendJson(res, 200, { success: true, id: request.id });
}

function handlePermissionList(res, query) {
  const { streamingId, status } = query || {};
  const permissions = permissionService.list({ streamingId, status });
  sendJson(res, 200, { permissions });
}

async function handlePermissionDecision(res, pathname, body) {
  const match = pathname.match(/^\/api\/permissions\/([^/]+)\/decision$/);
  if (!match) {
    console.log('[permission] invalid path format', { pathname });
    sendJson(res, 400, { error: 'invalid path format' });
    return;
  }
  const requestId = match[1];

  console.log('[permission] decision request', {
    pathname,
    requestId,
    body,
  });

  if (!requestId) {
    sendJson(res, 400, { error: 'permission ID not found in path' });
    return;
  }

  const { action, modifiedInput, denyReason } = body || {};
  if (!action || !['approve', 'deny'].includes(action)) {
    sendJson(res, 400, { error: 'action must be approve or deny' });
    return;
  }

  const existing = permissionService.get(requestId);
  if (!existing) {
    console.log('[permission] permission not found', { requestId });
    sendJson(res, 404, { error: 'permission not found or not pending' });
    return;
  }

  console.log('[permission] processing decision', {
    requestId,
    action,
    currentStatus: existing.status,
  });

  const updated = permissionService.decide(requestId, action, {
    modifiedInput,
    denyReason,
  });

  if (!updated) {
    console.log('[permission] decision failed - not pending', {
      requestId,
      currentStatus: existing.status,
    });
    sendJson(res, 404, { error: 'permission not found or not pending' });
    return;
  }

  console.log('[permission] decision successful', {
    requestId,
    action,
    newStatus: updated.status,
    streamingId: updated.streamingId,
  });

  if (updated.streamingId) {
    sendEvent(updated.streamingId, {
      type: 'permission_decision',
      permission: updated,
      timestamp: new Date().toISOString(),
    });
  }
  sendJson(res, 200, { success: true, status: updated.status, id: updated.id });
}

function handleMcpConfig(res) {
  const base = `http://${hostname}:${port}`;
  sendJson(res, 200, {
    mcpServers: {
      'demo-permissions': {
        command: process.execPath,
        args: [path.join(__dirname, 'mcp-server.js')],
        env: {
          APPROVAL_ENDPOINT_BASE: base,
        },
      },
    },
  });
}

async function handleEventsList(res) {
  try {
    const eventsDir = path.join(__dirname, 'events');

    try {
      await mkdir(eventsDir, { recursive: true });
    } catch (e) {
      // 目录已存在，忽略错误
    }

    const files = await readdir(eventsDir);
    const eventFiles = files
      .filter((f) => f.endsWith('.txt'))
      .map((f) => ({
        name: f.replace('.txt', ''),
        filename: f,
      }));
    sendJson(res, 200, { events: eventFiles });
  } catch (error) {
    console.error('[events:list] error', error);
    sendJson(res, 500, { error: 'Failed to list events' });
  }
}

async function handleEventsSave(req, res) {
  try {
    const body = await readRequestBody(req);
    const { name, events } = body;

    if (!name || !events || !Array.isArray(events)) {
      sendJson(res, 400, { error: 'name and events array are required' });
      return;
    }

    const eventsDir = path.join(__dirname, 'events');
    await mkdir(eventsDir, { recursive: true });

    const sseContent = events
      .map(event => `data: ${JSON.stringify(event)}`)
      .join('\n\n') + '\n\n';

    const filename = `${name}.txt`;
    const filepath = path.join(eventsDir, filename);

    await writeFile(filepath, sseContent, 'utf-8');

    console.log('[events:save] saved', { name, filename, eventCount: events.length });
    sendJson(res, 200, { success: true, filename });
  } catch (error) {
    console.error('[events:save] error', error);
    sendJson(res, 500, { error: 'Failed to save events: ' + error.message });
  }
}

async function handleEventsDelete(res, eventName) {
  try {
    const eventsDir = path.join(__dirname, 'events');
    const filename = `${eventName}.txt`;
    const filepath = path.join(eventsDir, filename);

    await unlink(filepath);

    console.log('[events:delete] deleted', { eventName, filename });
    sendJson(res, 200, { success: true, deleted: eventName });
  } catch (error) {
    console.error('[events:delete] error', error);
    if (error.code === 'ENOENT') {
      sendJson(res, 404, { error: 'Event not found' });
    } else {
      sendJson(res, 500, { error: 'Failed to delete event: ' + error.message });
    }
  }
}

async function handleApprovalPrompt(res, body) {
  const toolName = body?.tool_name;
  const toolInput = body?.input;
  const streamingId = body?.streamingId || 'unknown';

  if (!toolName) {
    sendJson(res, 400, { error: 'tool_name is required' });
    return;
  }

  const request = permissionService.add(toolName, toolInput || {}, streamingId);

  const TIMEOUT = 10 * 60 * 1000; // 10 minutes
  const POLL = 1000;
  const start = Date.now();

  const decision = await new Promise((resolve) => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed > TIMEOUT) {
        clearInterval(timer);
        resolve({ behavior: 'deny', message: 'Permission request timed out' });
        return;
      }
      const current = permissionService.get(request.id);
      if (!current) return;
      if (current.status === 'approved') {
        clearInterval(timer);
        resolve({
          behavior: 'allow',
          updatedInput: current.modifiedInput || toolInput,
        });
      } else if (current.status === 'denied') {
        clearInterval(timer);
        resolve({
          behavior: 'deny',
          message: current.denyReason || 'Permission denied',
        });
      }
    }, POLL);
  });

  sendJson(res, 200, decision);
}

async function handleChatTestStart(res, _userMessage, eventName = 'default') {
  const streamingId = generateId();
  const session = {
    child: null,
    clients: new Set(),
    events: [],
    closed: false,
  };
  sessions.set(streamingId, session);

  const streamUrl = `/api/stream/${streamingId}`;

  let events = [];

  if (eventName && eventName !== 'default') {
    try {
      const eventFilePath = path.join(__dirname, 'events', `${eventName}.txt`);
      const eventContent = await readFile(eventFilePath, 'utf-8');

      const lines = eventContent.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.substring(6).trim();
            if (jsonStr) {
              const event = JSON.parse(jsonStr);
              events.push(event);
            }
          } catch (e) {
            console.error('[mock] parse event error', e);
          }
        }
      }

      console.log(`[mock] loaded ${events.length} events from ${eventName}.txt`);
    } catch (error) {
      console.error(`[mock] failed to load event file ${eventName}`, error);
    }
  }

  if (events.length === 0) {
    events = [
      { type: 'system', subtype: 'init', cwd: 'G:\\ClaudeCode\\demo', session_id: streamingId, tools: [], mcp_servers: [], model: 'mock-model', permissionMode: 'default', apiKeySource: 'mock' },
      { type: 'process_end', code: 0 },
    ];
  }

  let idx = 0;
  const timer = setInterval(() => {
    if (idx >= events.length) {
      clearInterval(timer);
      closeSession(streamingId, 0);
      return;
    }
    sendEvent(streamingId, events[idx]);
    idx += 1;
  }, 400);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ streamingId, streamUrl, mock: true }));
}

async function handleProjectsList(res) {
  try {
    const projects = await ConversationConverter.getProjectList(PROJECTS_ROOT_DIR);
    sendJson(res, 200, { projects });
  } catch (error) {
    console.error('[projects:list] error', error);
    sendJson(res, 500, { error: 'Failed to list projects: ' + error.message });
  }
}

async function handleSessionConversation(res, projectId, sessionId) {
  try {
    const sessionPath = path.join(PROJECTS_ROOT_DIR, projectId, `${sessionId}.jsonl`);
    const converter = new ConversationConverter();
    const conversation = converter.convertFromFile(sessionPath);
    sendJson(res, 200, {
      projectId,
      sessionId,
      conversation
    });
  } catch (error) {
    console.error('[session:conversation] error', error);
    sendJson(res, 500, { error: 'Failed to load conversation: ' + error.message });
  }
}

async function handleSessionDelete(res, sessionId) {
  try {
    console.log('[session:delete] attempting to delete session', { sessionId });

    const folder = await findProjectPathBySessionId(sessionId);

    if (!folder) {
      console.error('[session:delete] session not found', { sessionId });
      sendJson(res, 404, { error: 'Session not found' });
      return;
    }

    const projectPath = path.join(folder.parentPath, folder.name);
    console.log('[session:delete] found project path', { sessionId, projectPath });

    const sessionFilePath = path.join(projectPath, `${sessionId}.jsonl`);

    try {
      await stat(sessionFilePath);
    } catch (error) {
      console.error('[session:delete] session file not found', { sessionId, sessionFilePath });
      sendJson(res, 404, { error: 'Session file not found' });
      return;
    }

    await unlink(sessionFilePath);
    console.log('[session:delete] deleted session file', { sessionId, sessionFilePath });

    const indexPath = path.join(projectPath, 'sessions-index.json');
    try {
      await stat(indexPath);

      const indexContent = await readFile(indexPath, 'utf-8');
      const indexData = JSON.parse(indexContent);

      if (indexData.entries && Array.isArray(indexData.entries)) {
        const originalLength = indexData.entries.length;

        indexData.entries = indexData.entries.filter(entry => entry.sessionId !== sessionId);

        const removedCount = originalLength - indexData.entries.length;

        if (removedCount > 0) {
          await writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
          console.log('[session:delete] updated sessions-index.json', {
            sessionId,
            removedCount,
            remainingEntries: indexData.entries.length
          });
        } else {
          console.log('[session:delete] session not found in index', { sessionId });
        }
      }
    } catch (error) {
      console.log('[session:delete] no sessions-index.json found or error reading it', {
        sessionId,
        error: error.message
      });
    }

    sendJson(res, 200, {
      success: true,
      message: 'Session deleted successfully',
      sessionId
    });
  } catch (error) {
    console.error('[session:delete] error', error);
    sendJson(res, 500, { error: 'Failed to delete session: ' + error.message });
  }
}

// ============================================
// 路由注册
// ============================================

/**
 * 注册所有聊天相关路由
 */
function registerChatRoutes(server) {
  const app = server.app;

  // SSE 连接：前端用 streamingId 订阅流式事件
  app.get('/api/stream/:streamingId', async (req, reply) => {
    const { streamingId } = req.params;
    const session = sessions.get(streamingId);
    if (!session) {
      reply.status(404).send('stream not found');
      return;
    }

    reply.header('Content-Type', 'text/event-stream');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Connection', 'keep-alive');
    reply.raw.write('\n');

    session.clients.add(reply.raw);
    for (const evt of session.events) {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    if (session.closed) {
      reply.raw.end();
      return;
    }

    req.raw.on('close', () => {
      session.clients.delete(reply.raw);
    });
  });

  // 创建新会话：启动 Claude CLI 子进程，返回 streamingId + streamUrl
  app.post('/api/chat/start', async (req, reply) => {
    try {
      const body = req.body;
      const userMessage = body?.message;
      const useMock = !!body?.mock;
      const eventName = body?.eventName || 'default';
      const session = body?.session;

      if (!userMessage) {
        reply.status(400).send({ error: 'message 必填' });
        return;
      }

      if (useMock) {
        return handleChatTestStart(reply, userMessage, eventName);
      }

      const streamingId = generateId();
      const claudePath = CLAUDE_CMD;
      const args = session
        ? ['--resume', session, `"${userMessage}"`, '--output-format', 'stream-json', '--verbose']
        : ['-p', `"${userMessage}"`, '--output-format', 'stream-json', '--verbose'];

      let cwd = process.cwd();
      if (session) {
        const folder = await findProjectPathBySessionId(session);
        if (folder) {
          cwd = await folderNameToPath(folder.name);
          console.log(`[chat:start] Found project path for session ${session}: ${cwd}`);
        } else {
          console.warn(`[chat:start] Could not find project path for session ${session}, using default cwd`);
        }
      }

      const mcpConfigPath = await ensureMcpConfigFile(streamingId, hostname, port);
      args.push('--mcp-config', mcpConfigPath);
      args.push('--permission-prompt-tool', 'mcp__demo-permissions__approval_prompt');
      args.push('--allowedTools', 'mcp__demo-permissions__approval_prompt');

      const env = {
        ...DEFAULT_ENV,
        MCP_STREAMING_ID: streamingId,
      };

      console.log('[chat:start] spawning', {
        streamingId,
        cli: claudePath,
        args,
        mcpConfigPath,
        useMock,
        cwd,
        session: session || 'none',
      });

      console.log(`[chat:start-cmd] ${claudePath} ${args.join(' ')}`);

      const child = spawn(claudePath, args, {
        cwd,
        stdio: ['inherit', 'pipe', 'pipe'],
        env,
      });

      child.on('error', (error) => {
        console.error('[chat:start] spawn error', {
          streamingId,
          error: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          path: error.path,
        });
        sendEvent(streamingId, {
          type: 'error',
          stderr: `Spawn error: ${error.message}`,
        });
      });

      sessions.set(streamingId, { child, clients: new Set(), events: [] });

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        const fullText = chunk.toString();
        console.log('[chat:start] stdout chunk', { streamingId, length: fullText.length });
        for (const line of fullText.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            console.log('[chat:start] parsed message', { streamingId, type: msg.type, subtype: msg.subtype });
            registerPermissionsFromMessage(msg, streamingId);
            sendEvent(streamingId, msg);
          } catch (err) {
            console.log('[chat:start] failed to parse line', { streamingId, line: trimmed });
            sendEvent(streamingId, { type: 'raw', data: trimmed });
          }
        }
      });

      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk) => {
        const stderrText = chunk.toString();
        console.error('[chat:start] stderr chunk', {
          streamingId,
          length: stderrText.length,
          text: stderrText,
        });
        sendEvent(streamingId, { type: 'error', stderr: stderrText });
      });

      child.on('close', (code, signal) => {
        console.log('[chat:start] process closed', {
          streamingId,
          code,
          signal,
          command: `${claudePath} ${args.join(' ')}`,
        });

        if (code !== 0) {
          console.error('[chat:start] ERROR: process exited with non-zero code', {
            streamingId,
            exitCode: code,
            signal,
            sessionIdUsed: session || 'none',
          });
        }

        sendEvent(streamingId, { type: 'process_end', code });
        const sessionData = sessions.get(streamingId);
        if (sessionData) {
          for (const res of sessionData.clients) res.end();
        }
        sessions.delete(streamingId);
      });

      return { streamingId, streamUrl: `/api/stream/${streamingId}` };
    } catch (error) {
      console.error('[chat:start] handler error', error);
      reply.status(500).send({ error: String(error) });
    }
  });

  // 单次请求（非流式）：直接跑一次 CLI，返回聚合结果
  app.post('/api/chat', async (req, reply) => {
    try {
      const body = req.body;
      const userMessage = body?.message;
      if (!userMessage) {
        reply.status(400).send({ error: 'message 必填' });
        return;
      }

      const claudePath = CLAUDE_CMD;
      const args = ['-p', userMessage, '--output-format', 'stream-json', '--verbose'];
      const env = { ...DEFAULT_ENV };

      console.log('[chat] spawn claude', {
        cli: claudePath,
        args,
        env: {
          ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL,
          ANTHROPIC_MODEL: env.ANTHROPIC_MODEL || model,
          API_TIMEOUT_MS: env.API_TIMEOUT_MS,
          ANTHROPIC_AUTH_TOKEN: env.ANTHROPIC_AUTH_TOKEN ? `(masked ${env.ANTHROPIC_AUTH_TOKEN.length} chars)` : 'missing',
        },
        messagePreview: userMessage.slice(0, 120),
      });

      const child = spawn(claudePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      });

      let rawText = '';
      let stderr = '';
      const events = [];

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        rawText += chunk.toString();
        console.log('[chat] stdout chunk', {
          length: chunk.length,
          snippet: chunk.toString().slice(0, 200),
        });
        for (const line of chunk.toString().split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            events.push(msg);
            console.log('[chat] parsed event', {
              type: msg.type,
              subtype: msg.subtype,
              keys: Object.keys(msg),
            });
          } catch {
            // 非 JSON 片段忽略
          }
        }
      });

      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
        console.error('[chat] stderr chunk', {
          length: chunk.length,
          snippet: chunk.toString().slice(0, 400),
        });
      });

      child.on('error', (error) => {
        console.error('[chat] spawn error', error);
        reply.status(500).send({ error: `启动 Claude CLI 失败: ${error}` });
      });

      child.on('close', (code) => {
        console.log('[chat] process closed', {
          code,
          stdoutLength: rawText.length,
          stderrLength: stderr.length,
          eventCount: events.length,
        });
        const replyText = extractTextFromEvents(events) || rawText.trim();
        if (!replyText && stderr) {
          reply.status(500).send({ error: 'Claude CLI 返回错误', detail: stderr });
          return;
        }
        return {
          reply: replyText || '(无返回)',
          stderr: stderr || undefined,
          events,
        };
      });
    } catch (error) {
      console.error('[chat] handler error', error);
      reply.status(500).send({ error: String(error) });
    }
  });

  // 权限通知：注册待审批请求
  app.post('/api/permissions/notify', async (req, reply) => {
    const body = req.body;
    const { toolName, toolInput, streamingId } = body || {};
    if (!toolName) {
      reply.status(400).send({ error: 'toolName is required' });
      return;
    }

    console.log('[permission] notify received', {
      toolName,
      toolInput,
      streamingId,
      timestamp: new Date().toISOString(),
    });

    const request = permissionService.add(toolName, toolInput, streamingId);

    console.log('[permission] permission request created', {
      permissionId: request.id,
      toolName,
      streamingId,
      status: request.status,
    });

    if (streamingId) {
      sendEvent(streamingId, {
        type: 'permission_request',
        permission: request,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, id: request.id };
  });

  // 权限列表
  app.get('/api/permissions', async (req, reply) => {
    const { streamingId, status } = req.query;
    const permissions = permissionService.list({ streamingId, status });
    return { permissions };
  });

  // 权限决策
  app.post('/api/permissions/:requestId/decision', async (req, reply) => {
    try {
      const { requestId } = req.params;
      const body = req.body;

      console.log('[permission] decision request', {
        requestId,
        body,
      });

      if (!requestId) {
        reply.status(400).send({ error: 'permission ID not found in path' });
        return;
      }

      const { action, modifiedInput, denyReason } = body || {};
      if (!action || !['approve', 'deny'].includes(action)) {
        reply.status(400).send({ error: 'action must be approve or deny' });
        return;
      }

      const existing = permissionService.get(requestId);
      if (!existing) {
        console.log('[permission] permission not found', { requestId });
        reply.status(404).send({ error: 'permission not found or not pending' });
        return;
      }

      console.log('[permission] processing decision', {
        requestId,
        action,
        currentStatus: existing.status,
      });

      const updated = permissionService.decide(requestId, action, {
        modifiedInput,
        denyReason,
      });

      if (!updated) {
        console.log('[permission] decision failed - not pending', {
          requestId,
          currentStatus: existing.status,
        });
        reply.status(404).send({ error: 'permission not found or not pending' });
        return;
      }

      console.log('[permission] decision successful', {
        requestId,
        action,
        newStatus: updated.status,
        streamingId: updated.streamingId,
      });

      if (updated.streamingId) {
        sendEvent(updated.streamingId, {
          type: 'permission_decision',
          permission: updated,
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true, status: updated.status, id: updated.id };
    } catch (error) {
      console.error('[permission] decision error', error);
      reply.status(500).send({ error: String(error) });
    }
  });

  // MCP-like approval_prompt endpoint
  app.post('/mcp/approval_prompt', async (req, reply) => {
    try {
      const body = req.body;
      const toolName = body?.tool_name;
      const toolInput = body?.input;
      const streamingId = body?.streamingId || 'unknown';

      if (!toolName) {
        reply.status(400).send({ error: 'tool_name is required' });
        return;
      }

      const request = permissionService.add(toolName, toolInput || {}, streamingId);

      const TIMEOUT = 10 * 60 * 1000; // 10 minutes
      const POLL = 1000;
      const start = Date.now();

      const decision = await new Promise((resolve) => {
        const timer = setInterval(() => {
          const elapsed = Date.now() - start;
          if (elapsed > TIMEOUT) {
            clearInterval(timer);
            resolve({ behavior: 'deny', message: 'Permission request timed out' });
            return;
          }
          const current = permissionService.get(request.id);
          if (!current) return;
          if (current.status === 'approved') {
            clearInterval(timer);
            resolve({
              behavior: 'allow',
              updatedInput: current.modifiedInput || toolInput,
            });
          } else if (current.status === 'denied') {
            clearInterval(timer);
            resolve({
              behavior: 'deny',
              message: current.denyReason || 'Permission denied',
            });
          }
        }, POLL);
      });

      return decision;
    } catch (error) {
      console.error('[approval_prompt] error', error);
      reply.status(500).send({ error: String(error) });
    }
  });

  // MCP config helper
  app.get('/mcp/config', async (req, reply) => {
    return {
      mcpServers: {
        'demo-permissions': {
          command: process.execPath,
          args: [path.join(__dirname, 'mcp-server.js')],
          env: {
            APPROVAL_ENDPOINT_BASE: `http://${hostname}:${port}`,
          },
        },
      },
    };
  });

  // 获取模拟事件列表
  app.get('/api/events', async (req, reply) => {
    try {
      const eventsDir = path.join(__dirname, 'events');

      try {
        await mkdir(eventsDir, { recursive: true });
      } catch (e) {
        // 目录已存在，忽略错误
      }

      const files = await readdir(eventsDir);
      const eventFiles = files
        .filter((f) => f.endsWith('.txt'))
        .map((f) => ({
          name: f.replace('.txt', ''),
          filename: f,
        }));
      return { events: eventFiles };
    } catch (error) {
      console.error('[events:list] error', error);
      reply.status(500).send({ error: 'Failed to list events' });
    }
  });

  // 保存 events 到文件
  app.post('/api/events/save', async (req, reply) => {
    try {
      const body = req.body;
      const { name, events } = body;

      if (!name || !events || !Array.isArray(events)) {
        reply.status(400).send({ error: 'name and events array are required' });
        return;
      }

      const eventsDir = path.join(__dirname, 'events');
      await mkdir(eventsDir, { recursive: true });

      const sseContent = events
        .map(event => `data: ${JSON.stringify(event)}`)
        .join('\n\n') + '\n\n';

      const filename = `${name}.txt`;
      const filepath = path.join(eventsDir, filename);

      await writeFile(filepath, sseContent, 'utf-8');

      console.log('[events:save] saved', { name, filename, eventCount: events.length });
      return { success: true, filename };
    } catch (error) {
      console.error('[events:save] error', error);
      reply.status(500).send({ error: 'Failed to save events: ' + error.message });
    }
  });

  // 删除 events
  app.delete('/api/events/:eventName', async (req, reply) => {
    try {
      const { eventName } = req.params;
      const eventsDir = path.join(__dirname, 'events');
      const filename = `${eventName}.txt`;
      const filepath = path.join(eventsDir, filename);

      await unlink(filepath);

      console.log('[events:delete] deleted', { eventName, filename });
      return { success: true, deleted: eventName };
    } catch (error) {
      console.error('[events:delete] error', error);
      if (error.code === 'ENOENT') {
        reply.status(404).send({ error: 'Event not found' });
      } else {
        reply.status(500).send({ error: 'Failed to delete event: ' + error.message });
      }
    }
  });

  // 获取项目列表（包含 sessions）
  app.get('/api/projects', async (req, reply) => {
    try {
      const projects = await ConversationConverter.getProjectList(PROJECTS_ROOT_DIR);
      return { projects };
    } catch (error) {
      console.error('[projects:list] error', error);
      reply.status(500).send({ error: 'Failed to list projects: ' + error.message });
    }
  });

  // 获取会话的对话内容
  app.get('/api/projects/:projectId/sessions/:sessionId', async (req, reply) => {
    try {
      const { projectId, sessionId } = req.params;
      const sessionPath = path.join(PROJECTS_ROOT_DIR, projectId, `${sessionId}.jsonl`);
      const converter = new ConversationConverter();
      const conversation = converter.convertFromFile(sessionPath);
      return {
        projectId,
        sessionId,
        conversation
      };
    } catch (error) {
      console.error('[session:conversation] error', error);
      reply.status(500).send({ error: 'Failed to load conversation: ' + error.message });
    }
  });

  // 删除 session（会话）
  app.delete('/api/sessions/:sessionId', async (req, reply) => {
    try {
      const { sessionId } = req.params;
      console.log('[session:delete] attempting to delete session', { sessionId });

      const folder = await findProjectPathBySessionId(sessionId);

      if (!folder) {
        console.error('[session:delete] session not found', { sessionId });
        reply.status(404).send({ error: 'Session not found' });
        return;
      }

      const projectPath = path.join(folder.parentPath, folder.name);
      console.log('[session:delete] found project path', { sessionId, projectPath });

      const sessionFilePath = path.join(projectPath, `${sessionId}.jsonl`);

      try {
        await stat(sessionFilePath);
      } catch (error) {
        console.error('[session:delete] session file not found', { sessionId, sessionFilePath });
        reply.status(404).send({ error: 'Session file not found' });
        return;
      }

      await unlink(sessionFilePath);
      console.log('[session:delete] deleted session file', { sessionId, sessionFilePath });

      const indexPath = path.join(projectPath, 'sessions-index.json');
      try {
        await stat(indexPath);

        const indexContent = await readFile(indexPath, 'utf-8');
        const indexData = JSON.parse(indexContent);

        if (indexData.entries && Array.isArray(indexData.entries)) {
          const originalLength = indexData.entries.length;

          indexData.entries = indexData.entries.filter(entry => entry.sessionId !== sessionId);

          const removedCount = originalLength - indexData.entries.length;

          if (removedCount > 0) {
            await writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8');
            console.log('[session:delete] updated sessions-index.json', {
              sessionId,
              removedCount,
              remainingEntries: indexData.entries.length
            });
          } else {
            console.log('[session:delete] session not found in index', { sessionId });
          }
        }
      } catch (error) {
        console.log('[session:delete] no sessions-index.json found or error reading it', {
          sessionId,
          error: error.message
        });
      }

      return {
        success: true,
        message: 'Session deleted successfully',
        sessionId
      };
    } catch (error) {
      console.error('[session:delete] error', error);
      reply.status(500).send({ error: 'Failed to delete session: ' + error.message });
    }
  });
}

module.exports = { registerChatRoutes };
