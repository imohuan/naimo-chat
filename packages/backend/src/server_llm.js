/**
 * 使用 @musistudio/llms 直接启动路由服务。
 * 参考 claude-code-router-main/src/server.ts 实现
 */
const Server =
  require("@musistudio/llms").default || require("@musistudio/llms");
const { registerApiRoutes } = require("./router/routes");

// 创建服务器
const createServer = (config) => {
  const server = new Server(config);

  // server.app.log.level = "silent";
  const applyCorsHeaders = (request, reply) => {
    // 反射 Origin，避免 credentials + "*" 触发浏览器拦截
    const origin = request.headers.origin;
    const allowOrigin = origin || "*";
    const reqHeaders =
      request.headers["access-control-request-headers"] ||
      "Content-Type,Authorization,Accept,Cache-Control,Last-Event-ID";

    reply.header("Access-Control-Allow-Origin", allowOrigin);
    reply.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    reply.header("Access-Control-Allow-Headers", reqHeaders);
    reply.header("Access-Control-Allow-Credentials", origin ? "true" : "false");
    reply.header("Access-Control-Expose-Headers", "*");
    reply.header("Vary", "Origin");
  };

  // 允许跨域访问（自定义中间件，避免插件超时）
  server.app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply);
    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });

  // 确保所有响应都带上 CORS 头
  server.app.addHook("onSend", async (request, reply, payload) => {
    applyCorsHeaders(request, reply);
    return payload;
  });

  registerApiRoutes(server);
  return server;
};

module.exports = { createServer };
