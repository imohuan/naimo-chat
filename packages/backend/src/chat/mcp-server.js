#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) 权限审批服务器
 * 
 * 这是一个最小化的 MCP 服务器，用于处理工具使用的权限审批流程。
 * 服务器通过 stdio 与 MCP 客户端通信，并代理到后端权限审批端点。
 * 
 * 主要功能：
 * - 暴露 approval_prompt 工具，供 MCP 客户端调用
 * - 向后端服务器发送权限审批请求
 * - 轮询权限审批状态直到获得批准或拒绝
 * - 返回审批结果给 MCP 客户端
 * 
 * 环境变量：
 * - APPROVAL_ENDPOINT_BASE: 后端权限服务器的基地址（默认: http://127.0.0.1:8080）
 * - MCP_STREAMING_ID: 流式会话标识符，用于关联权限请求
 */

// MCP SDK 服务器核心模块
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
// MCP SDK stdio 传输模块，用于通过标准输入输出与客户端通信
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
// MCP SDK 类型定义和错误处理
const {
  CallToolRequestSchema,    // 调用工具的请求模式
  ListToolsRequestSchema,   // 列出工具的请求模式
  McpError,                 // MCP 错误类
  ErrorCode,                // MCP 错误码枚举
} = require("@modelcontextprotocol/sdk/types.js");

// ==================== 配置常量 ====================
// 后端权限服务器的基地址，可通过环境变量覆盖
const BASE = process.env.APPROVAL_ENDPOINT_BASE || "http://127.0.0.1:8080";
// 通知后端创建权限审批请求的端点
const NOTIFY_URL = `${BASE}/api/chat/permissions/notify`;
// 查询权限审批列表的端点
const LIST_URL = `${BASE}/api/chat/permissions`;
// 流式会话标识符，用于关联同一会话的多个权限请求
const STREAMING_ID = process.env.MCP_STREAMING_ID;

// ==================== MCP 服务器初始化 ====================
// 创建 MCP 服务器实例
// - name: 服务器名称
// - capabilities: 服务器能力配置，这里启用了工具能力
const server = new Server(
  { name: "permissions", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ==================== 注册工具列表处理器 ====================
// 当客户端请求可用工具列表时，返回服务器提供的工具信息
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "approval_prompt",  // 工具名称
      description: "Request approval for tool usage from demo server",  // 工具描述
      inputSchema: {
        type: "object",
        properties: {
          tool_name: { type: "string" },  // 需要审批的工具名称
          input: { type: "object" },      // 工具调用的输入参数
        },
        required: ["tool_name", "input"],  // 必需的参数
      },
    },
  ],
}));

// ==================== 注册工具调用处理器 ====================
// 当客户端调用工具时，处理 approval_prompt 工具的调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // 验证工具名称，只处理 approval_prompt 工具
  if (request.params.name !== "approval_prompt") {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${request.params.name}`
    );
  }

  // 提取工具调用参数
  const { tool_name, input } = request.params.arguments;

  // 记录工具调用日志
  console.error("[MCP] approval_prompt called", {
    tool_name,
    input,
    streamingId: STREAMING_ID || "unknown",
    timestamp: new Date().toISOString(),
  });

  // ==================== 第一步：通知后端创建权限审批请求 ====================
  // 向后端发送 POST 请求，创建新的权限审批请求
  const notifyRes = await fetch(NOTIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      toolName: tool_name,              // 需要审批的工具名称
      toolInput: input,                 // 工具调用的输入参数
      streamingId: STREAMING_ID || "unknown",  // 流式会话标识符
    }),
  });

  // 记录通知响应日志
  console.error("[MCP] notify response", {
    status: notifyRes.status,
    ok: notifyRes.ok,
    streamingId: STREAMING_ID,
  });

  // 检查通知请求是否成功
  if (!notifyRes.ok) {
    const t = await notifyRes.text();
    throw new Error(`notify failed: ${notifyRes.status} ${t}`);
  }

  // 解析响应，获取权限请求 ID（用于后续查询状态）
  const { id: permissionRequestId } = await notifyRes.json();

  // 记录权限请求 ID
  console.error("[MCP] permission request ID received", {
    permissionRequestId,
    streamingId: STREAMING_ID,
  });

  // ==================== 第二步：轮询权限审批状态 ====================
  // 轮询配置
  const POLL = 1000;                    // 轮询间隔：1 秒
  const TIMEOUT = 10 * 60 * 1000;      // 超时时间：10 分钟
  const start = Date.now();             // 开始时间，用于计算超时
  let pollCount = 0;                    // 轮询次数计数器

  // 持续轮询直到获得审批结果或超时
  while (true) {
    // 检查是否超时
    if (Date.now() - start > TIMEOUT) {
      console.error("[MCP] permission request timeout", {
        permissionRequestId,
        streamingId: STREAMING_ID,
        elapsed: Date.now() - start,
      });
      // 超时后返回拒绝结果
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              behavior: "deny",
              message: "Permission timeout",
            }),
          },
        ],
      };
    }

    // 增加轮询计数
    pollCount++;
    // 每 10 次轮询记录一次日志（减少日志输出）
    if (pollCount % 10 === 0) {
      console.error("[MCP] polling permission status", {
        permissionRequestId,
        streamingId: STREAMING_ID,
        pollCount,
        elapsed: Date.now() - start,
      });
    }

    // 查询待处理的权限请求列表
    const pendingRes = await fetch(
      `${LIST_URL}?streamingId=${STREAMING_ID || ""}&status=pending`
    );
    if (!pendingRes.ok) throw new Error(`poll failed: ${pendingRes.status}`);
    const { permissions } = await pendingRes.json();
    // 查找当前权限请求是否仍在待处理列表中
    const hit = permissions.find((p) => p.id === permissionRequestId);

    // 如果当前请求不在待处理列表中，说明已经有了结果（批准或拒绝）
    if (!hit) {
      // 查询所有权限请求（包括已处理的），获取最终状态
      const allRes = await fetch(
        `${LIST_URL}?streamingId=${STREAMING_ID || ""}`
      );
      if (!allRes.ok) throw new Error(`poll-all failed: ${allRes.status}`);
      const { permissions: all } = await allRes.json();
      const done = all.find((p) => p.id === permissionRequestId);

      // 检查是否已批准
      if (done?.status === "approved") {
        console.error("[MCP] permission approved", {
          permissionRequestId,
          streamingId: STREAMING_ID,
        });
        // 返回批准结果，包含可能被修改后的输入参数
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                behavior: "allow",                              // 允许执行
                updatedInput: done.modifiedInput || input,      // 使用修改后的输入（如果有）或原始输入
              }),
            },
          ],
        };
      }

      // 检查是否已拒绝
      if (done?.status === "denied") {
        console.error("[MCP] permission denied", {
          permissionRequestId,
          streamingId: STREAMING_ID,
          reason: done.denyReason,
        });
        // 返回拒绝结果，包含拒绝原因
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                behavior: "deny",                                    // 拒绝执行
                message: done.denyReason || "Permission denied",     // 拒绝原因
              }),
            },
          ],
        };
      }
    }

    // 等待指定时间后继续下一次轮询
    await new Promise((r) => setTimeout(r, POLL));
  }
});

// ==================== 服务器启动函数 ====================
/**
 * 主函数：启动 MCP 服务器
 * 
 * 1. 初始化 stdio 传输层（通过标准输入输出与客户端通信）
 * 2. 连接服务器到传输层
 * 3. 开始监听客户端请求
 */
async function main() {
  // 记录服务器启动信息
  console.error("[MCP] server starting", {
    base: BASE,
    notifyUrl: NOTIFY_URL,
    listUrl: LIST_URL,
    streamingId: STREAMING_ID || "unknown",
  });

  // 创建 stdio 传输实例（通过标准输入输出与 MCP 客户端通信）
  const transport = new StdioServerTransport();
  // 连接服务器到传输层，开始接收请求
  await server.connect(transport);

  // 记录连接成功信息
  console.error("[MCP] server connected");
}

// 启动服务器，捕获并处理启动错误
main().catch((err) => {
  console.error("[MCP] server error", err);
  process.exit(1);
});
