/**
 * 对话文件读写锁工具
 * 确保并发访问时的数据一致性
 */

const fs = require("fs").promises;
const path = require("path");
const { PROJECT_DIR } = require("../../config/constants");

// 文件锁映射：conversationId -> Promise
const fileLocks = new Map();

/**
 * 获取对话文件路径
 */
function getConversationFilePath(id) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(PROJECT_DIR, `chat_${safeId}.json`);
}

/**
 * 获取或创建文件锁
 * @param {string} conversationId - 对话ID
 * @returns {Promise} 锁的 Promise
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
 * 内部读取函数（不带锁，用于已持有锁的情况）
 * @param {string} id - 对话ID
 * @returns {Promise<Object|null>} 对话对象或 null
 */
async function _readConversationFileInternal(id) {
  const filePath = getConversationFilePath(id);

  try {
    const content = await fs.readFile(filePath, "utf-8");

    // 检查内容是否为空或只有空白字符
    if (!content || !content.trim()) {
      console.warn(`对话文件为空: ${filePath}`);
      return null;
    }

    // 解析 JSON
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error(`对话文件 JSON 解析失败: ${filePath}`, parseError);
      console.error(`文件内容预览: ${content.substring(0, 200)}...`);
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
 * @param {string} id - 对话ID
 * @param {Object} data - 对话数据
 * @returns {Promise<void>}
 */
async function _writeConversationFileInternal(id, data) {
  const filePath = getConversationFilePath(id);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 读取对话文件（带锁）
 * @param {string} id - 对话ID
 * @returns {Promise<Object|null>} 对话对象或 null
 */
async function readConversationFile(id) {
  const releaseLock = await acquireLock(id);

  try {
    return await _readConversationFileInternal(id);
  } finally {
    releaseLock();
  }
}

/**
 * 写入对话文件（带锁）
 * @param {string} id - 对话ID
 * @param {Object} data - 对话数据
 * @returns {Promise<void>}
 */
async function writeConversationFile(id, data) {
  const releaseLock = await acquireLock(id);

  try {
    await _writeConversationFileInternal(id, data);
  } finally {
    releaseLock();
  }
}

/**
 * 更新对话文件中的特定消息版本（带锁）
 * 根据 versionId 匹配消息版本并更新
 * @param {string} conversationId - 对话ID
 * @param {string} versionId - 版本ID（requestId）
 * @param {Function} updateFn - 更新函数 (version, message) => void，返回 true 表示已更新
 * @returns {Promise<boolean>} 是否成功更新
 */
async function updateMessageByRequestId(conversationId, versionId, updateFn) {
  const releaseLock = await acquireLock(conversationId);

  try {
    const conversation = await _readConversationFileInternal(conversationId);
    if (!conversation || !conversation.messages) {
      return false;
    }

    // 查找匹配的消息版本
    let updated = false;
    for (const message of conversation.messages) {
      if (message.versions && Array.isArray(message.versions)) {
        const version = message.versions.find((v) => v.id === versionId);
        if (version) {
          const result = updateFn(version, message);
          if (result !== false) {
            updated = true;
            conversation.updatedAt = Date.now();
          }
          break;
        }
      }
    }

    if (updated) {
      await _writeConversationFileInternal(conversationId, conversation);
    }

    return updated;
  } finally {
    releaseLock();
  }
}


/**
 * 删除对话文件（带锁）
 * @param {string} id - 对话ID
 * @returns {Promise<void>}
 */
async function deleteConversationFile(id) {
  const filePath = getConversationFilePath(id);
  const releaseLock = await acquireLock(id);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  } finally {
    releaseLock();
  }
}

module.exports = {
  readConversationFile,
  writeConversationFile,
  updateMessageByRequestId,
  deleteConversationFile,
  getConversationFilePath,
};

