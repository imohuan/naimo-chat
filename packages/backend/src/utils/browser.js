/**
 * 浏览器相关工具函数
 */
const { exec } = require("child_process");

/**
 * 打开浏览器（跨平台支持）
 * @param {string} url - 要打开的 URL
 * @param {Object} options - 选项
 * @param {boolean} options.silent - 是否静默执行（不输出日志）
 * @returns {void}
 */
function openBrowser(url, options = {}) {
  const { silent = false } = options;
  const platform = process.platform;
  let command;

  switch (platform) {
    case "win32":
      // Windows: 使用 start 命令
      command = `start "" "${url}"`;
      break;
    case "darwin":
      // macOS: 使用 open 命令
      command = `open "${url}"`;
      break;
    default:
      // Linux 和其他 Unix 系统: 使用 xdg-open
      command = `xdg-open "${url}"`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      if (!silent) {
        console.warn(`⚠️ 无法自动打开浏览器: ${error.message}`);
        console.log(`请手动访问: ${url}`);
      }
    } else {
      if (!silent) {
        console.log(`🌐 已打开浏览器: ${url}`);
      }
    }
  });
}

module.exports = {
  openBrowser,
};
