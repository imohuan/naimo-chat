const { spawn } = require("child_process");
const path = require("path");

/**
 * Claude CLI 相关路由：
 * - 启动一个新的终端窗口（PowerShell 或 CMD）
 * - 设置对应的环境变量
 * - 执行指定的 Claude 命令（例如 `claude`）
 *
 * 前端可以传入：
 * - timeoutMs: API 超时时间
 * - baseUrl:   Anthropic / Claude 基础 URL
 * - apiKey:    Anthropic API Key
 * - claudePath: 要执行的命令（默认 "claude"）
 * - workDir:   工作目录（默认 "G:\\ClaudeCode"）
 * - terminalType: 终端类型（"powershell" 或 "cmd"，默认 "powershell"）
 */
function registerClaudeRoutes(server) {
  const app = server.app;

  // 规范化路径：使用 path.normalize 处理 /、\、\\、// 等多重分隔，并去掉末尾多余的分隔符
  const normalizeWindowsPath = (input) => {
    if (!input || typeof input !== "string") return "";
    // 使用 Node 内置的 path.normalize 进行规范化
    let normalized = path.normalize(input);
    // 去掉末尾多余的路径分隔符（兼容 / 和 \）
    normalized = normalized.replace(/[\\/]+$/g, "");
    return normalized;
  };

  app.post("/api/claude/start", async (req, reply) => {
    const {
      timeoutMs = "300000",
      baseUrl = "http://127.0.0.1:3457/",
      apiKey = "sk-imohuan",
      claudePath = "claude",
      workDir = "c:",
      terminalType = "powershell",
    } = req.body || {};

    try {
      // 处理路径中的 / \ \\ // 等情况，统一为 Windows 风格路径
      const normalizedWorkDir = normalizeWindowsPath(String(workDir));
      const rawClaudePath = String(claudePath);
      // 仅当命令中包含路径分隔符时才进行规范化，例如 "C:/xxx/claude.ps1"
      const normalizedClaudePath = /[\\/]/.test(rawClaudePath)
        ? normalizeWindowsPath(rawClaudePath)
        : rawClaudePath;

      const env = {
        ...process.env,
        API_TIMEOUT_MS: String(timeoutMs),
        ANTHROPIC_BASE_URL: String(baseUrl),
        ANTHROPIC_AUTH_TOKEN: String(apiKey),
      };

      const normalizedTerminalType = String(terminalType).toLowerCase();
      const isPowerShell =
        normalizedTerminalType === "powershell" || normalizedTerminalType === "ps";

      let child;
      let successMessage;

      if (isPowerShell) {
        // 通过 cmd 的 start 打开新的 PowerShell 窗口
        // cwd 已设置，直接执行命令即可
        child = spawn(
          "cmd.exe",
          ["/c", "start", "powershell", "-NoExit", "-Command", normalizedClaudePath],
          {
            shell: true,
            cwd: normalizedWorkDir,
            detached: true,
            stdio: "ignore",
            env,
          }
        );
        successMessage = "已在新的 PowerShell 窗口中启动 Claude（命令已发送）";
      } else {
        // 通过 cmd 的 start 打开新的 CMD 窗口
        // cwd 已设置，直接执行命令即可
        child = spawn(
          "cmd.exe",
          ["/c", "start", "cmd", "/k", normalizedClaudePath],
          {
            shell: true,
            cwd: normalizedWorkDir,
            detached: true,
            stdio: "ignore",
            env,
          }
        );
        successMessage = "已在新的 CMD 窗口中启动 Claude（命令已发送）";
      }

      // 让子进程在后台独立运行
      child.unref();

      return {
        success: true,
        message: successMessage,
      };
    } catch (error) {
      console.error("启动 Claude 失败:", error);
      return reply.status(500).send({
        success: false,
        message: "启动 Claude 失败",
        error: error.message,
      });
    }
  });
}

module.exports = { registerClaudeRoutes };
