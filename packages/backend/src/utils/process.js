/**
 * 进程管理相关工具函数
 */
const { existsSync, writeFileSync, readFileSync, unlinkSync } = require("fs");
const { mkdirSync } = require("fs");
const { execSync } = require("child_process");
const { PID_FILE, HOME_DIR } = require("../config/constants");

/**
 * 保存 PID
 * 将进程 ID 保存到文件中
 * @param {number} pid - 进程 ID
 * @returns {void}
 */
function savePid(pid) {
  try {
    if (!existsSync(HOME_DIR)) {
      mkdirSync(HOME_DIR, { recursive: true });
    }
    writeFileSync(PID_FILE, pid.toString());
  } catch (error) {
    console.error("Failed to save PID:", error);
  }
}

/**
 * 清理 PID 文件
 * 删除保存进程 ID 的文件
 * @returns {void}
 */
function cleanupPidFile() {
  if (existsSync(PID_FILE)) {
    try {
      unlinkSync(PID_FILE);
    } catch (e) {
      // 忽略清理错误
    }
  }
}

/**
 * 检查服务是否运行
 * 通过读取 PID 文件并检查进程是否存在来判断服务是否正在运行
 * 支持 Windows 和 Linux/macOS 平台
 * @returns {boolean} 如果服务正在运行返回 true，否则返回 false
 */
function isServiceRunning() {
  if (!existsSync(PID_FILE)) {
    return false;
  }
  try {
    const pidStr = readFileSync(PID_FILE, "utf-8");
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) {
      cleanupPidFile();
      return false;
    }
    // Windows 平台检查
    if (process.platform === "win32") {
      try {
        const command = `tasklist /FI "PID eq ${pid}"`;
        const output = execSync(command, { stdio: "pipe" }).toString();
        if (output.includes(pid.toString())) {
          return true;
        } else {
          cleanupPidFile();
          return false;
        }
      } catch (e) {
        cleanupPidFile();
        return false;
      }
    } else {
      // Linux/macOS 平台检查
      try {
        process.kill(pid, 0);
        return true;
      } catch (e) {
        cleanupPidFile();
        return false;
      }
    }
  } catch (e) {
    return false;
  }
}

module.exports = {
  savePid,
  cleanupPidFile,
  isServiceRunning,
};

