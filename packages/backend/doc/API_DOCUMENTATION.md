# API 文档

本文档描述了 `server_llm.js` 中的自定义 API 以及 `@musistudio/llms` 包提供的默认 API 端点。

---

## 一、server_llm.js 自定义 API

### 1. Token 计数接口

**端点**: `POST /v1/messages/count_tokens`

**描述**: 兼容 Claude 的 token 计数接口，用于计算消息的 token 数量。

**请求参数**:

```json
{
  "messages": [], // 必需：消息数组
  "tools": [], // 可选：工具数组
  "system": [] // 可选：系统消息数组
}
```

**返回值**:

```json
{
  "input_tokens": 123 // token 数量
}
```

---

### 2. 读取配置接口

**端点**: `GET /api/config`

**描述**: 读取当前系统配置。

**请求参数**: 无

**返回值**: 配置文件内容（JSON 对象）

**错误响应**: 无（返回空对象或默认配置）

---

### 3. 列出 Transformers 接口

**端点**: `GET /api/transformers`

**描述**: 列出 transformerService 中已注册的所有 transformers。

**请求参数**: 无

**返回值**:

```json
{
  "transformers": [
    {
      "name": "transformer_name", // transformer 名称
      "endpoint": "/endpoint/path" // transformer 的端点路径，可能为 null
    }
  ]
}
```

---

### 4. 更新配置接口

**端点**: `POST /api/config`

**描述**: 更新系统配置，会自动备份现有配置文件。

**请求参数**:

```json
{
  // 配置对象的任意字段
  // 具体结构取决于配置文件的格式
}
```

**返回值**:

```json
{
  "success": true,
  "message": "Config saved successfully"
}
```

**说明**: 更新前会自动备份现有配置文件到备份路径。

---

### 5. 重启服务接口

**端点**: `POST /api/restart`

**描述**: 触发服务重启。响应会立即返回，实际重启在 1 秒后执行。

**请求参数**: 无

**返回值**:

```json
{
  "success": true,
  "message": "Service restart initiated"
}
```

**说明**:

- 响应会立即发送
- 服务会在 1 秒后通过 spawn 新进程的方式重启
- 日志级别设置为 "silent"

---

### 6. 静态文件服务

**端点**: `GET /ui/*`

**描述**: 提供静态文件服务，用于访问前端 UI 资源。

**请求参数**: 无（通过 URL 路径指定文件）

**返回值**: 静态文件内容（HTML/CSS/JS 等）

**说明**:

- 静态文件根目录: `public/`
- URL 前缀: `/ui/`
- 缓存时间: 1 小时
- `/ui` 会自动重定向到 `/ui/`

---

### 7. 版本检查接口

**端点**: `GET /api/update/check`

**描述**: 检查是否有可用更新。

**请求参数**: 无

**返回值**:

```json
{
  "hasUpdate": false, // 是否有更新
  "latestVersion": "1.0.0", // 最新版本号
  "changelog": undefined // 更新日志（可选）
}
```

**错误响应** (500):

```json
{
  "error": "Failed to check for updates"
}
```

---

### 8. 执行更新接口

**端点**: `POST /api/update/perform`

**描述**: 执行系统更新。

**请求参数**: 无

**返回值**:

```json
{
  "success": true,
  "message": "Update performed successfully"
}
```

**错误响应** (500):

```json
{
  "error": "Failed to perform update"
}
```

---

### 9. 获取日志文件列表

**端点**: `GET /api/logs/files`

**描述**: 获取所有可用的日志文件列表。

**请求参数**: 无

**返回值**: 日志文件数组，格式取决于 `getLogFiles()` 的实现

**错误响应** (500):

```json
{
  "error": "Failed to get log files"
}
```

---

### 10. 获取日志内容

**端点**: `GET /api/logs`

**描述**: 读取指定日志文件的内容。

**查询参数**:

- `file` (可选): 日志文件路径

**请求参数**: 无（通过查询参数传递）

**返回值**: 日志内容（格式取决于 `readLogContent()` 的实现）

**错误响应** (500):

```json
{
  "error": "Failed to get logs"
}
```

---

### 11. 清除日志内容

**端点**: `DELETE /api/logs`

**描述**: 清除指定日志文件的内容。

**查询参数**:

- `file` (可选): 日志文件路径

**请求参数**: 无（通过查询参数传递）

**返回值**: 操作结果（格式取决于 `clearLogContent()` 的实现）

**错误响应** (500):

```json
{
  "error": "Failed to clear logs"
}
```

---

## 二、@musistudio/llms 默认 API

### 1. 根路径信息接口

**端点**: `GET /`

**描述**: 返回 API 基本信息和版本。

**请求参数**: 无

**返回值**:

```json
{
  "message": "LLMs API",
  "version": "1.0.0"
}
```

---

### 2. 健康检查接口

**端点**: `GET /health`

**描述**: 检查服务健康状态。

**请求参数**: 无

**返回值**:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 3. Provider 管理 API

#### 3.1 创建 Provider

**端点**: `POST /providers`

**描述**: 注册一个新的 LLM provider。

**请求参数**:

```json
{
  "id": "provider_id",                    // 必需：provider 唯一标识
  "name": "provider_name",                // 必需：provider 名称
  "type": "openai" | "anthropic",        // 必需：provider 类型
  "baseUrl": "https://api.example.com",  // 必需：API 基础 URL（必须是有效 URL）
  "apiKey": "your_api_key",              // 必需：API 密钥
  "models": ["model1", "model2"]         // 必需：模型名称数组（至少一个）
}
```

**返回值**: 注册后的 Provider 对象（格式同 `LLMProvider`）

**错误响应**:

- `400`: 参数验证失败
  - `"Provider name is required"` - 名称为空
  - `"Valid base URL is required"` - URL 无效
  - `"API key is required"` - API 密钥为空
  - `"At least one model is required"` - 模型数组为空
  - `"Provider with name 'xxx' already exists"` - provider 名称已存在

**错误格式**:

```json
{
  "error": "错误消息",
  "code": "错误代码",
  "statusCode": 400
}
```

---

#### 3.2 获取所有 Providers

**端点**: `GET /providers`

**描述**: 获取所有已注册的 providers 列表。

**请求参数**: 无

**返回值**: Provider 对象数组

```json
[
  {
    "name": "provider_name",
    "baseUrl": "https://api.example.com",
    "apiKey": "your_api_key",
    "models": ["model1", "model2"],
    "transformer": { ... }
  }
]
```

---

#### 3.3 获取单个 Provider

**端点**: `GET /providers/:id`

**描述**: 根据 ID 获取指定的 provider 信息。

**路径参数**:

- `id` (必需): Provider 的 ID 或名称

**请求参数**: 无

**返回值**: Provider 对象

**错误响应**:

- `404`: Provider 不存在

```json
{
  "error": "Provider not found",
  "code": "provider_not_found",
  "statusCode": 404
}
```

---

#### 3.4 更新 Provider

**端点**: `PUT /providers/:id`

**描述**: 更新指定 provider 的配置。

**路径参数**:

- `id` (必需): Provider 的 ID 或名称

**请求参数** (所有字段都是可选的):

```json
{
  "name": "new_name",                     // 可选：provider 名称
  "type": "openai" | "anthropic",        // 可选：provider 类型
  "baseUrl": "https://new-api.com",      // 可选：API 基础 URL
  "apiKey": "new_api_key",               // 可选：API 密钥
  "models": ["new_model"],               // 可选：模型数组
  "enabled": true                        // 可选：是否启用
}
```

**返回值**: 更新后的 Provider 对象

**错误响应**:

- `404`: Provider 不存在

```json
{
  "error": "Provider not found",
  "code": "provider_not_found",
  "statusCode": 404
}
```

---

#### 3.5 删除 Provider

**端点**: `DELETE /providers/:id`

**描述**: 删除指定的 provider。

**路径参数**:

- `id` (必需): Provider 的 ID 或名称

**请求参数**: 无

**返回值**:

```json
{
  "message": "Provider deleted successfully"
}
```

**错误响应**:

- `404`: Provider 不存在

```json
{
  "error": "Provider not found",
  "code": "provider_not_found",
  "statusCode": 404
}
```

---

#### 3.6 切换 Provider 启用状态

**端点**: `PATCH /providers/:id/toggle`

**描述**: 启用或禁用指定的 provider。

**路径参数**:

- `id` (必需): Provider 的 ID 或名称

**请求参数**:

```json
{
  "enabled": true // 必需：true 启用，false 禁用
}
```

**返回值**:

```json
{
  "message": "Provider enabled successfully"
}
```

或

```json
{
  "message": "Provider disabled successfully"
}
```

**错误响应**:

- `404`: Provider 不存在

```json
{
  "error": "Provider not found",
  "code": "provider_not_found",
  "statusCode": 404
}
```

---

### 4. Transformer 端点

**端点**: `POST /{transformerEndpoint}`

**描述**: 动态注册的 transformer 端点。每个已注册的 transformer 如果配置了 `endPoint`，会自动注册为 POST 端点。

**请求参数**:

- 请求体格式取决于 transformer 的要求
- 必须在请求体中包含 `model` 字段，格式为 `"provider_name,model_name"`

**处理流程**:

1. 从 `model` 字段解析 provider 和 model
2. 验证 provider 是否存在
3. 执行请求转换器链（transformRequestOut → provider transformers → model-specific transformers）
4. 发送请求到 LLM provider
5. 执行响应转换器链（provider transformers → model-specific transformers → transformResponseIn）
6. 返回格式化后的响应

**流式响应支持**:

- 如果请求体中 `stream: true`，返回 Server-Sent Events (SSE) 格式的流式响应
- Content-Type: `text/event-stream`
- Cache-Control: `no-cache`
- Connection: `keep-alive`

**普通响应**:

- 返回 JSON 格式的响应

---

## 三、通用错误格式

所有 API 错误响应遵循以下格式：

```json
{
  "error": "错误消息描述",
  "code": "错误代码",
  "statusCode": 400
}
```

**常见错误代码**:

- `invalid_request`: 请求参数无效
- `provider_not_found`: Provider 不存在
- `provider_exists`: Provider 已存在
- `provider_response_error`: Provider 响应错误

---

## 四、注意事项

1. **Model 格式**: 在使用 transformer 端点时，`model` 字段必须使用 `"provider_name,model_name"` 格式，中间用逗号分隔。

2. **认证**: Provider 的 API 密钥会通过 `Authorization: Bearer {apiKey}` 头部自动添加到请求中。

3. **代理支持**: 系统支持通过配置 HTTPS 代理进行请求转发。

4. **转换器链**:

   - 请求转换顺序: transformer.transformRequestOut → provider transformers → model-specific transformers
   - 响应转换顺序: provider transformers → model-specific transformers → transformer.transformResponseIn
   - 如果 provider 只使用一个 transformer，可能会跳过某些转换步骤（透传模式）

5. **日志级别**: 某些端点设置了 `logLevel: "silent"`，不会输出访问日志。

6. **静态文件**: 静态文件服务的根目录为 `public/`，访问路径为 `/ui/*`。
