# StreamableHTTP 实现原理与问题总结

## 一、问题总结

### 问题 1：`onsessioninitialized` 回调没有触发

#### 根本原因

1. **请求体获取时机错误**：

   - 新代码在 `hijack()` **之后**才获取 `requestBody`
   - 但 `hijack()` 会接管响应流，导致 Fastify 无法正确解析请求体
   - 结果：`requestBody` 为 `null` 或 `undefined`，无法判断是否是 `initialize` 请求

2. **参数传递错误**：

   - 新代码的 `handleStreamableHTTP` 方法签名：`(req, reply, mcpServer, routeSessionId)`
   - 旧代码的方法签名：`(req, reply, mcpServer, requestBody, routeSessionId)`
   - 新代码没有传递 `requestBody`，导致在方法内部重新获取时可能失败

3. **sessionId 处理逻辑不一致**：
   - 新代码直接使用 `convertSessionId(routeSessionId, "http")`
   - 如果 `routeSessionId` 为 `undefined`，会导致 `providedSessionId` 也为 `undefined`
   - 旧代码会先检查 `routeSessionId`，然后从 headers/query 中获取，最后才处理前缀

#### 修复方案

```javascript
// 修复1：在 hijack() 之前获取 requestBody
const requestBody = req.body || null;
if (requestBody) {
  delete requestBody.model;
}
const isInitialize = requestBody && requestBody.method === "initialize";
reply.hijack(); // 在获取 requestBody 之后才 hijack

// 修复2：修改方法签名，传递 requestBody
await transportService.handleStreamableHTTP(
  req,
  reply,
  mcpServer,
  requestBody, // 传递已解析的 requestBody
  sessionId
);

// 修复3：使用与旧代码一致的 sessionId 处理逻辑
const baseSessionId =
  routeSessionId ||
  req.headers["mcp-session-id"] ||
  req.headers["x-session-id"] ||
  req.query.sessionId;
const providedSessionId =
  baseSessionId && !baseSessionId.includes(":")
    ? `http:${baseSessionId}`
    : baseSessionId;
```

---

### 问题 2：SSE 会话覆盖 StreamableHTTP 会话

#### 根本原因

1. **sessionId 前缀处理错误**：

   - `handleSSEConnection` 接收的 `baseSessionId` 可能已经带有 `http:` 前缀
   - `convertSessionId` 方法检查到已有 `:` 就直接返回，不会添加 `sse:` 前缀
   - 结果：SSE 会话使用 `http:xxx` 作为 sessionId，与 StreamableHTTP 会话冲突

2. **会话存储冲突**：
   - 两种传输类型使用相同的 sessionId 存储在 `this.sessions` Map 中
   - 后创建的会话会覆盖先创建的会话
   - 结果：StreamableHTTP 会话被 SSE 会话覆盖，导致后续请求失败

#### 修复方案

```javascript
// 在 handleSSEConnection 中，先清理前缀，再添加 sse: 前缀
const cleanSessionId = baseSessionId?.includes(":")
  ? baseSessionId.split(":").slice(-1)[0] // 提取最后一部分（去掉所有前缀）
  : baseSessionId;
const sessionId = this.convertSessionId(cleanSessionId, "sse");
// 结果：无论输入是什么，SSE 会话都使用 sse:xxx 格式
```

---

## 二、StreamableHTTP 实现原理

### 1. 架构概述

StreamableHTTP 是 MCP (Model Context Protocol) 的一种传输方式，它使用标准的 HTTP POST 请求进行双向通信，而不是像 SSE 那样需要长连接。

```
客户端                   服务器
  |                        |
  |--- POST /mcp/:group -->|  (initialize 请求)
  |                        |  1. 创建 StreamableHTTPServerTransport
  |                        |  2. 连接 MCP 服务器
  |                        |  3. 处理请求并返回响应
  |<-- JSON-RPC Response ---|  (响应)
  |                        |
  |--- POST /mcp/:group -->|  (后续请求，使用相同 sessionId)
  |                        |  1. 查找现有会话
  |                        |  2. 重用 transport
  |                        |  3. 处理请求并返回响应
  |<-- JSON-RPC Response ---|
```

### 2. 核心组件

#### 2.1 TransportService

负责管理所有传输层会话，包括 SSE 和 StreamableHTTP。

```javascript
class TransportService {
  constructor() {
    this.sessions = new Map(); // sessionId -> { transport, server, group, transportType }
  }
}
```

**会话存储结构**：

- Key: `sessionId`（带前缀：`sse:xxx` 或 `http:xxx`）
- Value: `{ transport, server, group, transportType }`

#### 2.2 StreamableHTTPServerTransport

MCP SDK 提供的传输层实现，负责：

- 管理会话生命周期
- 处理 JSON-RPC 请求/响应
- 维护会话状态

**关键配置**：

```javascript
transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => sessionId, // 返回会话ID
  onsessioninitialized: (id) => {
    // 会话初始化回调
    // 当第一个 initialize 请求处理完成时触发
  },
});
```

### 3. 请求处理流程

#### 3.1 初始化请求（initialize）

```
1. 客户端发送 POST /mcp/:group
   Body: { method: "initialize", params: {...}, jsonrpc: "2.0", id: 0 }

2. 路由层（mcpRoutes.js）
   - 在 hijack() 之前获取 requestBody
   - 删除 model 字段（MCP 协议不允许额外字段）
   - 判断是否是 initialize 请求
   - 调用 hijack() 接管响应流
   - 获取/生成 sessionId
   - 获取 MCP 服务器实例

3. TransportService.handleStreamableHTTP()
   - 处理 sessionId（添加 http: 前缀）
   - 检查是否已有会话
   - 如果没有，创建新的 StreamableHTTPServerTransport
   - 连接 MCP 服务器到 transport
   - 存储会话到 this.sessions

4. transport.handleRequest()
   - 处理 initialize 请求
   - 触发 onsessioninitialized 回调
   - 返回初始化响应

5. 客户端收到响应
   - 保存 sessionId（用于后续请求）
```

#### 3.2 后续请求

```
1. 客户端发送 POST /mcp/:group
   Headers: { "mcp-session-id": "http:xxx" }
   Body: { method: "tools/list", jsonrpc: "2.0", id: 1 }

2. 路由层
   - 获取 sessionId（从 headers 或 query）
   - 调用 hijack()
   - 获取 MCP 服务器实例

3. TransportService.handleStreamableHTTP()
   - 处理 sessionId（添加 http: 前缀）
   - 查找现有会话（this.sessions.get(sessionId)）
   - 如果找到且类型正确，重用 transport
   - 如果类型不匹配（如被 SSE 覆盖），删除并重新创建
   - 调用 transport.handleRequest()

4. transport.handleRequest()
   - 处理请求
   - 返回响应
```

### 4. 会话管理

#### 4.1 会话创建时机

- **新会话**：当收到 `initialize` 请求且没有现有会话时
- **重用会话**：当找到现有 StreamableHTTP 会话时
- **重新创建**：当会话类型不匹配时（如被 SSE 覆盖）

#### 4.2 会话 ID 格式

- **StreamableHTTP**: `http:{uuid}` 或 `http:{baseSessionId}`
- **SSE**: `sse:{uuid}` 或 `sse:{baseSessionId}`
- **目的**：避免两种传输类型的会话冲突

#### 4.3 会话查找逻辑

```javascript
// 1. 优先使用路由传递的 sessionId
const baseSessionId =
  routeSessionId ||
  req.headers["mcp-session-id"] ||
  req.headers["x-session-id"] ||
  req.query.sessionId;

// 2. 处理前缀
const providedSessionId =
  baseSessionId && !baseSessionId.includes(":")
    ? `http:${baseSessionId}`
    : baseSessionId;

// 3. 查找会话
const session = this.sessions.get(providedSessionId);
```

### 5. 关键设计点

#### 5.1 hijack() 的时机

- **必须在获取 requestBody 之后**：因为 `hijack()` 会接管响应流，可能导致 Fastify 无法解析请求体
- **必须在处理响应之前**：让 StreamableHTTPServerTransport 完全控制响应

#### 5.2 requestBody 的处理

- **在路由层处理**：在 `hijack()` 之前获取，删除 `model` 字段
- **传递给 transportService**：避免在 transportService 中重新解析（可能失败）

#### 5.3 响应流编码问题

StreamableHTTPServerTransport 要求响应流不能有编码设置，需要使用 Proxy 包装：

```javascript
const wrappedResponse = new Proxy(response, {
  get(target, prop) {
    if (prop === "_readableState" && target._readableState) {
      return new Proxy(target._readableState, {
        get(stateTarget, stateProp) {
          if (stateProp === "encoding") return null;
          return stateTarget[stateProp];
        },
      });
    }
    if (prop === "readableEncoding") return null;
    return target[prop];
  },
});
```

### 6. 与 SSE 的区别

| 特性       | StreamableHTTP                   | SSE                                         |
| ---------- | -------------------------------- | ------------------------------------------- |
| 连接方式   | 短连接（每个请求一个 HTTP 请求） | 长连接（一个 HTTP 连接保持打开）            |
| 双向通信   | 通过 POST 请求发送，响应返回     | 客户端通过 POST 发送，服务器通过 SSE 流推送 |
| 会话管理   | 通过 sessionId 在多个请求间复用  | 通过长连接维护会话                          |
| 适用场景   | 更适合 RESTful API 风格          | 更适合实时推送场景                          |
| 实现复杂度 | 相对简单（标准 HTTP）            | 需要管理长连接生命周期                      |

---

## 三、修复后的完整流程

### 初始化请求流程

```
1. 客户端: POST /mcp/test-group
   Body: { method: "initialize", ... }

2. 路由层:
   - 获取 requestBody（hijack 之前）
   - 删除 model 字段
   - 判断是 initialize 请求
   - hijack() 接管响应
   - 获取 sessionId: "49fa215c-..."
   - 获取 MCP 服务器

3. TransportService:
   - 处理 sessionId: "http:49fa215c-..."
   - 创建 StreamableHTTPServerTransport
   - 连接 MCP 服务器
   - 存储会话: sessions.set("http:49fa215c-...", {...})
   - 调用 transport.handleRequest()

4. Transport:
   - 处理 initialize 请求
   - 触发 onsessioninitialized 回调 ✅
   - 返回初始化响应

5. 客户端:
   - 收到响应，保存 sessionId
```

### 后续请求流程

```
1. 客户端: POST /mcp/test-group
   Headers: { "mcp-session-id": "http:49fa215c-..." }
   Body: { method: "tools/list", ... }

2. 路由层:
   - 获取 requestBody
   - hijack()
   - 获取 sessionId（从 headers）

3. TransportService:
   - 处理 sessionId: "http:49fa215c-..."
   - 查找会话: sessions.get("http:49fa215c-...") ✅ 找到
   - 验证类型: StreamableHTTPServerTransport ✅ 正确
   - 重用 transport
   - 调用 transport.handleRequest()

4. Transport:
   - 处理请求
   - 返回响应

5. 客户端:
   - 收到响应
```

---

## 四、关键代码位置

### 路由层

- `demo-router/src/router/mcpRoutes.js` (157-195 行)
  - StreamableHTTP 路由处理
  - requestBody 获取和清理
  - hijack() 调用时机

### 传输服务层

- `demo-router/src/mcp/transportService.js`
  - `handleStreamableHTTP()` (333-622 行): StreamableHTTP 请求处理
  - `handleSSEConnection()` (39-93 行): SSE 连接处理
  - `convertSessionId()` (30-37 行): sessionId 前缀处理
  - `getBody()` (94-138 行): 请求体获取和清理

---

## 五、最佳实践

1. **始终在 hijack() 之前获取 requestBody**
2. **使用前缀区分不同传输类型的会话**（`sse:` vs `http:`）
3. **在路由层处理 requestBody 清理**（删除 model 字段）
4. **传递已解析的 requestBody 给 transportService**，避免重复解析
5. **使用 Proxy 包装响应流**，解决编码检查问题
6. **在创建 transport 前确保 sessionId 有值且格式正确**

---

## 六、总结

### 问题根源

1. **请求体获取时机错误**：在 `hijack()` 之后获取导致解析失败
2. **参数传递不完整**：没有传递 `requestBody` 给 `handleStreamableHTTP`
3. **sessionId 前缀处理错误**：SSE 会话可能使用 `http:` 前缀，导致冲突

### 修复效果

1. ✅ `onsessioninitialized` 回调正常触发
2. ✅ SSE 和 StreamableHTTP 会话不再冲突
3. ✅ 会话能够正确重用
4. ✅ 服务器能够正确初始化

### StreamableHTTP 优势

- 使用标准 HTTP，易于集成
- 不需要长连接，资源占用更少
- 适合 RESTful API 风格的应用
- 实现相对简单，易于调试
