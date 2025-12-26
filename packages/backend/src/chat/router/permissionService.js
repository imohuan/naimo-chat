/**
 * 权限管理服务
 * 
 * 内存中的权限请求追踪器，用于管理 Claude CLI 工具调用的审批流程：
 * - 注册待审批的权限请求
 * - 查询权限请求列表
 * - 处理审批/拒绝决策
 */

const { randomUUID } = require("crypto");

/**
 * @typedef {Object} PermissionRequest
 * @property {string} id - 权限请求唯一标识
 * @property {string} toolName - 工具名称（如 Write, Edit, Bash, Read）
 * @property {Object} toolInput - 工具输入参数
 * @property {string} streamingId - 关联的聊天会话 ID
 * @property {'pending'|'approved'|'denied'} status - 请求状态
 * @property {string} timestamp - 创建时间 ISO 字符串
 * @property {Object} [modifiedInput] - 审批时修改后的输入参数
 * @property {string} [denyReason] - 拒绝原因
 */

/**
 * 权限服务类
 * 
 * 提供权限请求的增删改查功能
 */
class PermissionService {
  constructor() {
    /** @type {Map<string, PermissionRequest>} */
    this.requests = new Map();
  }

  /**
   * 添加新的权限请求
   * 
   * @param {string} toolName - 工具名称
   * @param {Object} toolInput - 工具输入参数
   * @param {string} [streamingId='unknown'] - 关联的会话 ID
   * @returns {PermissionRequest} 创建的权限请求对象
   */
  add(toolName, toolInput, streamingId = "unknown") {
    const id = randomUUID();
    const request = {
      id,
      toolName,
      toolInput,
      streamingId,
      status: "pending",
      timestamp: new Date().toISOString(),
    };
    this.requests.set(id, request);
    return request;
  }

  /**
   * 查询权限请求列表
   * 
   * @param {Object} [filter={}] - 过滤条件
   * @param {string} [filter.streamingId] - 按会话 ID 过滤
   * @param {string} [filter.status] - 按状态过滤
   * @returns {PermissionRequest[]} 符合条件的权限请求列表
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
   * @param {string} id - 权限请求 ID
   * @returns {PermissionRequest|undefined} 权限请求对象
   */
  get(id) {
    return this.requests.get(id);
  }

  /**
   * 处理权限决策
   * 
   * @param {string} id - 权限请求 ID
   * @param {'approve'|'deny'} action - 决策动作
   * @param {Object} [options={}] - 附加选项
   * @param {Object} [options.modifiedInput] - 修改后的输入参数（仅 approve 时有效）
   * @param {string} [options.denyReason] - 拒绝原因（仅 deny 时有效）
   * @returns {PermissionRequest|null} 更新后的权限请求，失败返回 null
   */
  decide(id, action, options = {}) {
    const req = this.requests.get(id);

    // 仅处理 pending 状态的请求
    if (!req || req.status !== "pending") {
      return null;
    }

    if (action === "approve") {
      req.status = "approved";
      if (options.modifiedInput) {
        req.modifiedInput = options.modifiedInput;
      }
    } else if (action === "deny") {
      req.status = "denied";
      if (options.denyReason) {
        req.denyReason = options.denyReason;
      }
    } else {
      return null;
    }

    return req;
  }

  /**
   * 清除所有权限请求（用于测试）
   */
  clear() {
    this.requests.clear();
  }
}

// 导出单例实例
const permissionService = new PermissionService();

module.exports = {
  PermissionService,
  permissionService,
};
