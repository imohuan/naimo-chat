const { registerChatRoutes } = require("./chatRoutes");
const { registerPermissionRoutes } = require("./permissionRoutes");

/**
 * 注册 Chat 模块的所有路由
 * @param {import('fastify').FastifyInstance} server 
 */
function registerChatModuleRoutes(server) {
  registerChatRoutes(server);
  registerPermissionRoutes(server);
  console.log("✅ Chat Module Routes registered (prefix: /api/chat)");
}

module.exports = { registerChatModuleRoutes };
