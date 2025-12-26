/**
 * 主进程管理器
 * 负责启动和管理服务子进程，实现真正的重启功能
 */
const { spawn } = require("child_process");
const { cleanupPidFile, savePid } = require("./process");

// 保存子进程引用
let childProcess = null;
let restartRequested = false;
let isFirstStart = true; // 标记是否是首次启动

/**
 * 启动服务子进程
 * 使用当前脚本路径（支持打包后的单文件）和 --service 参数
 */
function startService() {
  if (childProcess && !childProcess.killed) {
    console.log("服务子进程已在运行");
    return;
  }

  // 使用当前主模块路径（打包后仍然有效），而不是硬编码的文件路径
  // process.argv[1] 在打包后会指向打包后的文件
  const scriptPath = process.argv[1] || require.main.filename;

  console.log("正在启动服务子进程...");
  childProcess = spawn(process.execPath, [scriptPath, "--service"], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  // 保存子进程 PID
  savePid(childProcess.pid);

  // 监听子进程退出
  childProcess.on("exit", (code, signal) => {
    console.log(`服务子进程退出，代码: ${code}, 信号: ${signal}`);
    childProcess = null;

    // 如果请求了重启，则重新启动
    if (restartRequested) {
      restartRequested = false;
      console.log("重启请求已处理，等待端口释放...");
      setTimeout(() => {
        startService();
      }, 2000);
    } else {
      // 清理 PID 文件
      cleanupPidFile();
    }
  });

  // 监听子进程错误
  childProcess.on("error", (error) => {
    console.error("启动服务子进程时出错:", error);
    childProcess = null;
    cleanupPidFile();
  });

  return childProcess;
}

/**
 * 重启服务
 */
function restartService() {
  if (!childProcess || childProcess.killed) {
    console.log("服务未运行，直接启动...");
    startService();
    return;
  }

  console.log("收到重启请求，正在关闭当前服务...");
  restartRequested = true;
  isFirstStart = false; // 标记不是首次启动

  // 发送 SIGTERM 信号给子进程，让它优雅关闭
  try {
    childProcess.kill("SIGTERM");
  } catch (error) {
    console.error("关闭子进程时出错:", error);
    // 如果 SIGTERM 失败，强制杀死
    if (childProcess && !childProcess.killed) {
      childProcess.kill("SIGKILL");
    }
    childProcess = null;
    startService();
  }
}

/**
 * 停止服务
 */
function stopService() {
  if (!childProcess || childProcess.killed) {
    console.log("服务未运行");
    return;
  }

  restartRequested = false;
  try {
    childProcess.kill("SIGTERM");
  } catch (error) {
    console.error("停止服务时出错:", error);
    if (childProcess && !childProcess.killed) {
      childProcess.kill("SIGKILL");
    }
  }
  childProcess = null;
  cleanupPidFile();
}

/**
 * 检查服务是否运行
 */
function isServiceRunning() {
  return childProcess && !childProcess.killed;
}

/**
 * 通用的进程关闭函数
 * @param {object} options - 配置选项
 * @param {string} options.pidFile - PID 文件路径（如果提供，会从此文件读取 pid）
 * @param {number} [options.pid] - 要关闭的进程 ID（可选，如果提供了 pidFile 则从文件读取）
 * @param {string} [options.processName="进程"] - 进程名称，用于日志输出
 * @param {boolean} [options.silent=false] - 是否静默模式，不输出日志
 * @param {number} [options.timeout=5000] - 等待进程关闭的超时时间（毫秒）
 * @param {boolean} [options.shouldExit=false] - 是否在完成后退出进程
 * @returns {Promise<boolean>} 成功关闭返回 true，否则返回 false
 *
 * @example
 * // 通过 PID 文件关闭进程（推荐）
 * const { PID_FILE } = require("../config/constants");
 * await killProcessByPid({ pidFile: PID_FILE, processName: "服务" });
 *
 * @example
 * // 通过 PID 文件关闭剪贴板监听
 * const { CLIPBOARD_WATCH_PID_FILE } = require("../config/constants");
 * await killProcessByPid({ pidFile: CLIPBOARD_WATCH_PID_FILE, processName: "剪贴板监听" });
 *
 * @example
 * // 直接通过 PID 关闭（不推荐，通常不需要）
 * await killProcessByPid({ pid: 12345, processName: "进程" });
 */
function killProcessByPid(options = {}) {
  const {
    pidFile = null,
    pid: providedPid = null,
    processName = "进程",
    silent = false,
    timeout = 5000,
    shouldExit = false,
  } = options;

  const { readFileSync, existsSync, unlinkSync } = require("fs");
  const { execSync } = require("child_process");

  // 从 pidFile 读取 pid，如果提供了 pidFile
  let pid = providedPid;
  if (pidFile && existsSync(pidFile)) {
    try {
      const pidStr = readFileSync(pidFile, "utf-8");
      const filePid = parseInt(pidStr, 10);
      if (!isNaN(filePid)) {
        pid = filePid;
      } else {
        if (!silent) {
          console.log(`❌ ${processName} PID 文件格式错误。`);
        }
        // 清理无效的 PID 文件
        try {
          unlinkSync(pidFile);
        } catch {
          // 忽略清理错误
        }
        if (shouldExit) {
          process.exit(1);
        }
        return Promise.resolve(false);
      }
    } catch (error) {
      if (!silent) {
        console.error(`❌ 读取 ${processName} PID 文件失败:`, error.message);
      }
      if (shouldExit) {
        process.exit(1);
      }
      return Promise.resolve(false);
    }
  } else if (pidFile && !existsSync(pidFile)) {
    if (!silent) {
      console.log(`❌ ${processName} PID 文件不存在，服务可能未运行。`);
    }
    if (shouldExit) {
      process.exit(0);
    }
    return Promise.resolve(false);
  }

  // 如果既没有 pidFile 也没有 pid，返回错误
  if (!pid) {
    if (!silent) {
      console.error("❌ 必须提供 pidFile 或 pid 参数。");
    }
    if (shouldExit) {
      process.exit(1);
    }
    return Promise.resolve(false);
  }

  // 清理 PID 文件的辅助函数
  const cleanupPidFileIfNeeded = () => {
    if (pidFile && existsSync(pidFile)) {
      try {
        unlinkSync(pidFile);
      } catch {
        // 忽略清理错误
      }
    }
  };

  // 检查进程是否存在的辅助函数
  const checkProcessExists = (pidToCheck) => {
    try {
      if (process.platform === "win32") {
        process.kill(pidToCheck, 0);
      } else {
        process.kill(pidToCheck, 0);
      }
      return true;
    } catch (error) {
      if (error.code === "ESRCH") {
        return false;
      }
      throw error;
    }
  };

  // 强制终止进程的辅助函数
  const forceKill = (pidToKill) => {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pidToKill} /F /T`, { stdio: "ignore" });
      } else {
        process.kill(pidToKill, "SIGKILL");
      }
      return true;
    } catch {
      return false;
    }
  };

  return new Promise((resolve) => {
    // 检查进程是否存在
    if (!checkProcessExists(pid)) {
      if (!silent) {
        console.log(`❌ ${processName} (PID: ${pid}) 不存在，可能已经停止。`);
      }
      cleanupPidFileIfNeeded();
      if (shouldExit) {
        process.exit(0);
      }
      resolve(false);
      return;
    }

    if (!silent) {
      console.log(`正在停止 ${processName} (PID: ${pid})...`);
    }

    // 发送停止信号
    try {
      if (process.platform === "win32") {
        // Windows 平台：直接 kill（Windows 不支持 Unix 信号）
        process.kill(pid);
      } else {
        // Unix 平台：发送 SIGTERM 信号
        process.kill(pid, "SIGTERM");
      }

      if (!silent) {
        console.log(`✅ 已发送停止信号，等待 ${processName} 关闭...`);
      }

      // 等待进程退出
      let waited = 0;
      const checkInterval = setInterval(() => {
        waited += 100;

        if (!checkProcessExists(pid)) {
          // 进程已退出
          clearInterval(checkInterval);
          cleanupPidFileIfNeeded();
          if (!silent) {
            console.log(`✅ ${processName} 已停止。`);
          }
          if (shouldExit) {
            process.exit(0);
          }
          resolve(true);
          return;
        }

        if (waited >= timeout) {
          // 超时后强制终止
          if (!silent) {
            console.log(`⚠️  ${processName} 未响应，强制终止...`);
          }
          forceKill(pid);
          clearInterval(checkInterval);
          cleanupPidFileIfNeeded();
          if (!silent) {
            console.log(`✅ ${processName} 已强制停止。`);
          }
          if (shouldExit) {
            process.exit(0);
          }
          resolve(true);
        }
      }, 100);
    } catch (error) {
      if (error.code === "ESRCH") {
        // 进程不存在
        if (!silent) {
          console.log(`❌ ${processName} (PID: ${pid}) 不存在，可能已经停止。`);
        }
        cleanupPidFileIfNeeded();
        if (shouldExit) {
          process.exit(0);
        }
        resolve(false);
      } else {
        if (!silent) {
          console.error(`❌ 停止 ${processName} 时出错:`, error.message);
        }
        cleanupPidFileIfNeeded();
        if (shouldExit) {
          process.exit(1);
        }
        resolve(false);
      }
    }
  });
}

/**
 * 通过 PID 文件停止剪贴板监听服务（用于外部调用）
 */
function stopClipboardWatchByPid() {
  const { CLIPBOARD_WATCH_PID_FILE } = require("../config/constants");

  // 使用通用函数关闭进程，从 pidFile 读取 pid
  killProcessByPid({
    pidFile: CLIPBOARD_WATCH_PID_FILE,
    processName: "剪贴板监听",
    shouldExit: true,
  }).catch((error) => {
    console.error("❌ 停止剪贴板监听服务时出错:", error.message);
    process.exit(1);
  });
}

/**
 * 通过 PID 文件停止服务（用于外部调用，如 --stop 参数）
 * 同时会尝试关闭剪贴板监听服务
 */
function stopServiceByPid() {
  const { existsSync } = require("fs");
  const { PID_FILE, CLIPBOARD_WATCH_PID_FILE } = require("../config/constants");

  // 先尝试关闭剪贴板监听服务
  if (existsSync(CLIPBOARD_WATCH_PID_FILE)) {
    console.log("正在关闭剪贴板监听服务...");
    killProcessByPid({
      pidFile: CLIPBOARD_WATCH_PID_FILE,
      processName: "剪贴板监听",
      silent: false,
      timeout: 3000,
      shouldExit: false,
    }).catch((error) => {
      console.warn("关闭剪贴板监听服务时出错:", error.message);
    });
  }

  // 使用通用函数关闭主服务进程，从 pidFile 读取 pid
  killProcessByPid({
    pidFile: PID_FILE,
    processName: "服务",
    shouldExit: true,
  }).catch((error) => {
    console.error("❌ 停止服务时出错:", error.message);
    process.exit(1);
  });
}

/**
 * 检查是否是首次启动
 * @returns {boolean} 如果是首次启动返回 true，否则返回 false
 */
function getIsFirstStart() {
  return isFirstStart;
}

/**
 * 设置首次启动标志
 * @param {boolean} value - 是否是首次启动
 */
function setIsFirstStart(value) {
  isFirstStart = value;
}

module.exports = {
  startService,
  restartService,
  stopService,
  stopServiceByPid,
  stopClipboardWatchByPid,
  killProcessByPid,
  isServiceRunning,
  getIsFirstStart,
  setIsFirstStart,
};
