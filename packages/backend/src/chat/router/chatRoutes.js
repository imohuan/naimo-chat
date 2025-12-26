const { spawn } = require("child_process");
const { writeFile, readFile } = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  sendEvent,
  closeSession,
  createSession,
  getSession,
  hasSession,
} = require("./sessionService");
const { permissionService } = require("./permissionService");
const { mcpServerText } = require("../mcp-server-text");
const { MCP_SERVER_DIR } = require("../../config/constants");
const { ensureDir } = require("../../utils/paths");
const { readConfigFile } = require("../../utils/configFile");
const { buildMcpConfig } = require("./mcpConfigUtils");

/**
 * 从配置文件中获取 Claude 相关配置
 * @returns {Promise<Object>} 配置对象，包含 HOST, PORT, APIKEY, API_TIMEOUT_MS, CLAUDE_PATH
 */
async function getClaudeConfig() {
  const defaultConfig = {
    HOST: "127.0.0.1",
    PORT: 3457,
    APIKEY: "sk-123456",
    API_TIMEOUT_MS: "300000",
    CLAUDE_PATH: process.platform === "win32" ? "claude.exe" : "claude",
  };

  try {
    const config = await readConfigFile() || defaultConfig;
    return {
      HOST: config.HOST || defaultConfig.HOST,
      PORT: Number(config.PORT) || defaultConfig.PORT,
      APIKEY: config.APIKEY || defaultConfig.APIKEY,
      API_TIMEOUT_MS: config.API_TIMEOUT_MS || defaultConfig.API_TIMEOUT_MS,
      CLAUDE_PATH: config.CLAUDE_PATH?.trim() || defaultConfig.CLAUDE_PATH,
    };
  } catch (error) {
    console.error("[chatRoutes] Failed to read config file:", error);
    // 出错时返回默认值
    return defaultConfig;
  }
}

/**
 * 根据配置生成环境变量配置
 * @param {Object} config - 从配置文件读取的配置对象
 * @returns {Object} 环境变量配置对象
 */
function buildEnvConfig(config) {
  const baseUrl = `http://${config.HOST}:${config.PORT}/`;
  return {
    API_TIMEOUT_MS: config.API_TIMEOUT_MS,
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: config.APIKEY,
    // ANTHROPIC_MODEL: "claude-3-5-sonnet-20241022", // 默认模型
  };
}

/**
 * 提取事件中的文本内容
 */
function extractTextFromEvents(events) {
  let text = "";
  for (const ev of events) {
    if (ev?.type === "content_block_delta" && ev?.delta?.text) {
      text += ev.delta.text;
    } else if (ev?.type === "content_block" && Array.isArray(ev.content)) {
      for (const part of ev.content) {
        if (part?.text) text += part.text;
      }
    } else if (ev?.type === "message" && Array.isArray(ev.content)) {
      for (const part of ev.content) {
        if (part?.text) text += part.text;
      }
    }
  }
  return text.trim();
}

/**
 * 从消息中识别并注册权限请求
 */
function registerPermissionsFromMessage(msg, streamingId) {
  if (msg?.type !== "message" || !Array.isArray(msg.content)) return;
  for (const block of msg.content) {
    if (block?.type === "tool_use" && block?.name) {
      const requiresPermission = ["Write", "Edit", "Bash", "Read"].includes(
        block.name
      );

      if (requiresPermission) {
        const req = permissionService.add(
          block.name,
          block.input || {},
          streamingId
        );
        console.log("[chat][permission] registered permission request", {
          streamingId,
          permissionId: req.id,
          toolName: block.name,
        });

        if (streamingId) {
          sendEvent(streamingId, {
            type: "permission_request",
            permission: req,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }
}

/**
 * 生成 MCP 配置文件
 * 为每个 streamId 生成独立的配置文件，以便传递 MCP_STREAMING_ID 环境变量
 */
async function ensureMcpConfigFile(streamingId, hostname, port) {
  const baseUrl = `http://${hostname}:${port}`;

  // 确保 MCP 服务器目录存在
  ensureDir(MCP_SERVER_DIR);

  // 将 mcpServerText 写入到 MCP_SERVER_DIR 目录下的 mcp-server.js 文件
  const mcpServerPath = path.join(MCP_SERVER_DIR, `mcp-server-${streamingId}.js`);
  const mcpConfigPath = path.join(MCP_SERVER_DIR, `mcp-config-${streamingId}.json`);

  // 使用通用函数构建配置
  const config = buildMcpConfig({
    baseUrl,
    mcpServerPath,
    streamingId,
  });

  await writeFile(mcpServerPath, mcpServerText, "utf-8");
  await writeFile(mcpConfigPath, JSON.stringify(config, null, 2), "utf-8");
  return mcpConfigPath;
}

/**
 * 注册聊天相关路由
 */
function registerChatRoutes(server) {
  const app = server.app;

  // 0. 返回聊天页面 HTML
  app.get("/api/chat", async (req, reply) => {
    try {
      const chatHtmlPath = path.join(__dirname, "../chat.html");
      const htmlContent = await readFile(chatHtmlPath, "utf-8");
      reply.type("text/html").send(htmlContent);
    } catch (error) {
      console.error("[chatRoutes] Failed to read chat.html:", error);
      reply.code(500).send({ error: "Failed to load chat page" });
    }
  });

  // 1. SSE 流连接
  app.get("/api/chat/stream/:streamingId", async (req, reply) => {
    const { streamingId } = req.params;

    if (!hasSession(streamingId)) {
      reply.code(404).send("stream not found");
      return;
    }

    const session = getSession(streamingId);

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write("\n");

    session.clients.add(reply.raw);

    // 回放已有事件
    for (const evt of session.events) {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // 如果会话已结束，直接结束响应
    if (session.closed) {
      reply.raw.end();
      return;
    }

    // 监听连接关闭
    req.raw.on("close", () => {
      session.clients.delete(reply.raw);
    });

    // 保持连接（Fastify 不会自动结束）
    return new Promise(() => { });
  });

  // 2. 启动流式聊天
  app.post("/api/chat/start", async (req, reply) => {
    const body = req.body || {};
    const userMessage = body.message;
    const useMock = !!body.mock;

    if (!userMessage) {
      return reply.code(400).send({ error: "message 必填" });
    }

    try {
      if (useMock) {
        // mock 逻辑简化处理或保留，这里暂时抛出未实现，或者复用原逻辑如果需要
        // 为了重构纯净，建议移除 Mock 或仅保留基本结构
        return reply.send({ error: "Mock mode not supported in refactored version" });
      }

      // 从配置文件获取配置
      const config = await getClaudeConfig();
      const envConfig = buildEnvConfig(config);

      const streamingId = randomUUID();
      const claudePath = config.CLAUDE_PATH;
      const args = [
        "-p",
        userMessage,
        "--output-format",
        "stream-json",
        "--verbose",
      ];

      // 获取服务器地址端口，用于 MCP 配置
      const mcpConfigPath = await ensureMcpConfigFile(streamingId, config.HOST, config.PORT);
      args.push("--mcp-config", mcpConfigPath);
      args.push(
        "--permission-prompt-tool",
        "mcp__permissions__approval_prompt"
      );
      args.push("--allowedTools", "mcp__permissions__approval_prompt");

      const env = {
        ...process.env,
        ...envConfig,
        MCP_STREAMING_ID: streamingId,
      };

      console.log("[chat:start] spawning", {
        streamingId,
        cli: claudePath,
        args,
        mcpConfigPath,
      });

      const child = spawn(claudePath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env,
      });

      // 创建会话
      createSession(streamingId, child);

      // 处理 stdout
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        // console.log("[chat:start] stdout chunk", chunk.length); // 减少日志
        for (const line of chunk.toString().split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            registerPermissionsFromMessage(msg, streamingId);
            sendEvent(streamingId, msg);
          } catch {
            sendEvent(streamingId, { type: "raw", data: trimmed });
          }
        }
      });

      // 处理 stderr
      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk) => {
        console.error("[chat:start] stderr chunk", {
          streamingId,
          length: chunk.length,
        });
        sendEvent(streamingId, { type: "error", stderr: chunk.toString() });
      });

      // 处理退出
      child.on("close", (code) => {
        console.log("[chat:start] process closed", { streamingId, code });
        closeSession(streamingId, code);
        // TODO: 清理 mcpConfigPath 文件
      });

      return {
        streamingId,
        streamUrl: `/api/chat/stream/${streamingId}`,
      };

    } catch (error) {
      console.error("[chat:start] error", error);
      return reply.code(500).send({ error: String(error) });
    }
  });

  // 3. 单次聊天 (Legacy/Non-streaming)
  app.post("/api/chat", async (req, reply) => {
    const body = req.body || {};
    const userMessage = body.message;

    if (!userMessage) {
      return reply.code(400).send({ error: "message 必填" });
    }

    try {
      // 从配置文件获取配置
      const config = await getClaudeConfig();
      const envConfig = buildEnvConfig(config);

      const claudePath = config.CLAUDE_PATH;
      const args = [
        "-p",
        userMessage,
        "--output-format",
        "stream-json",
        "--verbose",
      ];

      const env = { ...process.env, ...envConfig };

      const child = spawn(claudePath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env,
      });

      let rawText = "";
      let stderr = "";
      const events = [];

      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => {
        rawText += chunk.toString();
        for (const line of chunk.toString().split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            events.push(msg);
          } catch { }
        }
      });

      child.stderr?.setEncoding("utf8");
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      // 等待进程结束
      const code = await new Promise((resolve, reject) => {
        child.on("close", resolve);
        child.on("error", reject);
      });

      const replyText = extractTextFromEvents(events) || rawText.trim();

      if (!replyText && stderr) {
        return reply.code(500).send({ error: "Claude CLI Error", detail: stderr });
      }

      return {
        reply: replyText || "(无返回)",
        stderr: stderr || undefined,
        events,
      };

    } catch (error) {
      console.error("[chat] error", error);
      return reply.code(500).send({ error: String(error) });
    }
  });
}

module.exports = { registerChatRoutes };
