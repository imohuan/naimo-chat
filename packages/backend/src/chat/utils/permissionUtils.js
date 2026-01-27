/**
 * 权限管理工具函数
 * 
 * 处理工具调用的权限检查和注册
 */

/**
 * 从消息中注册权限请求
 *
 * @param {Object} msg - 消息对象
 * @param {string} streamingId - 流ID
 * @param {Object} permissionService - 权限服务实例
 * @param {Object} sessionManager - 会话管理器实例
 */
function registerPermissionsFromMessage(msg, streamingId, permissionService, sessionManager) {
  if (msg?.type !== 'message' || !Array.isArray(msg.content)) return;

  for (const block of msg.content) {
    if (block?.type === 'tool_use' && block?.name) {
      console.log('[权限] 检测到工具调用', {
        streamingId,
        toolName: block.name,
        toolInput: block.input,
        toolUseId: block.id,
      });

      const requiresPermission = ['Write', 'Edit', 'Bash', 'Read'].includes(block.name);

      if (requiresPermission) {
        const req = permissionService.add(block.name, block.input || {}, streamingId);
        console.log('[权限] 已注册权限请求', {
          streamingId,
          permissionId: req.id,
          toolName: block.name,
        });

        if (streamingId) {
          sessionManager.sendEvent(streamingId, {
            type: 'permission_request',
            permission: req,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }
}

module.exports = {
  registerPermissionsFromMessage,
};
