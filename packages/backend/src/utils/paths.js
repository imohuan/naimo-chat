const fs = require("fs");
const path = require("path");
const { mkdir, access } = require("fs/promises");
const { HOME_DIR, LOGS_DIR } = require("../config/constants");


/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 * @returns {Promise<void>}
 */
const ensureDirAsync = async (dirPath) => {
  try {
    await access(dirPath);
  } catch {
    await mkdir(dirPath, { recursive: true });
  }
};

/**
 * 初始化目录
 * 确保 HOME_DIR 和 logs 目录存在，如果不存在则创建
 * @returns {Promise<void>}
 */
async function initDir() {
  await ensureDirAsync(HOME_DIR);
  await ensureDirAsync(LOGS_DIR);
}

/** 确保保存目录存在 */
function ensureDir(dirPath) {
  // 使用 recursive 确保父级目录不存在时也能创建成功
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`创建目录: ${path.resolve(dirPath)}`);
  }
}

module.exports = {
  initDir,
  ensureDir,
  ensureDirAsync,
};
