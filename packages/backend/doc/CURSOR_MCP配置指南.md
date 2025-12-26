# Cursor MCP 配置指南

本指南说明如何在 Cursor 中配置 MCP，连接到 `demo-router` 中转服务器。

## 架构说明

`demo-router` 是一个 MCP 中转服务器，它：

1. 管理多个上游 MCP 服务器（通过 `mcp-servers.json` 配置）
2. 聚合这些服务器的工具
3. 通过 HTTP/SSE 端点暴露给 Cursor

## 服务器信息

- **默认地址**: `http://127.0.0.1:3457`
- **SSE 端点**: `GET /mcp/:group`
- **消息端点**: `POST /mcp/:group/messages`

其中 `:group` 对应你在 `mcp-servers.json` 中配置的服务器名称。

## 配置步骤

### 1. 确保 demo-router 正在运行

首先确保 `demo-router` 服务已启动：

```bash
cd demo-router
npm start
# 或
node src/index_llm.js
```

服务启动后，默认监听在 `http://127.0.0.1:3457`。

### 2. 查看可用的服务器组

访问以下 API 查看已配置的服务器：

```bash
curl http://127.0.0.1:3457/api/mcp/servers
```

这会返回类似：

```json
{
  "test-server": {
    "command": "node",
    "args": ["src/mcp/mcps/test-mcp-server.js"],
    "description": "测试用的 MCP 服务器",
    "enabled": true
  }
}
```

服务器名称（如 `test-server`）就是你在 Cursor 配置中需要使用的 `:group` 值。

### 3. 配置 Cursor MCP

编辑 Cursor 的 MCP 配置文件：

**Windows**: `C:\Users\<你的用户名>\.cursor\mcp.json`  
**macOS/Linux**: `~/.cursor/mcp.json`

#### 配置格式

```json
{
  "mcpServers": {
    "demo-router-test": {
      "url": "http://127.0.0.1:3457/mcp/test-server",
      "transport": "sse",
      "headers": {}
    }
  }
}
```

#### 配置说明

- **`demo-router-test`**: 这是 Cursor 中显示的服务器名称，可以自定义
- **`url`**: 中转服务器的 SSE 端点
  - 格式: `http://127.0.0.1:3457/mcp/<服务器名称>`
  - `<服务器名称>` 必须与 `mcp-servers.json` 中的键名一致
- **`transport`**: 使用 `"sse"` 表示 Server-Sent Events 传输
- **`headers`**: 可选的 HTTP 请求头（如果需要认证等）

### 4. 完整配置示例

假设你在 `mcp-servers.json` 中配置了以下服务器：

```json
{
  "mcpServers": {
    "test-server": {
      "command": "node",
      "args": ["src/mcp/mcps/test-mcp-server.js"]
    },
    "my-custom-server": {
      "command": "python",
      "args": ["-m", "my_mcp_server"]
    }
  }
}
```

那么在 Cursor 的 `mcp.json` 中可以这样配置：

```json
{
  "mcpServers": {
    "demo-router-aggregated": {
      "url": "http://127.0.0.1:3457/mcp/test-server",
      "transport": "sse",
      "headers": {}
    },
    "demo-router-custom": {
      "url": "http://127.0.0.1:3457/mcp/my-custom-server",
      "transport": "sse",
      "headers": {}
    }
  }
}
```

### 5. 重启 Cursor

配置完成后，重启 Cursor 使配置生效。

## 验证连接

1. 在 Cursor 中，MCP 服务器应该出现在可用工具列表中
2. 工具名称格式为：`{服务器名称}__{工具名称}`
   - 例如：`test-server__echo`、`test-server__current_time`

## 常见问题

### 1. 连接失败

- 检查 `demo-router` 是否正在运行
- 检查端口是否正确（默认 3457）
- 检查服务器名称是否与 `mcp-servers.json` 中的键名一致

### 2. 工具未显示

- 确保上游 MCP 服务器已成功连接
- 查看 `demo-router` 的日志输出
- 检查 `mcp-servers.json` 中的服务器配置是否正确

### 3. 修改服务器配置

如果需要添加、修改或删除服务器：

1. **通过 API**（推荐）:

   ```bash
   # 添加服务器
   curl -X POST http://127.0.0.1:3457/api/mcp/servers \
     -H "Content-Type: application/json" \
     -d '{
       "name": "new-server",
       "config": {
         "command": "node",
         "args": ["path/to/server.js"]
       }
     }'

   # 更新服务器
   curl -X PUT http://127.0.0.1:3457/api/mcp/servers/new-server \
     -H "Content-Type: application/json" \
     -d '{
       "config": {
         "command": "node",
         "args": ["path/to/updated-server.js"]
       }
     }'

   # 删除服务器
   curl -X DELETE http://127.0.0.1:3457/api/mcp/servers/new-server
   ```

2. **直接编辑文件**:
   编辑 `demo-router/src/mcp/mcp-servers.json`，然后重启服务

### 4. 自定义端口

如果 `demo-router` 运行在不同端口，修改 Cursor 配置中的 URL：

```json
{
  "mcpServers": {
    "demo-router": {
      "url": "http://127.0.0.1:8080/mcp/test-server",
      "transport": "sse"
    }
  }
}
```

## 工作原理

1. Cursor 连接到 `GET /mcp/:group` 建立 SSE 连接
2. Cursor 通过 `POST /mcp/:group/messages` 发送 JSON-RPC 消息
3. `demo-router` 将消息转发到对应的上游 MCP 服务器
4. 上游服务器的响应通过 SSE 流返回给 Cursor
5. 工具名称会自动添加服务器前缀，避免冲突

## 高级配置

### 使用环境变量

如果需要在不同环境使用不同配置，可以在 `headers` 中传递：

```json
{
  "mcpServers": {
    "demo-router": {
      "url": "http://127.0.0.1:3457/mcp/test-server",
      "transport": "sse",
      "headers": {
        "X-Environment": "production"
      }
    }
  }
}
```

### 聚合多个服务器

`demo-router` 会自动聚合所有已连接的上游服务器工具。如果你配置了多个服务器，它们的所有工具都会通过同一个端点暴露。

## 相关文件

- `demo-router/src/mcp/mcp-servers.json` - 上游服务器配置
- `demo-router/src/router/mcpRoutes.js` - MCP 路由定义
- `demo-router/src/mcp/mcpService.js` - MCP 服务逻辑
- `demo-router/src/mcp/transportService.js` - 传输层处理
