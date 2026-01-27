const { spawn } = require('child_process');
const path = require('path');
const { readFile, writeFile, readdir, mkdir, unlink, stat } = require('fs/promises');
const { PermissionService } = require('./utils/permissionService.js');
const ConversationConverter = require('./utils/conversationConverter.js');
const {
  generateId,
  getClaudeConfig,
  findProjectPathBySessionId,
  folderNameToPath,
} = require('./utils/index.js');
const { ensureMcpConfigFile } = require('./utils/mcpUtils.js');
const { SessionManager } = require('./utils/sessionUtils.js');
const { registerPermissionsFromMessage } = require('./utils/permissionUtils.js');
const { CLAUDE_PROJECTS_DIR } = require("../config/constants.js")

// 服务
const permissionService = new PermissionService();
const sessionManager = new SessionManager();

// ============================================
// 辅助函数
// ============================================

async function handleChatTestStart(reply, _userMessage, eventName = 'default') {
  const streamingId = generateId();
  sessionManager.createSession(streamingId);

  const streamUrl = `/api/chat/stream/${streamingId}`;

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
            console.error('[模拟] 解析事件错误', e);
          }
        }
      }

      console.log(`[模拟] 从 ${eventName}.txt 加载了 ${events.length} 个事件`);
    } catch (error) {
      console.error(`[模拟] 加载事件文件失败 ${eventName}`, error);
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
      sessionManager.closeSession(streamingId, 0);
      return;
    }
    sessionManager.sendEvent(streamingId, events[idx]);
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

  // 允许访问（自定义中间件 为了避免 llm 服务的默认行为，只要是 post 或 /api 开头的请求，都添加 model 字段）
  // 后续我还对model进行了删除否则可能会导致错误
  app.addHook("preHandler", async (request, _reply) => {
    // 注意：对于 /mcp/:group/messages 路由，不要访问 request.body
    // 因为该路由需要从原始请求流中读取请求体（用于 SSE handlePostMessage）
    if (request.url.startsWith("/chat/") && request.method === "POST") {
      // 只在非 messages 端点设置 model
      if (request.body) request.body.model = "xxx";
    }
  });

  // SSE 连接：前端用 streamingId 订阅流式事件
  app.get('/api/chat/stream/:streamingId', async (req, reply) => {
    const { streamingId } = req.params;
    const session = sessionManager.getSession(streamingId);
    if (!session) {
      reply.status(404).send('流不存在');
      return;
    }

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    reply.raw.write('\n');

    // 将客户端添加到会话
    session.clients.add(reply.raw);

    // 回放已有事件，方便前端快速展示
    for (const evt of session.events) {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // 如果会话已结束，回放后直接结束响应，避免前端自动重连时报 404
    if (session.closed) {
      reply.raw.end();
      return;
    }

    // 监听客户端断开连接
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

      const config = await getClaudeConfig();
      const streamingId = generateId();
      const claudePath = config.CLAUDE_PATH;
      const args = session
        ? ['--resume', session, `"${userMessage}"`, '--output-format', 'stream-json', '--verbose']
        : ['-p', `"${userMessage}"`, '--output-format', 'stream-json', '--verbose'];

      let cwd = process.cwd();
      if (session) {
        const folder = await findProjectPathBySessionId(session);
        if (folder) {
          cwd = await folderNameToPath(folder.name);
          console.log(`[聊天:启动] 找到会话 ${session} 的项目路径: ${cwd}`);
        } else {
          console.warn(`[聊天:启动] 无法找到会话 ${session} 的项目路径，使用默认工作目录`);
        }
      }

      const mcpConfigPath = await ensureMcpConfigFile(streamingId, config.HOST, config.PORT);
      args.push('--mcp-config', mcpConfigPath);
      args.push('--permission-prompt-tool', 'mcp__demo-permissions__approval_prompt');
      args.push('--allowedTools', 'mcp__demo-permissions__approval_prompt');

      const env = {
        API_TIMEOUT_MS: config.API_TIMEOUT_MS,
        ANTHROPIC_BASE_URL: `http://${config.HOST}:${config.PORT}/`,
        ANTHROPIC_AUTH_TOKEN: config.APIKEY,
        MCP_STREAMING_ID: streamingId,
      };

      console.log('[聊天:启动] 正在启动进程', {
        streamingId,
        cli: claudePath,
        args,
        mcpConfigPath,
        useMock,
        cwd,
        session: session || '无',
      });

      console.log(`[聊天:启动-命令] ${claudePath} ${args.join(' ')}`);

      const child = spawn(claudePath, args, {
        cwd,
        stdio: ['inherit', 'pipe', 'pipe'],
        env,
      });

      child.on('error', (error) => {
        console.error('[聊天:启动] 进程启动错误', {
          streamingId,
          error: error.message,
          code: error.code,
          errno: error.errno,
          syscall: error.syscall,
          path: error.path,
        });
        sessionManager.sendEvent(streamingId, {
          type: 'error',
          stderr: `进程启动错误: ${error.message}`,
        });
      });

      sessionManager.createSession(streamingId, child);

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        const fullText = chunk.toString();
        console.log('[聊天:启动] 标准输出数据块', { streamingId, length: fullText.length });
        for (const line of fullText.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            console.log('[聊天:启动] 解析消息', { streamingId, type: msg.type, subtype: msg.subtype });
            registerPermissionsFromMessage(msg, streamingId, permissionService, sessionManager);
            sessionManager.sendEvent(streamingId, msg);
          } catch (err) {
            console.log('[聊天:启动] 解析行失败', { streamingId, line: trimmed });
            sessionManager.sendEvent(streamingId, { type: 'raw', data: trimmed });
          }
        }
      });

      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk) => {
        const stderrText = chunk.toString();
        console.error('[聊天:启动] 标准错误数据块', {
          streamingId,
          length: stderrText.length,
          text: stderrText,
        });
        sessionManager.sendEvent(streamingId, { type: 'error', stderr: stderrText });
      });

      child.on('close', (code, signal) => {
        console.log('[聊天:启动] 进程关闭', {
          streamingId,
          code,
          signal,
          command: `${claudePath} ${args.join(' ')}`,
        });

        if (code !== 0) {
          console.error('[聊天:启动] 错误: 进程以非零代码退出', {
            streamingId,
            exitCode: code,
            signal,
            sessionIdUsed: session || '无',
          });
        }

        sessionManager.sendEvent(streamingId, { type: 'process_end', code });
        const sessionData = sessionManager.getSession(streamingId);
        if (sessionData) {
          for (const res of sessionData.clients) res.end();
        }
        sessionManager.deleteSession(streamingId);
      });

      return { streamingId, streamUrl: `/api/chat/stream/${streamingId}` };
    } catch (error) {
      console.error('[聊天:启动] 处理器错误', error);
      reply.status(500).send({ error: String(error) });
    }
  });

  // 权限通知：注册待审批请求
  app.post('/api/chat/permissions/notify', async (req, reply) => {
    const body = req.body;
    const { toolName, toolInput, streamingId } = body || {};
    if (!toolName) {
      reply.status(400).send({ error: '工具名称必填' });
      return;
    }

    console.log('[权限] 收到通知', {
      toolName,
      toolInput,
      streamingId,
      timestamp: new Date().toISOString(),
    });

    const request = permissionService.add(toolName, toolInput, streamingId);

    console.log('[权限] 权限请求已创建', {
      permissionId: request.id,
      toolName,
      streamingId,
      status: request.status,
    });

    if (streamingId) {
      sessionManager.sendEvent(streamingId, {
        type: 'permission_request',
        permission: request,
        timestamp: new Date().toISOString(),
      });
    }
    return { success: true, id: request.id };
  });

  // 权限列表
  app.get('/api/chat/permissions', async (req, reply) => {
    const { streamingId, status } = req.query;
    const permissions = permissionService.list({ streamingId, status });
    return { permissions };
  });

  // 权限决策
  app.post('/api/chat/permissions/:requestId/decision', async (req, reply) => {
    try {
      const { requestId } = req.params;
      const body = req.body;

      console.log('[权限] 决策请求', {
        requestId,
        body,
      });

      if (!requestId) {
        reply.status(400).send({ error: '路径中未找到权限ID' });
        return;
      }

      const { action, modifiedInput, denyReason } = body || {};
      if (!action || !['approve', 'deny'].includes(action)) {
        reply.status(400).send({ error: '操作必须是 approve 或 deny' });
        return;
      }

      const existing = permissionService.get(requestId);
      if (!existing) {
        console.log('[权限] 权限未找到', { requestId });
        reply.status(404).send({ error: '权限未找到或不在待审批状态' });
        return;
      }

      console.log('[权限] 正在处理决策', {
        requestId,
        action,
        currentStatus: existing.status,
      });

      const updated = permissionService.decide(requestId, action, {
        modifiedInput,
        denyReason,
      });

      if (!updated) {
        console.log('[权限] 决策失败 - 不在待审批状态', {
          requestId,
          currentStatus: existing.status,
        });
        reply.status(404).send({ error: '权限未找到或不在待审批状态' });
        return;
      }

      console.log('[权限] 决策成功', {
        requestId,
        action,
        newStatus: updated.status,
        streamingId: updated.streamingId,
      });

      if (updated.streamingId) {
        sessionManager.sendEvent(updated.streamingId, {
          type: 'permission_decision',
          permission: updated,
          timestamp: new Date().toISOString(),
        });
      }
      return { success: true, status: updated.status, id: updated.id };
    } catch (error) {
      console.error('[权限] 决策错误', error);
      reply.status(500).send({ error: String(error) });
    }
  });

  // MCP-like approval_prompt endpoint
  app.post('/api/chat/mcp/approval_prompt', async (req, reply) => {
    try {
      const body = req.body;
      const toolName = body?.tool_name;
      const toolInput = body?.input;
      const streamingId = body?.streamingId || 'unknown';

      if (!toolName) {
        reply.status(400).send({ error: '工具名称必填' });
        return;
      }

      const request = permissionService.add(toolName, toolInput || {}, streamingId);

      const TIMEOUT = 10 * 60 * 1000; // 10 分钟
      const POLL = 1000;
      const start = Date.now();

      const decision = await new Promise((resolve) => {
        const timer = setInterval(() => {
          const elapsed = Date.now() - start;
          if (elapsed > TIMEOUT) {
            clearInterval(timer);
            resolve({ behavior: 'deny', message: '权限请求超时' });
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
              message: current.denyReason || '权限被拒绝',
            });
          }
        }, POLL);
      });

      return decision;
    } catch (error) {
      console.error('[审批提示] 错误', error);
      reply.status(500).send({ error: String(error) });
    }
  });

  // MCP config helper
  app.get('/api/chat/mcp/config', async (req, reply) => {
    const config = await getClaudeConfig();
    return {
      mcpServers: {
        'demo-permissions': {
          command: process.execPath,
          args: [path.join(__dirname, 'mcp-server.js')],
          env: {
            APPROVAL_ENDPOINT_BASE: `http://${config.HOST}:${config.PORT}`,
          },
        },
      },
    };
  });

  // 获取模拟事件列表
  app.get('/api/chat/events', async (req, reply) => {
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
      console.error('[事件:列表] 错误', error);
      reply.status(500).send({ error: '获取事件列表失败' });
    }
  });

  // 保存 events 到文件
  app.post('/api/chat/events/save', async (req, reply) => {
    try {
      const body = req.body;
      const { name, events } = body;

      if (!name || !events || !Array.isArray(events)) {
        reply.status(400).send({ error: '名称和事件数组必填' });
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

      console.log('[事件:保存] 已保存', { name, filename, eventCount: events.length });
      return { success: true, filename };
    } catch (error) {
      console.error('[事件:保存] 错误', error);
      reply.status(500).send({ error: '保存事件失败: ' + error.message });
    }
  });

  // 删除 events
  app.delete('/api/chat/events/:eventName', async (req, reply) => {
    try {
      const { eventName } = req.params;
      const eventsDir = path.join(__dirname, 'events');
      const filename = `${eventName}.txt`;
      const filepath = path.join(eventsDir, filename);

      await unlink(filepath);

      console.log('[事件:删除] 已删除', { eventName, filename });
      return { success: true, deleted: eventName };
    } catch (error) {
      console.error('[事件:删除] 错误', error);
      if (error.code === 'ENOENT') {
        reply.status(404).send({ error: '事件未找到' });
      } else {
        reply.status(500).send({ error: '删除事件失败: ' + error.message });
      }
    }
  });

  // 获取项目列表（包含 sessions）
  app.get('/api/chat/projects', async (req, reply) => {
    try {
      const projects = await ConversationConverter.getProjectList(CLAUDE_PROJECTS_DIR);
      return { projects };
    } catch (error) {
      console.error('[项目:列表] 错误', error);
      reply.status(500).send({ error: '获取项目列表失败: ' + error.message });
    }
  });

  // 获取会话的对话内容
  app.get('/api/chat/projects/:projectId/sessions/:sessionId', async (req, reply) => {
    try {
      const { projectId, sessionId } = req.params;
      const sessionPath = path.join(CLAUDE_PROJECTS_DIR, projectId, `${sessionId}.jsonl`);
      const converter = new ConversationConverter();
      const conversation = converter.convertFromFile(sessionPath);
      return {
        projectId,
        sessionId,
        conversation
      };
    } catch (error) {
      console.error('[会话:对话] 错误', error);
      reply.status(500).send({ error: '加载对话失败: ' + error.message });
    }
  });

  // 删除 session（会话）
  app.delete('/api/chat/sessions/:sessionId', async (req, reply) => {
    try {
      const { sessionId } = req.params;
      console.log('[会话:删除] 尝试删除会话', { sessionId });

      const folder = await findProjectPathBySessionId(sessionId);

      if (!folder) {
        console.error('[会话:删除] 会话未找到', { sessionId });
        reply.status(404).send({ error: '会话未找到' });
        return;
      }

      const projectPath = path.join(folder.parentPath, folder.name);
      console.log('[会话:删除] 找到项目路径', { sessionId, projectPath });

      const sessionFilePath = path.join(projectPath, `${sessionId}.jsonl`);

      try {
        await stat(sessionFilePath);
      } catch (error) {
        console.error('[会话:删除] 会话文件未找到', { sessionId, sessionFilePath });
        reply.status(404).send({ error: '会话文件未找到' });
        return;
      }

      await unlink(sessionFilePath);
      console.log('[会话:删除] 已删除会话文件', { sessionId, sessionFilePath });

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
            console.log('[会话:删除] 已更新 sessions-index.json', {
              sessionId,
              removedCount,
              remainingEntries: indexData.entries.length
            });
          } else {
            console.log('[会话:删除] 索引中未找到会话', { sessionId });
          }
        }
      } catch (error) {
        console.log('[会话:删除] 未找到 sessions-index.json 或读取错误', {
          sessionId,
          error: error.message
        });
      }

      return {
        success: true,
        message: '会话删除成功',
        sessionId
      };
    } catch (error) {
      console.error('[会话:删除] 错误', error);
      reply.status(500).send({ error: '删除会话失败: ' + error.message });
    }
  });
}

module.exports = { registerChatRoutes };
