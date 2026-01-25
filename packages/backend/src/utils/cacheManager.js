const fs = require("fs");
const path = require("path");
const {
  CONFIG_BACKUP_DIR,
  MCP_TOOL_CALL_LOG_DIR,
  CHAT_MESSAGE_DIR,
  CLIPBOARD_IMAGES_DIR,
  LOGS_DIR,
} = require("../config/constants");

// 允许清理的缓存目录配置
const ALLOWED_CACHE_DIRECTORIES = {
  CONFIG_BACKUP: {
    key: "CONFIG_BACKUP",
    name: "配置备份",
    path: CONFIG_BACKUP_DIR,
    description: "存储配置文件的备份",
  },
  MCP_TOOL_CALL_LOG: {
    key: "MCP_TOOL_CALL_LOG",
    name: "MCP工具调用日志",
    path: MCP_TOOL_CALL_LOG_DIR,
    description: "存储MCP工具调用的日志记录",
  },
  CHAT_MESSAGE: {
    key: "CHAT_MESSAGE",
    name: "聊天消息",
    path: CHAT_MESSAGE_DIR,
    description: "存储聊天对话消息",
  },
  CLIPBOARD_IMAGES: {
    key: "CLIPBOARD_IMAGES",
    name: "剪贴板图片",
    path: CLIPBOARD_IMAGES_DIR,
    description: "存储剪贴板中的图片",
  },
  LOGS: {
    key: "LOGS",
    name: "日志文件",
    path: LOGS_DIR,
    description: "存储系统运行日志",
  },
};

/**
 * 获取目录大小和文件数量
 * @param {string} dirPath - 目录路径
 * @returns {Promise<{size: number, fileCount: number, folderCount: number}>}
 */
async function getDirectoryStats(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  let folderCount = 0;

  try {
    // 检查目录是否存在
    if (!fs.existsSync(dirPath)) {
      return { size: 0, fileCount: 0, folderCount: 0, exists: false };
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { size: 0, fileCount: 0, folderCount: 0, exists: false };
    }

    // 递归遍历目录
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const itemStat = fs.statSync(itemPath);

        if (itemStat.isDirectory()) {
          folderCount++;
          const subStats = await getDirectoryStats(itemPath);
          totalSize += subStats.size;
          fileCount += subStats.fileCount;
          folderCount += subStats.folderCount;
        } else {
          fileCount++;
          totalSize += itemStat.size;
        }
      } catch (error) {
        console.warn(`无法访问文件: ${itemPath}`, error.message);
      }
    }

    return {
      size: totalSize,
      fileCount,
      folderCount,
      exists: true,
    };
  } catch (error) {
    console.error(`获取目录统计信息失败: ${dirPath}`, error);
    return { size: 0, fileCount: 0, folderCount: 0, exists: false };
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 获取所有允许的缓存目录列表
 * @returns {Array}
 */
function getAllowedCacheDirectories() {
  return Object.values(ALLOWED_CACHE_DIRECTORIES).map((dir) => ({
    key: dir.key,
    name: dir.name,
    path: dir.path,
    description: dir.description,
  }));
}

/**
 * 获取所有缓存目录的信息
 * @returns {Promise<Array>}
 */
async function getCacheDirectoriesInfo() {
  const results = [];

  for (const [key, config] of Object.entries(ALLOWED_CACHE_DIRECTORIES)) {
    const stats = await getDirectoryStats(config.path);
    results.push({
      key: config.key,
      name: config.name,
      path: config.path,
      description: config.description,
      exists: stats.exists,
      size: stats.size,
      sizeFormatted: formatSize(stats.size),
      fileCount: stats.fileCount,
      folderCount: stats.folderCount,
    });
  }

  // 计算总计
  const total = results.reduce(
    (acc, item) => ({
      size: acc.size + item.size,
      fileCount: acc.fileCount + item.fileCount,
      folderCount: acc.folderCount + item.folderCount,
    }),
    { size: 0, fileCount: 0, folderCount: 0 }
  );

  return {
    directories: results,
    total: {
      ...total,
      sizeFormatted: formatSize(total.size),
    },
  };
}

/**
 * 递归删除目录内容（保留目录本身）
 * @param {string} dirPath - 目录路径
 * @returns {Promise<{deletedFiles: number, deletedFolders: number}>}
 */
async function clearDirectoryContents(dirPath) {
  let deletedFiles = 0;
  let deletedFolders = 0;

  try {
    if (!fs.existsSync(dirPath)) {
      return { deletedFiles, deletedFolders };
    }

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      try {
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          const subResult = await clearDirectoryContents(itemPath);
          deletedFiles += subResult.deletedFiles;
          deletedFolders += subResult.deletedFolders;
          fs.rmdirSync(itemPath);
          deletedFolders++;
        } else {
          fs.unlinkSync(itemPath);
          deletedFiles++;
        }
      } catch (error) {
        console.warn(`删除失败: ${itemPath}`, error.message);
      }
    }

    return { deletedFiles, deletedFolders };
  } catch (error) {
    console.error(`清空目录失败: ${dirPath}`, error);
    throw error;
  }
}

/**
 * 清空指定的缓存目录
 * @param {string} directoryKey - 目录键名
 * @returns {Promise<Object>}
 */
async function clearCacheDirectory(directoryKey) {
  // 验证目录是否在允许列表中
  const config = ALLOWED_CACHE_DIRECTORIES[directoryKey];

  if (!config) {
    return {
      success: false,
      error: `不允许清理的目录: ${directoryKey}`,
      allowedDirectories: Object.keys(ALLOWED_CACHE_DIRECTORIES),
    };
  }

  try {
    // 获取清理前的统计信息
    const beforeStats = await getDirectoryStats(config.path);

    if (!beforeStats.exists) {
      return {
        success: true,
        message: "目录不存在，无需清理",
        directory: config.name,
        path: config.path,
        deletedFiles: 0,
        deletedFolders: 0,
      };
    }

    // 清空目录内容
    const result = await clearDirectoryContents(config.path);

    return {
      success: true,
      message: "清理成功",
      directory: config.name,
      path: config.path,
      deletedFiles: result.deletedFiles,
      deletedFolders: result.deletedFolders,
      freedSpace: formatSize(beforeStats.size),
    };
  } catch (error) {
    console.error(`清理目录失败: ${config.path}`, error);
    return {
      success: false,
      error: `清理失败: ${error.message}`,
      directory: config.name,
      path: config.path,
    };
  }
}

module.exports = {
  getAllowedCacheDirectories,
  getCacheDirectoriesInfo,
  clearCacheDirectory,
  formatSize,
};
