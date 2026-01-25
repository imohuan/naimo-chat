const {
  getLogFiles,
  readLogContent,
  clearLogContent,
  getMessageList,
  getMessageDetail,
  deleteMessages,
} = require("../utils/logs");
const mcpLogger = require("../mcp/mcpLogger");

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

      const filteredLines = logLines

      // 过滤条件（使用正则表达式，性能更好）：
      // 1. 过滤掉包含 "/api/event_logging/batch" 的日志
      // 2. 只保留包含 "reqId" 的日志
      // const eventLoggingBatchRegex = /\/api\/event_logging\/batch/;
      // const reqIdRegex = /"reqId"\s*:/;
      // const filteredLines = logLines.filter((line) => {
      //   // 使用正则表达式匹配，避免 JSON.parse 的性能开销
      //   // 如果包含 "/api/event_logging/batch"，则过滤掉
      //   if (eventLoggingBatchRegex.test(line)) {
      //     return false;
      //   }

      //   // 如果没有 "reqId" 字段，则过滤掉
      //   if (!reqIdRegex.test(line)) {
      //     return false;
      //   }

      //   // {"level":30,"time":1765285262047,"pid":29876,"hostname":"DESKTOP-N9MLUA2","reqId":"req-3","req":{"method":"OPTIONS","url":"/health","host":"127.0.0.1:3457","remoteAddress":"127.0.0.1","remotePort":51186},"msg":"incoming request"}
      //   // 过滤 method是 options的
      //   const optionsMethodRegex = /"method"\s*:\s*"OPTIONS"/i;
      //   if (optionsMethodRegex.test(line)) {
      //     return false;
      //   }

      //   return true;
      // });

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

  // ========== 消息日志接口 ==========

  // 获取对话列表
  app.get("/api/messages", async (req, reply) => {
    try {
      const limit = parseInt(req.query?.limit) || 100;
      const offset = parseInt(req.query?.offset) || 0;

      const result = getMessageList({ limit, offset });
      return {
        messages: result.messages,
        total: result.total,
        limit,
        offset,
      };
    } catch (error) {
      console.error("获取对话列表失败:", error);
      reply.status(500).send({ error: "获取对话列表失败" });
    }
  });

  // 获取具体对话详情
  app.get("/api/messages/:requestId", async (req, reply) => {
    try {
      const { requestId } = req.params;
      const messageDetail = getMessageDetail(requestId);

      if (!messageDetail) {
        reply.status(404).send({ error: "对话不存在" });
        return;
      }

      return messageDetail;
    } catch (error) {
      console.error("获取对话详情失败:", error);
      reply.status(500).send({ error: "获取对话详情失败" });
    }
  });

  // 删除消息
  app.delete("/api/messages", async (req, reply) => {
    try {
      const { requestIds } = req.body;

      if (!requestIds) {
        reply.status(400).send({ error: "缺少 requestIds 参数" });
        return;
      }

      const ids = Array.isArray(requestIds) ? requestIds : [requestIds];
      if (ids.length === 0) {
        reply.status(400).send({ error: "requestIds 不能为空" });
        return;
      }

      const result = deleteMessages(ids);
      return result;
    } catch (error) {
      console.error("删除消息失败:", error);
      reply.status(500).send({ error: "删除消息失败" });
    }
  });

  // ========== MCP 工具调用日志接口 ==========

  // 获取 MCP 工具调用列表
  app.get("/api/mcp/tool-calls", async (req, reply) => {
    try {
      const limit = parseInt(req.query?.limit) || 50;
      const offset = parseInt(req.query?.offset) || 0;
      const toolName = req.query?.toolName;
      const serverName = req.query?.serverName;
      const success = req.query?.success !== undefined
        ? req.query.success === "true"
        : undefined;
      const startTime = req.query?.startTime
        ? parseInt(req.query.startTime)
        : undefined;
      const endTime = req.query?.endTime
        ? parseInt(req.query.endTime)
        : undefined;

      const result = mcpLogger.queryToolCalls({
        limit,
        offset,
        toolName,
        serverName,
        success,
        startTime,
        endTime
      });

      return result;
    } catch (error) {
      console.error("获取 MCP 工具调用列表失败:", error);
      reply.status(500).send({ error: "获取 MCP 工具调用列表失败" });
    }
  });

  // 获取 MCP 工具调用详情
  app.get("/api/mcp/tool-calls/:logId", async (req, reply) => {
    try {
      const { logId } = req.params;
      const detail = mcpLogger.getToolCallDetail(logId);

      if (!detail) {
        reply.status(404).send({ error: "工具调用日志不存在" });
        return;
      }

      return detail;
    } catch (error) {
      console.error("获取 MCP 工具调用详情失败:", error);
      reply.status(500).send({ error: "获取 MCP 工具调用详情失败" });
    }
  });

  // 删除 MCP 工具调用日志
  app.delete("/api/mcp/tool-calls", async (req, reply) => {
    try {
      const { logIds } = req.body;

      if (!logIds) {
        reply.status(400).send({ error: "缺少 logIds 参数" });
        return;
      }

      const ids = Array.isArray(logIds) ? logIds : [logIds];
      if (ids.length === 0) {
        reply.status(400).send({ error: "logIds 不能为空" });
        return;
      }

      const result = mcpLogger.deleteToolCalls(ids);
      return result;
    } catch (error) {
      console.error("删除 MCP 工具调用日志失败:", error);
      reply.status(500).send({ error: "删除 MCP 工具调用日志失败" });
    }
  });

  // 清空所有 MCP 工具调用日志
  app.delete("/api/mcp/tool-calls/all", async (req, reply) => {
    try {
      const result = mcpLogger.clearAllToolCalls();
      return result;
    } catch (error) {
      console.error("清空 MCP 工具调用日志失败:", error);
      reply.status(500).send({ error: "清空 MCP 工具调用日志失败" });
    }
  });

  // 获取 MCP 工具调用统计信息
  app.get("/api/mcp/tool-calls/stats", async (req, reply) => {
    try {
      const stats = mcpLogger.getStatistics();
      return stats;
    } catch (error) {
      console.error("获取 MCP 工具调用统计信息失败:", error);
      reply.status(500).send({ error: "获取 MCP 工具调用统计信息失败" });
    }
  });
}

module.exports = { registerLogRoutes };
