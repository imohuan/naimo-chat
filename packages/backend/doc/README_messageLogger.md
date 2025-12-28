# 消息日志记录中间件使用说明

## 功能概述

`messageLoggerMiddleware` 是一个用于保存 `/v1/messages` 接口请求和响应的中间件。它通过 Fastify 的 Hook 系统拦截请求和响应，无需修改 llm 项目的代码。

## 工作原理

1. **preHandler Hook**: 在请求处理前记录请求数据
2. **onSend Hook**: 在响应发送前记录响应数据
3. **异步保存**: 保存操作是异步的，不会阻塞请求响应

## 使用方法

### 基本使用

在 `index_llm.js` 中已经集成了该中间件：

```javascript
const { createMessageLoggerMiddleware } = require("./middleware");

// 创建中间件实例
const messageLogger = createMessageLoggerMiddleware({
  logDir: path.join(HOME_DIR, "logs", "messages"),
  saveToFile: true,
  logStream: false, // 流式响应较大，默认不记录
});

// 注册 hooks
server.addHook("preHandler", messageLogger.preHandler);
server.addHook("onSend", messageLogger.onSend);
```

### 配置选项

```javascript
createMessageLoggerMiddleware({
  // 日志保存目录（默认: ./logs/messages）
  logDir: path.join(HOME_DIR, "logs", "messages"),
  
  // 是否保存到文件（默认: true）
  saveToFile: true,
  
  // 是否记录流式响应（默认: false，因为流式响应较大）
  logStream: false,
  
  // 自定义保存函数（可选）
  // 可以用于保存到数据库或其他存储系统
  onSave: async (requestData, responseData) => {
    // 保存到数据库
    await saveToDatabase(requestData, responseData);
  },
})
```

### 自定义保存函数示例

```javascript
const messageLogger = createMessageLoggerMiddleware({
  logDir: path.join(HOME_DIR, "logs", "messages"),
  saveToFile: true,
  onSave: async (requestData, responseData) => {
    // 保存到 MongoDB
    await db.messages.insertOne({
      timestamp: new Date(),
      request: requestData,
      response: responseData,
    });
    
    // 或者保存到其他数据库
    // await saveToPostgreSQL(requestData, responseData);
  },
});
```

## 日志格式

日志以 JSONL（JSON Lines）格式保存，每行一个 JSON 对象：

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "request": {
    "method": "POST",
    "url": "/v1/messages",
    "headers": {
      "content-type": "application/json",
      "user-agent": "..."
    },
    "body": {
      "model": "anthropic,claude-3-opus-20240229",
      "messages": [...],
      "stream": false
    },
    "query": {},
    "ip": "127.0.0.1",
    "requestId": "req-123"
  },
  "response": {
    "statusCode": 200,
    "headers": {
      "content-type": "application/json"
    },
    "duration": 1234,
    "isStream": false,
    "body": {
      "id": "msg_123",
      "type": "message",
      "role": "assistant",
      "content": [...]
    }
  }
}
```

## 日志文件位置

默认日志文件保存在：`~/.claude-llm/logs/messages/`

文件命名格式：`messages-YYYY-MM-DD-HH-MM-SS.jsonl`

## 注意事项

1. **流式响应**: 默认不记录流式响应（`stream: true`），因为流式响应数据量较大。如需记录，设置 `logStream: true`

2. **性能影响**: 保存操作是异步的，不会阻塞请求，但大量请求时仍可能影响性能

3. **存储空间**: 日志文件会持续增长，建议定期清理或实现日志轮转

4. **敏感信息**: 当前实现会记录完整的请求体和响应体，如果包含敏感信息（如 API Key），建议在保存前进行脱敏处理

## 扩展建议

1. **日志轮转**: 实现按大小或时间自动轮转日志文件
2. **数据脱敏**: 在保存前移除敏感信息（如 API Key）
3. **压缩存储**: 对历史日志进行压缩以节省空间
4. **统计分析**: 基于日志数据进行使用情况分析

