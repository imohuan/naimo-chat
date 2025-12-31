// 核心路由逻辑，基于请求上下文/工具/Token 估算选择上游模型。
// 这里保持实现简单，便于 demo 和本地调试。
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { CLAUDE_PROJECTS_DIR } = require("../config/constants");
const { SimpleLRUCache } = require("../utils/cache");
const { readConfigFile } = require("../utils/configFile");

const sessionProjectCache = new SimpleLRUCache(500);

/**
 * 安全读取 JSON 文件
 *
 * 功能说明：
 * - 异步读取指定路径的 JSON 文件并解析
 * - 如果文件不存在、读取失败或 JSON 格式错误，返回 null 而不抛出异常
 * - 用于配置文件读取，避免因文件缺失导致程序崩溃
 *
 * @param {string} filePath - 要读取的 JSON 文件路径
 * @returns {Promise<Object|null>} 解析后的 JSON 对象，失败时返回 null
 *
 * @example
 * const config = await safeReadJSON('/path/to/config.json');
 * if (config) {
 *   console.log(config.Router);
 * }
 */
const safeReadJSON = async (filePath) => {
  try {
    const content = await fsp.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
};

/**
 * 根据会话 ID 查找对应的项目目录
 *
 * 功能说明：
 * - 在 CLAUDE_PROJECTS_DIR 目录下搜索包含指定 sessionId.jsonl 文件的项目目录
 * - 使用 LRU 缓存机制（最多缓存 500 个结果）提高查找性能
 * - 遍历所有子目录，检查是否存在 {sessionId}.jsonl 文件来确定项目归属
 *
 * 查找逻辑：
 * 1. 检查缓存，如果已缓存则直接返回
 * 2. 遍历 CLAUDE_PROJECTS_DIR 下的所有目录
 * 3. 并行检查每个目录中是否存在 {sessionId}.jsonl 文件
 * 4. 找到第一个匹配的目录名称作为项目名
 * 5. 将结果存入缓存并返回
 *
 * @param {string} sessionId - 会话 ID，用于查找对应的项目目录
 * @returns {Promise<string|null>} 找到的项目目录名称，未找到返回 null
 * .claude\projects\G--ClaudeCode-vite8-vue-oxc\3ba01274-93a0-4a42-a27c-26b4f0fd97ff.jsonl
 * 返回;: G--ClaudeCode-vite8-vue-oxc
 * @example
 * const project = await searchProjectBySession('abc123');
 * // 如果找到：返回 'my-project'
 * // 如果未找到：返回 null
 */
const searchProjectBySession = async (sessionId) => {
  // 参数校验：如果没有 sessionId，直接返回 null
  if (!sessionId) return null;

  // 缓存检查：如果缓存中已有结果，直接返回（避免重复文件系统操作）
  if (sessionProjectCache.has(sessionId)) {
    return sessionProjectCache.get(sessionId);
  }

  try {
    // 打开 CLAUDE_PROJECTS_DIR 目录进行遍历
    const dir = await fsp.opendir(CLAUDE_PROJECTS_DIR);
    const candidates = [];

    // 收集所有子目录名称作为候选项目
    for await (const dirent of dir) {
      if (dirent.isDirectory()) {
        candidates.push(dirent.name);
      }
    }

    // 并行检查每个候选目录中是否存在该 sessionId 的 .jsonl 文件
    const checks = await Promise.all(
      candidates.map(async (name) => {
        // 构建会话文件路径：{CLAUDE_PROJECTS_DIR}/{项目名}/{sessionId}.jsonl
        const sessionFile = path.join(
          CLAUDE_PROJECTS_DIR,
          name,
          `${sessionId}.jsonl`
        );
        try {
          // 检查文件是否存在且为普通文件
          const stat = await fsp.stat(sessionFile);
          return stat.isFile() ? name : null;
        } catch {
          // 文件不存在或无法访问，返回 null
          return null;
        }
      })
    );

    // 找到第一个非 null 的结果（即找到匹配的项目）
    const project = checks.find(Boolean) ?? null;

    // 将结果存入缓存（无论是否找到都缓存，避免重复查找）
    sessionProjectCache.set(sessionId, project);
    return project;
  } catch {
    // 目录打开失败或其他错误，缓存 null 并返回
    sessionProjectCache.set(sessionId, null);
    return null;
  }
};

/**
 * 获取项目特定的路由配置
 *
 * 功能说明：
 * - 根据会话 ID 查找并返回项目或会话级别的路由配置
 * - 支持多级配置优先级：会话级配置 > 项目级配置 > 全局配置（由调用方处理）
 * - 用于实现不同项目/会话可以使用不同的路由策略，支持多租户场景
 *
 * 配置查找优先级：
 * 1. 会话级配置：{项目目录}/{sessionId}.json 中的 Router 字段（优先级最高）
 * 2. 项目级配置：{项目目录}/config.json 中的 Router 字段
 * 3. 未找到：返回 undefined，调用方会回退到全局配置
 *
 * 工作流程：
 * 1. 验证 sessionId 是否存在
 * 2. 调用 searchProjectBySession 查找项目目录
 * 3. 构建会话配置文件和项目配置文件的路径
 * 4. 优先读取会话级配置，如果存在 Router 字段则返回
 * 5. 否则读取项目级配置，如果存在 Router 字段则返回
 * 6. 都未找到则返回 undefined
 *
 * @param {string} sessionId - 会话 ID，用于定位项目和会话配置
 * @returns {Promise<Object|undefined>} 路由配置对象（Router），未找到返回 undefined
 *
 * @example
 * // 假设项目目录为 'my-project'，sessionId 为 'abc123'
 * // 查找顺序：
 * // 1. {CLAUDE_PROJECTS_DIR}/../my-project/abc123.json 中的 Router
 * // 2. {CLAUDE_PROJECTS_DIR}/../my-project/config.json 中的 Router
 * // 3. 返回 undefined（调用方使用全局配置）
 *
 *
 * const router = await getProjectSpecificRouter('abc123');
 * if (router) {
 *   // 使用项目特定的路由配置
 *   console.log(router.default, router.longContext);
 * }
 */
const getProjectSpecificRouter = async (sessionId) => {
  // 参数校验：如果没有 sessionId，直接返回 undefined
  if (!sessionId) return undefined;

  // 查找该会话所属的项目目录
  const project = await searchProjectBySession(sessionId);

  // 如果未找到项目，返回 undefined（无法定位项目配置）
  if (!project) return undefined;

  // 构建项目基础目录路径（CLAUDE_PROJECTS_DIR 的父级下的项目目录）
  const baseDir = path.join(CLAUDE_PROJECTS_DIR, "..", project);

  // 构建会话级配置文件路径：{项目目录}/{sessionId}.json
  const sessionConfigPath = path.join(baseDir, `${sessionId}.json`);

  // 构建项目级配置文件路径：{项目目录}/config.json
  const projectConfigPath = path.join(baseDir, "config.json");

  // 优先读取会话级配置（优先级最高）
  const sessionConfig = await safeReadJSON(sessionConfigPath);
  if (sessionConfig?.Router) return sessionConfig.Router;

  // 如果会话级配置不存在，读取项目级配置
  const projectConfig = await safeReadJSON(projectConfigPath);
  if (projectConfig?.Router) return projectConfig.Router;

  // 都未找到，返回 undefined（调用方会使用全局配置）
  return undefined;
};

// Lightweight token estimator: counts UTF-8 bytes then divides; not exact but
// good enough for routing thresholds.
const estimateTokens = (text) => {
  if (!text) return 0;
  return Buffer.byteLength(String(text), "utf8") / 4;
};

const calculateTokenCount = (messages = [], system = [], tools = []) => {
  let tokens = 0;

  const addFromMessageContent = (content) => {
    if (typeof content === "string") {
      tokens += estimateTokens(content);
      return;
    }
    if (Array.isArray(content)) {
      content.forEach((part) => {
        if (part?.type === "text") {
          tokens += estimateTokens(part.text);
        } else if (part?.type === "tool_use") {
          tokens += estimateTokens(JSON.stringify(part.input ?? {}));
        } else if (part?.type === "tool_result") {
          const payload =
            typeof part.content === "string"
              ? part.content
              : JSON.stringify(part.content ?? {});
          tokens += estimateTokens(payload);
        }
      });
    }
  };

  messages.forEach((msg) => addFromMessageContent(msg.content));

  if (typeof system === "string") {
    tokens += estimateTokens(system);
  } else if (Array.isArray(system)) {
    system.forEach((item) => {
      if (item?.type === "text") {
        if (typeof item.text === "string") {
          tokens += estimateTokens(item.text);
        } else if (Array.isArray(item.text)) {
          item.text.forEach((t) => (tokens += estimateTokens(t)));
        }
      }
    });
  }

  tools.forEach((tool) => {
    if (tool?.description)
      tokens += estimateTokens(tool.name + tool.description);
    if (tool?.input_schema)
      tokens += estimateTokens(JSON.stringify(tool.input_schema));
  });

  return Math.round(tokens);
};

/**
 * 根據請求上下文選擇合適的模型
 * 
 * 模型選擇優先級（從高到低）：
 * 1. 用戶顯式指定模型（格式：provider,model）
 * 2. 長上下文路由（token 數超過閾值）
 * 3. 子代理模型（system 中包含 <CCR-SUBAGENT-MODEL> 標籤）
 * 4. Claude Haiku 背景模型
 * 5. Web 搜尋工具路由（請求包含 web_search 工具）
 * 6. 思考/推理路由（請求包含 thinking 或 reasoning 參數）
 * 7. 預設模型（Router.default）
 * 
 * @param {Object} req - 請求對象，包含 body、sessionId 等
 * @param {number} tokenCount - 當前請求估算的 token 數量
 * @param {Object} config - 配置對象，包含 Router 和 Providers
 * @param {Object} lastUsage - 上次使用記錄，包含 input_tokens 等資訊
 * @returns {Promise<string>} 選擇的模型字串（格式：provider,model 或 model）
 */
const selectModel = async (req, tokenCount, config, lastUsage) => {
  const logger = req.logger || console;
  logger?.debug?.(
    `[router] tokenCount=${tokenCount} sessionId=${req.sessionId || "n/a"}`
  );

  // 動態讀取 Router 配置（支持運行時更新，無需重啟）
  let currentRouter = config.Router;
  try {
    const fileConfig = await readConfigFile();
    if (fileConfig?.Router) {
      currentRouter = fileConfig.Router;
    }
  } catch (error) {
    logger?.warn?.("讀取 Router 配置失敗，使用內存中的配置:", error.message);
  }

  // 優先使用項目/會話特定的路由配置，否則使用全局配置
  const projectRouter = await getProjectSpecificRouter(req.sessionId);
  const Router = projectRouter || currentRouter || {};

  // ========== 情況 1：用戶顯式指定模型 ==========
  // 條件：req.body.model 為字串且包含逗號（格式：provider,model）
  // 行為：驗證 provider 和 model 是否存在於配置中，存在則直接使用
  // 示例：req.body.model = "openai,gpt-4" -> 返回 "openai,gpt-4"
  if (typeof req.body?.model === "string" && req.body.model.includes(",")) {
    const [provider, model] = req.body.model.split(",");
    const finalProvider = (config.Providers || []).find(
      (p) => p.name?.toLowerCase() === provider.toLowerCase()
    );
    const finalModel = finalProvider?.models?.find(
      (m) => m.toLowerCase() === model.toLowerCase()
    );
    if (finalProvider && finalModel) {
      logger?.info?.(
        `[router] 用戶顯式指定模型 -> ${finalProvider.name},${finalModel}`
      );
      return `${finalProvider.name},${finalModel}`;
    }
    logger?.info?.(
      `[router] 未找到匹配的顯式模型，回退原值: ${req.body.model}`
    );
    return req.body.model;
  }

  // ========== 情況 2：長上下文路由 ==========
  // 條件：滿足以下任一條件且配置了 Router.longContext
  //   - 當前 token 數 > longContextThreshold（預設 60000）
  //   - 上次使用記錄的 input_tokens > longContextThreshold 且當前 token 數 > 20000
  // 行為：返回 Router.longContext 指定的模型（通常是大上下文窗口模型）
  // 用途：處理需要大量上下文歷史的對話
  const longContextThreshold = Router.longContextThreshold || 60000;
  const lastUsageThreshold =
    lastUsage &&
    lastUsage.input_tokens > longContextThreshold &&
    tokenCount > 20000;
  const tokenCountThreshold = tokenCount > longContextThreshold;
  if ((lastUsageThreshold || tokenCountThreshold) && Router.longContext) {
    logger?.info?.("[router] 命中長上下文路由");
    return Router.longContext;
  }

  // ========== 情況 3：子代理模型 ==========
  // 條件：req.body.system 是陣列，且第二個元素包含 <CCR-SUBAGENT-MODEL> 標籤
  // 行為：從標籤中提取模型名稱，並從 system 中移除該標籤
  // 用途：支持子代理指定特定模型，用於多代理協作場景
  // 示例：system[1].text = "<CCR-SUBAGENT-MODEL>claude-3-opus</CCR-SUBAGENT-MODEL>其他內容"
  if (
    Array.isArray(req.body?.system) &&
    req.body.system.length > 1 &&
    req.body.system[1]?.text?.startsWith("<CCR-SUBAGENT-MODEL>")
  ) {
    const modelMatch = req.body.system[1].text.match(
      /<CCR-SUBAGENT-MODEL>(.*?)<\/CCR-SUBAGENT-MODEL>/s
    );
    if (modelMatch) {
      req.body.system[1].text = req.body.system[1].text.replace(
        `<CCR-SUBAGENT-MODEL>${modelMatch[1]}</CCR-SUBAGENT-MODEL>`,
        ""
      );
      return modelMatch[1];
    }
  }

  // ========== 情況 4：Claude Haiku 背景模型 ==========
  // 條件：req.body.model 包含 "claude" 和 "haiku"（不區分大小寫）且配置了 Router.background
  // 行為：返回 Router.background 指定的模型
  // 用途：將 Haiku 請求路由到專門的背景處理模型
  const isClaudeHaiku =
    req.body?.model?.toLowerCase?.().includes("claude") &&
    req.body?.model?.toLowerCase?.().includes("haiku");
  if (isClaudeHaiku && Router.background) {
    logger?.info?.("[router] 發現 haiku 背景模型，使用 background 配置");
    return Router.background;
  }

  // ========== 情況 5：Web 搜尋工具路由 ==========
  // 條件：req.body.tools 是陣列，且包含 type 以 "web_search" 開頭的工具，且配置了 Router.webSearch
  // 行為：返回 Router.webSearch 指定的模型
  // 用途：使用 Web 搜尋功能時，可能需要特定模型來處理搜尋結果
  const hasWebSearchTool =
    Array.isArray(req.body?.tools) &&
    req.body.tools.some((tool) => tool?.type?.startsWith?.("web_search"));
  if (hasWebSearchTool && Router.webSearch) {
    logger?.info?.("[router] 請求包含 web_search 工具，使用 webSearch 配置");
    return Router.webSearch;
  }

  // ========== 情況 6：思考/推理路由 ==========
  // 條件：req.body.thinking 或 req.body.reasoning 存在且不為 "none"，且配置了 Router.think
  // 行為：返回 Router.think 指定的模型
  // 用途：需要模型進行深度思考或推理時，使用專門的思考模型
  const hasThinking = req.body?.thinking && req.body.thinking !== "none";
  const hasReasoning = req.body?.reasoning && req.body.reasoning !== "none";
  if ((hasThinking || hasReasoning) && Router.think) {
    logger?.info?.("[router] 請求要求 thinking/reasoning，使用 think 配置");
    return Router.think;
  }

  // ========== 情況 7：預設模型 ==========
  // 條件：以上所有情況都不滿足
  // 行為：返回 Router.default 指定的模型
  // 用途：作為所有請求的最終回退選項
  return Router.default;
};

/**
 * Core router entry. Mutates req.body.model with the chosen upstream model.
 * @param {Object} req - Incoming request-like object containing body + metadata
 * @param {Object} config - Configuration object { Router, Providers, CUSTOM_ROUTER_PATH? }
 * @param {Object} opts - { lastUsageCache?: Map, logger?: console }
 * @returns {Promise<string>} chosen model string
 */
const route = async (req, config, opts = {}) => {
  const { lastUsageCache, logger = console } = opts;
  // 将 logger 挂到 req，后续选择逻辑也能打印
  req.logger = logger;

  // extract session id from metadata.user_id
  const userId = req.body?.metadata?.user_id;
  if (userId && typeof userId === "string" && userId.includes("_session_")) {
    const parts = userId.split("_session_");
    if (parts.length > 1) {
      req.sessionId = parts[1];
    }
  }

  const { messages = [], system = [], tools = [] } = req.body || {};
  const tokenCount = calculateTokenCount(messages, system, tools);
  req.tokenCount = tokenCount;
  logger?.debug?.(`[router] 估算 token 数: ${tokenCount}`);

  let model;
  const customPath = config.CUSTOM_ROUTER_PATH;
  if (customPath && fs.existsSync(customPath)) {
    try {
      const customRouter = require(customPath);
      logger?.info?.(`[router] 使用自定义路由: ${customPath}`);
      model = await customRouter(req, config, { logger });
    } catch (e) {
      logger.error?.(`Failed to run custom router: ${e.message}`);
    }
  }

  if (!model) {
    const lastUsage = lastUsageCache?.get?.(req.sessionId);
    model = await selectModel(req, tokenCount, config, lastUsage);
  }

  req.body.model = model;
  logger?.info?.(`[router] 最终选择模型: ${model}`);
  return model;
};

function createRouteMiddleware(config, sessionUsageCache, logger) {
  return async (req, _reply) => {
    if (
      req.url.startsWith("/v1/messages") &&
      !req.url.startsWith("/v1/messages/count_tokens")
    ) {
      await route(req, config, {
        lastUsageCache: sessionUsageCache,
        logger: logger,
      });
    }
  };
}

module.exports = {
  calculateTokenCount,
  createRouteMiddleware,
};
