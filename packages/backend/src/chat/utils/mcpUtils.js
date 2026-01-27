const path = require("path");
const { writeFile } = require("fs/promises");
const { MCP_SERVER_DIR } = require("../../config/constants.js")
const { ensureDirAsync } = require("../../utils/paths.js")
const { mcpServerText } = require("../mcp-server-text.js")

/**
 * 构建 MCP 配置对象
 * @param {Object} options - 配置选项
 * @param {string} options.baseUrl - API 基础 URL (例如: "http://localhost:8080")
 * @param {string} options.mcpServerPath - MCP 服务器脚本路径
 * @param {string} [options.streamingId] - 可选的流式会话 ID，用于传递环境变量
 * @returns {Object} MCP 配置对象
 */
function buildMcpConfig({ baseUrl, mcpServerPath, streamingId }) {
  const env = {
    APPROVAL_ENDPOINT_BASE: baseUrl,
  };

  // 如果提供了 streamingId，添加到环境变量中
  if (streamingId) {
    env.MCP_STREAMING_ID = streamingId;
  }

  return {
    mcpServers: {
      permissions: {
        // command: process.execPath,
        command: "node",
        args: [mcpServerPath],
        env,
      },
    },
  };
}

/**
 * 生成 MCP 配置文件
 */
async function ensureMcpConfigFile(streamingId, hostname, port) {
  const baseUrl = `http://${hostname}:${port}`;
  await ensureDirAsync(MCP_SERVER_DIR)

  // 将 mcpServerText 写入到 MCP_SERVER_DIR 目录下的 mcp-server.js 文件
  const mcpServerPath = path.join(MCP_SERVER_DIR, `mcp-server.js`);
  const mcpConfigPath = path.join(MCP_SERVER_DIR, `mcp-config.json`);

  const config = buildMcpConfig({ baseUrl, mcpServerPath, streamingId })

  await writeFile(mcpServerPath, mcpServerText, "utf-8");
  await writeFile(mcpConfigPath, JSON.stringify(config, null, 2), "utf-8");

  console.log("[mcp-config] 生成 MCP 配置", { mcpConfigPath, config });
  return mcpConfigPath;
}


module.exports = {
  buildMcpConfig,
  ensureMcpConfigFile,
};