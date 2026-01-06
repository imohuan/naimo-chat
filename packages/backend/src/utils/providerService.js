/**
 * 获取 providerService 工具函数
 * @param {Object} server - 服务器实例
 * @returns {Object|null} providerService 对象，如果不存在则返回 null
 */
function getProviderService(server) {
  return server?.app?._server?.providerService || null;
}

const debug = false;
const fetch =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

/**
 * 根据配置构建基础 URL
 * @param {Object} config - 配置对象（包含 HOST, PORT）
 * @returns {string} 基础 URL
 */
function buildBaseUrl(config = {}) {
  const host = config.HOST || "127.0.0.1";
  const port = process.env.SERVICE_PORT || config.PORT || 3457;
  return `http://${host}:${port}`;
}

/**
 * 获取 providers 列表，优先使用 server 实例，否则回退到 HTTP fetch
 * @param {Object} config - 配置对象（包含 HOST, PORT）
 * @param {Object|null} server - 服务器实例
 * @returns {Promise<Array>} providers 列表
 */
async function getProviders(config = {}, server = null) {
  // 优先使用 server 实例直接调用 providerService
  const providerService = getProviderService(server);
  if (providerService) {
    return providerService.getProviders();
  }

  // 回退到 HTTP fetch
  const baseUrl = buildBaseUrl(config);
  const response = await fetch(`${baseUrl}/providers`);
  const data = await response.json().catch(() => null);
  return data;
}

/**
 * 设置 provider 的配置，优先使用 server 实例，否则回退到 HTTP fetch
 * @param {Object} target - provider 对象（包含 name 属性）
 * @param {Object} options - 要设置的配置对象（如 { apiKey }）
 * @param {Object} config - 配置对象（包含 HOST, PORT）
 * @param {Object|null} server - 服务器实例
 * @param {boolean} debug - 是否输出调试信息
 * @returns {Promise<boolean>} 是否设置成功
 */
async function setProvider(target, options = {}, config = {}, server = null) {
  // 优先使用 server 实例直接调用 providerService
  const providerService = getProviderService(server);
  if (providerService) {
    const updatedProvider = providerService.updateProvider(
      target.name,
      options
    );

    if (updatedProvider) {
      // console.log("设置 Provider 成功", target.name, options);
      return true;
    }
    console.warn("更新 Provider 失败，未找到:", target.name);
    return false;
  }

  // 回退到 HTTP fetch
  const baseUrl = buildBaseUrl(config);

  // 获取列表（仅调试时）
  if (debug) {
    const providers = await getProviders(config, server);
    console.log("providers", providers);
  }

  const response = await fetch(
    `${baseUrl}/providers/${encodeURIComponent(target.name)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // llms 路由定义使用 camelCase: apiKey
      body: JSON.stringify(options),
    }
  );
  const data = await response.json().catch(() => null);
  if (debug) console.log("setProvider", data);
  // console.log("设置 Provider 成功", target.name, options);

  return true;
}

module.exports = {
  getProviderService,
  buildBaseUrl,
  getProviders,
  setProvider,
};
