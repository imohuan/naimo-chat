/**
 * Provider Transformer 中间件
 * 监听 PUT /providers/:id 接口，解析 transformer 配置并转换为 Transformer 实例
 */

/**
 * 实例化 transformer
 * 如果 transformerInstance 是函数（构造函数），则使用 new 调用；否则直接返回
 * @param {any} transformerInstance - Transformer 构造函数或实例
 * @param {any} options - 可选的配置对象
 * @param {string} transformerName - Transformer 名称，用于错误日志（可选）
 * @returns {any} Transformer 实例，失败时返回 undefined
 */
function instantiateTransformer(transformerInstance, options, transformerName) {
  if (!transformerInstance) {
    return undefined;
  }

  try {
    if (typeof transformerInstance === "function") {
      return options !== undefined
        ? new transformerInstance(options)
        : new transformerInstance();
    }
    return transformerInstance;
  } catch (error) {
    const name = transformerName || "unknown";
    console.error(`Failed to create transformer ${name}:`, error);
    return undefined;
  }
}

/**
 * 解析 transformer 配置
 * 将字符串配置（如 "maxtoken" 或 ["maxtoken", { max_tokens: 8192 }]）转换为 Transformer 实例
 * @param {any} transformerConfig - 原始 transformer 配置
 * @param {any} transformerService - TransformerService 实例
 * @returns {any} 解析后的 transformer 对象
 */
function parseTransformerConfig(transformerConfig, transformerService) {
  if (!transformerConfig || !transformerService) {
    return undefined;
  }

  const transformer = {};

  if (transformerConfig.use) {
    if (Array.isArray(transformerConfig.use)) {
      transformer.use = transformerConfig.use
        .map((item) => {
          // 处理数组格式：["maxtoken", { max_tokens: 8192 }]
          if (Array.isArray(item) && typeof item[0] === "string") {
            const transformerName = item[0];
            const options = item[1] || {};
            const TransformerClass = transformerService.getTransformer(transformerName);
            return instantiateTransformer(TransformerClass, options, transformerName);
          }

          // 处理字符串格式："maxtoken"
          if (typeof item === "string") {
            const TransformerClass = transformerService.getTransformer(item);
            return instantiateTransformer(TransformerClass, undefined, item);
          }

          // 如果已经是 Transformer 实例，直接返回
          return item;
        })
        .filter((item) => item !== undefined);
    }
  }

  // 处理模型特定的 transformer 配置
  Object.keys(transformerConfig).forEach((key) => {
    if (key === "use") {
      // 已经在上面处理过了
      return;
    }

    const modelTransformerConfig = transformerConfig[key];
    if (
      modelTransformerConfig &&
      typeof modelTransformerConfig === "object" &&
      Array.isArray(modelTransformerConfig.use)
    ) {
      transformer[key] = {
        use: modelTransformerConfig.use
          .map((item) => {
            // 处理数组格式：["maxtoken", { max_tokens: 8192 }]
            if (Array.isArray(item) && typeof item[0] === "string") {
              const transformerName = item[0];
              const options = item[1] || {};
              const TransformerClass = transformerService.getTransformer(
                transformerName
              );
              return instantiateTransformer(TransformerClass, options, transformerName);
            }

            // 处理字符串格式："maxtoken"
            if (typeof item === "string") {
              const TransformerClass = transformerService.getTransformer(item);
              return instantiateTransformer(TransformerClass, undefined, item);
            }

            // 如果已经是 Transformer 实例，直接返回
            return item;
          })
          .filter((item) => item !== undefined),
      };
    }
  });

  // 如果 transformer 对象为空，返回 undefined
  if (Object.keys(transformer).length === 0) {
    return undefined;
  }

  return transformer;
}

/**
 * 创建 Provider Transformer 中间件
 * @param {Object} server - 服务器实例
 * @param {Object} logger - 日志对象（可选）
 * @returns {Object} 包含 preHandler 方法的中间件对象
 */
function createProviderTransformerMiddleware(server = null, logger = null) {
  const log = logger || console;

  const preHandler = async (req, _reply) => {
    // 只处理 PUT /providers/:id 请求
    if (req.method !== "PUT" || !req.url.match(/^\/providers\/[^/]+$/)) {
      return;
    }

    // 检查请求体中是否有 transformer 配置
    if (!req.body || !req.body.transformer) {
      return;
    }

    // 获取 transformerService
    const transformerService =
      server?.app?._server?.transformerService ||
      req.server?.app?._server?.transformerService;

    if (!transformerService) {
      log.warn(
        "ProviderTransformerMiddleware: transformerService not found, skipping transformer parsing"
      );
      return;
    }

    const originalTransformer = req.body.transformer;

    try {
      // 解析 transformer 配置
      const parsedTransformer = parseTransformerConfig(
        originalTransformer,
        transformerService
      );

      if (parsedTransformer) {
        // 替换请求体中的 transformer 配置
        req.body.transformer = parsedTransformer;
        log.debug(
          `ProviderTransformerMiddleware: Parsed transformer config for provider ${req.params?.id || "unknown"}`
        );
      } else {
        // 如果解析失败，删除 transformer 配置
        delete req.body.transformer;
        log.warn(
          `ProviderTransformerMiddleware: Failed to parse transformer config, removed from request`
        );
      }
    } catch (error) {
      log.error(
        "ProviderTransformerMiddleware: Error parsing transformer config:",
        error
      );
      // 解析失败时，删除 transformer 配置，避免后续处理出错
      delete req.body.transformer;
    }

    if (req.body.transformer) {
      req.body.originalTransformer = originalTransformer
    }
  };

  return { preHandler };
}

module.exports = {
  createProviderTransformerMiddleware,
  parseTransformerConfig,
};

