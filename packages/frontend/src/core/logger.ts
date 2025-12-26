/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * 日志配置
 */
interface LoggerConfig {
  /** 是否启用日志（生产环境可关闭） */
  enabled: boolean;
  /** 是否上报错误日志 */
  reportEnabled: boolean;
  /** 上报接口地址 */
  reportUrl?: string;
  /** 环境标识 */
  env: string;
}

/**
 * 日志项
 */
interface LogItem {
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: string;
  url?: string;
  userAgent?: string;
  stack?: string;
}

// 默认配置
const defaultConfig: LoggerConfig = {
  enabled: import.meta.env.DEV,
  reportEnabled: !import.meta.env.DEV,
  env: import.meta.env.MODE,
};

let config: LoggerConfig = { ...defaultConfig };

/**
 * 更新日志配置
 */
export function setLoggerConfig(newConfig: Partial<LoggerConfig>) {
  config = { ...config, ...newConfig };
}

/**
 * 格式化日志消息
 */
function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  if (data !== undefined) {
    return `${prefix} ${message}`;
  }
  return `${prefix} ${message}`;
}

/**
 * 创建日志项
 */
function createLogItem(level: LogLevel, message: string, data?: unknown, error?: Error): LogItem {
  return {
    level,
    message,
    data,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    stack: error?.stack,
  };
}

/**
 * 上报日志（可扩展为实际的上报逻辑）
 */
async function reportLog(item: LogItem) {
  if (!config.reportEnabled || !config.reportUrl) {
    return;
  }

  try {
    // 这里可以接入实际的日志上报服务
    // 例如：发送到后端 API、Sentry、或其他监控平台
    if (config.reportUrl) {
      await fetch(config.reportUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });
    }
  } catch (error) {
    // 上报失败时静默处理，避免循环上报
    console.error("日志上报失败:", error);
  }
}

/**
 * 输出日志到控制台
 */
function outputToConsole(level: LogLevel, formattedMessage: string, data?: unknown) {
  if (!config.enabled) {
    return;
  }

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedMessage, data ?? "");
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, data ?? "");
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, data ?? "");
      break;
    case LogLevel.ERROR:
      console.error(formattedMessage, data ?? "");
      break;
  }
}

/**
 * 统一的日志方法
 */
function log(level: LogLevel, message: string, data?: unknown, error?: Error) {
  const formattedMessage = formatMessage(level, message, data);
  outputToConsole(level, formattedMessage, data);

  // 错误级别及以上需要上报
  if (level === LogLevel.ERROR || level === LogLevel.WARN) {
    const logItem = createLogItem(level, message, data, error);
    reportLog(logItem);
  }
}

/**
 * 日志工具类
 * 统一封装 console 方法，提供格式化输出和上报能力
 */
export const logger = {
  /**
   * 调试日志（仅在开发环境输出）
   */
  debug: (message: string, ...args: unknown[]) => {
    if (config.enabled) {
      log(LogLevel.DEBUG, message, args.length > 0 ? args : undefined);
    }
  },

  /**
   * 信息日志
   */
  info: (message: string, ...args: unknown[]) => {
    log(LogLevel.INFO, message, args.length > 0 ? args : undefined);
  },

  /**
   * 警告日志
   */
  warn: (message: string, ...args: unknown[]) => {
    log(LogLevel.WARN, message, args.length > 0 ? args : undefined);
  },

  /**
   * 错误日志
   */
  error: (message: string, error?: Error, ...args: unknown[]) => {
    log(LogLevel.ERROR, message, args.length > 0 ? args : undefined, error);
  },

  /**
   * 分组日志（开发环境）
   */
  group: (label: string, ...args: unknown[]) => {
    if (config.enabled) {
      console.group(formatMessage(LogLevel.DEBUG, label));
      if (args.length > 0) {
        console.log(...args);
      }
    }
  },

  /**
   * 结束分组
   */
  groupEnd: () => {
    if (config.enabled) {
      console.groupEnd();
    }
  },

  /**
   * 表格日志（开发环境）
   */
  table: (data: unknown) => {
    if (config.enabled) {
      console.table(data);
    }
  },
};

/**
 * 重写全局 console 方法（可选，根据需求决定是否启用）
 * 如果启用，所有 console.log 等调用都会经过 logger 处理
 */
export function overrideConsole() {
  if (typeof window === "undefined") {
    return;
  }

  const originalConsole = { ...console };

  console.log = (...args: unknown[]) => {
    logger.info(args.join(" "), args);
    originalConsole.log(...args);
  };

  console.info = (...args: unknown[]) => {
    logger.info(args.join(" "), args);
    originalConsole.info(...args);
  };

  console.warn = (...args: unknown[]) => {
    logger.warn(args.join(" "), args);
    originalConsole.warn(...args);
  };

  console.error = (...args: unknown[]) => {
    logger.error(args.join(" "), undefined, args);
    originalConsole.error(...args);
  };

  console.debug = (...args: unknown[]) => {
    logger.debug(args.join(" "), args);
    originalConsole.debug(...args);
  };
}
