const { readdir, access, } = require("fs/promises");
const path = require("path");
const { CLAUDE_PROJECTS_DIR } = require("../../config/constants.js");
const { randomUUID } = require("crypto");
const { readConfigFile } = require("../../utils/configFile.js");

// ============================================
// 工具函数
// ============================================

/**
 * 生成唯一 ID
 */
function generateId() {
  return randomUUID();
}

/**
 * 从配置文件中获取 Claude 相关配置
 * @returns {Promise<Object>} 配置对象，包含 HOST, PORT, APIKEY, API_TIMEOUT_MS, CLAUDE_PATH
 */
async function getClaudeConfig() {
  const defaultConfig = {
    HOST: "127.0.0.1",
    PORT: 3457,
    APIKEY: "sk-123456",
    API_TIMEOUT_MS: "300000",
    CLAUDE_PATH: process.platform === "win32" ? "claude.exe" : "claude",
  };

  try {
    const config = await readConfigFile() || defaultConfig;
    return {
      HOST: config.HOST || defaultConfig.HOST,
      PORT: Number(config.PORT) || defaultConfig.PORT,
      APIKEY: config.APIKEY || defaultConfig.APIKEY,
      API_TIMEOUT_MS: config.API_TIMEOUT_MS || defaultConfig.API_TIMEOUT_MS,
      CLAUDE_PATH: config.CLAUDE_PATH?.trim() || defaultConfig.CLAUDE_PATH,
    };
  } catch (error) {
    console.error("[chatRoutes] Failed to read config file:", error);
    // 出错时返回默认值
    return defaultConfig;
  }
}

/**
 * 根据 session ID 查找对应的项目目录
 * @param {string} sessionId - session ID
 * @returns {Promise<string|null>} - 返回项目路径，如果找不到返回 null
 */
async function findProjectPathBySessionId(sessionId) {
  try {
    const entries = await readdir(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
    const folders = entries.filter((entry) => entry.isDirectory());

    for (const folder of folders) {
      const folderPath = path.join(CLAUDE_PROJECTS_DIR, folder.name);

      try {
        const files = await readdir(folderPath);
        const found = files.some(file => {
          const fileNameWithoutExt = path.basename(file, ".jsonl");
          return file.endsWith(".jsonl") && fileNameWithoutExt === sessionId;
        });

        if (found) {
          console.log(`[findProjectPath] Found session ${sessionId} in folder: ${folder.name}`);
          return folder;
        }
      } catch (err) {
        // 忽略读取错误，继续下一个文件夹
      }
    }

    console.log(`[findProjectPath] Session ${sessionId} not found in any project`);
    return null;
  } catch (err) {
    console.error(`[findProjectPath] Error:`, err);
    return null;
  }
}

/**
 * 将文件夹名称转换为路径
 * 例如: E--Code-Git-code-skills -> E:/Code/Git/code-skills
 */
async function folderNameToPath(folderName) {
  const parts = folderName.split("--");
  if (parts.length < 2) return null;

  const drive = parts[0];
  const pathPart = parts.slice(1).join("--");
  const segments = pathPart.split("-");

  async function tryAllCombinations(currentPath, remainingSegments) {
    if (remainingSegments.length === 0) {
      try {
        await access(currentPath);
        return currentPath;
      } catch {
        return null;
      }
    }

    for (let i = 1; i <= remainingSegments.length; i++) {
      const combined = remainingSegments.slice(0, i).join("-");
      const newPath = path.join(currentPath, combined);

      try {
        await access(newPath);
        const result = await tryAllCombinations(newPath, remainingSegments.slice(i));
        if (result) return result;
      } catch {
        // 继续尝试下一个组合
      }
    }

    return null;
  }

  return await tryAllCombinations(`${drive}:/`, segments);
}

/**
 * 从 JSONL 文件中获取指定属性的第一次出现值
 * @param {string} sessionPath - JSONL 文件的完整路径
 * @param {string} attr - 要查找的属性名称
 * @returns {Promise<any|null>} - 返回属性值，如果未找到返回 null
 * @example
 * // 获取 cwd 属性
 * const cwd = await getSessionFileAttr('path/to/session.jsonl', 'cwd');
 * // 返回: "E:\\Code\\Git\\code-skills\\novel-to-video-studio"
 * 
 * // 获取不存在的属性
 * const notExist = await getSessionFileAttr('path/to/session.jsonl', 'notExist');
 * // 返回: null
 */
async function getSessionFileAttr(sessionPath, attr) {
  const fs = require("fs");
  const readline = require("readline");

  return new Promise((resolve, reject) => {
    let found = false;

    const fileStream = fs.createReadStream(sessionPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      if (found) return;

      try {
        const jsonObj = JSON.parse(line);
        if (jsonObj[attr] !== undefined) {
          found = true;
          rl.close();
          resolve(jsonObj[attr]);
        }
      } catch (err) {
        // 忽略解析错误，继续下一行
      }
    });

    rl.on("close", () => {
      if (!found) {
        resolve(null); // 未找到属性
      }
    });

    rl.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * 获取项目路径，优先使用 folderNameToPath，失败时使用 getSessionFileAttr 兜底
 * @param {string} folderName - 项目文件夹名称
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<string|null>} - 返回项目路径，如果获取失败返回 null
 * @example
 * const projectPath = await getProjectPath('E--Code-Git-project', 'session-id-123');
 */
async function getProjectPath(folderName, sessionId) {
  // 首先尝试使用 folderNameToPath
  let projectPath = await folderNameToPath(folderName);

  // 如果失败，使用 getSessionFileAttr 从 JSONL 文件中读取 cwd
  if (!projectPath && sessionId) {
    const sessionPath = path.join(CLAUDE_PROJECTS_DIR, folderName, `${sessionId}.jsonl`);
    try {
      projectPath = await getSessionFileAttr(sessionPath, 'cwd');
      if (projectPath) {
        console.log(`[getProjectPath] 通过 getSessionFileAttr 获取到项目路径: ${projectPath}`);
      }
    } catch (err) {
      console.error(`[getProjectPath] 读取 session 文件失败:`, err);
    }
  }

  return projectPath;
}

module.exports = {
  generateId,
  getClaudeConfig,
  findProjectPathBySessionId,
  folderNameToPath,
  getSessionFileAttr,
  getProjectPath,
};
