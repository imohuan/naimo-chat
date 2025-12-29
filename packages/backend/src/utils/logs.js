const { join } = require("path");
const {
  existsSync,
  readdirSync,
  statSync,
  readFileSync,
  writeFileSync,
} = require("fs");
const { readdir: readdirAsync, unlink: unlinkAsync } = require("fs/promises");
const fs = require("fs");
const os = require("os");
const { createStream } = require("rotating-file-stream");
const { LOGS_DIR, CHAT_MESSAGE_DIR } = require("../config/constants");

/**
 * 获取日志文件列表
 * 扫描日志目录，返回所有 .log 文件的信息，按修改时间倒序排列
 * @returns {Array<{name: string, path: string, size: number, lastModified: string}>} 日志文件信息数组
 * @throws {Error} 当读取目录失败时抛出错误
 */
const getLogFiles = () => {
  try {
    const logDir = LOGS_DIR;
    const logFiles = [];

    if (existsSync(logDir)) {
      const files = readdirSync(logDir);

      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = join(logDir, file);
          const stats = statSync(filePath);

          logFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
          });
        }
      }

      // 按修改时间倒序排列
      logFiles.sort(
        (a, b) =>
          new Date(b.lastModified).getTime() -
          new Date(a.lastModified).getTime()
      );
    }

    return logFiles;
  } catch (error) {
    console.error("Failed to get log files:", error);
    throw error;
  }
};

/**
 * 读取日志内容
 * 读取指定日志文件的内容，按行分割并过滤空行
 * @param {string} [filePath] - 日志文件路径，如果不提供则使用默认路径
 * @returns {Array<string>} 日志行数组
 * @throws {Error} 当读取文件失败时抛出错误
 */
const readLogContent = (filePath) => {
  try {
    let logFilePath;

    if (filePath) {
      logFilePath = filePath;
    } else {
      logFilePath = join(LOGS_DIR, "app.log");
    }

    if (!existsSync(logFilePath)) {
      return [];
    }

    const logContent = readFileSync(logFilePath, "utf8");
    const logLines = logContent.split("\n").filter((line) => line.trim());

    return logLines;
  } catch (error) {
    console.error("Failed to get logs:", error);
    throw error;
  }
};

/**
 * 清除日志内容
 * 清空指定日志文件的内容
 * @param {string} [filePath] - 日志文件路径，如果不提供则使用默认路径
 * @returns {{success: boolean, message: string}} 操作结果对象
 * @throws {Error} 当清除文件失败时抛出错误
 */
const clearLogContent = (filePath) => {
  try {
    let logFilePath;

    if (filePath) {
      logFilePath = filePath;
    } else {
      logFilePath = join(LOGS_DIR, "app.log");
    }

    if (existsSync(logFilePath)) {
      writeFileSync(logFilePath, "", "utf8");
    }

    return { success: true, message: "Logs cleared successfully" };
  } catch (error) {
    console.error("Failed to clear logs:", error);
    throw error;
  }
};

/**
 * 清理日志文件
 * 删除超出数量限制的旧日志文件，只保留最近的指定数量的文件
 * @param {number} [maxFiles=10] - 保留的最大日志文件数量
 * @returns {Promise<void>}
 */
async function cleanupLogFiles(maxFiles = 10) {
  try {
    if (!existsSync(LOGS_DIR)) {
      return;
    }
    const files = await readdirAsync(LOGS_DIR);
    const logFiles = files
      .filter((file) => file.startsWith("ccr-") && file.endsWith(".log"))
      .sort()
      .reverse();

    if (logFiles.length > maxFiles) {
      for (let i = maxFiles; i < logFiles.length; i++) {
        const filePath = join(LOGS_DIR, logFiles[i]);
        try {
          await unlinkAsync(filePath);
        } catch (error) {
          console.warn(`Failed to delete log file ${filePath}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to clean up log files:", error);
  }
}

// ========== Logger 功能 ==========
/**
 * 格式化时间戳
 * 将日期对象格式化为 YYYYMMDDHHmmss 格式的字符串
 * @param {Date} [date=new Date()] - 日期对象，默认为当前时间
 * @returns {string} 格式化后的时间戳字符串
 */
const formatTs = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
};

const logFile = join(LOGS_DIR, `ccr-${formatTs()}.log`);
const baseLogFields = { pid: process.pid, hostname: os.hostname() };

/**
 * 清理对象
 * 递归清理对象中的 undefined 值，用于日志记录前的数据清理
 * @param {*} obj - 需要清理的对象
 * @returns {*} 清理后的对象，如果值为 undefined 则返回 undefined
 */
const sanitize = (obj) => {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const arr = obj.map(sanitize).filter((v) => v !== undefined);
    return arr;
  }
  if (typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = sanitize(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return obj;
};

/**
 * 写入日志
 * 将日志条目以 JSON 格式追加到日志文件中
 * @param {number} level - 日志级别（20=debug, 30=info, 40=warn, 50=error）
 * @param {string} [msg] - 日志消息
 * @param {Object} [extra={}] - 额外的日志字段
 * @returns {Promise<void>}
 */
const writeLog = async (level, msg, extra = {}) => {
  const entry = sanitize({
    level,
    time: Date.now(),
    ...baseLogFields,
    ...(msg ? { msg } : {}),
    ...extra,
  });

  const line = JSON.stringify(entry);
  try {
    await fs.promises.appendFile(logFile, `${line}\n`, "utf8");
  } catch (err) {
    try {
      fs.writeSync(
        process.stderr.fd,
        `[logger] 写入日志失败: ${err.message}\n`
      );
    } catch {
      /* noop */
    }
  }
};

/**
 * 构建日志记录器
 * 创建一个带有上下文的日志记录器对象
 * @param {Object} [context={}] - 日志上下文对象，会合并到每条日志中
 * @returns {Object} 日志记录器对象，包含以下方法：
 *   - {Function} debug - 记录调试级别日志 (level: 20)
 *   - {Function} info - 记录信息级别日志 (level: 30)
 *   - {Function} warn - 记录警告级别日志 (level: 40)
 *   - {Function} error - 记录错误级别日志 (level: 50)
 *   - {Function} child - 创建子日志记录器，继承当前上下文并添加新的上下文
 */
const buildLogger = (context = {}) => {
  const mergeCtx = (payload = {}) => ({ ...context, ...payload });
  return {
    debug: (msg, extra) => writeLog(20, msg, mergeCtx(extra)),
    info: (msg, extra) => writeLog(30, msg, mergeCtx(extra)),
    warn: (msg, extra) => writeLog(40, msg, mergeCtx(extra)),
    error: (msg, extra) => writeLog(50, msg, mergeCtx(extra)),
    child: (childCtx = {}) => buildLogger({ ...context, ...childCtx }),
  };
};

const logger = buildLogger();

/**
 * 创建日志配置
 * 根据配置对象创建 rotating-file-stream 日志配置（供 @musistudio/llms 使用）
 * @param {Object} config - 配置对象，包含 LOG 和 LOG_LEVEL 属性
 * @param {string} homeDir - 主目录路径，日志文件将存储在此目录
 * @returns {Object|false} 日志配置对象，如果 LOG 为 false 则返回 false
 */
const createLoggerConfig = (config, homeDir) => {
  const pad = (num) => (num > 9 ? "" : "0") + num;
  const generator = (time, index) => {
    if (!time) {
      time = new Date();
    }
    const month = time.getFullYear() + "" + pad(time.getMonth() + 1);
    const day = pad(time.getDate());
    const hour = pad(time.getHours());
    const minute = pad(time.getMinutes());
    return `./logs/ccr-${month}${day}${hour}${minute}${pad(time.getSeconds())}${index ? `_${index}` : ""
      }.log`;
  };

  return config.LOG !== false
    ? {
      level: config.LOG_LEVEL || "debug",
      stream: createStream(generator, {
        path: homeDir,
        maxFiles: 3,
        interval: "1d",
        compress: false,
        maxSize: "50M",
      }),
    }
    : false;
};

// ========== 消息日志功能 ==========
/**
 * 获取消息日志列表
 * 扫描消息日志目录，返回所有对话的信息，按时间倒序排列
 * @param {Object} options - 选项
 * @param {number} options.limit - 返回的最大数量（默认：100）
 * @param {number} options.offset - 偏移量（默认：0）
 * @returns {Array<{requestId: string, timestamp: string, model: string, hasRequest: boolean, hasResponse: boolean, hasStreamResponse: boolean}>} 消息列表
 * @throws {Error} 当读取目录失败时抛出错误
 */
const getMessageList = (options = {}) => {
  try {
    const { limit = 100, offset = 0 } = options;
    const messageDir = CHAT_MESSAGE_DIR;
    const messageMap = new Map();

    if (!existsSync(messageDir)) {
      return [];
    }

    const files = readdirSync(messageDir);

    // 遍历所有文件，提取 requestId
    for (const file of files) {
      let requestId = null;
      let fileType = null;

      // 匹配格式：{requestId}-req.json, {requestId}-res.md, {requestId}-res-full.jsonl
      const reqMatch = file.match(/^(.+)-req\.json$/);
      const resMdMatch = file.match(/^(.+)-res\.md$/);
      const resFullMatch = file.match(/^(.+)-res-full\.jsonl$/);

      if (reqMatch) {
        requestId = reqMatch[1];
        fileType = "request";
      } else if (resMdMatch) {
        requestId = resMdMatch[1];
        fileType = "response";
      } else if (resFullMatch) {
        requestId = resFullMatch[1];
        fileType = "streamResponse";
      }

      if (requestId) {
        if (!messageMap.has(requestId)) {
          messageMap.set(requestId, {
            requestId,
            hasRequest: false,
            hasResponse: false,
            hasStreamResponse: false,
            timestamp: null,
            model: null,
            lastModified: null,
          });
        }

        const message = messageMap.get(requestId);
        const filePath = join(messageDir, file);
        const stats = statSync(filePath);

        if (fileType === "request") {
          message.hasRequest = true;
          // 尝试读取请求文件获取时间戳和模型信息
          try {
            const requestData = JSON.parse(readFileSync(filePath, "utf8"));
            message.timestamp = requestData.timestamp || stats.mtime.toISOString();
            message.model = requestData.body?.model || null;
          } catch {
            message.timestamp = stats.mtime.toISOString();
          }
        } else if (fileType === "response") {
          message.hasResponse = true;
        } else if (fileType === "streamResponse") {
          message.hasStreamResponse = true;
        }

        // 更新最后修改时间（取最新的）
        if (!message.lastModified || stats.mtime > new Date(message.lastModified)) {
          message.lastModified = stats.mtime.toISOString();
        }
      }
    }

    // 转换为数组并按时间倒序排列
    const messageList = Array.from(messageMap.values())
      .filter((msg) => msg.hasRequest) // 只返回有请求文件的对话
      .sort((a, b) => {
        const timeA = new Date(a.timestamp || a.lastModified).getTime();
        const timeB = new Date(b.timestamp || b.lastModified).getTime();
        return timeB - timeA;
      });

    // 应用分页
    return messageList.slice(offset, offset + limit);
  } catch (error) {
    console.error("Failed to get message list:", error);
    throw error;
  }
};

/**
 * 获取消息详情
 * 根据 requestId 获取完整的对话信息（包括请求和响应）
 * @param {string} requestId - 请求 ID
 * @returns {Object|null} 消息详情对象，包含请求、响应等信息，如果不存在则返回 null
 * @throws {Error} 当读取文件失败时抛出错误
 */
const getMessageDetail = (requestId) => {
  try {
    const messageDir = CHAT_MESSAGE_DIR;
    const requestFile = join(messageDir, `${requestId}-req.json`);
    const responseMdFile = join(messageDir, `${requestId}-res.md`);
    const responseFullFile = join(messageDir, `${requestId}-res-full.jsonl`);

    const result = {
      requestId,
      request: null,
      response: {
        content: null, // Markdown 格式的响应内容
        full: null, // 完整的响应数据（JSONL 格式，流式响应）
        isStream: false,
      },
    };

    // 读取请求文件
    if (existsSync(requestFile)) {
      try {
        const requestContent = readFileSync(requestFile, "utf8");
        result.request = JSON.parse(requestContent);
      } catch (error) {
        console.error(`Failed to parse request file for ${requestId}:`, error);
        result.request = { error: "Failed to parse request file" };
      }
    }

    // 读取响应内容文件（Markdown）
    if (existsSync(responseMdFile)) {
      try {
        result.response.content = readFileSync(responseMdFile, "utf8");
      } catch (error) {
        console.error(`Failed to read response content file for ${requestId}:`, error);
      }
    }

    // 读取完整响应文件（JSONL）
    if (existsSync(responseFullFile)) {
      try {
        const fullContent = readFileSync(responseFullFile, "utf8");
        const lines = fullContent
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter((item) => item !== null);

        result.response.full = lines;
        result.response.isStream = lines.length > 0 && lines[0].type !== undefined;
      } catch (error) {
        console.error(`Failed to parse response full file for ${requestId}:`, error);
      }
    }

    // 如果没有任何数据，返回 null
    if (!result.request && !result.response.content && !result.response.full) {
      return null;
    }

    return result;
  } catch (error) {
    console.error(`Failed to get message detail for ${requestId}:`, error);
    throw error;
  }
};

module.exports = {
  getLogFiles,
  readLogContent,
  clearLogContent,
  cleanupLogFiles,
  logger,
  createLoggerConfig,
  getMessageList,
  getMessageDetail,
};
