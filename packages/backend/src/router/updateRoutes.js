const { join } = require("path");
const { writeFileSync } = require("fs");
const { RESTART_SIGNAL_FILE } = require("../config/constants");

function registerUpdateRoutes(server) {
  const app = server.app;

  // 重启服务端点
  app.post("/api/restart", { logLevel: "silent" }, async (req, reply) => {
    reply.send({ success: true, message: "服务重启已启动" });
    try {
      writeFileSync(RESTART_SIGNAL_FILE, Date.now().toString(), "utf8");
      console.log("已发送重启信号到主进程");
    } catch (error) {
      console.error("发送重启信号失败:", error);
    }
  });

  // 版本检查端点
  app.get("/api/update/check", { logLevel: "silent" }, async (req, reply) => {
    try {
      const packageJson = require(join(__dirname, "..", "..", "package.json"));
      const currentVersion = packageJson.version;
      return {
        hasUpdate: false,
        latestVersion: currentVersion,
        changelog: undefined,
      };
    } catch (error) {
      console.error("检查更新失败:", error);
      reply.status(500).send({ error: "检查更新失败" });
    }
  });

  // 执行更新端点
  app.post(
    "/api/update/perform",
    { logLevel: "silent" },
    async (req, reply) => {
      try {
        return { success: true, message: "更新执行成功" };
      } catch (error) {
        console.error("执行更新失败:", error);
        reply.status(500).send({ error: "执行更新失败" });
      }
    }
  );
}

module.exports = { registerUpdateRoutes };
