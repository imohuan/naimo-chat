<!-- a8d64881-70c3-4d05-8e97-b4c177f5989f 7a43b24b-776e-4974-a00b-36598ab82056 -->

# AI Chat API 完整实现计划

## 概述

在后台创建新的 AI 聊天 API 路由，支持创建对话、获取对话列表、获取对话详情，以及流式消息发送。包含完整的 SSE 通信和测试页面。

## 文件结构

### 1. 路由文件

- `packages/backend/src/router/aiChatRoutes.js` - 主路由文件
- 在 `packages/backend/src/router/routes.js` 中注册新路由

### 2. 模式处理文件（src/chat-mode/）

- `chatMode.js` - 对话模式处理
- `canvasMode.js` - 画布模式处理（不包含历史记录）
- `agentMode.js` - 智能模式处理
- `imageMode.js` - 图片模式处理
- `videoMode.js` - 视频模式处理

每个模式文件导出一个函数，该函数负责构建消息并执行请求：

```javascript
/**
 * 模式处理函数：构建消息并执行请求
 * @param {Object} context - 上下文对象
 * @param {Object} context.conversation - 对话对象
 * @param {string} context.currentInput - 当前用户输入
 * @param {string} context.mode - 对话模式
 * @param {Array} context.files - 附件列表
 * @param {string} context.editorCode - 编辑器代码（Canvas模式使用）
 * @param {string} context.model - 模型ID
 * @param {string} context.apiKey - API Key（可选）
 * @param {Function} context.onStreamEvent - 流式事件回调函数 (event) => void
 * @returns {Promise<Object>} 返回请求结果 { requestId, fullResponse, events }
 */
async function processMode(context) {
  // 1. 构建消息数组
  const messages = [];

  // - 加载对应的系统提示词（使用 replaceVariablesInMessages 替换变量）
  // - 根据模式决定是否包含历史消息
  // - 添加当前用户输入和附件

  // 2. 调用通用请求函数执行 /v1/messages 请求
  const result = await requestLLM({
    messages,
    model: context.model,
    apiKey: context.apiKey,
    onStreamEvent: context.onStreamEvent, // 监听各种流式事件
  });

  // 3. 返回结果
  return result;
}

module.exports = processMode;
```

**通用请求函数 `requestLLM`**（在工具文件中实现，如 `src/utils/llmRequest.js`）：

```javascript
const { getClaudeConfig } = require("../router/chatRoutes"); // 或从合适的位置导入

/**
 * 通用 LLM 请求函数
 * @param {Object} options - 请求选项
 * @param {ChatMessage[]} options.messages - 消息数组
 * @param {string} options.model - 模型ID
 * @param {string} options.apiKey - API Key（可选）
 * @param {Function} options.onStreamEvent - 流式事件回调 (event) => void
 * @returns {Promise<Object>} { requestId, fullResponse, events }
 */
async function requestLLM(options) {
  const { messages, model, apiKey, onStreamEvent } = options;
  const config = await getClaudeConfig();
  const port = config.PORT || 3457;

  // 发送 POST 请求到 /v1/messages
  const response = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.APIKEY || "",
    },
    body: JSON.stringify({
      messages,
      model,
      stream: true,
      apiKey,
    }),
  });

  // 获取请求ID（从响应头）
  const requestId = response.headers.get("X-Request-Id");

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`);
  }

  // 解析 SSE 流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim() || !line.startsWith("data: ")) continue;

      const jsonStr = line.substring(6).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const event = JSON.parse(jsonStr);
        events.push(event);

        // 调用回调函数，通知监听者
        if (onStreamEvent) {
          onStreamEvent(event);
        }

        // 提取文本内容（根据不同的响应格式）
        if (event.type === "content_block_delta" && event.delta?.text) {
          fullResponse += event.delta.text;
        } else if (event.type === "message_delta" && event.delta?.text) {
          fullResponse += event.delta.text;
        }
        // ... 处理其他格式（OpenAI格式等）
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  return { requestId, fullResponse, events };
}

module.exports = { requestLLM };
```

**说明：**

- 每个模式文件导出一个函数，负责完整的请求处理流程（构建消息 + 执行请求）
- 函数内部调用通用 `requestLLM` 函数执行 /v1/messages 请求
- 通过 `onStreamEvent` 回调监听流式响应中的各种事件（content_block_delta, message_delta 等）
- 拆分多个文件只是为了区分不同的模式处理逻辑

### 3. 提示词文件（src/prompts/）

- `chatMode.js` - 对话模式提示词
- `canvasMode.js` - 画布模式提示词
- `agentMode.js` - 智能模式提示词
- `imageMode.js` - 图片模式提示词
- `videoMode.js` - 视频模式提示词
- `titleGeneration.js` - 标题生成提示词

每个提示词文件直接导出 `ChatMessage[]` 数组：

```javascript
// 提示词文件直接导出数组
module.exports = [
  {
    role: "system",
    type: "system", // 可选，用于区分用途
    content:
      "系统提示词内容，支持 {{variable}} 变量格式，例如：你好，{{name}}！",
    // 或者使用数组格式：
    // content: [
    //   {
    //     type: "text",
    //     text: "系统提示词内容，支持 {{variable}} 变量格式"
    //   }
    // ]
  },
  // 可以包含多条消息
  {
    role: "user",
    content: "用户预设消息，支持 {{variable}} 变量",
  },
];
```

**变量替换规则：**

- 在 content 文本中使用 `{{variable}}` 作为占位符
- 使用工具函数 `replaceVariablesInMessages(messages, variables)` 进行变量替换
- 工具函数会递归处理数组中的所有消息，替换 content 中的变量占位符

### 4. 测试页面

- `packages/backend/public/ai_chat/index.html` - 测试页面（Vue 3 + TailwindCSS）
- 路由：`GET /ui/ai_chat/index.html`

## 对话数据结构

```javascript
{
  id: "20240101-abc123",  // 时间+短UUID格式
  title: "对话标题",
  mode: "chat" | "canvas" | "agent" | "图片" | "视频",
  messages: [
    {
      role: "user" | "assistant" | "system",
      content: string | Array<{ type: "text", text: string }>,
      isRequesting: false,  // 扩展属性：是否正在请求中（仅 assistant 消息）
      currentRequestId: null,  // 扩展属性：当前请求ID（仅 assistant 消息）
      // ... 其他扩展属性
    }
  ],  // 对话消息列表
  codeHistory: {},  // Canvas模式代码历史（可选）
  createdAt: 1234567890,
  updatedAt: 1234567890
}
```

### 注意：消息日志记录

**已由 `messageLoggerMiddleware` 自动处理，无需手动实现：**

- `messageLoggerMiddleware` 已自动拦截 `/v1/messages` 接口的所有请求和响应
- 请求 ID 会自动写入响应头 `X-Request-Id`
- 日志自动保存到 `CHAT_MESSAGE_DIR` 目录（`links/claude-llm/chat-message/`）
- 自动生成以下文件：
  - `{requestId}-req.json` - 请求参数
  - `{requestId}-res.md` - 响应内容（Markdown 格式）
  - `{requestId}-res-full.jsonl` - 完整响应数据（JSONL 格式，包含流式响应）
- 可以通过响应头 `X-Request-Id` 获取请求 ID，用于关联对话和日志

## API 端点设计

### 1. POST /api/ai_chat/conversations

创建新对话并发送第一条消息

**请求体：**

```javascript
{
  initialInput: "用户输入内容",  // 必需
  mode: "chat",  // 可选，默认 "chat"
  messages: [],  // 可选，自定义消息列表
  model: "provider,model",  // 可选，模型ID
  apiKey: "xxx",  // 可选，临时API Key
  files: []  // 可选，附件列表
}
```

**流程：**

1. 生成请求 ID（UUID）
2. 如果没有提供 messages，根据 mode 调用对应的模式处理函数
3. 使用 initialInput 生成对话标题（调用 LLM，非流式，HTTP 请求）
4. 创建对话 JSON 数据（时间+短 UUID 作为 ID），添加用户消息和初始 assistant 消息（设置 `isRequesting: true`, `currentRequestId: requestId`）
5. 发送消息到 LLM（流式，通过 HTTP 请求 `/v1/messages`）

   - **注意**：`messageLoggerMiddleware` 会自动记录请求和响应日志到 `CHAT_MESSAGE_DIR`
   - 请求 ID 会自动写入响应头 `X-Request-Id`，可以通过该响应头获取

6. 在流式响应过程中，实时收集响应内容并更新对话的 messages
7. 返回对话 ID、请求 ID 和流式响应端点

### 2. GET /api/ai_chat/conversations

获取所有对话列表

**响应：**

```javascript
[
  {
    id: "20240101-abc123",
    title: "对话标题",
    mode: "chat",
    createdAt: 1234567890,
    updatedAt: 1234567890,
  },
];
```

### 3. GET /api/ai_chat/conversations/:id

获取单个对话详情

**响应：** 完整的对话对象

### 4. POST /api/ai_chat/conversations/:id/messages

向现有对话发送消息

**请求体：**

```javascript
{
  content: "用户消息",  // 必需
  mode: "chat",  // 可选，如果提供则切换对话模式（chat/canvas/agent/图片/视频），否则使用对话原有模式
  model: "provider,model",  // 可选，模型ID，用于选择不同的模型
  apiKey: "xxx",  // 可选，临时API Key
  files: []  // 可选，附件列表
}
```

**流程：**

1. 读取对话数据，检查最后一条 assistant 消息的 `isRequesting` 状态（如果存在）
2. 生成新的请求 ID
3. 确定使用的模式：如果请求体中提供了 `mode`，则使用新的模式（并更新对话的 `mode` 字段），否则使用对话原有的模式
4. 根据确定的模式调用对应的模式处理函数（函数内部会构建消息并执行请求）
5. 添加用户消息到对话的 messages，创建新的 assistant 消息并设置 `isRequesting: true`, `currentRequestId: requestId`。如果提供了 `mode` 则同时更新对话的 `mode` 字段
6. 发送到 LLM（流式，通过 HTTP 请求 `/v1/messages`）

   - **注意**：`messageLoggerMiddleware` 会自动记录请求和响应日志到 `CHAT_MESSAGE_DIR`
   - 请求 ID 会自动写入响应头 `X-Request-Id`，可以通过该响应头获取
   - 如果请求体中提供了 `model`，则使用指定的模型，否则使用对话默认模型或系统默认模型

7. 在流式响应过程中，实时收集响应内容并更新最后一条 assistant 消息的 content
8. 流式完成后，更新最后一条 assistant 消息：设置 `isRequesting: false`, `currentRequestId: null`
9. 更新对话主文件

### 5. GET /api/ai_chat/conversations/:id/stream

SSE 流式响应端点

**实现：**

- 使用内存会话管理（类似 chatRoutes.js）
- 支持多客户端连接
- 事件回放机制

## 模式处理逻辑

### Canvas 模式

- 不包含历史消息
- 只使用当前编辑器代码（editorCode）
- 模式处理函数中只添加系统提示词、编辑器代码和当前用户输入到消息数组

### Chat/Agent/Image/Video 模式

- 包含历史消息，但限制数量避免上下文过大（如最近 10 条）
- 模式处理函数中需要：
  - 加载系统提示词
  - 添加历史消息（限制数量）
  - 添加当前用户输入和附件

## 提示词系统

### 提示词格式

提示词文件直接导出标准的 `ChatMessage[]` 数组：

```javascript
// 标准 ChatMessage 格式
{
  role: "user" | "assistant" | "system",
  content: string | Array<{ type: "text", text: string }>,
  type?: string,  // 可选，用于区分用途
  // 扩展属性（仅 assistant 消息）：
  isRequesting?: boolean,  // 是否正在请求中
  currentRequestId?: string | null  // 当前请求ID
}
```

**示例：**

```javascript
// chatMode.js
module.exports = [
  {
    role: "system",
    content: "你好，{{name}}！欢迎使用 AI 助手。",
    // 或者使用数组格式：
    // content: [
    //   {
    //     type: "text",
    //     text: "你好，{{name}}！欢迎使用 AI 助手。"
    //   }
    // ]
  },
];
```

### 变量替换

提示词文件中的 `{{variable}}` 占位符在使用时通过工具函数进行替换：

1. **变量替换工具函数**：

```javascript
/**
 * 在消息中替换变量
 * @param {ChatMessage[]} messages - 消息数组
 * @param {Object} variables - 变量对象，例如 { name: "世界" }
 * @returns {ChatMessage[]} 替换后的消息数组（深拷贝）
 */
function replaceVariablesInMessages(messages, variables) {
  return messages.map((msg) => {
    const newMsg = { ...msg };

    if (typeof msg.content === "string") {
      // content 是字符串，直接替换
      newMsg.content = replaceVariables(msg.content, variables);
    } else if (Array.isArray(msg.content)) {
      // content 是数组，递归处理每个元素
      newMsg.content = msg.content.map((item) => {
        if (item.type === "text" && item.text) {
          return {
            ...item,
            text: replaceVariables(item.text, variables),
          };
        }
        return item;
      });
    }

    return newMsg;
  });
}

/**
 * 在文本中替换变量
 */
function replaceVariables(text, variables) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] || match;
  });
}
```

2. **使用方式**：

```javascript
const chatModePrompt = require("./prompts/chatMode");
const messages = replaceVariablesInMessages(chatModePrompt, { name: "世界" });
// 结果：messages[0].content = "你好，世界！欢迎使用 AI 助手。"
```

### 标题生成

- 使用 `src/prompts/titleGeneration.js`
- 返回 `ChatMessage[]` 格式的提示词
- 通过 HTTP 调用 LLM 生成标题（非流式）
- 清洗和规范化标题（去除重复、限制长度）

## LLM API 调用

### HTTP 请求格式

```javascript
POST http://127.0.0.1:${port}/v1/messages
Headers: {
  'Content-Type': 'application/json',
  'x-api-key': config.APIKEY  // 可选
}
Body: {
  messages: ChatMessage[],
  model: "provider,model",
  stream: true,
  apiKey: "xxx"  // 可选，临时API Key
}
```

### 流式处理

- 解析 SSE 格式响应
- 将事件转发给客户端
- 实时收集响应内容并更新对话数据

## 测试页面功能

- 创建对话（选择模式）
- 查看对话列表
- 切换对话
- 发送消息
- 显示流式响应（SSE）

## 实现细节

### 依赖项

- 复用 `projectRoutes.js` 的文件操作逻辑
- 复用 `chatRoutes.js` 的 SSE 实现模式
- 使用 `getClaudeConfig()` 获取配置
- 使用 `PROJECT_DIR` 存储对话文件
- **注意**：`messageLoggerMiddleware` 已自动处理 `/v1/messages` 的请求/响应日志，无需手动实现日志记录功能

### 错误处理

- 对话不存在：404
- 参数验证：400
- LLM 调用失败：500
- 文件操作错误：500
- 正在请求中：409（可选）

### 代码组织

- 文件操作函数（read/write/delete conversation）
- 模式处理函数（各模式的完整请求处理逻辑）
- 通用 LLM 请求函数（`requestLLM`，执行 /v1/messages 请求，支持流式事件监听）
- 提示词加载和变量替换函数
- 标题生成函数
- SSE 会话管理
- 路由注册函数

### 性能优化

- 流式响应过程中实时收集内容，避免频繁写入主项目文件
- 请求完成后一次性更新主文件

### To-dos

- [ ] 创建 aiChatRoutes.js 文件，实现基础路由结构和文件操作函数
- [ ] 实现各模式的系统提示词函数（chat, canvas, agent, image, video）
- [ ] 实现对话标题生成功能，调用 LLM 生成标题
- [ ] 实现对话的 CRUD API（创建、获取列表、获取详情）
- [ ] 实现 SSE 会话管理服务（会话存储、事件推送、客户端管理）
- [ ] 实现 LLM 流式调用函数，转发 SSE 事件
- [ ] 实现发送消息 API，支持流式响应
- [ ] 在 routes.js 中注册新路由
- [ ] 创建测试页面（Vue 3 + TailwindCSS），实现完整的测试功能
