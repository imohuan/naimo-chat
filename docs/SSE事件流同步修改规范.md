# SSE 事件流同步修改规范

## 📋 概述

本文档规范了在修改 SSE（Server-Sent Events）流传输数据时，需要同步修改的相关文件。由于前后端使用相同的 SSE 事件协议，任何对事件格式、类型或字段的修改都需要在三个关键位置保持同步。

## 🔗 相关文件

### 1. 后端中间件：`usageCacheMiddleware.js`

**路径**: `packages/backend/src/middleware/usageCacheMiddleware.js`

**职责**:

- 拦截和处理来自 LLM API 的 SSE 流
- 在工具调用场景下，生成自定义事件（如 `tool:start`、`tool:result` 等）
- 转发或修改事件数据
- 负责事件数据的**生成和发送**

**关键代码位置**:

- 第 130-138 行：生成 `tool:start` 事件
- 第 188-197 行：生成 `tool:result` 事件
- 第 202-211 行：生成 `tool:error` 事件
- 第 261-268 行：生成 `tool:continue_error` 事件
- 第 298-304 行：生成 `tool:continue_complete` 事件

### 2. 后端路由：`router.js`

**路径**: `packages/backend/src/conversations/router.js`

**职责**:

- 接收来自中间件的 SSE 事件
- 解析事件并构建 `contentBlocks` 数据结构
- 将事件转发给前端客户端
- 负责事件数据的**接收和处理**

**关键代码位置**: 第 146-345 行（`onStreamEvent` 函数）

### 3. 前端 Hook：`useSSEStream.ts`

**路径**: `packages/frontend/src/views/LlmDashboard/Chat/hooks/useSSEStream.ts`

**职责**:

- 通过 EventSource 接收 SSE 事件
- 解析事件数据并触发相应的回调函数
- 负责事件数据的**接收和分发**

**关键代码位置**: 第 33-238 行（`es.onmessage` 事件处理）

## ⚠️ 需要同步修改的场景

以下任何修改都需要在三个文件中同步更新：

### 1. 新增事件类型

- ✅ 在 `usageCacheMiddleware.js` 中生成新事件
- ✅ 在 `router.js` 的 `onStreamEvent` 中添加处理逻辑
- ✅ 在 `useSSEStream.ts` 的 `switch` 语句中添加 `case` 分支
- ✅ 在 `types.ts` 中更新 `SSEEventType` 和 `SSEEvent` 接口

### 2. 修改事件字段

- ✅ 修改事件数据结构（添加/删除/重命名字段）
- ✅ 更新三个文件中的字段访问逻辑
- ✅ 更新 TypeScript 类型定义

### 3. 修改事件处理逻辑

- ✅ 改变事件的处理流程
- ✅ 修改事件的条件判断
- ✅ 更新事件的状态管理

### 4. 修改事件命名

- ✅ 重命名事件类型（如 `tool:start` → `tool:call_start`）
- ✅ 同步更新所有引用该事件的地方

## 📝 修改检查清单

在修改 SSE 事件流相关代码时，请按以下清单逐项检查：

### 后端中间件 (`usageCacheMiddleware.js`)

- [ ] 检查是否新增了 `controller.enqueue()` 调用
- [ ] 检查是否修改了事件数据结构
- [ ] 检查是否修改了事件类型字符串
- [ ] 检查是否添加了新的字段到事件数据中

### 后端路由 (`router.js` 146-345 行)

- [ ] 检查 `onStreamEvent` 函数中的 `switch (event.type)` 语句
- [ ] 检查是否添加了新的事件类型 `case`
- [ ] 检查是否修改了事件字段的访问路径（如 `event.tool_id` → `event.toolId`）
- [ ] 检查是否修改了 `contentBlocks` 的构建逻辑
- [ ] 检查是否更新了事件数据的验证逻辑

### 前端 Hook (`useSSEStream.ts`)

- [ ] 检查 `es.onmessage` 中的 `switch (data.type)` 语句
- [ ] 检查是否添加了新的事件类型 `case`
- [ ] 检查是否修改了事件字段的访问路径
- [ ] 检查是否更新了回调函数的参数
- [ ] 检查是否添加了新的回调函数调用

### 类型定义 (`types.ts`)

- [ ] 检查 `SSEEventType` 类型是否包含所有事件类型
- [ ] 检查 `SSEEvent` 接口是否包含所有事件字段
- [ ] 检查 `StreamCallbacks` 接口是否包含所有回调函数

## 📊 事件类型映射表

| 事件类型                     | 生成位置                      | 处理位置（后端） | 处理位置（前端）      | 说明                           |
| ---------------------------- | ----------------------------- | ---------------- | --------------------- | ------------------------------ |
| `content_block_start`        | LLM API                       | `router.js:152`  | `useSSEStream.ts:38`  | 内容块开始                     |
| `content_block_delta`        | LLM API                       | `router.js:185`  | `useSSEStream.ts:60`  | 内容块增量更新                 |
| `content_block_stop`         | LLM API                       | `router.js:208`  | `useSSEStream.ts:80`  | 内容块结束                     |
| `message_delta`              | LLM API                       | `router.js:232`  | `useSSEStream.ts:89`  | 消息增量                       |
| `message_complete`           | LLM API                       | -                | `useSSEStream.ts:125` | 消息完成                       |
| `session_end`                | `router.js`                   | -                | `useSSEStream.ts:133` | 会话结束                       |
| `error`                      | LLM API / 中间件              | -                | `useSSEStream.ts:144` | 错误事件                       |
| `request_id`                 | `router.js`                   | -                | `useSSEStream.ts:97`  | 请求 ID 更新                   |
| `tool:start`                 | `usageCacheMiddleware.js:130` | `router.js:249`  | `useSSEStream.ts:189` | 工具调用开始（中间件生成）     |
| `tool:result`                | `usageCacheMiddleware.js:188` | `router.js:276`  | `useSSEStream.ts:199` | 工具执行成功（中间件生成）     |
| `tool:error`                 | `usageCacheMiddleware.js:202` | `router.js:311`  | `useSSEStream.ts:210` | 工具执行失败（中间件生成）     |
| `tool:continue_error`        | `usageCacheMiddleware.js:261` | -                | `useSSEStream.ts:221` | 工具继续请求错误（中间件生成） |
| `tool:continue_complete`     | `usageCacheMiddleware.js:298` | -                | `useSSEStream.ts:228` | 工具继续请求完成（中间件生成） |
| `conversation:updated`       | `router.js`                   | -                | `useSSEStream.ts:104` | 对话更新                       |
| `conversation:title_updated` | `router.js`                   | -                | `useSSEStream.ts:115` | 对话标题更新                   |
| `canvas:code_delta`          | `router.js`                   | -                | `useSSEStream.ts:152` | Canvas 代码增量                |
| `canvas:diff_detected`       | `router.js`                   | -                | `useSSEStream.ts:158` | Canvas diff 检测               |
| `canvas:show_editor`         | `router.js`                   | -                | `useSSEStream.ts:168` | Canvas 显示编辑器              |
| `canvas:code_complete`       | `router.js`                   | -                | `useSSEStream.ts:172` | Canvas 代码完成                |
| `canvas:record_created`      | `router.js`                   | -                | `useSSEStream.ts:182` | Canvas 记录创建                |

## 🔍 事件数据结构规范

### 标准事件结构

所有 SSE 事件都应遵循以下基本结构：

```typescript
interface SSEEvent {
  type: SSEEventType; // 事件类型（必需）
  requestId?: string; // 请求 ID（可选）
  index?: number; // 内容块索引（可选）
  timestamp?: string; // 时间戳（可选，ISO 8601 格式）
  error?: string; // 错误信息（可选）
  // ... 其他特定字段
}
```

### 工具相关事件结构

```typescript
// tool:start 事件
{
  type: "tool:start",
  tool_id: string,              // 工具调用 ID（必需）
  tool_name: string,            // 工具名称（必需）
  timestamp: string             // 时间戳（必需）
}

// tool:result 事件
{
  type: "tool:result",
  tool_id: string,              // 工具调用 ID（必需）
  tool_name: string,            // 工具名称（必需）
  input: Record<string, unknown>, // 工具输入参数（必需）
  result: unknown,              // 工具执行结果（必需）
  timestamp: string             // 时间戳（必需）
}

// tool:error 事件
{
  type: "tool:error",
  tool_id: string,              // 工具调用 ID（必需）
  tool_name: string,            // 工具名称（必需）
  error: string,                // 错误信息（必需）
  timestamp: string             // 时间戳（必需）
}
```

## 📖 修改示例

### 示例 1：新增事件类型

假设需要新增一个 `tool:progress` 事件来报告工具执行进度：

#### 1. 在 `usageCacheMiddleware.js` 中生成事件

```javascript
// 在工具执行过程中发送进度事件
controller.enqueue({
  event: "tool:progress",
  data: {
    type: "tool:progress",
    tool_id: currentToolId,
    tool_name: currentToolName,
    progress: 50, // 进度百分比
    message: "正在处理...",
    timestamp: new Date().toISOString(),
  },
});
```

#### 2. 在 `router.js` 中处理事件

```javascript
case "tool:progress":
  // 工具执行进度
  if (event.tool_id) {
    let toolBlock = contentBlocks.find(
      (block) => block.type === "tool" && block.id === event.tool_id
    );
    if (toolBlock) {
      // 更新工具块的状态
      toolBlock.toolCall.progress = event.progress;
      toolBlock.toolCall.progressMessage = event.message;
    }
  }
  break;
```

#### 3. 在 `useSSEStream.ts` 中处理事件

```typescript
case "tool:progress":
  if (data.tool_id && data.tool_name) {
    callbacks.onToolProgress?.({
      toolId: data.tool_id,
      toolName: data.tool_name,
      progress: data.progress,
      message: data.message,
      timestamp: data.timestamp,
    });
  }
  break;
```

#### 4. 在 `types.ts` 中更新类型定义

```typescript
export type SSEEventType =
  | "content_block_start"
  // ... 其他事件类型
  | "tool:progress"; // 新增

export interface SSEEvent {
  type: SSEEventType;
  // ... 其他字段
  progress?: number; // 新增
  message?: string; // 新增
}

export interface StreamCallbacks {
  // ... 其他回调
  onToolProgress?: (data: {
    // 新增
    toolId: string;
    toolName: string;
    progress: number;
    message?: string;
    timestamp?: string;
  }) => void;
}
```

### 示例 2：修改事件字段名称

假设需要将 `tool_id` 重命名为 `toolId`（驼峰命名）：

#### 1. 在 `usageCacheMiddleware.js` 中修改

```javascript
// 修改前
tool_id: currentToolId,

// 修改后
toolId: currentToolId,
```

#### 2. 在 `router.js` 中修改

```javascript
// 修改前
if (event.tool_id) {
  let toolBlock = contentBlocks.find(
    (block) => block.type === "tool" && block.id === event.tool_id
  );
}

// 修改后
if (event.toolId) {
  let toolBlock = contentBlocks.find(
    (block) => block.type === "tool" && block.id === event.toolId
  );
}
```

#### 3. 在 `useSSEStream.ts` 中修改

```typescript
// 修改前
if (data.tool_id && data.tool_name) {
  callbacks.onToolStart?.({
    toolId: data.tool_id,
    toolName: data.tool_name,
  });
}

// 修改后
if (data.toolId && data.toolName) {
  callbacks.onToolStart?.({
    toolId: data.toolId,
    toolName: data.toolName,
  });
}
```

#### 4. 在 `types.ts` 中修改

```typescript
export interface SSEEvent {
  type: SSEEventType;
  // 修改前
  tool_id?: string;
  tool_name?: string;

  // 修改后
  toolId?: string;
  toolName?: string;
}
```

## ✅ 测试建议

在完成同步修改后，建议进行以下测试：

1. **单元测试**：测试每个事件类型的生成和解析
2. **集成测试**：测试完整的事件流（从中间件到前端）
3. **端到端测试**：在实际使用场景中测试事件流
4. **向后兼容性测试**：确保旧版本的事件仍然可以正常处理

## 🚨 常见错误

### 错误 1：只修改了一个文件

**问题**：只修改了 `usageCacheMiddleware.js`，忘记同步修改 `router.js` 和 `useSSEStream.ts`

**后果**：前端无法正确接收和处理新事件，导致功能异常

### 错误 2：字段名称不一致

**问题**：后端使用 `tool_id`，前端使用 `toolId`

**后果**：前端无法正确读取事件数据

### 错误 3：忘记更新类型定义

**问题**：修改了事件结构，但忘记更新 TypeScript 类型定义

**后果**：TypeScript 编译错误，类型检查失效

### 错误 4：事件类型拼写错误

**问题**：`tool:start` 写成了 `tool_start` 或 `toolStart`

**后果**：事件无法匹配，导致处理逻辑失效

## 📚 相关文档

- [工具调用处理说明.md](./工具调用处理说明.md) - 工具调用的完整处理流程
- [工具调用流转发修复总结.md](./工具调用流转发修复总结.md) - 工具调用流转发的修复记录

## 📝 更新日志

| 日期       | 版本  | 修改内容                                                         | 修改人 |
| ---------- | ----- | ---------------------------------------------------------------- | ------ |
| 2025-01-XX | 1.0.0 | 初始版本                                                         | -      |
| 2025-01-30 | 1.1.0 | 在 `tool:result` 事件中添加 `input` 字段，包含工具调用的输入参数 | -      |

---

**⚠️ 重要提醒**：在修改 SSE 事件流相关代码时，请务必按照本规范进行同步修改，避免前后端不一致导致的功能异常。
