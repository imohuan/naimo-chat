#!/usr/bin/env node

/**
 * 开发环境启动脚本
 * 使用子进程同时启动前端和后端服务
 */

const { spawn } = require("child_process");
const path = require("path");

// 颜色输出工具
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function colorLog(color, label, message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `${colors[color]}[${timestamp}] [${label}]${colors.reset} ${message}`
  );
}

// 获取项目根目录
const rootDir = path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "packages", "backend");
const frontendDir = path.join(rootDir, "packages", "frontend");

// 存储子进程
const processes = [];

// 清理函数
function cleanup() {
  colorLog("yellow", "CLEANUP", "正在关闭所有服务...");

  processes.forEach((proc) => {
    if (proc && !proc.killed) {
      try {
        // Windows 使用 taskkill，Unix 使用 kill
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", proc.pid, "/f", "/t"], {
            stdio: "ignore",
            shell: true,
          });
        } else {
          proc.kill("SIGTERM");
        }
      } catch (error) {
        // 忽略错误
      }
    }
  });

  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

// 注册退出信号处理
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

// 启动后端服务
function startBackend() {
  return new Promise((resolve, reject) => {
    colorLog("cyan", "BACKEND", "正在启动后端服务...");

    // 直接使用 node 启动后端入口文件
    const backendProcess = spawn("node", ["src/index_llm.js"], {
      cwd: backendDir,
      stdio: "pipe",
      shell: true,
      env: { ...process.env },
    });

    processes.push(backendProcess);

    // 收集所有输出，以便在进程退出时显示完整的错误信息
    let stdoutBuffer = "";
    let stderrBuffer = "";

    backendProcess.stdout.on("data", (data) => {
      const message = data.toString();
      stdoutBuffer += message;

      // 保持原始格式输出，不破坏换行
      if (message.trim()) {
        // 为每一行添加前缀，但保持原始换行
        const lines = message.split("\n");
        const formattedLines = lines.map(line => {
          if (line.trim()) {
            const timestamp = new Date().toLocaleTimeString();
            return `${colors.blue}[${timestamp}] [BACKEND]${colors.reset} ${line}`;
          }
          return line;
        }).join("\n");

        process.stdout.write(formattedLines);

        // 检测服务启动成功
        if (
          message.includes("服务已启动") ||
          message.includes("Server listening") ||
          message.includes("listening on") ||
          message.includes("ready")
        ) {
          colorLog("green", "BACKEND", "✅ 后端服务启动成功");
          resolve();
        }
      }
    });

    backendProcess.stderr.on("data", (data) => {
      const message = data.toString();
      stderrBuffer += message;

      // 保持原始格式输出，不破坏换行
      if (message.trim()) {
        const lines = message.split("\n");
        const formattedLines = lines.map(line => {
          if (line.trim()) {
            const timestamp = new Date().toLocaleTimeString();
            return `${colors.red}[${timestamp}] [BACKEND]${colors.reset} ${line}`;
          }
          return line;
        }).join("\n");

        process.stderr.write(formattedLines);
      }
    });

    backendProcess.on("error", (error) => {
      colorLog("red", "BACKEND", `启动失败: ${error.message}`);
      reject(error);
    });

    backendProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        colorLog("red", "BACKEND", `进程退出，代码: ${code}`);

        // 如果进程异常退出，显示所有收集到的输出
        if (code !== 143) {
          // 143 是 SIGTERM 的正常退出码
          if (stderrBuffer.trim()) {
            colorLog("red", "BACKEND", "=== 错误输出 ===");
            const errorLines = stderrBuffer.split("\n");
            for (const line of errorLines) {
              const trimmed = line.trim();
              if (trimmed) {
                colorLog("red", "BACKEND", trimmed);
              }
            }
          }
          if (stdoutBuffer.trim() && !stdoutBuffer.includes("服务已启动")) {
            // 如果 stdout 中有输出但未检测到启动成功消息，也显示出来
            colorLog("yellow", "BACKEND", "=== 标准输出 ===");
            const outputLines = stdoutBuffer.split("\n");
            for (const line of outputLines.slice(-20)) {
              // 只显示最后 20 行，避免输出过多
              const trimmed = line.trim();
              if (trimmed) {
                colorLog("yellow", "BACKEND", trimmed);
              }
            }
          }
          reject(new Error(`后端服务异常退出: ${code}`));
        }
      }
    });

    // 超时处理：如果 30 秒内没有检测到启动成功，也继续（可能日志格式不同）
    setTimeout(() => {
      if (!backendProcess.killed) {
        colorLog(
          "yellow",
          "BACKEND",
          "⚠️  未检测到启动成功消息，但进程仍在运行"
        );
        resolve();
      }
    }, 30000);
  });
}

// 启动前端服务
function startFrontend() {
  return new Promise((resolve, reject) => {
    colorLog("magenta", "FRONTEND", "正在启动前端服务...");

    // 使用 pnpm 启动前端
    const frontendProcess = spawn("pnpm", ["dev"], {
      cwd: frontendDir,
      stdio: "pipe",
      shell: true,
      env: { ...process.env },
    });

    processes.push(frontendProcess);

    frontendProcess.stdout.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        colorLog("magenta", "FRONTEND", message);

        // 检测 Vite 启动成功
        if (
          message.includes("Local:") ||
          message.includes("Network:") ||
          message.includes("ready in") ||
          message.includes("VITE")
        ) {
          colorLog("green", "FRONTEND", "✅ 前端服务启动成功");
          resolve();
        }
      }
    });

    frontendProcess.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message) {
        // Vite 可能将一些信息输出到 stderr，但不一定是错误
        if (message.includes("Local:") || message.includes("Network:")) {
          colorLog("magenta", "FRONTEND", message);
        } else {
          colorLog("red", "FRONTEND", message);
        }
      }
    });

    frontendProcess.on("error", (error) => {
      colorLog("red", "FRONTEND", `启动失败: ${error.message}`);
      reject(error);
    });

    frontendProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        colorLog("red", "FRONTEND", `进程退出，代码: ${code}`);
        if (code !== 143) {
          reject(new Error(`前端服务异常退出: ${code}`));
        }
      }
    });

    // 超时处理
    setTimeout(() => {
      if (!frontendProcess.killed) {
        colorLog(
          "yellow",
          "FRONTEND",
          "⚠️  未检测到启动成功消息，但进程仍在运行"
        );
        resolve();
      }
    }, 30000);
  });
}

// 主函数
async function main() {
  try {
    colorLog("bright", "START", "🚀 开始启动开发环境...\n");

    // 并行启动前后端
    await Promise.all([startBackend(), startFrontend()]);

    colorLog("green", "SUCCESS", "\n✨ 所有服务已启动！");
    colorLog("cyan", "INFO", "按 Ctrl+C 停止所有服务\n");
  } catch (error) {
    colorLog("red", "ERROR", `启动失败: ${error.message}`);
    cleanup();
    process.exit(1);
  }
}

// 运行主函数
main();
