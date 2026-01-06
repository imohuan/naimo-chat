# MCP 连接问题修复总结

## 问题背景

在使用 Claude Code 链接中转 MCP 服务时，出现了连接失败的情况。主要表现为：

1. **Server already initialized**: 客户端重启后，由于后端保留了相同 `sessionId` 的旧会话，导致重复发送 `initialize` 请求时被拒绝。
2. **Invalid Request (id: null)**: 某些情况下手动返回的 JSON-RPC 响应中 `id` 为 `null`，导致客户端校验失败。
3. **初始化状态不一致**: 传输层过早标记 `initialized`，导致第一个真正的协议初始化请求被拦截，SDK 内部 Server 未能正确加载工具。

## 修复措施

### 1. 会话重置机制 (Session Reset)

在 `transportService.js` 中增加了对 `initialize` 请求的特殊处理。

- **逻辑**：当收到 `method: "initialize"` 请求时，如果内存中已存在相同 `sessionId` 的会话，则主动删除旧会话。
- **效果**：确保了客户端每次重新启动连接时，后端都能提供一个全新的服务器实例，避免了“已初始化”冲突。

### 2. 初始化标识延迟触发

调整了 `initialized` 标识的设置时机。

- **原逻辑**：在传输层连接回调中立即设为 `true`。
- **新逻辑**：传输层只负责转发。通过响应代理（Response Proxy）捕获 SDK 返回的第一个成功初始化响应后，才将该会话标记为 `initialized`。
- **效果**：保证了第一个握手请求能真实到达 SDK 并完成初始化。

### 3. 服务器命名优化

在 `mcpService.js` 中更新了服务器实例的配置。

- **修改**：将 `name` 和 `displayName` 统一设置为 `naimo_mcp_hub`。
- **效果**：日志显示更清晰，不再出现“服务器: 未知”，方便后续排查。

### 4. 健壮的响应劫持

优化了对 `StreamableHTTP` 响应的拦截逻辑。

- 完善了代理对象对 `_readableState` 和 `encoding` 的模拟，确保满足 SDK 的严格检查。
- 确保手动返回重复初始化响应时，尽可能保留原始请求的 `id`。

## 文件变动

- [mcpService.js](file:///e:/Code/Git/naimo_chat/packages/backend/src/mcp/mcpService.js): 更新服务器名称及 displayName。
- [transportService.js](file:///e:/Code/Git/naimo_chat/packages/backend/src/mcp/transportService.js): 实现会话重置、延迟初始化标记及响应捕获逻辑。

## 验证结果

经过多次重启 Claude Code 验证，连接握手均能正常通过，且工具列表能够正确列出。
