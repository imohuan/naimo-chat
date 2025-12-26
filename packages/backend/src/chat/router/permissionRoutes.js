const { permissionService } = require("./permissionService");
const path = require("path");
const { buildMcpConfig } = require("./mcpConfigUtils");
const { MCP_SERVER_DIR } = require("../../config/constants");

function registerPermissionRoutes(server) {
  const app = server.app;

  // 1. 权限请求通知 - 注册待审批请求
  app.post("/api/chat/permissions/notify", async (req, reply) => {
    const { toolName, toolInput, streamingId } = req.body || {};

    if (!toolName) {
      return reply.code(400).send({ error: "toolName is required" });
    }

    const request = permissionService.add(toolName, toolInput, streamingId);

    console.log("[permission] notify received", {
      permissionId: request.id,
      toolName,
      streamingId,
    });

    // 如果有会话，这里可以尝试向 session 发送 SSE 事件，
    // 但 sessionService 解耦了，可以通过事件总线或直接引用来发送。
    // 在 server.js 中是直接调用的 sendEvent。
    // 为简化，这里暂不触发 SSE (SSE 在 chatRoutes/registerPermissionsFromMessage 中触发)
    // 或者如果这是外部触发的 notify，则需要引入 sessionService

    return { success: true, id: request.id };
  });

  // 2. 获取权限列表
  app.get("/api/chat/permissions", async (req, reply) => {
    const { streamingId, status } = req.query || {};
    const permissions = permissionService.list({ streamingId, status });
    return { permissions };
  });

  // 3. 权限决策
  app.post("/api/chat/permissions/:id/decision", async (req, reply) => {
    const { id } = req.params;
    const { action, modifiedInput, denyReason } = req.body || {};

    if (!action || !["approve", "deny"].includes(action)) {
      return reply.code(400).send({ error: "action must be approve or deny" });
    }

    const existing = permissionService.get(id);
    if (!existing) {
      return reply.code(404).send({ error: "permission not found" });
    }

    const updated = permissionService.decide(id, action, {
      modifiedInput,
      denyReason,
    });

    if (!updated) {
      return reply.code(400).send({ error: "permission not pending or invalid" });
    }

    console.log("[permission] decided", {
      id,
      action,
      status: updated.status,
    });

    // 可以在这里触发 SSE 通知前端决策结果 (可选)

    return { success: true, status: updated.status, id: updated.id };
  });

  // 4. MCP approval_prompt (被 Claude CLI 调用)
  app.post("/api/chat/mcp/approval_prompt", async (req, reply) => {
    const { tool_name, input, streamingId } = req.body || {};

    if (!tool_name) {
      return reply.code(400).send({ error: "tool_name is required" });
    }

    // 1. 注册请求
    const request = permissionService.add(tool_name, input || {}, streamingId);

    // 2. 轮询等待决策
    const TIMEOUT = 10 * 60 * 1000; // 10分钟超时
    const POLL_INTERVAL = 1000;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const timer = setInterval(() => {
        // 超时检查
        if (Date.now() - startTime > TIMEOUT) {
          clearInterval(timer);
          resolve(reply.code(200).send({
            behavior: "deny",
            message: "Permission request timed out",
          }));
          return;
        }

        const current = permissionService.get(request.id);
        if (!current) return;

        if (current.status === "approved") {
          clearInterval(timer);
          resolve(reply.code(200).send({
            behavior: "allow",
            updatedInput: current.modifiedInput || input,
          }));
        } else if (current.status === "denied") {
          clearInterval(timer);
          resolve(reply.code(200).send({
            behavior: "deny",
            message: current.denyReason || "Permission denied",
          }));
        }
      }, POLL_INTERVAL);
    });
  });

  // 5. MCP Config (供 Claude CLI 或其他工具获取当前服务的 MCP 配置)
  app.get("/api/chat/mcp/config", async (req, reply) => {
    const host = req.headers.host; // e.g. localhost:8080
    const baseUrl = `http://${host}`;
    const mcpServerPath = path.resolve(MCP_SERVER_DIR, "mcp-server.js");
    return buildMcpConfig({ baseUrl, mcpServerPath, });
  });
}

module.exports = { registerPermissionRoutes };
