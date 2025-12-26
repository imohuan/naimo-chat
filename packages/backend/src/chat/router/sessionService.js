/**
 * 会话管理服务
 * 
 * 管理聊天流式会话的生命周期，包括：
 * - 会话创建与存储
 * - SSE 事件推送
 * - 会话关闭与清理
 */

/** @type {Map<string, Session>} 内存会话表 */
const sessions = new Map();

/** 会话保留时间（毫秒），避免 EventSource 自动重连时 404 */
const SESSION_TTL_MS = 30_000;

/**
 * @typedef {Object} Session
 * @property {import('child_process').ChildProcess|null} child - Claude CLI 子进程
 * @property {Set<import('http').ServerResponse>} clients - SSE 客户端连接集合
 * @property {Array<Object>} events - 已发送的事件列表（用于重连回放）
 * @property {boolean} closed - 会话是否已关闭
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
    res.write(data);
  }

  // 保存事件用于重连时回放
  session.events.push(payload);
}

/**
 * 关闭会话并通知所有客户端
 * 
 * @param {string} streamingId - 会话唯一标识
 * @param {number} code - 进程退出码
 */
function closeSession(streamingId, code) {
  const session = sessions.get(streamingId);
  if (!session) return;

  session.closed = true;

  // 发送进程结束事件
  sendEvent(streamingId, {
    type: "process_end",
    code,
    timestamp: new Date().toISOString(),
  });

  // 关闭所有客户端连接
  for (const res of session.clients) {
    res.end();
  }
  session.clients.clear();

  // 延迟删除会话，避免 EventSource 自动重连立刻 404
  setTimeout(() => sessions.delete(streamingId), SESSION_TTL_MS);
}

/**
 * 创建新会话
 * 
 * @param {string} streamingId - 会话唯一标识
 * @param {import('child_process').ChildProcess|null} child - Claude CLI 子进程（可选）
 * @returns {Session} 创建的会话对象
 */
function createSession(streamingId, child = null) {
  const session = {
    child,
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
 * 删除会话
 * 
 * @param {string} streamingId - 会话唯一标识
 */
function deleteSession(streamingId) {
  sessions.delete(streamingId);
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

module.exports = {
  sendEvent,
  closeSession,
  createSession,
  getSession,
  deleteSession,
  hasSession,
  SESSION_TTL_MS,
};
