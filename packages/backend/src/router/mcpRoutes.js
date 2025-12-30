const configService = require("../mcp/configService");
const mcpService = require("../mcp/mcpService");
const transportService = require("../mcp/transportService");

function registerMcpRoutes(server) {
  const app = server.app;

  const applyMcpCors = (req, reply) => {
    const origin = req.headers.origin || req.headers.referer || "*";
    const allowCredentials = origin && origin !== "*" ? "true" : "false";
    const reqHeaders =
      req.headers["access-control-request-headers"] ||
      "Content-Type,Authorization,Accept,Cache-Control,Last-Event-ID";

    reply.header("Access-Control-Allow-Origin", origin || "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Headers", reqHeaders);
    reply.header("Access-Control-Allow-Credentials", allowCredentials);
    reply.header("Access-Control-Expose-Headers", "*");
    reply.header("Vary", "Origin");

    // hijack 场景需要直接写 raw
    if (reply.raw && typeof reply.raw.setHeader === "function") {
      reply.raw.setHeader("Access-Control-Allow-Origin", origin || "*");
      reply.raw.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      reply.raw.setHeader("Access-Control-Allow-Headers", reqHeaders);
      reply.raw.setHeader("Access-Control-Allow-Credentials", allowCredentials);
      reply.raw.setHeader("Access-Control-Expose-Headers", "*");
      reply.raw.setHeader("Vary", "Origin");
    }
  };

  // 启动时初始化上游服务器（非阻塞，在后台执行）
  mcpService.initUpstreamServers().catch((error) => {
    console.error("初始化上游 MCP 服务器失败:", error);
  });

  // 允许访问（自定义中间件 为了避免 llm 服务的默认行为，只要是 post 或 /api 开头的请求，都添加 model 字段）
  // 后续我还对model进行了删除否则可能会导致错误
  app.addHook("preHandler", async (request, _reply) => {
    // 注意：对于 /mcp/:group/messages 路由，不要访问 request.body
    // 因为该路由需要从原始请求流中读取请求体（用于 SSE handlePostMessage）
    if (request.url.startsWith("/mcp/") && request.method === "POST") {
      // 只在非 messages 端点设置 model
      if (request.body) request.body.model = "xxx";
    }
  });

  // API：获取整体 MCP 配置
  app.get("/api/mcp/config", async (_req, _reply) => {
    return configService.getConfig();
  });

  // API：设置整体 MCP 配置（重载所有 MCP 连接）
  app.put("/api/mcp/config", async (req, reply) => {
    try {
      const updatedConfig = configService.setConfig(req.body || {});
      await mcpService.disconnectAllUpstreams();
      await mcpService.initUpstreamServers();
      return { success: true, config: updatedConfig };
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  // API：获取所有服务器
  app.get("/api/mcp/servers", async (_req, _reply) => {
    return configService.getAllServers();
  });

  // API：获取单个服务器
  app.get("/api/mcp/servers/:name", async (req, reply) => {
    const config = configService.getServer(req.params.name);
    if (!config) {
      reply.code(404).send({ error: "服务器未找到" });
      return;
    }
    return config;
  });

  // API：创建服务器
  app.post("/api/mcp/servers", async (req, reply) => {
    const { name, config } = req.body;
    try {
      const savedConfig = configService.createServer(name, config);
      try {
        // 连接逻辑由 connectToUpstream 内部根据 enabled 决定
        await mcpService.connectToUpstream(name, savedConfig);
        return { success: true, config: configService.getServer(name) };
      } catch (err) {
        // 启动失败则断开连接并将该服务器配置为禁用状态
        const revertedConfig = {
          ...savedConfig,
          enabled: false,
        };
        configService.updateServer(name, revertedConfig);
        await mcpService.disconnectUpstream(name);
        return {
          success: false,
          config: configService.getServer(name),
          error: err.message,
        };
      }
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  // API：更新服务器
  app.put("/api/mcp/servers/:name", async (req, reply) => {
    const { config } = req.body;
    try {
      const name = req.params.name;
      const updatedConfig = configService.updateServer(name, config);
      const isEnabled = updatedConfig.enabled !== false;

      // 动态开关逻辑
      if (!isEnabled) {
        await mcpService.disconnectUpstream(name);
        return { success: true, config: configService.getServer(name) };
      }

      try {
        // 确保先断开再重连，涵盖从关闭到开启的情况
        await mcpService.disconnectUpstream(name);
        await mcpService.connectToUpstream(name, updatedConfig);
        return { success: true, config: configService.getServer(name) };
      } catch (err) {
        // 启用失败时，强制回滚为禁用状态并返回最新配置
        const revertedConfig = {
          ...updatedConfig,
          enabled: false,
        };
        configService.updateServer(name, revertedConfig);
        await mcpService.disconnectUpstream(name);
        return {
          success: false,
          config: configService.getServer(name),
          error: err.message,
        };
      }
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  // API：删除服务器
  app.delete("/api/mcp/servers/:name", async (req, reply) => {
    try {
      configService.deleteServer(req.params.name);
      // 断开连接逻辑
      await mcpService.disconnectUpstream(req.params.name);
      return { success: true };
    } catch (error) {
      reply.code(400).send({ error: error.message });
    }
  });

  // API：获取指定服务器的工具列表（直接获取，不通过 SSE）
  app.get("/api/mcp/servers/:name/tools", async (req, reply) => {
    try {
      const serverName = req.params.name;

      // 检查服务器是否存在
      const config = configService.getServer(serverName);
      if (!config) {
        reply.code(404).send({ error: "服务器未找到" });
        return;
      }

      // 检查服务器是否已连接
      const tools = mcpService.getServerTools(serverName);

      // 如果工具列表为空且服务器已启用，尝试刷新
      if (tools.length === 0 && config.enabled !== false) {
        try {
          const refreshedTools = await mcpService.refreshServerTools(serverName);
          return { tools: refreshedTools };
        } catch (error) {
          // 刷新失败，返回空列表
          console.warn(`获取服务器 ${serverName} 的工具列表失败:`, error);
          return { tools: [] };
        }
      }

      return { tools };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  // API：刷新指定服务器的工具列表
  app.post("/api/mcp/servers/:name/tools/refresh", async (req, reply) => {
    try {
      const serverName = req.params.name;

      // 检查服务器是否存在
      const config = configService.getServer(serverName);
      if (!config) {
        reply.code(404).send({ error: "服务器未找到" });
        return;
      }

      // 检查服务器是否已连接
      const tools = await mcpService.refreshServerTools(serverName);

      return { success: true, tools };
    } catch (error) {
      reply.code(500).send({ error: error.message });
    }
  });

  app.get("/mcp/:group", async (req, reply) => {
    applyMcpCors(req, reply);

    const sessionId = transportService.getSessionId(req);
    const mcpServer = await mcpService.getMcpServer(
      sessionId,
      req.params.group
    );
    // handleSSEConnection 处理响应
    await transportService.handleSSEConnection(
      req,
      reply,
      mcpServer,
      sessionId
    );
  });

  // 错误处理辅助函数
  const handleError = (error, req, reply, context) => {
    console.error(
      `[${context}] 处理组 ${req.params.group} 的路由时出错:`,
      error
    );
    if (!reply.hijacked) {
      reply.code(500).send({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: `内部错误: ${error.message}`,
        },
        id: null,
      });
    } else {
      transportService.sendErrorResponse(
        reply.raw,
        500,
        -32000,
        `内部错误: ${error.message}`,
        null
      );
    }
  };

  app.post(
    "/mcp/:group/messages",
    {
      // 禁用 Fastify 的自动响应处理，让 SSE transport 完全控制
      disableRequestLogging: true,
      schema: {
        headers: {},
        body: {},
      },
    },
    async (req, reply) => {
      try {
        applyMcpCors(req, reply);

        // 客户端在此处发送消息（JSON-RPC） 使用 hijack 来完全控制响应，避免 Fastify 自动处理
        reply.hijack();
        // handleHTTPMessage 会使用 getBody() 方法处理请求体
        await transportService.handleHTTPMessage(req, reply);
      } catch (error) {
        handleError(error, req, reply, "SSE Message Route");
      }
    }
  );

  // MCP：StreamableHTTP 端点
  app.post(
    "/mcp/:group",
    {
      // 禁用 Fastify 的自动响应处理，让 StreamableHTTPServerTransport 完全控制
      disableRequestLogging: true,
      // 注意：Fastify 会自动解析 JSON body，但 req.raw 的流应该仍然可用
      // StreamableHTTPServerTransport.handleRequest 会从 req.raw 读取请求体
      // 允许任何 Content-Type，避免 406 错误
      schema: {
        headers: {},
        body: {},
      },
    },
    async (req, reply) => {
      try {
        // 在 hijack() 之前，尝试获取请求体（如果 Fastify 已经解析） 这对于判断是否是 initialize 请求很重要
        const requestBody = req.body || null;
        // 删除 body.model 字段（如果存在），因为 MCP 协议不允许额外字段 这可能是由 preHandler hook 添加的
        if (requestBody) delete requestBody.model;

        // 使用 hijack 来完全控制响应，避免 Fastify 自动设置编码
        // 必须在处理任何响应之前调用，在任何其他操作之前
        reply.hijack();

        // TODO: 每次请求都生成一个新的 sessionId，这导致重复创建非常多的会话
        const sessionId = transportService.getSessionId(
          req,
          "global-sessionid"
        );
        console.log(`[StreamableHTTP] 路由中的会话ID: ${sessionId}`);

        // 将 sessionId 添加到请求头中，这样 handleStreamableHTTP 可以获取到
        // 如果请求头中已经有 sessionId，则使用已有的；否则使用路由中生成的
        if (!req.headers["mcp-session-id"] && !req.headers["x-session-id"]) {
          req.headers["mcp-session-id"] = sessionId;
        }

        const mcpServer = await mcpService.getMcpServer(
          sessionId,
          req.params.group
        );

        // handleStreamableHTTP 处理响应，传递已解析的 body（如果可用）和 sessionId
        await transportService.handleStreamableHTTP(
          req,
          reply,
          mcpServer,
          requestBody,
          sessionId
        );
      } catch (error) {
        handleError(error, req, reply, "StreamableHTTP");
      }
    }
  );
}

module.exports = { registerMcpRoutes };
