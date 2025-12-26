const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const {
  StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
// Use low-level Server API for dynamic tool registration with JSON Schema
// McpServer requires Zod schemas, but we receive JSON Schema from upstream servers
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} = require("@modelcontextprotocol/sdk/types.js");
const configService = require("./configService");

class McpService {
  constructor() {
    this.upstreamClients = new Map(); // serverName -> Client 上游客户端映射
    this.serverTools = new Map(); // serverName -> [tools] 服务器工具映射
  }

  async initUpstreamServers() {
    const servers = configService.getAllServers();
    for (const [name, config] of Object.entries(servers)) {
      if (config?.enabled === false) {
        console.log(`跳过未启用的上游服务器 ${name}`);
        continue;
      }
      try {
        await this.connectToUpstream(name, config);
      } catch (error) {
        console.error(`连接到上游服务器 ${name} 失败:`, error);
      }
    }
  }

  async connectToUpstream(name, config) {
    if (config?.enabled === false) {
      console.log(`服务器 ${name} 已关闭（enabled=false），跳过连接`);
      return;
    }
    let transport;
    if (config.command) {
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: { ...process.env, ...config.env },
      });
    } else if (config.url) {
      transport = new StreamableHTTPClientTransport(config.url, {
        headers: config.headers,
      });
    } else {
      throw new Error(`服务器 ${name} 的配置无效`);
    }

    const client = new Client(
      {
        name: "demo-router-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await client.connect(transport);
    this.upstreamClients.set(name, client);

    // 列出工具
    const result = await client.listTools();
    this.serverTools.set(name, result.tools || []);
    console.log(`已连接到 ${name}，找到 ${result.tools?.length || 0} 个工具`);
  }

  async disconnectUpstream(name) {
    const client = this.upstreamClients.get(name);
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error(`关闭与 ${name} 的连接时出错:`, error);
      }
      this.upstreamClients.delete(name);
      this.serverTools.delete(name);
      console.log(`已断开与 ${name} 的连接`);
    }
  }

  async disconnectAllUpstreams() {
    const serverNames = Array.from(this.upstreamClients.keys());
    for (const name of serverNames) {
      await this.disconnectUpstream(name);
    }
  }

  async getMcpServer(sessionId, group) {
    // group 参数直接对应 mcpServers[name] 中的 name
    // 如果提供了 group，只返回该服务器的工具；否则返回所有服务器的工具

    // Use low-level Server API for dynamic tool registration with JSON Schema
    const server = new Server(
      {
        name: "demo-router-hub",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}, // 我们将注册工具
        },
      }
    );

    // 收集所有工具
    let allTools = [];
    let matchedServers = 0;

    for (const [serverName] of this.upstreamClients) {
      // 如果指定了 group，只处理名称匹配的服务器
      if (group && serverName !== group) {
        console.log(
          `[getMcpServer] 跳过服务器 ${serverName}，因为 group (${group}) 不匹配`
        );
        continue;
      }

      const tools = this.serverTools.get(serverName) || [];
      console.log(
        `[getMcpServer] 正在注册来自 ${serverName} 的 ${
          tools.length
        } 个工具（group: ${group || "all"}）`
      );

      if (tools.length > 0) {
        matchedServers++;
        // 直接使用工具名称，不需要前缀
        for (const tool of tools) {
          allTools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
      }
    }

    if (group && matchedServers === 0) {
      console.warn(
        `[getMcpServer] 警告：组 ${group} 没有匹配到任何服务器。可用服务器: ${Array.from(
          this.upstreamClients.keys()
        ).join(", ")}`
      );
    }

    // 1. 处理 ListTools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: allTools,
      };
    });

    // 2. 处理 CallTool
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.log(
        "[McpService] 调用工具请求:",
        JSON.stringify(request.params, null, 2)
      );
      const toolName = request.params.name;
      const args = request.params.arguments || {};

      // 如果指定了 group，使用 group 作为服务器名
      // 如果没有指定 group，需要查找工具所在的服务器
      let serverName = group;

      if (!serverName) {
        // 如果没有指定 group，需要查找工具所在的服务器
        // 遍历所有服务器，找到包含该工具的服务器
        serverName = null;
        for (const [name] of this.upstreamClients) {
          const tools = this.serverTools.get(name) || [];
          if (tools.some((t) => t.name === toolName)) {
            serverName = name;
            break;
          }
        }

        if (!serverName) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool ${toolName} not found`
          );
        }
      }

      const client = this.upstreamClients.get(serverName);
      if (!client) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Server ${serverName} not found`
        );
      }

      // 转发调用
      try {
        console.log(
          `[McpService] 正在将工具 ${toolName} 转发到 ${serverName}，参数:`,
          JSON.stringify(args, null, 2)
        );
        const result = await client.callTool({
          name: toolName,
          arguments: args,
        });
        return result;
      } catch (error) {
        console.error(`[McpService] 工具执行失败:`, error);
        // 如果是 McpError，直接抛出
        if (error.code !== undefined && error.message) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });

    console.log(
      `[getMcpServer] 已为组 ${
        group || "all"
      } 创建服务器，匹配 ${matchedServers} 个服务器，共 ${
        allTools.length
      } 个工具`
    );

    return server;
  }
}

module.exports = new McpService();
