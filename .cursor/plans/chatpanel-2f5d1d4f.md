<!-- 2f5d1d4f-ad1f-4f50-a852-4bb4dccc8e6f 75e72073-d337-4f11-9818-746f466c68f5 -->

# ChatPanel 重构计划

## 一、目标

1. 删除旧的 `modes` 和 `prompts` 目录
2. 重新实现对话请求功能，使用新的 API (`/api/ai_chat/*`)
3. 拆分 ChatPanel.vue 为多个功能单一的组件
4. 创建 Pinia store 管理对话状态
5. 使用 mitt 进行组件间通信
6. 使用 VueUse 工具库优化实现

## 二、架构设计

### 2.1 数据流架构

```mermaid
graph TB
    subgraph Store[Pinia Store]
        ConversationStore[conversationStore]
    end

    subgraph Hooks[Composables/Hooks]
        useChatApi[useChatApi]
        useSSEStream[useSSEStream]
        useConversation[useConversation]
    end

    subgraph Components[Components]
        ChatPanel[ChatPanel.vue]
        ChatSidebar[ChatSidebar.vue]
        ChatMessages[ChatMessages.vue]
        ChatInput[ChatInput.vue]
        ModeSelector[ModeSelector.vue]
        ModelSelector[ModelSelector.vue]
    end

    subgraph EventBus[Event Bus - mitt]
        EventBus[eventBus]
    end

    ConversationStore --> useChatApi
    ConversationStore --> useSSEStream
    ConversationStore --> useConversation
    ChatPanel --> ConversationStore
    ChatPanel --> EventBus
    ChatSidebar --> ConversationStore
    ChatMessages --> ConversationStore
    ChatInput --> ConversationStore
    ChatInput --> EventBus
    ModeSelector --> ConversationStore
    ModelSelector --> ConversationStore
```

### 2.2 文件结构

```
packages/frontend/src/
├── stores/
│   └── conversation.ts           # 对话状态管理 (Pinia)
├── hooks/
│   ├── useChatApi.ts             # API 调用封装
│   ├── useSSEStream.ts           # SSE 流式响应处理
│   ├── useConversation.ts        # 对话业务逻辑
│   └── useModelSelector.ts       # 模型选择逻辑
├── views/LlmDashboard/Chat/
│   ├── ChatPanel.vue             # 主容器组件 (简化)
│   ├── components/
│   │   ├── ChatSidebar.vue       # 对话列表侧边栏
│   │   ├── ChatMessages.vue      # 消息列表展示
│   │   ├── ChatInput.vue         # 输入框组件
│   │   ├── ModeSelector.vue      # 模式选择器
│   │   ├── ChatHeaderActions.vue # 头部操作按钮
│   │   └── CanvasPanel.vue       # Canvas 面板 (ImmersiveCode)
│   └── types.ts                  # 类型定义
└── events/
    └── conversationEvents.ts     # 对话相关事件类型定义
```

## 三、详细实现步骤

### 3.1 删除旧代码

**删除的文件/目录：**

- `packages/frontend/src/views/LlmDashboard/Chat/modes/` (整个目录)
- `packages/frontend/src/prompts/modes/` (整个目录)
- `packages/frontend/src/views/LlmDashboard/Chat/useChatConversations.ts` (将被 Pinia store 替代)

### 3.2 创建 Pinia Store

**文件：** `packages/frontend/src/stores/conversation.ts`

**职责：**

- 管理对话列表 (`conversations`)
- 管理当前活跃对话 ID (`activeConversationId`)
- 管理侧边栏折叠状态 (`sidebarCollapsed`)
- 提供对话 CRUD 操作方法
- 使用 `useLocalStorage` (VueUse) 持久化状态

**关键状态：**

```typescript
// 后端 API 格式（与服务器交互使用）
interface ApiConversation {
  id: string;
  title: string;
  mode: "chat" | "canvas" | "agent" | "image" | "video" | "图片" | "视频";
  messages: ApiMessage[];
  createdAt: number;
  updatedAt: number;
  codeHistory?: CodeHistory;
}

interface ApiMessage {
  messageKey: string; // 消息唯一标识
  role: "user" | "assistant";
  versions: ApiMessageVersion[]; // 版本数组，支持消息重试
  createdAt: number;
  updatedAt?: number;
}

interface ApiMessageVersion {
  id: string; // 版本ID（通常是 requestId）
  content: string;
  isRequesting?: boolean;
  createdAt?: number;
}

// 前端 UI 格式（用于组件渲染）
interface Conversation {
  id: string;
  title: string;
  mode: ConversationMode;
  messages: MessageType[];
  createdAt: number;
  updatedAt: number;
  codeHistory?: CodeHistory;
}

interface MessageType {
  key: string; // 对应后端的 messageKey
  from: "user" | "assistant";
  versions: MessageVersion[];
  sources?: MessageSource[];
  reasoning?: MessageReasoning;
  tools?: MessageTool[];
}

interface MessageVersion {
  id: string;
  content: string;
  files?: FileUIPart[];
}
```

### 3.3 创建 Hooks

#### 3.3.1 useChatApi.ts

**职责：**

- 封装所有 API 调用
- 使用 `useLlmApi` 获取 baseUrl 和 apiKey
- 提供方法：
  - `createConversation(params)`
  - `sendMessage(conversationId, params)`
  - `fetchConversations()`
  - `fetchConversation(id)`
  - `deleteConversation(id)`

#### 3.3.2 useSSEStream.ts

**职责：**

- 管理 SSE 连接
- 处理流式事件 (`content_block_delta`, `message_delta`, `message_complete`, `error`, `request_id`)
- 使用 `useEventListener` (VueUse) 处理事件
- 提供方法：
  - `connectToStream(conversationId, requestId, callbacks)`
  - `disconnect()`
  - `isConnected` (computed)

**事件处理：**

- `content_block_delta`: 累积文本内容，更新到对应的 `version.content`
- `message_delta`: 累积文本内容（备用格式）
- `request_id`: 更新 `version.id` 和 `messageKey`（如果包含临时 ID）
- `message_complete`: 标记版本完成，设置 `isRequesting = false`
- `error`: 处理错误，更新版本状态

#### 3.3.3 useConversation.ts

**职责：**

- 封装对话相关的业务逻辑
- 结合 store 和 hooks 提供高级方法
- 处理模式切换、消息发送等
- 使用 `useDebounceFn` (VueUse) 优化操作

### 3.4 拆分组件

#### 3.4.1 ChatPanel.vue (主容器)

**职责：**

- 布局管理（侧边栏 + 主区域 + Canvas）
- 协调子组件
- 使用 `useConversation` hook
- 监听事件总线事件

**简化后的代码量：** ~200 行

#### 3.4.2 ChatSidebar.vue

**职责：**

- 显示对话列表
- 对话选择、创建、删除
- 使用 store 管理状态
- 使用 `useMediaQuery` (VueUse) 响应式布局

#### 3.4.3 ChatMessages.vue

**职责：**

- 渲染消息列表
- 消息版本切换（如果有多个版本）
- 消息操作（复制、重试等）
- 处理流式响应更新（通过 `version.id` 匹配）
- 使用 `useVirtualList` 或 `useScroll` (VueUse) 优化性能

**重要实现细节：**

- 需要根据 `version.id`（requestId）来更新对应的版本内容
- 当收到 `request_id` 事件时，需要更新 `version.id` 和 `messageKey`（如果包含临时 ID）
- 重试时传递 `messageKey` 参数，在同一消息下创建新版本

#### 3.4.4 ChatInput.vue

**职责：**

- 输入框和附件上传
- 模式选择集成
- 模型选择集成
- 发送消息逻辑
- 使用 `useClipboard` (VueUse) 支持粘贴
- 发送事件到事件总线

#### 3.4.5 ModeSelector.vue

**职责：**

- 模式下拉选择
- 模式说明展示
- 使用 store 更新模式

#### 3.4.6 CanvasPanel.vue

**职责：**

- ImmersiveCode 组件包装
- Canvas 模式特定逻辑
- 代码历史管理

### 3.5 事件系统 (mitt)

**文件：** `packages/frontend/src/events/conversationEvents.ts`

**事件类型：**

```typescript
interface ConversationEvents {
  "conversation:created": { id: string };
  "conversation:selected": { id: string };
  "conversation:deleted": { id: string };
  "message:sent": { conversationId: string; content: string };
  "message:streaming": {
    conversationId: string;
    requestId: string;
    chunk: string;
  };
  "message:complete": { conversationId: string; requestId: string };
  "message:request-id-updated": {
    conversationId: string;
    messageKey: string;
    oldRequestId: string;
    newRequestId: string;
  };
  "mode:changed": { conversationId: string; mode: string };
  "canvas:code-changed": { conversationId: string; code: string };
}
```

**使用场景：**

- 消息发送时通知其他组件
- Canvas 代码变化时通知输入框
- 模式切换时通知相关组件

### 3.6 API 集成

**新的 API 端点映射：**

| 旧 API | 新 API | 说明 |

|--------|--------|------|

| `POST /api/projects` | `POST /api/ai_chat/conversations` | 创建对话 |

| `GET /api/projects` | `GET /api/ai_chat/conversations` | 获取对话列表 |

| `GET /api/projects/:id` | `GET /api/ai_chat/conversations/:id` | 获取对话详情 |

| `PUT /api/projects/:id` | (不再需要，服务器自动更新) | 删除 |

| `DELETE /api/projects/:id` | `DELETE /api/ai_chat/conversations/:id` | 删除对话 |

| `POST /v1/messages` | `POST /api/ai_chat/conversations/:id/messages` | 发送消息 |

| (无) | `GET /api/ai_chat/conversations/:id/stream/:requestId` | SSE 流式响应 |

**关键变化：**

1. 消息发送使用新的端点，返回 `{ requestId, streamUrl }`
2. 使用 SSE 连接接收流式响应
3. 对话自动保存，无需手动 PUT 更新
4. 模式处理在后端完成，前端只传递 `mode` 参数
5. **消息结构变化**：使用 `messageKey + versions` 结构，支持消息重试
   - 每个消息有唯一的 `messageKey`
   - 每个消息可以有多个 `versions`（用于重试）
   - 每个 `version` 有独立的 `id`（通常是 `requestId`）
6. **重试机制**：通过传递 `messageKey` 参数，可以在同一消息下创建新版本

## 四、实现细节

### 4.1 流式响应处理

```typescript
// useSSEStream.ts
const eventSource = new EventSource(streamUrl);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "content_block_delta":
      // 累积内容并更新 store
      onChunk(data.delta.text);
      break;
    case "request_id":
      // 更新消息的 requestId（从临时ID更新为真实ID）
      // 需要同时更新 version.id 和 messageKey（如果 messageKey 包含临时ID）
      onRequestId(data.requestId);
      break;
    case "message_complete":
      // 标记消息完成
      onComplete();
      break;
    case "error":
      // 处理错误
      onError(data.error);
      break;
  }
};
```

### 4.2 模式管理简化

- 前端不再需要模式处理器
- 只负责传递 `mode` 参数到 API
- Canvas 模式需要传递 `editorCode`
- 模式切换通过事件总线通知相关组件

### 4.3 消息格式转换

**后端 API 格式（服务器返回）：**

```typescript
// 后端 API 消息格式
interface ApiMessage {
  messageKey: string; // 消息唯一标识，格式如 "user-{timestamp}-{random}" 或 "assistant-{requestId}"
  role: "user" | "assistant";
  versions: ApiMessageVersion[]; // 版本数组，支持消息重试
  createdAt: number;
  updatedAt?: number;
}

interface ApiMessageVersion {
  id: string; // 版本ID，通常是 requestId（如 "req-5-{timestamp}" 或临时ID "temp-{uuid}"）
  content: string;
  isRequesting?: boolean; // 是否正在请求中
  createdAt?: number;
}
```

**前端 UI 格式（组件使用）：**

```typescript
// 前端 UI 消息格式
interface MessageType {
  key: string; // 对应后端的 messageKey
  from: "user" | "assistant";
  versions: MessageVersion[];
  sources?: MessageSource[];
  reasoning?: MessageReasoning;
  tools?: MessageTool[];
}

interface MessageVersion {
  id: string; // 对应后端的 version.id
  content: string;
  files?: FileUIPart[];
}
```

**转换逻辑：**

- **API → UI**: 在 store 中使用 `apiMessageToMessageType` 函数转换

  - `messageKey` → `key`
  - `role` → `from`
  - `versions` 数组直接映射，但只保留 `id` 和 `content`
  - `isRequesting` 状态用于判断当前版本是否正在请求

- **UI → API**: 发送消息时，前端只需要传递 `content`、`mode` 等参数，后端会自动创建 `messageKey` 和 `versions`

**关键点：**

1. 每个消息可以有多个版本（versions），用于支持消息重试功能
2. `messageKey` 是消息的唯一标识，不会因为重试而改变
3. `version.id` 通常是 `requestId`，用于标识不同的请求版本
4. 当 `version.id` 从临时 ID 更新为真实 ID 时，如果 `messageKey` 包含临时 ID，也需要同步更新

## 五、迁移步骤

1. **创建类型定义文件** (`types.ts`)
2. **创建 Pinia store** (`stores/conversation.ts`)
3. **创建 hooks** (`useChatApi.ts`, `useSSEStream.ts`, `useConversation.ts`)
4. **创建事件类型** (`events/conversationEvents.ts`)
5. **创建子组件** (按优先级：ChatSidebar → ChatMessages → ChatInput → ModeSelector → CanvasPanel)
6. **重构 ChatPanel.vue** (使用新的 store 和 hooks)
7. **测试集成** (确保所有功能正常工作)
8. **删除旧代码** (modes, prompts, useChatConversations.ts)

## 六、注意事项

1. **向后兼容**：确保现有功能不受影响
2. **错误处理**：API 调用失败时的用户提示
3. **加载状态**：对话加载、消息发送的加载指示
4. **性能优化**：大量消息时的虚拟滚动
5. **代码历史**：Canvas 模式的代码历史保存和恢复
6. **SSE 重连**：连接断开时的自动重连机制
7. **类型安全**：确保所有类型定义完整
8. **消息版本管理**：
   - 正确处理 `version.id` 从临时 ID 到真实 ID 的更新
   - 当更新 `version.id` 时，如果 `messageKey` 包含临时 ID，需要同步更新 `messageKey`
   - 使用 `version.id`（requestId）来匹配和更新对应的版本内容
9. **消息重试**：通过传递 `messageKey` 参数实现，在同一消息下创建新版本

## 七、测试清单

- [ ] 创建新对话
- [ ] 发送消息（各种模式）
- [ ] 流式响应接收
- [ ] 对话列表加载
- [ ] 对话切换
- [ ] 对话删除
- [ ] 模式切换
- [ ] Canvas 模式代码历史
- [ ] 错误处理
- [ ] SSE 连接断开处理
- [ ] 消息重试功能（通过 messageKey 创建新版本）
- [ ] 消息版本切换（多个版本之间的切换）
- [ ] requestId 更新（从临时 ID 到真实 ID 的更新）
- [ ] messageKey 同步更新（当包含临时 ID 时）

### To-dos

- [ ] 删除旧的 modes 和 prompts 目录，以及 useChatConversations.ts
- [ ] 创建类型定义文件 (types.ts)，定义 Conversation、Message 等接口
- [ ] 创建 Pinia store (stores/conversation.ts)，管理对话状态
- [ ] 创建事件类型定义 (events/conversationEvents.ts)
- [ ] 创建 useChatApi.ts hook，封装 API 调用
- [ ] 创建 useSSEStream.ts hook，处理 SSE 流式响应
- [ ] 创建 useConversation.ts hook，封装对话业务逻辑
- [ ] 创建 ChatSidebar.vue 组件，展示对话列表
- [ ] 创建 ChatMessages.vue 组件，展示消息列表
- [ ] 创建 ChatInput.vue 组件，处理消息输入
- [ ] 创建 ModeSelector.vue 组件，处理模式选择
- [ ] 创建 CanvasPanel.vue 组件，包装 ImmersiveCode
- [ ] 重构 ChatPanel.vue，使用新的 store 和组件
- [ ] 测试所有功能，确保正常工作
