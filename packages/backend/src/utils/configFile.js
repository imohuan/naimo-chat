const { existsSync, readFileSync, copyFileSync } = require("fs");
const { mkdir, writeFile, readFile } = require("fs/promises");
const { join } = require("path");
const { homedir } = require("os");
const { HOME_DIR, CONFIG_FILE, CONFIG_BACKUP_DIR } = require("../config/constants");
const { PROVIDER_CONFIG } = require("../config/provider");

/**
 * 读取配置文件
 * 从配置文件中读取并解析 JSON 内容
 * @returns {Promise<Object|null>} 配置对象，如果文件不存在或读取失败则返回 null
 */
const readConfigFile = async () => {
  try {
    if (existsSync(CONFIG_FILE)) {
      const content = readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Failed to read config file:", error);
  }
  return null;
};

/**
 * 备份配置文件
 * 创建配置文件的备份，文件名包含时间戳
 * @returns {Promise<string|null>} 备份文件路径，如果备份失败则返回 null
 */
const backupConfigFile = async () => {
  try {
    if (existsSync(CONFIG_FILE)) {
      await mkdir(CONFIG_BACKUP_DIR, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = join(CONFIG_BACKUP_DIR, `config.${timestamp}.bak`);
      copyFileSync(CONFIG_FILE, backupPath);
      return backupPath;
    }
  } catch (error) {
    console.error("Failed to backup config file:", error);
  }
  return null;
};

/**
 * 写入配置文件
 * 将配置对象写入配置文件，如果目录不存在则创建
 * @param {Object} config - 配置对象
 * @returns {Promise<void>}
 * @throws {Error} 当写入文件失败时抛出错误
 */
const writeConfigFile = async (config) => {
  try {
    await mkdir(HOME_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error("Failed to write config file:", error);
    throw error;
  }
};

/**
 * 初始化 Claude 配置
 * 在用户主目录下创建 .claude.json 配置文件（如果不存在）
 * @returns {Promise<void>}
 */
async function initializeClaudeConfig() {
  const homeDir = homedir();
  const configPath = join(homeDir, ".claude.json");
  if (!existsSync(configPath)) {
    const userID = Array.from(
      { length: 64 },
      () => Math.random().toString(16)[2]
    ).join("");
    const configContent = {
      numStartups: 184,
      autoUpdaterStatus: "enabled",
      userID,
      hasCompletedOnboarding: true,
      lastOnboardingVersion: "1.0.17",
      projects: {},
    };
    await writeFile(configPath, JSON.stringify(configContent, null, 2));
  }
}

/**
 * 读取配置文件并初始化
 * 读取配置文件，将配置合并到环境变量，如果文件不存在则返回默认配置
 * @returns {Promise<Object>} 配置对象
 */
async function initConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const content = await readFile(CONFIG_FILE, "utf-8");
      const config = JSON.parse(content);
      // 将配置合并到环境变量
      Object.assign(process.env, config);
      return config;
    }
  } catch (error) {
    console.error("Failed to read config file:", error);
  }

  // 返回默认配置
  return {
    ...PROVIDER_CONFIG,
    PORT: process.env.PORT || 3457,
    HOST: process.env.HOST || "127.0.0.1",
    // APIKEY: process.env.APIKEY || "",
    LOG: process.env.LOG !== "false",
    LOG_LEVEL: process.env.LOG_LEVEL || "debug",
  };
}

module.exports = {
  readConfigFile,
  backupConfigFile,
  writeConfigFile,
  initializeClaudeConfig,
  initConfig,
};
