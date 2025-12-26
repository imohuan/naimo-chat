# MCP 服务管理器实现计划（Fastify 版本）

## 架构设计

```
┌─────────────────────────────────────────┐
│   demo-router 项目 (Fastify)           │
│  ┌───────────────────────────────────┐  │
│  │  Fastify 服务器 (基于 @musistudio/llms) │
│  │  - /mcp/{group} 端点 (SSE/HTTP)   │  │
│  │  - /api/mcp/servers 管理接口       │  │
│  │  - 聚合上游 MCP 服务器工具          │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  MCP 服务器管理                    │  │
│  │  - 读取/保存 mcp-servers.json      │  │
│  │  - 增删改查接口                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │
         ├─> stdio MCP 服务器 (command + args)
         ├─> HTTP MCP 服务器 (url + headers)
         └─> SSE MCP 服务器 (url + headers)
```

## 实现步骤

### 1. 创建配置文件结构

- 文件：`src/mcp/mcp-servers.json`
- 格式：`{ mcpServers: { serverName: { command, args, url, headers, env } } }`
- 服务器名称作为 group 标识
- 自动检测传输类型：有 `command+args` 为 stdio，有 `url` 为 HTTP/SSE

### 2. 实现配置管理服务 (src/mcp/configService.js)

- `loadConfig()`: 读取 JSON 配置文件
- `saveConfig()`: 保存配置到 JSON 文件
- `getServer(name)`: 获取单个服务器配置
- `getAllServers()`: 获取所有服务器配置
- `createServer(name, config)`: 创建服务器
- `updateServer(name, config)`: 更新服务器
- `deleteServer(name)`: 删除服务器

### 3. 实现 MCP 服务管理 (src/mcp/mcpService.js)

- `initUpstreamServers()`: 初始化所有上游 MCP 服务器连接
- `createTransportFromConfig()`: 根据配置创建传输层（stdio/HTTP/SSE）
- `getServerByName(name)`: 获取指定名称的服务器信息
- `getMcpServer(sessionId, group)`: 获取或创建聚合 MCP 服务器（group = 服务器名称）
- `registerAllTools()`: 注册所有上游服务器的工具
- 工具名称格式：`{serverName}__{toolName}`

### 4. 实现 SSE/HTTP 传输服务 (src/mcp/transportService.js)

- `handleSSEConnection(req, reply, group)`: 处理 SSE 连接
- `handleStreamableHTTP(req, reply, group)`: 处理 StreamableHTTP 连接
- 使用 sessionId 进行会话隔离
- 支持 `/mcp/{group}` 路由

### 5. 实现 MCP 路由 (src/router/mcpRoutes.js)

- 按照 `updateRoutes.js` 的模式创建 `registerMcpRoutes(server)` 函数
- `GET /api/mcp/servers`: 获取所有服务器
- `GET /api/mcp/servers/:name`: 获取单个服务器配置
- `POST /api/mcp/servers`: 创建服务器
- `PUT /api/mcp/servers/:name`: 更新服务器
- `DELETE /api/mcp/servers/:name`: 删除服务器
- `GET /mcp/:group`: SSE 连接端点
- `POST /mcp/:group`: StreamableHTTP 端点

### 6. 集成到主路由 (src/router/routes.js)

- 在 `registerApiRoutes()` 中调用 `registerMcpRoutes(server)`

## 技术要点

1. **传输方式支持**：

   - stdio: `command + args` → `StdioClientTransport`
   - HTTP: `url + headers` → `SSEClientTransport` 或 `StreamableHTTPClientTransport`
   - 自动检测配置类型（有 command+args 为 stdio，有 url 为 HTTP/SSE）
   - 支持环境变量替换（`${VAR_NAME}` 格式）

2. **路由方式**：

   - `/mcp/{group}` 访问特定服务器（group = 服务器名称）
   - 不支持全局路由（必须指定 group）
   - 每个 group 对应一个独立的 MCP 服务器实例

3. **会话隔离**：

   - 使用 `sessionId` 区分不同客户端会话（与 `streamingId` 一一对应）
   - 每个 sessionId 维护独立的 MCP 服务器实例
   - **工作流程**：

     - 每个对话（Claude Code 实例）有独立的 `streamingId`
     - 启动 Claude Code 时通过 `--mcp-config` 传递 MCP 配置文件
     - MCP 配置文件中将 `streamingId` 作为 `sessionId` 传递给 HTTP/SSE 类型的 MCP 服务器
     - 后续所有 MCP 调用都使用这个 `sessionId`

   - **sessionId 传输方式**：

     - **StreamableHTTP (POST /mcp/:group)**：

       - 通过 HTTP 请求头传递：`mcp-session-id: <streamingId>`
       - 在生成 MCP 配置文件时，将 `streamingId` 注入到 HTTP 类型 MCP 服务器的 `headers` 中：
         ```json
         {
           "mcpServers": {
             "my-server": {
               "url": "http://localhost:3457/mcp/my-server",
               "headers": {
                 "mcp-session-id": "${STREAMING_ID}"
               }
             }
           }
         }
         ```
       - 服务器端从请求头读取 `mcp-session-id`，作为 sessionId 使用

     - **SSE (GET /mcp/:group)**：

       - 连接建立时，通过请求头传递：`mcp-session-id: <streamingId>`
       - 后续消息通过查询参数传递：`GET /mcp/:group/messages?sessionId=<streamingId>`
       - 同样在 MCP 配置文件的 `headers` 中注入 `streamingId`

     - **stdio 传输**：

       - 通过环境变量传递：`MCP_STREAMING_ID=<streamingId>`
       - MCP 服务器从环境变量读取，然后通过 HTTP 请求传递给权限服务等

     - **环境变量替换**：
       - 支持 `${STREAMING_ID}` 或 `${MCP_STREAMING_ID}` 格式的环境变量替换
       - 在生成 MCP 配置文件时，将实际的 `streamingId` 替换到配置中

4. **工具聚合**：

   - 将上游服务器的工具聚合到统一的 MCP 服务器
   - 工具名称格式：`{serverName}__{toolName}`（使用双下划线分隔）
   - 工具调用时自动路由到对应的上游服务器

5. **框架适配**：

   - 使用 Fastify（通过 `server.app` 访问）
   - 路由注册模式：`registerXxxRoutes(server)` 函数
   - 请求/响应：`req`, `reply`（Fastify 风格）
   - 支持 SSE 流式响应和 StreamableHTTP

6. **错误处理**：

   - 上游服务器连接失败时标记为 disconnected 状态
   - 工具调用失败时返回详细错误信息
   - 支持重连机制（仅 HTTP/SSE 传输）

7. **初始化流程**：
   - 启动时读取配置文件
   - 异步初始化所有上游服务器连接
   - 注册所有工具到聚合服务器
   - 支持热重载（修改配置后重新加载）

## 文件结构

```
demo-router/
├── src/
│   ├── router/
│   │   ├── routes.js              # 主路由（添加 mcpRoutes 注册）
│   │   └── mcpRoutes.js            # MCP 路由
│   └── mcp/
│       ├── configService.js        # 配置管理
│       ├── mcpService.js           # MCP 服务管理
│       ├── transportService.js     # 传输层处理
│       └── mcp-servers.json        # 配置文件（初始为空对象）
├── package.json                    # 添加 @modelcontextprotocol/sdk 依赖
└── README.md                       # 使用说明
```

## 依赖安装

需要在 `package.json` 中添加以下依赖：

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

## 配置文件格式示例

### stdio 传输配置

```json
{
  "mcpServers": {
    "demo-permissions": {
      "command": "node",
      "args": ["G:\\ClaudeCode\\demo\\mcp-server.js"],
      "env": {
        "APPROVAL_ENDPOINT_BASE": "http://127.0.0.1:8080",
        "MCP_STREAMING_ID": "${STREAMING_ID}"
      }
    }
  }
}
```

### HTTP/SSE 传输配置

```json
{
  "mcpServers": {
    "alphavantage": {
      "url": "https://mcprouter.to/alphavantage",
      "headers": {
        "Authorization": "Bearer sk-xxx",
        "HTTP-Referer": "https://www.cursor.com/",
        "X-Title": "Cursor"
      }
    }
  }
}
```

## 实现细节

### 1. configService.js 实现要点

- 使用 `fs.readFileSync` 和 `fs.writeFileSync` 同步读写 JSON 文件
- 配置文件路径：`path.join(__dirname, 'mcp-servers.json')`
- 支持配置验证（检查必需字段）
- 保存前备份原配置文件（可选）

### 2. mcpService.js 实现要点

- 维护 `serverInfos` 数组存储所有上游服务器信息
- 每个服务器包含：`name`, `status`, `tools`, `client`, `transport`, `error`
- `initUpstreamServers()` 异步初始化所有服务器
- `createTransportFromConfig()` 根据配置自动选择传输方式
- `getMcpServer(sessionId, group)` 为每个会话创建聚合服务器
- 工具调用时解析工具名（`serverName__toolName`），路由到对应服务器

### 3. transportService.js 实现要点

- SSE 连接：使用 `SSEServerTransport` 处理 GET 请求
- StreamableHTTP：使用 `StreamableHTTPServerTransport` 处理 POST 请求
- sessionId 生成：从请求头 `X-Session-Id` 或查询参数 `sessionId` 获取，否则自动生成 UUID
- 错误处理：连接失败时返回适当的 HTTP 状态码和错误信息

### 4. mcpRoutes.js 实现要点

- 遵循 `updateRoutes.js` 的模式
- API 路由使用 `app.get/post/put/delete()` 注册
- MCP 端点使用 `app.get('/mcp/:group', ...)` 和 `app.post('/mcp/:group', ...)`
- 请求体验证（使用 Fastify schema 或手动验证）
- 错误响应格式统一：`{ success: false, error: "..." }`

## 测试要点

1. **配置管理测试**：

   - 创建/更新/删除服务器配置
   - 配置文件格式验证
   - 并发读写安全性

2. **MCP 服务测试**：

   - stdio 服务器启动和连接
   - HTTP/SSE 服务器连接
   - 工具注册和调用
   - 错误处理和重连

3. **路由测试**：
   - `/api/mcp/servers` 接口功能
   - `/mcp/{group}` 端点连接
   - sessionId 隔离验证

## 注意事项

1. **环境变量**：支持 `${VAR_NAME}` 格式的环境变量替换
2. **路径处理**：Windows 和 Unix 路径兼容性
3. **错误日志**：记录详细的错误信息便于调试
4. **性能优化**：异步初始化，避免阻塞启动
5. **资源清理**：服务停止时正确关闭所有连接
