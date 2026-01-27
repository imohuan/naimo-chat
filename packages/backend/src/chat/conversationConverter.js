const fs = require('fs');
const path = require('path');

/**
 * 将 JSONL 格式的对话转换为前端展示格式
 */
class ConversationConverter {
  constructor() {
    this.messageCounter = 0;
  }

  /**
   * 读取并转换 JSONL 文件
   * @param {string} jsonlPath - JSONL 文件路径
   * @returns {Array} 转换后的对话数组
   */
  convertFromFile(jsonlPath) {
    const content = fs.readFileSync(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n');
    const jsonlData = lines.map(line => JSON.parse(line));

    // 获取子代理目录 - 从 sessionId 提取目录
    const sessionId = path.basename(jsonlPath, '.jsonl');
    const projectDir = path.dirname(jsonlPath);
    const subagentsDir = path.join(projectDir, sessionId, 'subagents');

    return this.convert(jsonlData, subagentsDir);
  }

  /**
   * 转换 JSONL 数据为前端格式
   * @param {Array} jsonlData - JSONL 数据数组
   * @param {string} subagentsDir - 子代理目录路径
   * @returns {Array} 转换后的对话数组
   */
  convert(jsonlData, subagentsDir = null) {
    this.messageCounter = 0;
    const messages = [];
    const toolCallMap = new Map(); // 存储工具调用信息 uuid -> message
    const uuidToMessageMap = new Map(); // 存储 uuid 到消息的映射
    const agentIdMap = new Map(); // 存储 agentId 到工具消息的映射

    // 第一遍：构建 uuid 映射和工具调用映射
    for (const entry of jsonlData) {
      if (entry.uuid) {
        uuidToMessageMap.set(entry.uuid, entry);
      }
    }

    // 第二遍：转换消息
    for (const entry of jsonlData) {
      // 跳过系统消息、进度消息和快照
      if (entry.type === 'system' || entry.type === 'file-history-snapshot') {
        continue;
      }

      // 处理进度消息 - 提取 agentId
      if (entry.type === 'progress' && entry.data?.type === 'agent_progress') {
        const agentId = entry.data.agentId;
        const parentToolUseID = entry.parentToolUseID;
        if (agentId && parentToolUseID) {
          agentIdMap.set(parentToolUseID, agentId);
        }
        continue;
      }

      const timestamp = this.formatTime(entry.timestamp);

      if (entry.type === 'user') {
        const userMsg = this.convertUserMessage(entry, timestamp, uuidToMessageMap, toolCallMap);
        if (userMsg) messages.push(userMsg);
      } else if (entry.type === 'assistant') {
        const assistantMsgs = this.convertAssistantMessage(entry, timestamp, toolCallMap, subagentsDir);
        messages.push(...assistantMsgs);
      }
    }

    // 第三遍：填充子代理内容
    if (subagentsDir) {
      for (const [toolUseId, agentId] of agentIdMap.entries()) {
        const toolMsg = toolCallMap.get(toolUseId);
        if (toolMsg && toolMsg.kind === 'subagent') {
          toolMsg.agentId = agentId;
          toolMsg.subagentMessages = this.loadSubagentMessages(agentId, subagentsDir);
        }
      }
    }

    return messages;
  }

  /**
   * 转换用户消息
   */
  convertUserMessage(entry, timestamp, uuidToMessageMap, toolCallMap) {
    const content = entry.message?.content;
    if (!content) return null;

    // 处理工具结果 - 合并到对应的工具调用中
    if (Array.isArray(content) && content.some(item => item.type === 'tool_result')) {
      this.mergeToolResults(entry, content, uuidToMessageMap, toolCallMap);
      return null; // 工具结果不单独显示
    }

    // 处理字符串内容
    if (typeof content === 'string') {
      // 跳过工具结果消息
      if (content.includes('tool_use_id') || content.includes('tool_result')) {
        return null;
      }
      return {
        id: this.generateId(),
        role: 'user',
        kind: 'text',
        rawText: content,
        time: timestamp
      };
    }

    // 处理数组内容
    if (Array.isArray(content)) {
      const textContent = content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      if (textContent) {
        return {
          id: this.generateId(),
          role: 'user',
          kind: 'text',
          rawText: textContent,
          time: timestamp
        };
      }
    }

    return null;
  }

  /**
   * 合并工具结果到工具调用
   */
  mergeToolResults(entry, content, uuidToMessageMap, toolCallMap) {
    for (const item of content) {
      if (item.type === 'tool_result' && item.tool_use_id) {
        const toolMsg = toolCallMap.get(item.tool_use_id);
        if (toolMsg) {
          toolMsg.result = item.content || '';
          toolMsg.isError = item.is_error || false;

          // 如果是子代理结果，标记 agentId
          if (item.agentId) {
            toolMsg.agentId = item.agentId;
          }
        }
      }
    }
  }

  /**
   * 转换助手消息
   */
  convertAssistantMessage(entry, timestamp, toolCallMap, subagentsDir) {
    const messages = [];
    const content = entry.message?.content;
    if (!content || !Array.isArray(content)) return messages;

    for (const item of content) {
      if (item.type === 'text' && item.text) {
        messages.push({
          id: this.generateId(),
          role: 'assistant',
          kind: 'text',
          rawText: item.text,
          time: timestamp
        });
      } else if (item.type === 'tool_use') {
        const toolMsg = this.convertToolUse(item, timestamp, subagentsDir);
        if (toolMsg) {
          toolCallMap.set(item.id, toolMsg);
          messages.push(toolMsg);
        }
      }
    }

    return messages;
  }

  /**
   * 转换工具调用
   */
  convertToolUse(toolUse, timestamp, subagentsDir) {
    const toolName = toolUse.name;
    const input = toolUse.input || {};

    // 处理不同类型的工具
    if (toolName === 'Bash') {
      return {
        id: this.generateId(),
        role: 'assistant',
        kind: 'tool',
        name: 'Bash',
        input: {
          command: input.command || input.description || ''
        },
        result: '', // 结果需要后续填充
        tool_use_id: toolUse.id,
        isError: false,
        time: timestamp
      };
    } else if (toolName === 'Write' || toolName === 'Create') {
      const content = input.content || input.text || '';
      return {
        id: this.generateId(),
        role: 'assistant',
        kind: 'tool',
        name: 'Write',
        input: {
          path: input.file_path || input.path || '',
          content: content
        },
        result: '',
        tool_use_id: toolUse.id,
        isError: false,
        // 只在有内容时生成 diffLines
        diffLines: content ? this.generateDiffLines(content) : [],
        time: timestamp
      };
    } else if (toolName === 'Read') {
      return {
        id: this.generateId(),
        role: 'assistant',
        kind: 'tool',
        name: 'Read',
        input: {
          path: input.file_path || input.path || ''
        },
        result: '',
        tool_use_id: toolUse.id,
        isError: false,
        time: timestamp
      };
    } else if (toolName === 'Task') {
      // Task 工具 - 子代理调用
      const subagentMsg = {
        id: this.generateId(),
        role: 'assistant',
        kind: 'subagent',
        name: 'Task',
        input: {
          description: input.description || '',
          prompt: input.prompt || '',
          subagent_type: input.subagent_type || ''
        },
        result: '',
        tool_use_id: toolUse.id,
        isError: false,
        time: timestamp,
        subagentMessages: [] // 子代理的消息列表
      };

      // 尝试加载子代理内容（稍后通过 agentId 填充）
      return subagentMsg;
    } else if (toolName === 'TodoWrite') {
      return {
        id: this.generateId(),
        role: 'assistant',
        kind: 'todo_list',
        name: 'TodoWrite',
        input: input,
        todos: input.todos || [],
        tool_use_id: toolUse.id,
        time: timestamp
      };
    }

    // 通用工具处理
    return {
      id: this.generateId(),
      role: 'assistant',
      kind: 'tool',
      name: toolName,
      input: input,
      result: '',
      tool_use_id: toolUse.id,
      isError: false,
      time: timestamp
    };
  }

  /**
   * 加载子代理内容
   */
  loadSubagentMessages(agentId, subagentsDir) {
    if (!subagentsDir || !agentId) return [];

    const subagentFile = path.join(subagentsDir, `agent-${agentId}.jsonl`);

    if (!fs.existsSync(subagentFile)) {
      console.warn(`Subagent file not found: ${subagentFile}`);
      return [];
    }

    try {
      const content = fs.readFileSync(subagentFile, 'utf-8');
      const lines = content.trim().split('\n');
      const subagentData = lines.map(line => JSON.parse(line));

      // 递归转换子代理消息（不传递 subagentsDir 避免嵌套子代理）
      return this.convert(subagentData, null);
    } catch (error) {
      console.error(`Error loading subagent ${agentId}:`, error);
      return [];
    }
  }

  /**
   * 生成 diff 行
   */
  generateDiffLines(content) {
    if (!content) return [];
    const lines = content.split('\n');
    return lines.map(line => ({
      type: 'add',
      content: `+ ${line}`
    }));
  }

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '00:00';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * 生成消息 ID
   */
  generateId() {
    this.messageCounter++;
    return `msg-${String(this.messageCounter).padStart(3, '0')}`;
  }

  /**
   * 获取项目列表
   * @param {string} projectsDir - 项目目录路径
   * @returns {Promise<Array>} 项目列表
   */
  static async getProjectList(projectsDir) {
    if (!fs.existsSync(projectsDir)) {
      return [];
    }

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });

    // 使用 Promise.all 并发处理所有项目
    const projectPromises = entries
      .filter(entry => entry.isDirectory())
      .map(async (entry) => {
        const projectPath = path.join(projectsDir, entry.name);
        const sessions = await this.getProjectSessions(projectPath);

        // 过滤掉无效的 sessions
        const validSessions = this.validateProjectSessions(sessions, projectPath);

        if (validSessions.length > 0) {
          return {
            id: entry.name,
            name: entry.name,
            path: projectPath,
            sessions: validSessions
          };
        }
        return null;
      });

    const results = await Promise.all(projectPromises);

    // 过滤掉 null 值（没有有效 sessions 的项目）
    return results.filter(project => project !== null);
  }

  /**
   * 获取项目的会话列表
   * @param {string} projectPath - 项目路径
   * @returns {Promise<Array>} 会话列表
   */
  static async getProjectSessions(projectPath) {
    if (!fs.existsSync(projectPath)) {
      return [];
    }

    const entries = fs.readdirSync(projectPath, { withFileTypes: true });

    // 使用 Promise.all 并发处理所有 session 文件
    const sessionPromises = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map(async (entry) => {
        const sessionId = entry.name.replace('.jsonl', '');
        const filePath = path.join(projectPath, entry.name);
        const stats = fs.statSync(filePath);

        return {
          id: sessionId,
          name: sessionId,
          file: entry.name,
          path: filePath,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        };
      });

    const sessions = await Promise.all(sessionPromises);

    // 按修改时间倒序排序
    sessions.sort((a, b) => b.modifiedAt - a.modifiedAt);

    return sessions;
  }

  /**
   * 验证项目的 sessions，返回有效的主 session
   * @param {Array} sessions - session 数组
   * @param {string} projectPath - 项目路径
   * @returns {Array} 验证后的有效 session 数组
   */
  static validateProjectSessions(sessions, projectPath) {
    if (!sessions || sessions.length === 0) {
      return [];
    }

    // 如果只有一个 session 文件，直接返回
    if (sessions.length === 1) {
      return sessions;
    }

    // 多个 session 文件的情况，检查 sessions-index.json
    const indexPath = path.join(projectPath, 'sessions-index.json');

    if (!fs.existsSync(indexPath)) {
      // 没有 index 文件，过滤掉所有
      console.warn(`Multiple sessions found but no sessions-index.json in ${projectPath}`);
      return [];
    }

    try {
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      const indexData = JSON.parse(indexContent);

      // 检查是否有 entries
      if (!indexData.entries || !Array.isArray(indexData.entries) || indexData.entries.length === 0) {
        // 有多个文件但 entries 为空，过滤掉
        // console.warn(`sessions-index.json exists but has no entries in ${projectPath}`);
        return [];
      }

      // 对所有 entries 进行判断，查找匹配的 sessions
      const matchedSessions = [];

      for (const entry of indexData.entries) {
        const expectedSessionId = entry.sessionId;
        const expectedFullPath = entry.fullPath;

        if (!expectedSessionId || !expectedFullPath) {
          console.warn(`Invalid entry in sessions-index.json: missing sessionId or fullPath`);
          continue;
        }

        // 查找匹配的 session
        const matchedSession = sessions.find(session => {
          // 验证 sessionId 匹配
          const sessionIdMatch = session.id === expectedSessionId;

          // 验证 fullPath 匹配（规范化路径进行比较）
          const normalizedSessionPath = path.normalize(session.path);
          const normalizedExpectedPath = path.normalize(expectedFullPath);
          const fullPathMatch = normalizedSessionPath === normalizedExpectedPath;

          return sessionIdMatch && fullPathMatch;
        });

        if (matchedSession) {
          matchedSessions.push(matchedSession);
        }
      }

      // 返回所有找到的 sessions
      return matchedSessions;

    } catch (error) {
      console.error(`Error reading sessions-index.json in ${projectPath}:`, error.message);
      return [];
    }
  }
}

module.exports = ConversationConverter;
