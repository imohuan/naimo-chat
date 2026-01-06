# 前端中断功能测试指南

## 测试步骤

1. **启动后端服务**
   ```bash
   cd packages/backend
   npm start
   ```

2. **启动前端服务**
   ```bash
   cd packages/frontend
   npm dev
   ```

3. **测试中断功能**
   - 在聊天界面输入一个较长的提示（如"写一个详细的故事"）
   - 在 AI 开始回答时，点击红色的"取消"按钮
   - 验证是否显示"请求已中断"的成功消息
   - 验证流式输出是否立即停止

## 预期行为

### 正常中断流程
1. 点击取消按钮后，前端调用 `POST /api/ai_chat/conversations/:id/stream/:requestId/abort`
2. 后端接收中断请求，触发 AbortController.abort()
3. 正在进行的 fetch 请求收到中断信号
4. 前端收到成功响应，显示"请求已中断"消息
5. UI 状态恢复正常，可以发送新消息

### 错误处理
- 如果没有活跃请求，显示"没有可中断的请求"
- 如果中断失败，显示具体错误信息
- 中断后自动清理所有相关状态

## 关键改动点

### useChatApi.ts
- 添加 `abortRequest()` 函数调用后端中断端点

### useConversation.ts
- `createConversation()` 返回 `{ conversationId, requestId }`
- `sendMessage()` 返回 `{ requestId }`

### ChatPanel.vue
- 新增 `currentRequestId` 状态跟踪当前请求
- `handleAbort()` 调用后端 API 而非直接 abort()
- 在请求完成后清理 `currentRequestId`

## 调试提示

如果遇到问题，检查：
1. 浏览器开发者工具 Network 标签中的中断请求
2. 后端日志中的中断处理信息
3. SSE 连接是否正确关闭
4. UI 状态是否正确重置