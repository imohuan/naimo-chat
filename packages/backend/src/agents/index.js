const { mcpAgent } = require('./mcp.agent');
const mcpService = require('../mcp/mcpService');

/**
 * Agents 管理器
 * 负责管理所有注册的 agent 实例
 */
class AgentsManager {
  constructor() {
    this.agents = new Map(); // agent名称 -> agent实例
  }

  /**
   * 注册一个 agent
   * @param {IAgent} agent - 要注册的 agent 实例
   */
  registerAgent(agent) {
    if (!agent || !agent.name) {
      throw new Error('Agent 必须具有 name 属性');
    }
    this.agents.set(agent.name, agent);
    console.log(`[AgentsManager] 已注册 agent: ${agent.name}，包含 ${agent.tools?.size || 0} 个工具`);
  }

  /**
   * 根据名称查找 agent
   * @param {string} name - agent 名称
   * @returns {IAgent|undefined} 找到的 agent 实例，未找到返回 undefined
   */
  getAgent(name) {
    return this.agents.get(name);
  }

  /**
   * 获取所有已注册的 agents
   * @returns {Array<IAgent>} 所有 agent 实例的数组
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * 获取所有 agent 的工具
   * @returns {Array} 工具数组
   */
  getAllTools() {
    const allTools = [];
    for (const agent of this.agents.values()) {
      if (agent.tools && agent.tools instanceof Map) {
        allTools.push(...agent.tools.values());
      }
    }
    return allTools;
  }
}

// 创建单例实例
const agentsManager = new AgentsManager();

/**
 * 刷新 MCP Agent 工具
 * 从 mcpService 重新加载所有工具到 mcpAgent
 * @param {Object} logger - 日志记录器，默认为 console
 */
function refreshMcpAgentTools(logger = console) {
  try {
    // 尝试立即加载工具（如果 mcpService 已经初始化）
    // 如果没有初始化完成，工具会在首次使用时通过延迟加载机制加载
    if (mcpService.serverTools && mcpService.serverTools instanceof Map && mcpService.serverTools.size > 0) {
      const beforeSize = mcpAgent.tools.size;
      mcpAgent.appendTools();
      const afterSize = mcpAgent.tools.size;
      if (afterSize > beforeSize) {
        logger.info(`[AgentsManager] 已加载 ${afterSize} 个 MCP 工具（新增 ${afterSize - beforeSize} 个）`);
      } else if (afterSize > 0) {
        logger.info(`[AgentsManager] 已刷新 ${afterSize} 个 MCP 工具`);
      }
    } else {
      logger.info('[AgentsManager] MCP agent 已注册，等待 mcpService 初始化完成后加载工具');
      // 延迟尝试加载工具（给 mcpService 一些初始化时间）
      setTimeout(() => {
        if (mcpService.serverTools && mcpService.serverTools instanceof Map && mcpService.serverTools.size > 0) {
          const beforeSize = mcpAgent.tools.size;
          mcpAgent.appendTools();
          if (mcpAgent.tools.size > beforeSize) {
            logger.info(`[AgentsManager] 延迟加载完成，已加载 ${mcpAgent.tools.size} 个 MCP 工具`);
          }
        }
      }, 2000);
    }
  } catch (error) {
    logger.error("[AgentsManager] 刷新 MCP agent 工具失败:", error);
  }
}

module.exports = agentsManager;
module.exports.refreshMcpAgentTools = refreshMcpAgentTools;

