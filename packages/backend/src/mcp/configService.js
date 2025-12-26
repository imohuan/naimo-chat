const fs = require("fs");
const { MCP_SERVERS_CONFIG_FILE } = require("../config/constants");

const CONFIG_FILE = MCP_SERVERS_CONFIG_FILE;

class ConfigService {
  constructor() {
    this.config = { mcpServers: {} };
    this.loadConfig();
  }

  normalizeConfig(config = {}) {
    // 默认开启，如果显式传入 false 则关闭
    return { ...config, enabled: config.enabled !== false };
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, "utf8");
        this.config = JSON.parse(data);
      } else {
        // 如果配置文件不存在，则创建默认配置文件
        this.saveConfig();
      }
    } catch (error) {
      console.error("加载 MCP 配置失败:", error);
      // 出错时保持默认配置
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(this.config, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("保存 MCP 配置失败:", error);
      throw error;
    }
  }

  getConfig() {
    return this.config;
  }

  getAllServers() {
    return this.config.mcpServers || {};
  }

  getServer(name) {
    return this.config.mcpServers?.[name];
  }

  createServer(name, config) {
    if (!this.config.mcpServers) {
      this.config.mcpServers = {};
    }

    if (this.config.mcpServers[name]) {
      throw new Error(`名为 "${name}" 的服务器已存在`);
    }

    const normalizedConfig = this.normalizeConfig(config);
    this.validateServerConfig(normalizedConfig);
    this.config.mcpServers[name] = normalizedConfig;
    this.saveConfig();
    return config;
  }

  updateServer(name, config) {
    if (!this.config.mcpServers?.[name]) {
      throw new Error(`名为 "${name}" 的服务器未找到`);
    }

    const normalizedConfig = this.normalizeConfig(config);
    this.validateServerConfig(normalizedConfig);
    this.config.mcpServers[name] = normalizedConfig;
    this.saveConfig();
    return config;
  }

  deleteServer(name) {
    if (this.config.mcpServers?.[name]) {
      delete this.config.mcpServers[name];
      this.saveConfig();
      return true;
    }
    return false;
  }

  validateServerConfig(config) {
    // 基本验证
    const isStdio = config.command && Array.isArray(config.args);
    const isHttp = config.url; // HTTP/SSE 的基本检查

    if (!isStdio && !isHttp) {
      throw new Error(
        '无效的服务器配置: 必须为 stdio 提供 "command" 和 "args"，或为 HTTP/SSE 提供 "url"'
      );
    }
  }

  setConfig(config = {}) {
    // 全量替换配置，目前仅支持 mcpServers
    const inputServers = config.mcpServers || {};
    const normalizedServers = {};

    for (const [name, serverConfig] of Object.entries(inputServers)) {
      const normalizedConfig = this.normalizeConfig(serverConfig || {});
      this.validateServerConfig(normalizedConfig);
      normalizedServers[name] = normalizedConfig;
    }

    this.config = { mcpServers: normalizedServers };
    this.saveConfig();
    return this.config;
  }
}

module.exports = new ConfigService();
