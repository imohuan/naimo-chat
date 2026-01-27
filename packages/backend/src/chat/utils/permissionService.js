const { randomUUID } = require('crypto');

/**
 * 权限服务
 * 
 * 轻量级内存权限跟踪器，用于服务器。
 * 基本权限流程：
 *  - add() 注册待审批请求
 *  - list() 列出/过滤请求
 *  - decide() 标记批准/拒绝，并携带修改后的输入或拒绝原因
 */
class PermissionService {
  constructor() {
    /** @type {Map<string, PermissionRequest>} 权限请求映射表 */
    this.requests = new Map();
  }

  /**
   * 添加新的权限请求
   * 
   * @param {string} toolName - 工具名称
   * @param {Object} toolInput - 工具输入参数
   * @param {string} streamingId - 流ID，默认为 'unknown'
   * @returns {PermissionRequest} 创建的权限请求对象
   */
  add(toolName, toolInput, streamingId = 'unknown') {
    const id = randomUUID();
    const request = {
      id,
      toolName,
      toolInput,
      streamingId,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };
    this.requests.set(id, request);
    return request;
  }

  /**
   * 列出权限请求（支持过滤）
   * 
   * @param {Object} filter - 过滤条件
   * @param {string} [filter.streamingId] - 按流ID过滤
   * @param {string} [filter.status] - 按状态过滤（pending/approved/denied）
   * @returns {Array<PermissionRequest>} 符合条件的权限请求列表
   */
  list(filter = {}) {
    const { streamingId, status } = filter;
    return Array.from(this.requests.values()).filter((r) => {
      if (streamingId && r.streamingId !== streamingId) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }

  /**
   * 获取单个权限请求
   * 
   * @param {string} id - 权限请求ID
   * @returns {PermissionRequest|undefined} 权限请求对象，不存在则返回 undefined
   */
  get(id) {
    return this.requests.get(id);
  }

  /**
   * 对权限请求做出决策（批准或拒绝）
   * 
   * @param {string} id - 权限请求ID
   * @param {string} action - 操作类型：'approve' 或 'deny'
   * @param {Object} options - 可选参数
   * @param {Object} [options.modifiedInput] - 批准时修改后的输入参数
   * @param {string} [options.denyReason] - 拒绝时的原因
   * @returns {PermissionRequest|null} 更新后的权限请求对象，失败则返回 null
   */
  decide(id, action, options = {}) {
    const req = this.requests.get(id);
    if (!req || req.status !== 'pending') return null;

    if (action === 'approve') {
      req.status = 'approved';
      if (options.modifiedInput) req.modifiedInput = options.modifiedInput;
    } else if (action === 'deny') {
      req.status = 'denied';
      if (options.denyReason) req.denyReason = options.denyReason;
    } else {
      return null;
    }

    return req;
  }
}

/**
 * @typedef {Object} PermissionRequest
 * @property {string} id - 权限请求唯一标识
 * @property {string} toolName - 工具名称
 * @property {Object} toolInput - 工具输入参数
 * @property {string} streamingId - 关联的流ID
 * @property {string} status - 状态：'pending' | 'approved' | 'denied'
 * @property {string} timestamp - 创建时间戳
 * @property {Object} [modifiedInput] - 批准时修改后的输入（可选）
 * @property {string} [denyReason] - 拒绝原因（可选）
 */

module.exports = { PermissionService };
