const fs = require("fs");
const { spawn } = require("child_process");
const { CLIPBOARD_WATCH_PID_FILE } = require("../config/constants");
const { killProcessByPid } = require("../utils/processManager");

const readClipboardWatchPid = () => {
  if (!fs.existsSync(CLIPBOARD_WATCH_PID_FILE)) return null;
  try {
    const pid = parseInt(fs.readFileSync(CLIPBOARD_WATCH_PID_FILE, "utf8"));
    return Number.isNaN(pid) ? null : pid;
  } catch (err) {
    console.warn("读取剪贴板监听 PID 文件失败:", err);
    return null;
  }
};

const isProcessRunning = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const writeClipboardWatchPid = (pid) => {
  fs.writeFileSync(CLIPBOARD_WATCH_PID_FILE, String(pid), "utf8");
};

const clearClipboardWatchPid = () => {
  if (fs.existsSync(CLIPBOARD_WATCH_PID_FILE)) {
    fs.unlinkSync(CLIPBOARD_WATCH_PID_FILE);
  }
};

function registerClipboardWatchRoutes(app) {
  app.get("/api/clipboard-watch/status", async () => {
    const pid = readClipboardWatchPid();
    const running = isProcessRunning(pid);
    if (!running) {
      clearClipboardWatchPid();
    }
    return { running, pid: running ? pid : null };
  });

  app.get("/api/clipboard-watch/start", async (req, reply) => {
    try {
      const existingPid = readClipboardWatchPid();
      if (isProcessRunning(existingPid)) {
        return { success: true, running: true, pid: existingPid };
      }

      // 使用当前主模块路径（打包后仍然有效），而不是硬编码的文件路径
      // process.argv[1] 在打包后会指向打包后的文件
      const scriptPath = process.argv[1] || require.main.filename;

      const child = spawn(process.execPath, [scriptPath, "--clipboard-watch"], {
        detached: true,
        stdio: "inherit", // 继承父进程的 stdio，让主进程可以看到日志输出
        windowsHide: true,
      });

      writeClipboardWatchPid(child.pid);
      child.unref();

      return { success: true, running: true, pid: child.pid };
    } catch (error) {
      console.error("启动剪贴板监听任务失败:", error);
      return reply
        .status(500)
        .send({ success: false, message: "启动任务失败" });
    }
  });

  app.get("/api/clipboard-watch/stop", async (req, reply) => {
    try {
      const pid = readClipboardWatchPid();
      if (!pid || !isProcessRunning(pid)) {
        clearClipboardWatchPid();
        return { success: true, running: false };
      }

      // 使用通用函数关闭进程，从 pidFile 读取 pid
      const success = await killProcessByPid({
        pidFile: CLIPBOARD_WATCH_PID_FILE,
        processName: "剪贴板监听",
        silent: false,
        timeout: 5000,
      });

      return { success, running: false };
    } catch (error) {
      console.error("停止剪贴板监听任务失败:", error);
      clearClipboardWatchPid();
      return reply
        .status(500)
        .send({ success: false, message: "停止任务失败" });
    }
  });
}

module.exports = { registerClipboardWatchRoutes };
