/**
 * AI Chat SSE 会话管理服务
 * 管理流式会话的生命周期，包括会话创建、事件推送、会话关闭
 */

/** @type {Map<string, Session>} 内存会话表 */
const sessions = new Map();

/** 会话保留时间（毫秒），避免 EventSource 自动重连时 404 */
const SESSION_TTL_MS = 30_000;

/**
 * @typedef {Object} Session
 * @property {Set<import('http').ServerResponse>} clients - SSE 客户端连接集合
 * @property {Array<Object>} events - 已发送的事件列表（用于重连回放）
 * @property {boolean} closed - 会话是否已关闭
 * @property {AbortController} [abortController] - 可选的中断控制器
 * @property {Array<Object>} [contentBlocks] - 当前已生成的内容块（用于中断时保存）
 * @property {string} [conversationId] - 对话ID（用于中断时更新消息）
 */

/**
 * 向指定会话的所有客户端推送 SSE 事件
 * 
 * @param {string} streamingId - 会话唯一标识
 * @param {Object} payload - 事件数据
 */
function sendEvent(streamingId, payload) {
  const session = sessions.get(streamingId);
  if (!session) return;

  // SSE 格式：data: JSON\n\n
  const data = `data: ${JSON.stringify(payload)}\n\n`;

  // 向所有客户端推送
  for (const res of session.clients) {
    try {
      res.write(data);
    } catch (error) {
      console.error("[aiChatSessionService] Failed to send event:", error);
    }
  }

  // 保存事件用于重连时回放
  session.events.push(payload);
}

/**
 * 关闭会话并通知所有客户端
 * 
 * @param {string} streamingId - 会话唯一标识
 */
function closeSession(streamingId) {
  const session = sessions.get(streamingId);
  if (!session) return;

  session.closed = true;

  // 如果存在 AbortController，触发中断
  if (session.abortController) {
    session.abortController.abort();
  }

  // 发送会话结束事件
  sendEvent(streamingId, {
    type: "session_end",
    timestamp: new Date().toISOString(),
  });

  // 关闭所有客户端连接
  for (const res of session.clients) {
    try {
      res.end();
    } catch (error) {
      console.error("[aiChatSessionService] Failed to close client:", error);
    }
  }
  session.clients.clear();

  // 延迟删除会话，避免 EventSource 自动重连立刻 404
  setTimeout(() => sessions.delete(streamingId), SESSION_TTL_MS);
}

/**
 * 创建新会话
 * 
 * @param {string} streamingId - 会话唯一标识
 * @returns {Session} 创建的会话对象
 */
function createSession(streamingId) {
  const session = {
    clients: new Set(),
    events: [],
    closed: false,
  };
  sessions.set(streamingId, session);
  return session;
}

/**
 * 获取会话
 * 
 * @param {string} streamingId - 会话唯一标识
 * @returns {Session|undefined} 会话对象，不存在则返回 undefined
 */
function getSession(streamingId) {
  return sessions.get(streamingId);
}

/**
 * 检查会话是否存在
 *
 * @param {string} streamingId - 会话唯一标识
 * @returns {boolean}
 */
function hasSession(streamingId) {
  return sessions.has(streamingId);
}

/**
 * 为会话设置 AbortController
 *
 * @param {string} streamingId - 会话唯一标识
 * @param {AbortController} abortController - 中断控制器
 */
function setAbortController(streamingId, abortController) {
  const session = sessions.get(streamingId);
  if (!session) return;

  session.abortController = abortController;
}

/**
 * 更新会话的内容块（用于中断时保存已生成的内容）
 *
 * @param {string} streamingId - 会话唯一标识
 * @param {Array<Object>} contentBlocks - 内容块数组
 */
function updateSessionContentBlocks(streamingId, contentBlocks) {
  const session = sessions.get(streamingId);
  if (!session) return;

  session.contentBlocks = contentBlocks;
}

/**
 * 设置会话的对话ID
 *
 * @param {string} streamingId - 会话唯一标识
 * @param {string} conversationId - 对话ID
 */
function setSessionConversationId(streamingId, conversationId) {
  const session = sessions.get(streamingId);
  if (!session) return;

  session.conversationId = conversationId;
}

/**
 * 中断会话的请求
 *
 * @param {string} streamingId - 会话唯一标识
 * @returns {boolean} 是否成功中断
 */
function abortSession(streamingId) {
  const session = sessions.get(streamingId);
  if (!session || !session.abortController) return false;

  session.abortController.abort();
  return true;
}

module.exports = {
  sendEvent,
  closeSession,
  createSession,
  getSession,
  hasSession,
  setAbortController,
  updateSessionContentBlocks,
  setSessionConversationId,
  abortSession,
  SESSION_TTL_MS,
};

