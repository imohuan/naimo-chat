const { join } = require("path");
const fastifyStatic = require("@fastify/static");
const { calculateTokenCount } = require("../middleware/routeMiddleware");
const { registerConfigRoutes } = require("./configRoutes");
const { registerUpdateRoutes } = require("./updateRoutes");
const { registerLogRoutes } = require("./logRoutes");
const { registerClipboardWatchRoutes } = require("./clipboardWatch");
const { registerMcpRoutes } = require("./mcpRoutes");
const { registerClaudeRoutes } = require("./claudeRoutes");
const { registerProjectRoutes } = require("./projectRoutes");

function registerApiRoutes(server) {
  const app = server.app;

  // 兼容 Claude 的 token 计数接口
  app.post("/v1/messages/count_tokens", async (req) => {
    const { messages = [], tools = [], system = [] } = req.body || {};
    const tokenCount = calculateTokenCount(messages, system, tools);
    return { input_tokens: tokenCount };
  });

  registerConfigRoutes(server);
  registerUpdateRoutes(server);
  registerLogRoutes(server);
  registerClipboardWatchRoutes(server.app);
  registerMcpRoutes(server);
  registerClaudeRoutes(server);
  registerProjectRoutes(server);

  // 注册静态文件服务
  try {
    // 优先使用嵌入的资源（打包后）
    try {
      const {
        registerEmbeddedStatic,
      } = require("../utils/staticResourceServer");
      registerEmbeddedStatic(app, "/ui/");
      console.log("✅ 使用嵌入的静态资源");
    } catch {
      // 如果嵌入资源不可用，回退到文件系统（开发模式）
      console.log("📁 使用文件系统静态资源（开发模式）");
      const publicPath = join(__dirname, "..", "..", "public");
      app.register(fastifyStatic, {
        root: publicPath,
        prefix: "/ui/",
        maxAge: "1h",
        logLevel: "silent",
      });

      app.get("/ui", async (_, reply) => {
        return reply.redirect("/ui/");
      });
    }
  } catch (error) {
    console.warn("静态文件服务不可用:", error.message);
  }
}

module.exports = { registerApiRoutes };
