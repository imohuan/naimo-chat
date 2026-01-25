const { IAgent, ITool } = require('./type');
const mcpService = require('../mcp/mcpService');
const mcpLogger = require('../mcp/mcpLogger');

/**
 * MCP Agent
 * 提供 mcpService 服务开启的所有工具
 */
class McpAgent extends IAgent {
  constructor() {
    super();
    this.name = 'mcp';
    this.tools = new Map();
    // 不在构造函数中立即加载工具，因为 mcpService 可能还未初始化
    // 工具将在首次需要时或显式调用 appendTools() 时加载

    // 去抖定时器
    this.debounceTimer = null;
    // 执行锁，防止 appendTools 执行期间重复触发
    this.isAppendingTools = false;

    // 监听 mcpService.serverTools 的变化
    this.setupServerToolsWatcher();
  }

  /**
   * 设置 serverTools 的监听器（类似前端的 watch）
   * 使用 Proxy 监听 Map 的变化（set, delete, clear 等操作）
   */
  setupServerToolsWatcher() {
    if (!mcpService.serverTools || !(mcpService.serverTools instanceof Map)) {
      console.warn('[McpAgent] mcpService.serverTools 未初始化，稍后重试');
      // 如果 serverTools 还未初始化，延迟设置监听器
      setTimeout(() => this.setupServerToolsWatcher(), 100);
      return;
    }

    // 保存原始的 Map 实例和 this 引用
    const originalMap = mcpService.serverTools;
    const agentInstance = this;

    // 创建 Proxy 来拦截 Map 的操作
    const proxyMap = new Proxy(originalMap, {
      get: (target, prop) => {
        const value = target[prop];

        // 拦截 Map 的修改方法
        if (prop === 'set') {
          return function (key, val) {
            const hadKey = target.has(key);
            const result = Map.prototype.set.call(target, key, val);

            // 触发变化回调
            if (hadKey) {
              console.log(`[McpAgent] serverTools 更新: ${key} 的工具列表已更新`);
            } else {
              console.log(`[McpAgent] serverTools 新增: ${key} 的工具列表已添加`);
            }

            // 自动重新加载工具（使用去抖）
            agentInstance.debouncedAppendTools();

            return result;
          };
        }

        if (prop === 'delete') {
          return function (key) {
            const hadKey = target.has(key);
            const result = Map.prototype.delete.call(target, key);

            if (hadKey) {
              console.log(`[McpAgent] serverTools 删除: ${key} 的工具列表已移除`);
              // 自动重新加载工具（使用去抖）
              agentInstance.debouncedAppendTools();
            }

            return result;
          };
        }

        if (prop === 'clear') {
          return function () {
            const hadItems = target.size > 0;
            const result = Map.prototype.clear.call(target);

            if (hadItems) {
              console.log('[McpAgent] serverTools 清空: 所有工具列表已清空');
              // 自动重新加载工具（使用去抖）
              agentInstance.debouncedAppendTools();
            }

            return result;
          };
        }

        // 对于其他属性和方法，直接返回
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }
    });

    // 替换 mcpService.serverTools 为代理对象
    mcpService.serverTools = proxyMap;

    // console.log('[McpAgent] serverTools 监听器已设置');
  }

  /**
   * 去抖版本的 appendTools，延迟 500ms 执行
   * 避免短时间内多次调用导致性能问题
   */
  debouncedAppendTools() {
    // 如果正在执行 appendTools，跳过本次调用
    // 因为 appendTools 会清空并重新加载所有工具，重复执行会导致冲突
    if (this.isAppendingTools) {
      console.log('[McpAgent] appendTools 正在执行中，跳过本次调用');
      return;
    }

    // 清除之前的定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的定时器
    this.debounceTimer = setTimeout(() => {
      this.appendTools();
      this.debounceTimer = null;
    }, 500);
  }

  /**
   * 从 mcpService 获取所有工具并注册
   */
  appendTools() {
    // 如果正在执行，直接返回，避免重复执行导致冲突
    if (this.isAppendingTools) {
      console.warn('[McpAgent] appendTools 正在执行中，跳过重复调用');
      return;
    }

    // 设置执行锁
    this.isAppendingTools = true;

    try {
      // 清空现有工具（如果需要重新加载）
      this.tools.clear();

      // 从 mcpService 获取所有服务器的工具
      // serverTools 是一个 Map<serverName, tools[]>
      if (!mcpService.serverTools || !(mcpService.serverTools instanceof Map)) {
        console.warn('[McpAgent] mcpService.serverTools 未初始化或格式不正确');
        return; // finally 块会释放锁
      }

      for (const [serverName, tools] of mcpService.serverTools.entries()) {
        if (!Array.isArray(tools) || tools.length === 0) {
          continue;
        }

        // 为每个工具创建 ITool 实例
        for (const tool of tools) {
          // 使用 mcp__${serverName}__${tool.name} 格式作为工具名称（与前端保持一致）
          const registeredToolName = `mcp__${serverName}__${tool.name}`;

          // 检查是否已存在同名工具（避免重复注册）
          if (this.tools.has(registeredToolName)) {
            console.warn(
              `[McpAgent] 工具 ${registeredToolName} 已存在，跳过注册`
            );
            continue;
          }

          // 创建工具实例（保存 serverName 和原始 toolName 以便后续调用）
          const toolServerName = serverName;
          const originalToolName = tool.name;
          const toolInstance = new ITool(
            registeredToolName, // 使用格式化的工具名称
            tool.description || '',
            tool.inputSchema || {},
            // 工具处理器：调用 mcpService 的对应工具
            async (args, _context) => {
              return await this.handleToolCall(registeredToolName, args, toolServerName, originalToolName);
            }
          );

          this.tools.set(registeredToolName, toolInstance);
        }
      }

      console.log(
        `[McpAgent] 已加载 ${this.tools.size} 个 MCP 工具（来自 ${mcpService.serverTools.size} 个服务器）`
      );
    } finally {
      // 释放执行锁
      this.isAppendingTools = false;
    }
  }

  /**
   * 解析工具名称，提取服务器名称和原始工具名称
   * @param {string} toolName - 工具名称（可能是 mcp__${serverName}__${toolName} 格式）
   * @returns {{serverName: string, originalToolName: string} | null} 解析结果
   */
  parseToolName(toolName) {
    // 检查是否是 mcp__${serverName}__${toolName} 格式
    const match = toolName.match(/^mcp__(.+?)__(.+)$/);
    if (match) {
      return {
        serverName: match[1],
        originalToolName: match[2],
      };
    }
    return null;
  }

  /**
   * 处理工具调用
   * @param {string} toolName - 工具名称（可能是 mcp__${serverName}__${toolName} 格式）
   * @param {Object} args - 工具参数
   * @param {string} serverName - 服务器名称（可选，如果不提供则自动查找或解析）
   * @param {string} originalToolName - 原始工具名称（可选，如果不提供则自动解析）
   * @returns {Promise<string>} 工具执行结果
   */
  async handleToolCall(toolName, args, serverName = null, originalToolName = null) {
    try {
      // 如果工具不存在，尝试重新加载（延迟加载机制）
      if (!this.tools.has(toolName)) {
        const beforeSize = this.tools.size;
        this.appendTools();
        if (this.tools.size > beforeSize) {
          console.log(`[McpAgent] 延迟加载完成，新增 ${this.tools.size - beforeSize} 个工具`);
        }
      }

      // 解析工具名称（如果提供了 serverName 和 originalToolName，则使用它们；否则尝试解析）
      let parsed = null;
      if (!serverName || !originalToolName) {
        parsed = this.parseToolName(toolName);
      }

      if (parsed) {
        // 如果解析成功，使用解析出的值
        serverName = serverName || parsed.serverName;
        originalToolName = originalToolName || parsed.originalToolName;
      } else if (!serverName || !originalToolName) {
        // 如果解析失败且没有提供 serverName 或 originalToolName，尝试查找
        if (!serverName) {
          if (mcpService.serverTools && mcpService.serverTools instanceof Map) {
            for (const [name, tools] of mcpService.serverTools.entries()) {
              if (Array.isArray(tools) && tools.some((t) => t.name === toolName)) {
                serverName = name;
                break;
              }
            }
          }
        }
        // 如果没有找到 serverName，使用 toolName 作为 originalToolName
        if (!originalToolName) {
          originalToolName = toolName;
        }
      }

      if (!serverName) {
        throw new Error(`未找到工具 ${toolName} 所在的服务器`);
      }

      if (!originalToolName) {
        throw new Error(`无法确定工具 ${toolName} 的原始名称`);
      }

      const client = mcpService.upstreamClients.get(serverName);
      if (!client) {
        throw new Error(`服务器 ${serverName} 未连接`);
      }

      console.log(
        `[McpAgent] 调用工具 ${originalToolName}（注册名: ${toolName}），服务器: ${serverName}，参数:`,
        JSON.stringify(args, null, 2)
      );

      // 记录开始时间
      const startTime = Date.now();

      // 调用上游服务器的工具（使用原始工具名称）
      const result = await client.callTool({
        name: originalToolName,
        arguments: args,
      });

      // 记录成功的工具调用
      mcpLogger.logToolCall({
        toolName: originalToolName,
        serverName,
        arguments: args,
        result,
        duration: Date.now() - startTime,
        sessionId: null
      });

      // 处理结果
      if (result.content) {
        // 如果结果是数组，提取文本内容
        if (Array.isArray(result.content)) {
          return result.content
            .map((item) => {
              if (typeof item === 'string') {
                return item;
              }
              if (item.text) {
                return item.text;
              }
              if (item.type === 'text' && item.text) {
                return item.text;
              }
              return JSON.stringify(item);
            })
            .join('\n');
        }
        // 如果是字符串，直接返回
        if (typeof result.content === 'string') {
          return result.content;
        }
      }

      // 如果没有 content，返回整个结果对象（转为 JSON）
      return JSON.stringify(result, null, 2);
    } catch (error) {
      console.error(`[McpAgent] 工具调用失败: ${toolName}`, error);

      // 记录失败的工具调用
      mcpLogger.logToolCall({
        toolName: originalToolName || toolName,
        serverName: serverName || 'unknown',
        arguments: args,
        error: error,
        duration: Date.now() - (startTime || Date.now()),
        sessionId: null
      });

      return `错误: ${error.message || error.toString()}`;
    }
  }

  /**
   * 判断是否应该处理该请求
   * MCP agent 默认总是可用（不强制检查）
   * @param {Object} _req - 请求对象
   * @param {Object} _config - 配置对象
   * @returns {boolean} 是否应该处理
   */
  shouldHandle(_req, _config) {
    // MCP agent 总是可用，不需要特殊判断
    return true;
  }

  /**
   * 请求处理器（在处理请求前调用）
   * 可以在这里刷新工具列表（如果需要）
   * @param {Object} _req - 请求对象
   * @param {Object} _config - 配置对象
   */
  reqHandler(_req, _config) {
    // 可以在这里刷新工具列表，但为了避免频繁刷新，暂时不实现
    // 如果需要动态刷新，可以调用 this.appendTools()
  }
}

// 创建并导出 agent 实例
const mcpAgent = new McpAgent();

module.exports = {
  McpAgent,
  mcpAgent,
};

