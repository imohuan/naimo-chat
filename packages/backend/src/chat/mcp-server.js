#!/usr/bin/env node
/**
 * Minimal MCP server exposing approval_prompt (CommonJS for node compat).
 * Proxies to demo backend permission endpoints.
 */
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} = require("@modelcontextprotocol/sdk/types.js");

const BASE = process.env.APPROVAL_ENDPOINT_BASE || "http://127.0.0.1:8080";
const NOTIFY_URL = `${BASE}/api/permissions/notify`;
const LIST_URL = `${BASE}/api/permissions`;
const STREAMING_ID = process.env.MCP_STREAMING_ID || process.env.CUI_STREAMING_ID;

console.error("[MCP] Starting demo-permissions MCP server", {
  base: BASE,
  notifyUrl: NOTIFY_URL,
  listUrl: LIST_URL,
  streamingId: STREAMING_ID || "unknown",
  timestamp: new Date().toISOString(),
});

const server = new Server(
  { name: "demo-permissions", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[MCP] ListTools called");
  return {
    tools: [
      {
        name: "approval_prompt",
        description: "Request approval for tool usage from demo server",
        inputSchema: {
          type: "object",
          properties: {
            tool_name: { type: "string" },
            input: { type: "object" },
          },
          required: ["tool_name", "input"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "approval_prompt") {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${request.params.name}`
    );
  }

  const { tool_name, input } = request.params.arguments;

  console.error("[MCP] approval_prompt called", {
    tool_name,
    input,
    streamingId: STREAMING_ID || "unknown",
    timestamp: new Date().toISOString(),
  });

  const notifyRes = await fetch(NOTIFY_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      toolName: tool_name,
      toolInput: input,
      streamingId: STREAMING_ID || "unknown",
    }),
  });

  console.error("[MCP] notify response", {
    status: notifyRes.status,
    ok: notifyRes.ok,
    streamingId: STREAMING_ID,
  });
  if (!notifyRes.ok) {
    const t = await notifyRes.text();
    throw new Error(`notify failed: ${notifyRes.status} ${t}`);
  }
  const { id: permissionRequestId } = await notifyRes.json();

  console.error("[MCP] permission request ID received", {
    permissionRequestId,
    streamingId: STREAMING_ID,
  });

  const POLL = 1000;
  const TIMEOUT = 10 * 60 * 1000;
  const start = Date.now();
  let pollCount = 0;

  while (true) {
    if (Date.now() - start > TIMEOUT) {
      console.error("[MCP] permission request timeout", {
        permissionRequestId,
        streamingId: STREAMING_ID,
        elapsed: Date.now() - start,
      });
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

    pollCount++;
    if (pollCount % 10 === 0) {
      console.error("[MCP] polling permission status", {
        permissionRequestId,
        streamingId: STREAMING_ID,
        pollCount,
        elapsed: Date.now() - start,
      });
    }

    const pendingRes = await fetch(
      `${LIST_URL}?streamingId=${STREAMING_ID || ""}&status=pending`
    );
    if (!pendingRes.ok) throw new Error(`poll failed: ${pendingRes.status}`);
    const { permissions } = await pendingRes.json();
    const hit = permissions.find((p) => p.id === permissionRequestId);

    if (!hit) {
      const allRes = await fetch(
        `${LIST_URL}?streamingId=${STREAMING_ID || ""}`
      );
      if (!allRes.ok) throw new Error(`poll-all failed: ${allRes.status}`);
      const { permissions: all } = await allRes.json();
      const done = all.find((p) => p.id === permissionRequestId);
      if (done?.status === "approved") {
        console.error("[MCP] permission approved", {
          permissionRequestId,
          streamingId: STREAMING_ID,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                behavior: "allow",
                updatedInput: done.modifiedInput || input,
              }),
            },
          ],
        };
      }
      if (done?.status === "denied") {
        console.error("[MCP] permission denied", {
          permissionRequestId,
          streamingId: STREAMING_ID,
          reason: done.denyReason,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                behavior: "deny",
                message: done.denyReason || "Permission denied",
              }),
            },
          ],
        };
      }
    }

    await new Promise((r) => setTimeout(r, POLL));
  }
});

async function main() {
  console.error("[MCP] server starting", {
    base: BASE,
    notifyUrl: NOTIFY_URL,
    listUrl: LIST_URL,
    streamingId: STREAMING_ID || "unknown",
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[MCP] server connected and ready");
}

main().catch((err) => {
  console.error("[MCP] server error", err);
  process.exit(1);
});
