#!/usr/bin/env node
/**
 * Demo permissions MCP server (stdio)
 * Mirrors the original demo/mcp-server.js but packaged for router use.
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

class DemoPermissionsMCPServer {
  constructor() {
    this.BASE = process.env.APPROVAL_ENDPOINT_BASE || "http://127.0.0.1:8080";
    this.NOTIFY_URL = `${this.BASE}/api/permissions/notify`;
    this.LIST_URL = `${this.BASE}/api/permissions`;
    this.STREAMING_ID = process.env.MCP_STREAMING_ID;

    this.server = new Server(
      { name: "demo-permissions", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    this.registerHandlers();
  }

  registerHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
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
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
        streamingId: this.STREAMING_ID || "unknown",
        timestamp: new Date().toISOString(),
      });

      const notifyRes = await fetch(this.NOTIFY_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toolName: tool_name,
          toolInput: input,
          streamingId: this.STREAMING_ID || "unknown",
        }),
      });

      console.error("[MCP] notify response", {
        status: notifyRes.status,
        ok: notifyRes.ok,
        streamingId: this.STREAMING_ID,
      });
      if (!notifyRes.ok) {
        const t = await notifyRes.text();
        throw new Error(`notify failed: ${notifyRes.status} ${t}`);
      }
      const { id: permissionRequestId } = await notifyRes.json();

      console.error("[MCP] permission request ID received", {
        permissionRequestId,
        streamingId: this.STREAMING_ID,
      });

      const POLL = 1000;
      const TIMEOUT = 10 * 60 * 1000;
      const start = Date.now();
      let pollCount = 0;

      while (true) {
        if (Date.now() - start > TIMEOUT) {
          console.error("[MCP] permission request timeout", {
            permissionRequestId,
            streamingId: this.STREAMING_ID,
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
            streamingId: this.STREAMING_ID,
            pollCount,
            elapsed: Date.now() - start,
          });
        }

        const pendingRes = await fetch(
          `${this.LIST_URL}?streamingId=${
            this.STREAMING_ID || ""
          }&status=pending`
        );
        if (!pendingRes.ok)
          throw new Error(`poll failed: ${pendingRes.status}`);
        const { permissions } = await pendingRes.json();
        const hit = permissions.find((p) => p.id === permissionRequestId);

        if (!hit) {
          const allRes = await fetch(
            `${this.LIST_URL}?streamingId=${this.STREAMING_ID || ""}`
          );
          if (!allRes.ok) throw new Error(`poll-all failed: ${allRes.status}`);
          const { permissions: all } = await allRes.json();
          const done = all.find((p) => p.id === permissionRequestId);
          if (done?.status === "approved") {
            console.error("[MCP] permission approved", {
              permissionRequestId,
              streamingId: this.STREAMING_ID,
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
              streamingId: this.STREAMING_ID,
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
  }

  async run() {
    console.error("[MCP] server starting", {
      base: this.BASE,
      notifyUrl: this.NOTIFY_URL,
      listUrl: this.LIST_URL,
      streamingId: this.STREAMING_ID || "unknown",
    });

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("[MCP] server connected");
  }
}

if (require.main === module) {
  const server = new DemoPermissionsMCPServer();
  server.run().catch((err) => {
    console.error("[MCP] server error", err);
    // process.exit(1);
  });
}

module.exports = DemoPermissionsMCPServer;
