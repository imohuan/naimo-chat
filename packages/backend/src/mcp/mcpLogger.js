const fs = require("fs");
const path = require("path");
const { MCP_TOOL_CALL_LOG_DIR } = require("../config/constants");

class McpLogger {
  constructor() {
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(MCP_TOOL_CALL_LOG_DIR)) {
      fs.mkdirSync(MCP_TOOL_CALL_LOG_DIR, { recursive: true });
    }
  }

  /**
   * 记录工具调用
   * @param {Object} logData - 日志数据
   * @param {string} logData.toolName - 工具名称
   * @param {string} logData.serverName - 服务器名称
   * @param {Object} logData.arguments - 工具参数
   * @param {Object} logData.result - 工具执行结果
   * @param {Error} logData.error - 错误信息（如果有）
   * @param {number} logData.duration - 执行时长（毫秒）
   * @param {string} logData.sessionId - 会话ID
   */
  logToolCall(logData) {
    try {
      const timestamp = Date.now();
      const logId = `${timestamp}_${logData.toolName}_${Math.random().toString(36).substring(7)}`;
      const logFile = path.join(MCP_TOOL_CALL_LOG_DIR, `${logId}.json`);

      const logEntry = {
        id: logId,
        timestamp,
        date: new Date(timestamp).toISOString(),
        toolName: logData.toolName,
        serverName: logData.serverName,
        sessionId: logData.sessionId || null,
        arguments: logData.arguments || {},
        result: logData.result || null,
        error: logData.error ? {
          message: logData.error.message,
          code: logData.error.code,
          stack: logData.error.stack
        } : null,
        duration: logData.duration || 0,
        success: !logData.error
      };

      fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2), "utf8");
      console.log(`[McpLogger] 工具调用日志已保存: ${logFile}`);
    } catch (error) {
      console.error("[McpLogger] 保存工具调用日志失败:", error);
    }
  }

  /**
   * 查询工具调用日志
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 返回数量限制
   * @param {number} options.offset - 偏移量
   * @param {string} options.toolName - 按工具名称过滤
   * @param {string} options.serverName - 按服务器名称过滤
   * @param {boolean} options.success - 按成功/失败过滤
   * @param {number} options.startTime - 开始时间戳
   * @param {number} options.endTime - 结束时间戳
   * @returns {Object} 查询结果
   */
  queryToolCalls(options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        toolName,
        serverName,
        success,
        startTime,
        endTime
      } = options;

      // 读取所有日志文件
      const files = fs.readdirSync(MCP_TOOL_CALL_LOG_DIR)
        .filter(f => f.endsWith(".json"))
        .sort()
        .reverse(); // 最新的在前

      let logs = [];
      for (const file of files) {
        try {
          const filePath = path.join(MCP_TOOL_CALL_LOG_DIR, file);
          const content = fs.readFileSync(filePath, "utf8");
          const log = JSON.parse(content);

          // 应用过滤条件
          if (toolName && log.toolName !== toolName) continue;
          if (serverName && log.serverName !== serverName) continue;
          if (success !== undefined && log.success !== success) continue;
          if (startTime && log.timestamp < startTime) continue;
          if (endTime && log.timestamp > endTime) continue;

          logs.push(log);
        } catch (error) {
          console.error(`[McpLogger] 读取日志文件失败 ${file}:`, error);
        }
      }

      const total = logs.length;
      const paginatedLogs = logs.slice(offset, offset + limit);

      return {
        logs: paginatedLogs,
        total,
        limit,
        offset
      };
    } catch (error) {
      console.error("[McpLogger] 查询工具调用日志失败:", error);
      return {
        logs: [],
        total: 0,
        limit,
        offset
      };
    }
  }

  /**
   * 获取工具调用详情
   * @param {string} logId - 日志ID
   * @returns {Object|null} 日志详情
   */
  getToolCallDetail(logId) {
    try {
      const files = fs.readdirSync(MCP_TOOL_CALL_LOG_DIR)
        .filter(f => f.startsWith(logId) && f.endsWith(".json"));

      if (files.length === 0) {
        return null;
      }

      const filePath = path.join(MCP_TOOL_CALL_LOG_DIR, files[0]);
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`[McpLogger] 获取工具调用详情失败 ${logId}:`, error);
      return null;
    }
  }

  /**
   * 删除工具调用日志
   * @param {string[]} logIds - 日志ID数组
   * @returns {Object} 删除结果
   */
  deleteToolCalls(logIds) {
    try {
      let deletedCount = 0;
      const errors = [];

      for (const logId of logIds) {
        try {
          const files = fs.readdirSync(MCP_TOOL_CALL_LOG_DIR)
            .filter(f => f.startsWith(logId) && f.endsWith(".json"));

          for (const file of files) {
            const filePath = path.join(MCP_TOOL_CALL_LOG_DIR, file);
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (error) {
          errors.push({ logId, error: error.message });
        }
      }

      return {
        success: true,
        deletedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error("[McpLogger] 删除工具调用日志失败:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 清空所有工具调用日志
   * @returns {Object} 清空结果
   */
  clearAllToolCalls() {
    try {
      const files = fs.readdirSync(MCP_TOOL_CALL_LOG_DIR)
        .filter(f => f.endsWith(".json"));

      let deletedCount = 0;
      for (const file of files) {
        const filePath = path.join(MCP_TOOL_CALL_LOG_DIR, file);
        fs.unlinkSync(filePath);
        deletedCount++;
      }

      return {
        success: true,
        deletedCount
      };
    } catch (error) {
      console.error("[McpLogger] 清空工具调用日志失败:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStatistics() {
    try {
      const files = fs.readdirSync(MCP_TOOL_CALL_LOG_DIR)
        .filter(f => f.endsWith(".json"));

      const stats = {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        toolStats: {},
        serverStats: {}
      };

      for (const file of files) {
        try {
          const filePath = path.join(MCP_TOOL_CALL_LOG_DIR, file);
          const content = fs.readFileSync(filePath, "utf8");
          const log = JSON.parse(content);

          stats.totalCalls++;
          if (log.success) {
            stats.successCalls++;
          } else {
            stats.failedCalls++;
          }

          // 工具统计
          if (!stats.toolStats[log.toolName]) {
            stats.toolStats[log.toolName] = { total: 0, success: 0, failed: 0 };
          }
          stats.toolStats[log.toolName].total++;
          if (log.success) {
            stats.toolStats[log.toolName].success++;
          } else {
            stats.toolStats[log.toolName].failed++;
          }

          // 服务器统计
          if (!stats.serverStats[log.serverName]) {
            stats.serverStats[log.serverName] = { total: 0, success: 0, failed: 0 };
          }
          stats.serverStats[log.serverName].total++;
          if (log.success) {
            stats.serverStats[log.serverName].success++;
          } else {
            stats.serverStats[log.serverName].failed++;
          }
        } catch (error) {
          console.error(`[McpLogger] 读取统计信息失败 ${file}:`, error);
        }
      }

      return stats;
    } catch (error) {
      console.error("[McpLogger] 获取统计信息失败:", error);
      return {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        toolStats: {},
        serverStats: {}
      };
    }
  }
}

module.exports = new McpLogger();
