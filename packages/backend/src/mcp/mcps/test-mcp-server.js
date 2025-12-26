#!/usr/bin/env node

/**
 * Test MCP Server
 * 一个简单的测试 MCP 服务器，提供基本的工具和资源
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

class TestMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'test-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'echo',
            description: '回显输入的文本',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: '要回显的消息',
                },
              },
              required: ['message'],
            },
          },
          {
            name: 'current_time',
            description: '获取当前时间',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  description: '时间格式 (iso, locale, timestamp)',
                  enum: ['iso', 'locale', 'timestamp'],
                  default: 'iso',
                },
              },
            },
          },
          {
            name: 'calculate',
            description: '执行简单的数学计算',
            inputSchema: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: '数学表达式 (例如: "2 + 3", "10 * 5")',
                },
              },
              required: ['expression'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'echo':
            return {
              content: [
                {
                  type: 'text',
                  text: `回显: ${args.message}`,
                },
              ],
            };

          case 'current_time':
            const now = new Date();
            let timeString;

            switch (args.format || 'iso') {
              case 'iso':
                timeString = now.toISOString();
                break;
              case 'locale':
                timeString = now.toLocaleString('zh-CN');
                break;
              case 'timestamp':
                timeString = now.getTime().toString();
                break;
              default:
                timeString = now.toISOString();
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `当前时间: ${timeString}`,
                },
              ],
            };

          case 'calculate':
            // 简单的数学表达式计算（仅支持基本运算）
            const expression = args.expression.replace(/[^0-9+\-*/().\s]/g, '');
            try {
              const result = Function(`"use strict"; return (${expression})`)();
              return {
                content: [
                  {
                    type: 'text',
                    text: `计算结果: ${expression} = ${result}`,
                  },
                ],
              };
            } catch (error) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `计算错误: 无法计算表达式 "${args.expression}"`,
                  },
                ],
                isError: true,
              };
            }

          default:
            throw new Error(`未知工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'test://info',
            mimeType: 'text/plain',
            name: '服务器信息',
            description: '测试 MCP 服务器的基本信息',
          },
          {
            uri: 'test://sample-data',
            mimeType: 'application/json',
            name: '示例数据',
            description: '一些示例 JSON 数据',
          },
        ],
      };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case 'test://info':
          return {
            contents: [
              {
                uri,
                mimeType: 'text/plain',
                text: `测试 MCP 服务器

这是一个用于测试的 MCP 服务器，提供以下功能：
- echo 工具：回显文本
- current_time 工具：获取当前时间
- calculate 工具：简单数学计算

服务器版本: 1.0.0
启动时间: ${new Date().toISOString()}`,
              },
            ],
          };

        case 'test://sample-data':
          return {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(
                  {
                    users: [
                      { id: 1, name: 'Alice', role: 'admin' },
                      { id: 2, name: 'Bob', role: 'user' },
                      { id: 3, name: 'Charlie', role: 'developer' },
                    ],
                    settings: {
                      theme: 'dark',
                      language: 'zh-CN',
                      notifications: true,
                    },
                    stats: {
                      totalUsers: 3,
                      activeUsers: 2,
                      lastUpdate: new Date().toISOString(),
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };

        default:
          throw new Error(`未知资源: ${uri}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Test MCP Server running on stdio');
  }
}

// 启动服务器
if (require.main === module) {
  const server = new TestMCPServer();
  server.run().catch(console.error);
}

module.exports = TestMCPServer;