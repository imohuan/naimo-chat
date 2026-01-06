# 请求中断功能实现

## 概述

为 AI Chat 系统添加了完整的请求中断功能，允许用户在流式响应过程中主动中断正在进行的请求。

## 实现的功能

### 1. 前端支持
- ✅ `useChatApi.ts`: 添加 `abortSignal` 参数支持
- ✅ `ChatPanel.vue`: 实现 AbortController 管理和中断处理
- ✅ `ChatInput.vue`: 显示取消按钮，支持中断操作
- ✅ `types.ts`: 更新接口定义以支持 `abortSignal`

### 2. 后端支持
- ✅ `llmRequest.js`: 在 fetch 请求中传递 `abortSignal`
- ✅ `sessionService.js`: 扩展会话管理，支持 AbortController 存储
- ✅ `router.js`: 添加中断端点 `/api/ai_chat/conversations/:id/stream/:requestId/abort`
- ✅ 所有模式处理函数 (`chatMode.js`, `canvasMode.js`, `imageMode.js`, `videoMode.js`, `agentMode.js`): 支持 `abortSignal` 参数

## API 端点

### 中断请求
```
POST /api/ai_chat/conversations/:id/stream/:requestId/abort
```

**响应示例:**
```json
{
  "success": true,
  "message": "请求已中断"
}
```

**错误响应:**
- `404 Not Found`: Stream not found
- `409 Conflict`: 无法中断请求

## 工作流程

1. **创建请求时**:
   - 前端创建 `AbortController`
   - 后端创建 SSE 会话时存储 `AbortController`
   - `abortSignal` 传递给所有 LLM 请求

2. **中断请求时**:
   - 用户点击取消按钮
   - 前端调用 `abortController.abort()`
   - 后端接收中断请求，调用存储的 `abortController.abort()`
   - 所有正在进行的 fetch 请求收到中断信号
   - 抛出 `AbortError`，被正确处理并返回"请求已中断"消息

3. **清理工作**:
   - SSE 会话关闭
   - 发送 `request_aborted` 事件到前端
   - 清理会话资源

## 错误处理

### 前端错误处理
```typescript
try {
  await sendMessage(...);
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    pushToast("请求已中断", "info");
  } else {
    pushToast(`发送消息失败: ${error.message}`, "error");
  }
}
```

### 后端错误处理
```javascript
if (fetchError instanceof Error && fetchError.name === 'AbortError') {
  throw new Error('请求已中断');
}
```

## 测试

运行测试脚本验证中断功能:
```bash
node test_abort.js
```

## 兼容性

- 所有现有 API 保持向后兼容
- `abortSignal` 参数为可选参数
- 不影响现有的非中断请求流程

## 注意事项

1. **中断时机**: 请求可以在任何时候中断，包括正在流式传输内容时
2. **资源清理**: 中断后会自动清理 SSE 会话和相关资源
3. **用户体验**: 前端会显示适当的中断提示信息
4. **错误恢复**: 中断后用户可以正常发起新的请求

## 技术细节

- 使用标准的 `AbortController` 和 `AbortSignal` API
- SSE 会话管理扩展支持存储控制器
- 所有 LLM 模式统一支持中断功能
- 前后端错误处理保持一致