/**
 * Canvas 文件管理工具
 * 用于管理 Canvas 代码历史文件的读写操作
 */

const fs = require("fs").promises;
const path = require("path");
const { PROJECT_DIR } = require("../../config/constants");
const { ensureDir } = require("../../utils/paths");
const { randomUUID } = require("crypto");

// 文件锁映射：conversationId -> Promise
const fileLocks = new Map();

/**
 * 获取或创建文件锁
 * @param {string} conversationId - 对话ID
 * @returns {Promise<Function>} 释放锁的函数
 */
async function acquireLock(conversationId) {
  // 如果已有锁，等待它完成
  if (fileLocks.has(conversationId)) {
    await fileLocks.get(conversationId);
  }

  // 创建新的锁
  let resolveLock;
  const lockPromise = new Promise((resolve) => {
    resolveLock = resolve;
  });

  fileLocks.set(conversationId, lockPromise);

  // 返回释放锁的函数
  return () => {
    fileLocks.delete(conversationId);
    resolveLock();
  };
}

/**
 * 获取 Canvas 文件路径
 * @param {string} conversationId - 对话ID
 * @returns {string} Canvas 文件路径
 */
function getCanvasFilePath(conversationId) {
  const safeId = conversationId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(PROJECT_DIR, `chat_${safeId}-canvas.json`);
}

/**
 * 内部读取函数（不带锁，用于已持有锁的情况）
 * @param {string} conversationId - 对话ID
 * @returns {Promise<Object|null>} Canvas 数据对象或 null
 */
async function _readCanvasFileInternal(conversationId) {
  const filePath = getCanvasFilePath(conversationId);

  try {
    const content = await fs.readFile(filePath, "utf-8");

    // 检查内容是否为空或只有空白字符
    if (!content || !content.trim()) {
      return null;
    }

    // 解析 JSON
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error(`Canvas 文件 JSON 解析失败: ${filePath}`, parseError);
      return null;
    }
  } catch (error) {
    // 文件不存在，返回 null
    if (error.code === "ENOENT") {
      return null;
    }
    // 其他错误直接抛出
    throw error;
  }
}

/**
 * 内部写入函数（不带锁，用于已持有锁的情况）
 * @param {string} conversationId - 对话ID
 * @param {Object} data - Canvas 数据对象
 * @returns {Promise<void>}
 */
async function _writeCanvasFileInternal(conversationId, data) {
  // 确保目录存在
  await ensureDir(PROJECT_DIR);

  const filePath = getCanvasFilePath(conversationId);

  // 更新 updatedAt 时间戳
  data.updatedAt = Date.now();

  // 写入文件
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 读取 Canvas 文件（带锁）
 * @param {string} conversationId - 对话ID
 * @returns {Promise<Object|null>} Canvas 数据对象或 null
 */
async function readCanvasFile(conversationId) {
  const releaseLock = await acquireLock(conversationId);

  try {
    return await _readCanvasFileInternal(conversationId);
  } finally {
    releaseLock();
  }
}

/**
 * 写入 Canvas 文件（带锁）
 * @param {string} conversationId - 对话ID
 * @param {Object} data - Canvas 数据对象
 * @returns {Promise<void>}
 */
async function writeCanvasFile(conversationId, data) {
  const releaseLock = await acquireLock(conversationId);

  try {
    await _writeCanvasFileInternal(conversationId, data);
  } finally {
    releaseLock();
  }
}

/**
 * 内部初始化函数（不带锁，用于已持有锁的情况）
 * @param {string} conversationId - 对话ID
 * @returns {Promise<Object>} 初始化后的 Canvas 数据对象
 */
async function _initCanvasFileInternal(conversationId) {
  const canvasData = {
    conversationId,
    codeHistory: {
      versions: [],
      currentVersionIndex: 0,
    },
    updatedAt: Date.now(),
  };

  await _writeCanvasFileInternal(conversationId, canvasData);
  return canvasData;
}

/**
 * 初始化 Canvas 文件结构（带锁）
 * @param {string} conversationId - 对话ID
 * @returns {Promise<Object>} 初始化后的 Canvas 数据对象
 */
async function initCanvasFile(conversationId) {
  const releaseLock = await acquireLock(conversationId);

  try {
    return await _initCanvasFileInternal(conversationId);
  } finally {
    releaseLock();
  }
}

/**
 * 更新 Canvas 代码历史
 * @param {string} conversationId - 对话ID
 * @param {Function} updateFn - 更新函数 (codeHistory) => void，返回 true 表示已更新
 * @returns {Promise<Object>} 更新后的 Canvas 数据对象
 */
async function updateCanvasCodeHistory(conversationId, updateFn) {
  const releaseLock = await acquireLock(conversationId);

  try {
    // 读取现有数据（使用内部函数，不获取锁）
    let canvasData = await _readCanvasFileInternal(conversationId);

    // 如果文件不存在，初始化（使用内部函数，不获取锁）
    if (!canvasData) {
      canvasData = await _initCanvasFileInternal(conversationId);
    }

    // 确保 codeHistory 结构存在
    if (!canvasData.codeHistory) {
      canvasData.codeHistory = {
        versions: [],
        currentVersionIndex: 0,
      };
    }

    // 执行更新函数
    const result = updateFn(canvasData.codeHistory);

    // 如果更新函数返回 true 或未返回 false，保存文件（使用内部函数，不获取锁）
    if (result !== false) {
      await _writeCanvasFileInternal(conversationId, canvasData);
    }

    return canvasData;
  } finally {
    releaseLock();
  }
}

/**
 * 添加新的代码记录到当前版本
 * @param {string} conversationId - 对话ID
 * @param {Object} record - 代码记录对象
 * @param {string} record.code - 完整代码（可选）
 * @param {string} record.diff - Diff 内容（可选）
 * @param {string} record.originalCode - 原始代码（可选）
 * @returns {Promise<{recordId: string, versionId: string}>} 返回记录ID和版本ID
 */
async function addCodeRecord(conversationId, record) {
  const recordId = `record_${randomUUID()}`;
  const timestamp = Date.now();

  const canvasData = await updateCanvasCodeHistory(conversationId, (codeHistory) => {
    // 获取当前版本索引
    let currentVersionIndex = codeHistory.currentVersionIndex || 0;

    // 如果当前版本索引无效或不存在，创建新版本
    if (
      !codeHistory.versions ||
      currentVersionIndex < 0 ||
      currentVersionIndex >= codeHistory.versions.length
    ) {
      // 创建新版本
      const versionId = `version_${randomUUID()}`;
      const newVersion = {
        id: versionId,
        timestamp,
        label: `版本 ${(codeHistory.versions?.length || 0) + 1}`,
        records: [],
        currentIndex: 0,
      };

      if (!codeHistory.versions) {
        codeHistory.versions = [];
      }
      codeHistory.versions.push(newVersion);
      currentVersionIndex = codeHistory.versions.length - 1;
      codeHistory.currentVersionIndex = currentVersionIndex;
    }

    // 获取当前版本
    const currentVersion = codeHistory.versions[currentVersionIndex];

    // 创建新记录
    const newRecord = {
      id: recordId,
      code: record.code || "",
      diff: record.diff || "",
      originalCode: record.originalCode || "",
      timestamp,
    };

    // 添加到当前版本的记录列表
    if (!currentVersion.records) {
      currentVersion.records = [];
    }
    currentVersion.records.push(newRecord);
    currentVersion.currentIndex = currentVersion.records.length - 1;

    return true;
  });

  // 获取版本ID
  const versionId =
    canvasData.codeHistory.versions[canvasData.codeHistory.currentVersionIndex]?.id || null;

  return { recordId, versionId };
}

/**
 * 添加新的代码版本（每次更新创建一个新版本）
 * @param {string} conversationId - 对话ID
 * @param {Object} record - 代码记录对象
 * @param {string} record.code - 完整代码（可选）
 * @param {string} record.diff - Diff 内容（可选）
 * @param {string} record.originalCode - 原始代码（可选）
 * @param {string} [record.label] - 版本标签（可选，默认自动生成）
 * @returns {Promise<{recordId: string, versionId: string}>} 返回记录ID和版本ID
 */
async function addCodeVersion(conversationId, record) {
  const recordId = `record_${randomUUID()}`;
  const timestamp = Date.now();

  const canvasData = await updateCanvasCodeHistory(conversationId, (codeHistory) => {
    // 确保 versions 数组存在
    if (!codeHistory.versions) {
      codeHistory.versions = [];
    }

    // 创建新版本
    const versionId = `version_${randomUUID()}`;
    const versionNumber = codeHistory.versions.length + 1;
    const newVersion = {
      id: versionId,
      timestamp,
      label: record.label || `版本 ${versionNumber}`,
      records: [],
      currentIndex: 0,
    };

    // 创建新记录
    const newRecord = {
      id: recordId,
      code: record.code || "",
      diff: record.diff || "",
      originalCode: record.originalCode || "",
      timestamp,
    };

    // 将记录添加到新版本
    newVersion.records.push(newRecord);
    newVersion.currentIndex = 0;

    // 添加新版本到版本列表
    codeHistory.versions.push(newVersion);
    // 设置新版本为当前版本
    codeHistory.currentVersionIndex = codeHistory.versions.length - 1;

    return true;
  });

  // 获取版本ID
  const versionId =
    canvasData.codeHistory.versions[canvasData.codeHistory.currentVersionIndex]?.id || null;

  return { recordId, versionId };
}

/**
 * 更新代码记录（用于应用 diff 后保存完整代码）
 * @param {string} conversationId - 对话ID
 * @param {string} recordId - 记录ID
 * @param {string} code - 应用 diff 后的完整代码
 * @returns {Promise<boolean>} 是否成功更新
 */
async function updateCodeRecord(conversationId, recordId, code) {
  let updated = false;

  await updateCanvasCodeHistory(conversationId, (codeHistory) => {
    // 遍历所有版本查找记录
    for (const version of codeHistory.versions || []) {
      if (version.records && Array.isArray(version.records)) {
        const record = version.records.find((r) => r.id === recordId);
        if (record) {
          record.code = code;
          updated = true;
          return true;
        }
      }
    }
    return false;
  });

  return updated;
}

/**
 * 获取代码记录
 * @param {string} conversationId - 对话ID
 * @param {string} recordId - 记录ID
 * @returns {Promise<Object|null>} 代码记录对象或 null
 */
async function getCodeRecord(conversationId, recordId) {
  const canvasData = await readCanvasFile(conversationId);
  if (!canvasData || !canvasData.codeHistory) {
    return null;
  }

  // 遍历所有版本查找记录
  for (const version of canvasData.codeHistory.versions || []) {
    if (version.records && Array.isArray(version.records)) {
      const record = version.records.find((r) => r.id === recordId);
      if (record) {
        return record;
      }
    }
  }

  return null;
}

module.exports = {
  getCanvasFilePath,
  readCanvasFile,
  writeCanvasFile,
  initCanvasFile,
  updateCanvasCodeHistory,
  addCodeRecord,
  addCodeVersion,
  updateCodeRecord,
  getCodeRecord,
};

