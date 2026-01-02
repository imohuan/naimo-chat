const {
  readConfigFile,
  backupConfigFile,
  writeConfigFile,
} = require("../utils/configFile");
const { getProviderService } = require("../utils");
const { setProvider } = require("../utils/providerService");
const {
  CLAUDE_DIR,
  CLAUDE_SETTINGS_PATH,
} = require("../config/constants");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("fs");

function registerConfigRoutes(server) {
  const app = server.app;

  // 读取配置
  app.get("/api/config", async () => {
    return await readConfigFile();
  });

  // 列出 transformerService 中已注册的 transformers
  app.get("/api/transformers", async () => {
    const transformers =
      app._server?.transformerService?.getAllTransformers() || new Map();
    const transformerList = Array.from(transformers.entries()).map(
      ([name, transformer]) => ({
        name,
        endpoint: transformer.endPoint || null,
      })
    );
    return { transformers: transformerList };
  });

  // 更新配置
  app.post("/api/config", async (req) => {
    const newConfig = req.body || {};

    const backupPath = await backupConfigFile();
    if (backupPath) {
      console.log(`已备份现有配置文件到 ${backupPath}`);
    }

    await writeConfigFile(newConfig);

    const providerService = getProviderService(server);
    if (providerService) {
      const providers = providerService.getProviders() || [];
      for (const provider of providers) {
        const cfgProvider = newConfig.Providers.find(
          (p) => p.name === provider.name
        );
        if (cfgProvider) {
          await setProvider(
            provider,
            {
              apiKeys: cfgProvider.api_keys,
              limit: cfgProvider.limit,
              sort: cfgProvider.sort,
              enabled: cfgProvider.enabled,
              originalTransformer: cfgProvider.transformer,
            },
            newConfig,
            server
          );
        }
      }
    }

    return { success: true, message: "配置保存成功" };
  });

  // 更新 provider 启用状态
  app.post("/api/providers/enabled", async (req, reply) => {
    const { name, enabled } = req.body || {};
    if (!name || typeof enabled !== "boolean") {
      return reply.status(400).send({
        success: false,
        message: "参数错误，需提供 name 与 enabled(boolean)",
      });
    }

    try {
      const configData = (await readConfigFile()) || {};
      const ok = await setProvider({ name }, { enabled }, configData, server);
      if (!ok) {
        return reply
          .status(404)
          .send({ success: false, message: "未找到指定的 provider" });
      }
      return { success: true, message: "更新 provider 启用状态成功" };
    } catch (error) {
      console.error("更新 provider 启用状态失败:", error);
      return reply
        .status(500)
        .send({ success: false, message: "更新 provider 启用状态失败" });
    }
  });

  // 同步配置
  app.get("/api/config-sync", async (req, reply) => {
    try {
      const providerService = getProviderService(server);
      const providers = providerService?.getProviders() || [];

      const localConfig = (await readConfigFile()) || {};

      // 找出所有有 sort 值的 provider 的最大 sort 值
      const maxSort = providers.reduce((max, provider) => {
        if (provider.sort !== undefined && provider.sort !== null) {
          return Math.max(max, provider.sort);
        }
        return max;
      }, -1);

      // 为没有 sort 值的 provider 分配 sort 值
      let nextSort = maxSort + 1;
      const configProviders = providers.map((provider) => {
        let sortValue = provider.sort;
        if (sortValue === undefined || sortValue === null) {
          sortValue = nextSort++;
        }

        return {
          name: provider.name,
          api_base_url: provider.baseUrl,
          api_key: provider.apiKey,
          models: provider.models || [],
          // ...(provider.transformer && { transformer: provider.transformer }),
          ...(provider.originalTransformer && { transformer: provider.originalTransformer }),
          ...(provider.limit !== undefined && { limit: provider.limit }),
          ...(provider.apiKeys && { api_keys: provider.apiKeys }),
          sort: sortValue,
          ...(provider.enabled !== undefined && { enabled: provider.enabled }),
        };
      });

      const mergedConfig = {
        ...localConfig,
        Providers: configProviders,
      };

      const backupPath = await backupConfigFile();
      if (backupPath) {
        console.log(`已备份现有配置文件到 ${backupPath}`);
      }

      await writeConfigFile(mergedConfig);

      return {
        success: true,
        message: "配置同步成功",
        providersCount: configProviders.length,
      };
    } catch (error) {
      console.error("配置同步失败:", error);
      reply.status(500).send({
        success: false,
        error: "配置同步失败",
        message: error.message,
      });
    }
  });

  // 更新 Claude settings.json 中的 statusLine 配置
  app.get("/api/statusline/update", async (req, reply) => {
    try {
      // 读取当前配置
      const config = await readConfigFile();
      const statusLineEnabled = config?.StatusLine?.enabled || false;

      // 读取或创建 Claude settings.json
      let claudeSettings = {};
      if (existsSync(CLAUDE_SETTINGS_PATH)) {
        try {
          const settingsContent = readFileSync(CLAUDE_SETTINGS_PATH, "utf-8");
          claudeSettings = JSON.parse(settingsContent);
        } catch (error) {
          console.error("读取 Claude settings.json 失败:", error);
          return reply.status(500).send({
            success: false,
            message: "读取 Claude settings.json 失败",
            error: error.message,
          });
        }
      }

      if (statusLineEnabled) {
        // 启用 StatusLine：设置 statusLine 配置
        // 参考 processManager.js 的做法，使用 process.execPath 和 scriptPath
        // process.execPath 在开发环境是 node，打包后是 exe 文件本身
        // process.argv[1] 在打包后会指向打包后的文件
        const scriptPath = process.argv[1] || require.main.filename;
        const execPath = process.execPath.replace(/\\/g, "/");
        const scriptPathNormalized = scriptPath.replace(/\\/g, "/");
        claudeSettings.statusLine = {
          type: "command",
          command: `${execPath} "${scriptPathNormalized}" --statusline`,
          padding: 0,
        };
      } else {
        // 禁用 StatusLine：移除 statusLine 配置
        if (claudeSettings.statusLine) {
          delete claudeSettings.statusLine;
        }
      }

      // 确保 .claude 目录存在
      if (!existsSync(CLAUDE_DIR)) {
        mkdirSync(CLAUDE_DIR, { recursive: true });
      }

      // 写入 Claude settings.json
      try {
        writeFileSync(
          CLAUDE_SETTINGS_PATH,
          JSON.stringify(claudeSettings, null, 2),
          "utf-8"
        );

        return {
          success: true,
          message: statusLineEnabled
            ? "已启用 StatusLine 并更新 Claude settings.json"
            : "已禁用 StatusLine 并更新 Claude settings.json",
          statusLineEnabled,
          settingsPath: CLAUDE_SETTINGS_PATH,
        };
      } catch (error) {
        console.error("写入 Claude settings.json 失败:", error);
        return reply.status(500).send({
          success: false,
          message: "写入 Claude settings.json 失败",
          error: error.message,
        });
      }
    } catch (error) {
      console.error("更新 StatusLine 配置失败:", error);
      return reply.status(500).send({
        success: false,
        message: "更新 StatusLine 配置失败",
        error: error.message,
      });
    }
  });
}

module.exports = { registerConfigRoutes };
