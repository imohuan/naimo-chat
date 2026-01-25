# 缓存管理 API 文档

## 概述

缓存管理 API 提供了查看和清理系统缓存目录的功能。支持的缓存目录包括：

- **CONFIG_BACKUP**: 配置备份目录
- **MCP_TOOL_CALL_LOG**: MCP工具调用日志目录
- **CHAT_MESSAGE**: 聊天消息目录
- **CLIPBOARD_IMAGES**: 剪贴板图片目录
- **LOGS**: 日志文件目录

## API 接口

### 1. 获取允许的缓存目录列表

获取所有可以管理的缓存目录配置信息。

**请求**
```
GET /api/cache/directories
```

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "key": "CONFIG_BACKUP",
      "name": "配置备份",
      "path": "/path/to/.claude-llm/backup-config",
      "description": "存储配置文件的备份"
    },
    {
      "key": "MCP_TOOL_CALL_LOG",
      "name": "MCP工具调用日志",
      "path": "/path/to/.claude-llm/mcp-logs/tool-calls",
      "description": "存储MCP工具调用的日志记录"
    }
  ]
}
```

### 2. 获取缓存目录信息

获取所有缓存目录的详细统计信息，包括文件数量、文件夹数量和占用空间。

**请求**
```
GET /api/cache/info
```

**响应示例**
```json
{
  "success": true,
  "data": {
    "directories": [
      {
        "key": "CONFIG_BACKUP",
        "name": "配置备份",
        "path": "/path/to/.claude-llm/backup-config",
        "description": "存储配置文件的备份",
        "exists": true,
        "size": 1048576,
        "sizeFormatted": "1.00 MB",
        "fileCount": 10,
        "folderCount": 2
      },
      {
        "key": "LOGS",
        "name": "日志文件",
        "path": "/path/to/.claude-llm/logs",
        "description": "存储系统运行日志",
        "exists": true,
        "size": 5242880,
        "sizeFormatted": "5.00 MB",
        "fileCount": 25,
        "folderCount": 0
      }
    ],
    "total": {
      "size": 10485760,
      "sizeFormatted": "10.00 MB",
      "fileCount": 100,
      "folderCount": 5
    }
  }
}
```

### 3. 清空单个缓存目录

清空指定的缓存目录内容（保留目录本身）。

**请求**
```
DELETE /api/cache/clear
Content-Type: application/json

{
  "directory": "LOGS"
}
```

**参数说明**
- `directory`: 目录键名，必须是允许的目录之一（CONFIG_BACKUP, MCP_TOOL_CALL_LOG, CHAT_MESSAGE, CLIPBOARD_IMAGES, LOGS）

**响应示例（成功）**
```json
{
  "success": true,
  "message": "清理成功",
  "directory": "日志文件",
  "path": "/path/to/.claude-llm/logs",
  "deletedFiles": 25,
  "deletedFolders": 0,
  "freedSpace": "5.00 MB"
}
```

**响应示例（目录不存在）**
```json
{
  "success": true,
  "message": "目录不存在，无需清理",
  "directory": "日志文件",
  "path": "/path/to/.claude-llm/logs",
  "deletedFiles": 0,
  "deletedFolders": 0
}
```

**响应示例（不允许的目录）**
```json
{
  "success": false,
  "error": "不允许清理的目录: INVALID_DIR",
  "allowedDirectories": [
    "CONFIG_BACKUP",
    "MCP_TOOL_CALL_LOG",
    "CHAT_MESSAGE",
    "CLIPBOARD_IMAGES",
    "LOGS"
  ]
}
```

### 4. 批量清空多个缓存目录

一次性清空多个缓存目录。

**请求**
```
DELETE /api/cache/clear-batch
Content-Type: application/json

{
  "directories": ["LOGS", "CLIPBOARD_IMAGES", "CONFIG_BACKUP"]
}
```

**参数说明**
- `directories`: 目录键名数组，每个元素必须是允许的目录之一

**响应示例**
```json
{
  "success": true,
  "data": [
    {
      "directory": "LOGS",
      "success": true,
      "message": "清理成功",
      "deletedFiles": 25,
      "deletedFolders": 0,
      "freedSpace": "5.00 MB"
    },
    {
      "directory": "CLIPBOARD_IMAGES",
      "success": true,
      "message": "清理成功",
      "deletedFiles": 50,
      "deletedFolders": 0,
      "freedSpace": "10.00 MB"
    },
    {
      "directory": "CONFIG_BACKUP",
      "success": false,
      "error": "不允许清理的目录: CONFIG_BACKUP"
    }
  ]
}
```

## 错误处理

所有接口在发生错误时都会返回相应的 HTTP 状态码和错误信息：

- `400 Bad Request`: 请求参数错误
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误

错误响应格式：
```json
{
  "success": false,
  "error": "错误描述信息"
}
```

## 安全说明

1. 只能清理预定义的缓存目录，不能清理任意目录
2. 清理操作会删除目录内的所有文件和子目录，但保留目录本身
3. 清理操作不可逆，请谨慎使用
4. 建议在清理前先调用 `/api/cache/info` 查看目录信息

## 使用示例

### 查看所有缓存信息
```bash
curl http://localhost:3457/api/cache/info
```

### 清空日志目录
```bash
curl -X DELETE http://localhost:3457/api/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"directory": "LOGS"}'
```

### 批量清空多个目录
```bash
curl -X DELETE http://localhost:3457/api/cache/clear-batch \
  -H "Content-Type: application/json" \
  -d '{"directories": ["LOGS", "CLIPBOARD_IMAGES"]}'
```
