const {
  getLogFiles,
  readLogContent,
  clearLogContent,
} = require("../utils/logs");

function registerLogRoutes(server) {
  const app = server.app;

  // 获取日志文件列表
  app.get("/api/logs/files", async (req, reply) => {
    try {
      const logFiles = getLogFiles();
      return logFiles;
    } catch (error) {
      console.error("获取日志文件列表失败:", error);
      reply.status(500).send({ error: "获取日志文件列表失败" });
    }
  });

  // 获取日志内容
  app.get("/api/logs", async (req, reply) => {
    try {
      const filePath = req.query?.file;
      const logLines = readLogContent(filePath);

      // 过滤条件（使用正则表达式，性能更好）：
      // 1. 过滤掉包含 "/api/event_logging/batch" 的日志
      // 2. 只保留包含 "reqId" 的日志
      const eventLoggingBatchRegex = /\/api\/event_logging\/batch/;
      const reqIdRegex = /"reqId"\s*:/;
      const filteredLines = logLines.filter((line) => {
        // 使用正则表达式匹配，避免 JSON.parse 的性能开销
        // 如果包含 "/api/event_logging/batch"，则过滤掉
        if (eventLoggingBatchRegex.test(line)) {
          return false;
        }

        // 如果没有 "reqId" 字段，则过滤掉
        if (!reqIdRegex.test(line)) {
          return false;
        }

        // {"level":30,"time":1765285262047,"pid":29876,"hostname":"DESKTOP-N9MLUA2","reqId":"req-3","req":{"method":"OPTIONS","url":"/health","host":"127.0.0.1:3457","remoteAddress":"127.0.0.1","remotePort":51186},"msg":"incoming request"}
        // 过滤 method是 options的
        const optionsMethodRegex = /"method"\s*:\s*"OPTIONS"/i;
        if (optionsMethodRegex.test(line)) {
          return false;
        }

        return true;
      });

      // 解析查询参数
      const offset = parseInt(req.query?.offset) || 0; // 默认从最后开始
      const size = parseInt(req.query?.size) || 1000; // 默认返回1000行

      // 确保参数有效
      const validOffset = Math.max(0, offset);
      const validSize = Math.max(1, Math.min(size, 10000)); // 限制最大10000行

      // 计算切片范围（从末尾开始）
      const totalLines = filteredLines.length;
      const startIndex = Math.max(0, totalLines - validOffset - validSize);
      const endIndex = totalLines - validOffset;

      // return filteredLines;
      // 返回指定范围的行
      const result = filteredLines.slice(startIndex, endIndex);
      return result;
    } catch (error) {
      console.error("获取日志内容失败:", error);
      reply.status(500).send({ error: "获取日志内容失败" });
    }
  });

  // 清除日志内容
  app.delete("/api/logs", async (req, reply) => {
    try {
      const filePath = req.query?.file;
      const result = clearLogContent(filePath);
      return result;
    } catch (error) {
      console.error("清除日志失败:", error);
      reply.status(500).send({ error: "清除日志失败" });
    }
  });
}

module.exports = { registerLogRoutes };
