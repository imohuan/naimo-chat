const { readFile, readdir, mkdir, unlink, stat, access, writeFile } = require("fs/promises");
const path = require("path");
const { CLAUDE_PROJECTS_DIR } = require("../config/constants")
const { randomUUID } = require("crypto");

// ============================================
// 配置区域
// ============================================

const PROJECTS_ROOT_DIR = CLAUDE_PROJECTS_DIR

const SESSION_TTL_MS = 30_000; // 30s 保留已结束会话，避免 EventSource 自动重连时 404

// ============================================
// 工具函数
// ============================================

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
    const entries = await readdir(PROJECTS_ROOT_DIR, { withFileTypes: true });
    const folders = entries.filter((entry) => entry.isDirectory());

    for (const folder of folders) {
      const folderPath = path.join(PROJECTS_ROOT_DIR, folder.name);

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
 * 从事件中提取文本内容
 */
function extractTextFromEvents(events) {
  let text = "";
  for (const ev of events) {
    if (ev?.type === "content_block_delta" && ev?.delta?.text) {
      text += ev.delta.text;
    } else if (ev?.type === "content_block" && Array.isArray(ev.content)) {
      for (const part of ev.content) {
        if (part?.text) text += part.text;
      }
    } else if (ev?.type === "message" && Array.isArray(ev.content)) {
      for (const part of ev.content) {
        if (part?.text) text += part.text;
      }
    }
  }
  return text.trim();
}

/**
 * 读取请求体
 */
async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buf = Buffer.concat(chunks).toString("utf-8");
  if (!buf) return null;
  return JSON.parse(buf);
}

/**
 * 发送 JSON 响应
 */
function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

/**
 * 生成 MCP 配置文件
 */
async function ensureMcpConfigFile(streamingId, hostname, port) {
  const base = `http://${hostname}:${port}`;
  const mcpServerPath = path.resolve(__dirname, "mcp-server.js");

  const config = {
    mcpServers: {
      "demo-permissions": {
        command: process.execPath,
        args: [mcpServerPath],
        env: {
          APPROVAL_ENDPOINT_BASE: base,
          MCP_STREAMING_ID: streamingId,
        },
      },
    },
  };

  const outPath = path.join(__dirname, "mcp-config.json");
  await writeFile(outPath, JSON.stringify(config, null, 2), "utf-8");

  console.log("[mcp-config] Generated MCP config", {
    outPath,
    streamingId,
    nodeExecPath: process.execPath,
    mcpServerPath,
    command: config.mcpServers["demo-permissions"].command,
    args: config.mcpServers["demo-permissions"].args,
  });

  return outPath;
}

/**
 * 生成唯一 ID
 */
function generateId() {
  return randomUUID();
}

module.exports = {
  PROJECTS_ROOT_DIR,
  SESSION_TTL_MS,
  getClaudeConfig,
  findProjectPathBySessionId,
  folderNameToPath,
  extractTextFromEvents,
  readRequestBody,
  sendJson,
  ensureMcpConfigFile,
  generateId,
};
