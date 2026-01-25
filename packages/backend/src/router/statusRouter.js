const {
  getCacheDirectoriesInfo,
  clearCacheDirectory,
  getAllowedCacheDirectories,
} = require("../utils/cacheManager");

/**
 * 注册缓存管理相关路由
 */
function registerStatusRoutes(server) {
  const app = server.app;

  // 获取所有允许的缓存目录列表
  app.get("/api/cache/directories", async (req, reply) => {
    try {
      const directories = getAllowedCacheDirectories();
      return {
        success: true,
        data: directories,
      };
    } catch (error) {
      console.error("获取缓存目录列表失败:", error);
      reply.status(500).send({
        success: false,
        error: "获取缓存目录列表失败",
      });
    }
  });

  // 获取缓存目录信息（文件数量、大小等）
  app.get("/api/cache/info", async (req, reply) => {
    try {
      const info = await getCacheDirectoriesInfo();
      return {
        success: true,
        data: info,
      };
    } catch (error) {
      console.error("获取缓存目录信息失败:", error);
      reply.status(500).send({
        success: false,
        error: "获取缓存目录信息失败",
      });
    }
  });

  // 清空指定缓存目录
  app.delete("/api/cache/clear", async (req, reply) => {
    try {
      const { directory } = req.body;

      if (!directory) {
        reply.status(400).send({
          success: false,
          error: "缺少 directory 参数",
        });
        return;
      }

      const result = await clearCacheDirectory(directory);

      if (!result.success) {
        reply.status(400).send(result);
        return;
      }

      return result;
    } catch (error) {
      console.error("清空缓存目录失败:", error);
      reply.status(500).send({
        success: false,
        error: "清空缓存目录失败",
      });
    }
  });

  // 批量清空多个缓存目录
  app.delete("/api/cache/clear-batch", async (req, reply) => {
    try {
      const { directories } = req.body;

      if (!directories || !Array.isArray(directories)) {
        reply.status(400).send({
          success: false,
          error: "缺少 directories 参数或格式不正确",
        });
        return;
      }

      const results = [];
      for (const directory of directories) {
        const result = await clearCacheDirectory(directory);
        results.push({
          directory,
          ...result,
        });
      }

      const allSuccess = results.every((r) => r.success);

      return {
        success: allSuccess,
        data: results,
      };
    } catch (error) {
      console.error("批量清空缓存目录失败:", error);
      reply.status(500).send({
        success: false,
        error: "批量清空缓存目录失败",
      });
    }
  });
}

module.exports = { registerStatusRoutes };
