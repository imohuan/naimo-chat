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
const { LOGS_DIR } = require("../config/constants");

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
    return `./logs/ccr-${month}${day}${hour}${minute}${pad(time.getSeconds())}${
      index ? `_${index}` : ""
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

module.exports = {
  getLogFiles,
  readLogContent,
  clearLogContent,
  cleanupLogFiles,
  logger,
  createLoggerConfig,
};
