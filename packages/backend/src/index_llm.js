/**
 * 主入口文件，参考 claude-code-router-main/src/index.ts 实现
 * 使用 @musistudio/llms 启动路由服务
 */
const { createServer } = require("./server_llm");
const { PROVIDER_CONFIG } = require("./config/provider");
const { writeConfigFile } = require("./utils/configFile");
const { HOME_DIR, CONFIG_FILE, LOG_FILE } = require("./config/constants");
const {
  initializeClaudeConfig,
  initConfig,
  initDir,
  cleanupLogFiles,
  SimpleLRUCache,
  savePid,
  cleanupPidFile,
  isServiceRunning,
  openBrowser,
} = require("./utils");
const { createLoggerConfig } = require("./utils/logs");
const {
  createAuthMiddleware,
  createRouteMiddleware,
  createUsageCacheMiddleware,
  createProviderKeyMiddleware,
} = require("./middleware");
const { runStatusLine } = require("./utils/statusline");

const sessionUsageCache = new SimpleLRUCache(100);

// 检查是否为服务模式（子进程模式）
const isServiceMode = process.argv.includes("--service");
const isStopMode = process.argv.includes("--stop");
const isClipboardWatchMode = process.argv.includes("--clipboard-watch");
const isStatusLineMode = process.argv.includes("--statusline");

async function run(_options = {}) {
  // 如果是 statusline 模式，执行 statusline 功能
  if (isStatusLineMode) {
    runStatusLine();
    return;
  }

  // 如果是剪贴板监听模式，启动剪贴板监听功能
  if (isClipboardWatchMode) {
    const { startClipboardWatch } = require("./utils/watch-clipboard");
    startClipboardWatch();
    return;
  }

  // 如果是停止模式，停止服务并退出
  if (isStopMode) {
    const { stopServiceByPid } = require("./utils/processManager");
    stopServiceByPid();
    return;
  }

  // 如果是服务模式（子进程），直接启动服务，不检查 PID
  if (isServiceMode) {
    await startService();
    return;
  }

  // 主进程模式：检查服务是否已在运行
  if (isServiceRunning()) {
    console.log("✅ 服务已在后台运行。");
    return;
  }

  // 主进程模式：启动进程管理器
  await startProcessManager();
}

/**
 * 启动进程管理器（主进程）
 */
async function startProcessManager() {
  const {
    startService,
    restartService,
    stopService,
  } = require("./utils/processManager");
  const { existsSync } = require("fs");
  const { RESTART_SIGNAL_FILE } = require("./config/constants");

  // 初始化配置
  await initializeClaudeConfig();
  await initDir();

  // 读取配置以获取端口和主机信息
  const config = await initConfig();
  let HOST = config.HOST || "127.0.0.1";
  if (config.HOST && !config.APIKEY) {
    HOST = "127.0.0.1";
  }
  const port = config.PORT || 3457;
  const serviceUrl = `http://${HOST}:${port}/ui/`;

  // 启动服务子进程（首次启动）
  startService();

  // 等待服务启动后打开浏览器（仅在首次启动时）
  setTimeout(() => {
    openBrowser(serviceUrl);
  }, 2000);

  // 监听重启信号文件
  const restartSignalFile = RESTART_SIGNAL_FILE;

  // 清理旧的信号文件
  if (existsSync(restartSignalFile)) {
    const { unlinkSync } = require("fs");
    try {
      unlinkSync(restartSignalFile);
    } catch {
      // 忽略错误
    }
  }

  // 使用轮询方式检测重启信号文件（Windows 上更可靠）
  const checkRestartSignal = () => {
    if (existsSync(restartSignalFile)) {
      const { unlinkSync } = require("fs");
      console.log("检测到重启信号，正在重启服务...");
      // 重启时不打开浏览器
      restartService();

      // 删除信号文件
      try {
        unlinkSync(restartSignalFile);
      } catch {
        // 忽略错误
      }
    }
  };

  // 每 500ms 检查一次重启信号
  const restartCheckInterval = setInterval(checkRestartSignal, 500);

  // 清理定时器
  process.on("exit", () => {
    clearInterval(restartCheckInterval);
  });

  // 处理主进程退出
  process.on("SIGINT", () => {
    console.log("收到 SIGINT 信号，正在停止服务...");
    stopService();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    stopService();
    process.exit(0);
  });
}

/**
 * 启动服务（子进程模式）
 */
async function startService() {
  await initializeClaudeConfig();
  await initDir();

  // 清理旧日志文件，只保留最近的 10 个
  await cleanupLogFiles(10);
  const config = await initConfig();

  let HOST = config.HOST || "127.0.0.1";
  if (config.HOST && !config.APIKEY) {
    HOST = "127.0.0.1";
    console.warn("⚠️ 未设置 API 密钥。HOST 已强制设置为 127.0.0.1。");
  }

  const port = config.PORT || 3457;

  // 保存后台进程的 PID
  savePid(process.pid);

  // 处理 SIGINT (Ctrl+C) 以清理 PID 文件
  process.on("SIGINT", () => {
    console.log("收到 SIGINT 信号，正在清理...");
    cleanupPidFile();
    process.exit(0);
  });

  // 处理 SIGTERM 以清理 PID 文件
  process.on("SIGTERM", () => {
    cleanupPidFile();
    process.exit(0);
  });

  // 使用环境变量中的端口（用于后台进程）
  const servicePort = process.env.SERVICE_PORT
    ? parseInt(process.env.SERVICE_PORT)
    : port;

  // 配置日志
  const loggerConfig = createLoggerConfig(config, HOME_DIR);
  const initialConfig = {
    Providers:
      config.Providers || config.providers || PROVIDER_CONFIG.Providers,
    Router: config.Router || PROVIDER_CONFIG.Router,
    HOST: HOST,
    PORT: servicePort,
    LOG_FILE: LOG_FILE,
  };

  writeConfigFile({ ...config, ...initialConfig });

  const server = createServer({
    jsonPath: CONFIG_FILE,
    initialConfig: {
      ...initialConfig,
      providers:
        config.Providers || config.providers || PROVIDER_CONFIG.Providers,
    },
    logger: loggerConfig,
  });

  const appLogger = server.app?.log || console;

  // 注入配置
  server.addHook("preHandler", (req, _reply) => {
    return new Promise((resolve, _reject) => {
      // 判断请求 是 /providers 接口，则设置 api_keys 和 limit 自定义字段
      if (req.url === "/providers" && req.method === "GET") {
        // 检查 providerService 是否存在
        const { getProviderService } = require("./utils");
        const providerService = getProviderService(server);
        if (!providerService) {
          // 如果 providerService 不存在，直接返回，不阻塞请求
          return resolve();
        }

        // 给每一个 provider 设置 api_keys 和 limit 自定义字段
        try {
          providerService.getProviders().forEach((provider) => {
            const cfgProvider = config.Providers.find(
              (p) => p.name === provider.name
            );
            if (cfgProvider && !provider?.apiKeys) {
              provider.apiKeys = cfgProvider.api_keys;
              provider.limit = cfgProvider.limit;
              provider.sort = cfgProvider.sort;
              provider.enabled = cfgProvider.enabled;
            }
          });
        } catch (error) {
          appLogger.error("设置 provider 字段时出错:", error);
        }
      }
      // 不返回值，让请求继续处理
      resolve();
    });
  });

  // 添加全局错误处理器以防止服务崩溃
  process.on("uncaughtException", (err) => {
    appLogger.error("未捕获的异常:", err);
  });

  process.on("unhandledRejection", (reason, promise) => {
    appLogger.error("未处理的 Promise 拒绝:", promise, "原因:", reason);
  });

  // 添加异步 preHandler hook 用于认证
  server.addHook("preHandler", createAuthMiddleware(config));

  // 添加路由处理 hook
  server.addHook(
    "preHandler",
    createRouteMiddleware(config, sessionUsageCache, appLogger)
  );

  // 通过provider的配置中的enable来判断当前模型是否可用，如果没有则直接返回报错
  // 添加一个 hook prehandler 来判断 当前的provider 是否启用，如果没有则直接返回报错
  server.addHook("preHandler", async (req, reply) => {
    // 仅拦截模型请求
    if (
      !req.url.startsWith("/v1/messages") ||
      req.url.startsWith("/v1/messages/count_tokens")
    ) {
      return;
    }

    const model = req.body?.model;
    if (!model || typeof model !== "string") return;
    const [providerName] = model.split(",");

    const { getProviderService } = require("./utils");
    const providerService = getProviderService(server);

    // 优先从运行中的 providerService 获取状态，否则回退配置
    const runtimeProvider = providerService?.getProvider(providerName);
    const configProvider = (config.Providers || config.providers || []).find(
      (p) => p.name === providerName
    );

    const enabledFromRuntime = runtimeProvider?.enabled;
    const enabledFromConfig = configProvider?.enabled;

    // 默认启用，只有显式 false 才视为禁用
    const isEnabled =
      enabledFromRuntime !== undefined
        ? enabledFromRuntime !== false
        : enabledFromConfig !== false;

    if (!isEnabled) {
      return reply
        .status(403)
        .send({ error: "当前 Provider 已被禁用", provider: providerName });
    }
  });

  // Provider 密钥轮换 hook（api_keys / api_key）
  const keyMiddleware = createProviderKeyMiddleware(config, server);
  server.addHook("preHandler", keyMiddleware.preHandler);

  // 添加错误处理 hook
  server.addHook("onError", async (request, _reply, error) => {
    await keyMiddleware.onError(request, _reply, error);
    appLogger.error("请求错误:", error);
  });

  // 添加 onSend hook 用于处理响应和缓存用量
  // 注意：如果需要 agents 支持，需要传递 agentsManager 参数
  server.addHook(
    "onSend",
    createUsageCacheMiddleware(sessionUsageCache, config, null)
  );
  // onSend 释放 key 并发占用
  server.addHook("onSend", keyMiddleware.onSend);

  // 启动服务器
  try {
    await server.start();
  } catch (error) {
    // 如果 start() 不是 Promise，尝试直接调用
    if (typeof server.start === "function") {
      server.start();
    } else {
      throw error;
    }
  }

  const serviceUrl = `http://${HOST}:${servicePort}/ui/`;
  console.log(`[llm-server] 服务已启动，地址: ${serviceUrl}`);
}

// 如果直接运行此文件，则启动服务
if (require.main === module) {
  run().catch((error) => {
    console.error("启动服务器失败:", error);
    process.exit(1);
  });
}

module.exports = { run };
