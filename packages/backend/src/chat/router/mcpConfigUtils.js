/**
 * MCP 配置工具函数
 * 提供通用的 MCP 配置生成逻辑
 */

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
        command: process.execPath,
        args: [mcpServerPath],
        env,
      },
    },
  };
}

module.exports = { buildMcpConfig };

