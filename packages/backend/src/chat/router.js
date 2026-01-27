const { spawn } = require('child_process');
const path = require('path');
const { readFile, writeFile, readdir, mkdir, unlink, stat } = require('fs/promises');
const { PermissionService } = require('./permission-service.js');
const ConversationConverter = require('./conversationConverter.js');
const { readConfigFile } = require('../utils/configFile.js');
const {
  PROJECTS_ROOT_DIR,
  SESSION_TTL_MS,
  findProjectPathBySessionId,
  folderNameToPath,
  ensureMcpConfigFile,
  generateId,
} = require('./utils.js');

// 配置
let hostname = '127.0.0.1';
let port = process.env.PORT ? Number(process.env.PORT) : 8080;

// 从配置文件读取环境变量
let DEFAULT_ENV = {
  API_TIMEOUT_MS: '300000',
  ANTHROPIC_BASE_URL: 'http://127.0.0.1:3457/',
  ANTHROPIC_AUTH_TOKEN: 'sk-123456',
};

const model = process.env.ANTHROPIC_MODEL;
const CLAUDE_CMD = process.platform === 'win32' ? 'claude.exe' : 'claude';

// 异步初始化配置
async function initializeConfig() {
  const config = await readConfigFile();
  if (config) {
    hostname = config.HOST || hostname;
    port = config.PORT ? Number(config.PORT) : port;
    DEFAULT_ENV = {
      API_TIMEOUT_MS: config.API_TIMEOUT_MS || DEFAULT_ENV.API_TIMEOUT_MS,
      ANTHROPIC_BASE_URL: config.ANTHROPIC_BASE_URL || DEFAULT_ENV.ANTHROPIC_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: config.ANTHROPIC_AUTH_TOKEN || DEFAULT_ENV.ANTHROPIC_AUTH_TOKEN,
    };
  }
}


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
// 辅助函数
// ============================================

async function handleChatTestStart(reply, _userMessage, eventName = 'default') {
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

  return { streamingId, streamUrl, mock: true };
}

// ============================================
// 路由注册
// ============================================

/**
 * 注册所有聊天相关路由
 */
function registerChatRoutes(server) {
  const app = server.app;

  // 初始化配置
  initializeConfig().catch(err => {
    console.error('[config] failed to initialize config', err);
  });

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
