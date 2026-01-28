import { ref } from 'vue';
import { marked } from 'marked';
import type { ChatMessage } from '@/types';

/**
 * 流事件处理 Hook
 * 
 * 处理 SSE（Server-Sent Events）流式响应，支持多种事件类型
 * 
 * @param addChatItem - 添加聊天项的回调函数
 * @param chatItems - 聊天项列表的响应式引用
 * @returns 流处理控制对象
 * 
 * @example
 * ```ts
 * const { startStream, stopStream } = useStreamHandler(addChatItem, chatItems)
 * 
 * // 启动流
 * startStream(streamingId, streamUrl, (sessionId) => {
 *   console.log('Session ID:', sessionId)
 * })
 * 
 * // 停止流
 * stopStream()
 * ```
 */
export function useStreamHandler(
  addChatItem: (item: Partial<ChatMessage>) => void,
  chatItems: { value: ChatMessage[] }
) {
  const eventSource = ref<EventSource | null>(null);

  /**
   * 启动 SSE 流连接
   * 
   * @param id - 流 ID（用于日志）
   * @param url - SSE 流 URL
   * @param onSessionId - Session ID 回调函数
   */
  const startStream = (id: string, url: string, onSessionId?: (sessionId: string) => void) => {
    if (eventSource.value) eventSource.value.close();

    eventSource.value = new EventSource(url);

    eventSource.value.onopen = () => {
      console.log('SSE Connected:', url);
    };

    eventSource.value.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log("Stream Event:", data);
        handleStreamEvent(data, onSessionId);
      } catch (err) {
        console.error("Parse Error:", err, "Raw data:", e.data);
      }
    };

    eventSource.value.onerror = (e) => {
      console.error("SSE Error:", e);
      stopStream();
    };
  };

  /**
   * 停止 SSE 流连接
   */
  const stopStream = () => {
    if (eventSource.value) {
      console.log('[StreamHandler] Closing SSE connection');
      eventSource.value.close();
      eventSource.value = null;
    }
  };

  /**
   * 处理流事件
   * 
   * 支持的事件类型：
   * - message: 主要消息格式（包含 content 数组）
   * - content: 基础内容类型
   * - content_block_delta: 流式文本增量
   * - assistant: 嵌套的助手消息
   * - user: 用户消息（包含 tool_result）
   * - tool_use: 工具调用
   * - tool_result: 工具结果
   * - permission_request: 权限请求
   * - permission_decision: 权限决策
   * - subagent_message: 子代理消息
   * - error: 错误事件
   * - process_end: 流程结束
   * - aborted: 会话中断
   * 
   * @param data - 事件数据
   * @param onSessionId - Session ID 回调函数
   */
  const handleStreamEvent = (data: any, onSessionId?: (sessionId: string) => void) => {
    console.log('[StreamHandler] Event:', data.type, data);

    // 0. 检查并设置 sessionId（如果存在）
    if (data.session_id && onSessionId) {
      onSessionId(data.session_id);
      console.log('Session ID set from stream:', data.session_id);
    }

    // 1. 处理 message 类型（主要的消息格式）
    if (data.type === 'message' && Array.isArray(data.content)) {
      data.content.forEach((contentBlock: any) => {
        if (contentBlock.type === 'text' && contentBlock.text) {
          updateTextContent(contentBlock.text);
        } else if (contentBlock.type === 'thinking' && contentBlock.thinking) {
          updateTextContent(contentBlock.thinking);
        } else if (contentBlock.type === 'tool_use') {
          handleToolUse(contentBlock);
        }
      });
    }
    // 2. 处理基础 content 类型
    else if (data.type === 'content') {
      updateTextContent(data.content);
    }
    // 3. 处理 content_block_delta 类型（流式文本增量）
    else if (data.type === 'content_block_delta' && data.delta?.text) {
      updateTextContent(data.delta.text);
    }
    // 4. 处理 assistant 类型的嵌套消息
    else if (data.type === 'assistant' && data.message?.content) {
      data.message.content.forEach((contentBlock: any) => {
        if (contentBlock.type === 'text') {
          updateTextContent(contentBlock.text);
        } else if (contentBlock.type === 'tool_use') {
          handleToolUse(contentBlock);
        }
      });
    }
    // 5. 处理独立的 tool_use
    else if (data.type === 'tool_use') {
      handleToolUse(data);
    }
    // 6. 处理 user 类型（包含 tool_result）
    else if (data.type === 'user' && Array.isArray(data.message?.content)) {
      data.message.content.forEach((block: any) => {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const resText = typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((p: any) => p.text || '').join('\n')
              : JSON.stringify(block.content);

          const targetIndex = chatItems.value.findIndex(i => i.tool_use_id === block.tool_use_id);
          if (targetIndex >= 0) {
            chatItems.value[targetIndex] = {
              ...chatItems.value[targetIndex],
              result: resText,
              isError: block.is_error
            };
          }
        }
      });
    }
    // 7. 处理独立的 tool_result
    else if (data.type === 'tool_result') {
      updateToolResult(data);
    }
    // 8. 处理权限请求
    else if (data.type === 'permission_request') {
      handlePermissionRequest(data);
    }
    // 9. 处理权限决策
    else if (data.type === 'permission_decision') {
      // 权限已处理，可以移除对应的请求卡片
      if (data.permission?.id) {
        chatItems.value = chatItems.value.filter(i => i.requestId !== data.permission.id);
      }
    }
    // 10. 处理子代理消息
    else if (data.type === 'subagent_message' && data.agent_id) {
      handleSubagentMessage(data);
    }
    // 11. 处理错误
    else if (data.type === 'error') {
      handleError(data);
    }
    // 12. 处理流结束
    else if (data.type === 'process_end') {
      handleEnd(data);
    }
    // 13. 处理中断事件
    else if (data.type === 'aborted') {
      handleEnd(data);
    }
  };

  /**
   * 更新文本内容
   * 
   * 如果最后一条消息是助手的文本消息，则追加内容；否则创建新消息
   * 
   * @param text - 文本内容
   */
  const updateTextContent = (text: string) => {
    if (!text) return;

    const last = chatItems.value[chatItems.value.length - 1];
    if (last && last.role === 'assistant' && last.kind === 'text') {
      const newRawText = (last.rawText || '') + text;
      chatItems.value[chatItems.value.length - 1] = {
        ...last,
        rawText: newRawText,
        html: marked.parse(newRawText) as string
      };
    } else {
      addChatItem({
        role: 'assistant',
        kind: 'text',
        rawText: text,
        html: marked.parse(text) as string
      });
    }
  };

  /**
   * 处理工具调用
   * 
   * 支持的工具类型：
   * - Task: 子代理任务
   * - TodoWrite: TODO 列表
   * - Write: 文件写入（带 Diff 预览）
   * - 其他工具
   * 
   * @param toolData - 工具数据
   */
  const handleToolUse = (toolData: any) => {
    if (toolData.name === 'Task') {
      addChatItem({
        role: 'assistant',
        kind: 'subagent',
        name: toolData.name,
        input: toolData.input,
        result: '',
        tool_use_id: toolData.id,
        isError: false,
        subagentMessages: [],
        agentId: null
      });
      return;
    }

    if (toolData.name === 'TodoWrite' && toolData.input?.todos) {
      addChatItem({
        role: 'assistant',
        kind: 'todo_list',
        name: toolData.name,
        input: toolData.input,
        todos: toolData.input.todos,
        tool_use_id: toolData.id
      });
      return;
    }

    const item: Partial<ChatMessage> = {
      role: 'assistant',
      kind: 'tool',
      name: toolData.name,
      input: toolData.input,
      result: '',
      tool_use_id: toolData.id,
      isError: false
    };

    if (toolData.name === 'Write' && toolData.input?.content) {
      item.diffLines = generatePreviewDiff(toolData.input.content);
    }

    addChatItem(item);
  };

  /**
   * 更新工具执行结果
   * 
   * @param data - 工具结果数据
   */
  const updateToolResult = (data: any) => {
    const targetIndex = chatItems.value.findIndex(i => i.tool_use_id === data.tool_use_id);
    if (targetIndex >= 0) {
      chatItems.value[targetIndex] = {
        ...chatItems.value[targetIndex],
        result: data.result,
        isError: data.is_error
      };
    }
  };

  /**
   * 处理子代理消息
   * 
   * 将子代理消息添加到对应的子代理项中
   * 
   * @param data - 子代理消息数据
   */
  const handleSubagentMessage = (data: any) => {
    // 查找对应的子代理项
    const subagentIndex = chatItems.value.findIndex(
      (i: any) => i.kind === 'subagent' && i.tool_use_id === data.agent_id
    );

    if (subagentIndex >= 0) {
      const subagentItem = chatItems.value[subagentIndex];

      // 初始化 subagentMessages 数组（如果不存在）
      if (!subagentItem.subagentMessages) {
        subagentItem.subagentMessages = [];
      }

      // 添加子代理消息
      const message = {
        id: data.message_id || `subagent-msg-${Date.now()}`,
        role: data.role || 'assistant',
        kind: data.kind || 'text',
        ...data.message
      };

      subagentItem.subagentMessages.push(message);

      // 触发响应式更新
      chatItems.value[subagentIndex] = {
        ...subagentItem
      };
    }
  };

  /**
   * 处理权限请求
   * 
   * @param data - 权限请求数据
   */
  const handlePermissionRequest = (data: any) => {
    const req = data.permission || data;
    addChatItem({
      role: 'assistant',
      kind: 'permission_request',
      toolName: req.toolName,
      toolInput: req.toolInput,
      payload: req.payload,
      requestId: req.id
    });
  };

  /**
   * 处理错误事件
   * 
   * @param data - 错误数据
   */
  const handleError = (data: any) => {
    addChatItem({
      role: 'assistant',
      kind: 'text',
      rawText: `❌ 错误: ${data.stderr || data.error || 'unknown'}`,
      html: marked.parse(`❌ 错误: ${data.stderr || data.error || 'unknown'}`) as string
    });
  };

  /**
   * 处理流结束事件
   * 
   * @param data - 结束事件数据
   */
  const handleEnd = (data: any) => {
    if (data.type === 'aborted') {
      addChatItem({
        role: 'assistant',
        kind: 'text',
        rawText: `⚠️ ${data.message || '会话已被用户中断'}`,
        html: marked.parse(`⚠️ ${data.message || '会话已被用户中断'}`) as string
      });
    } else if (data.type === 'process_end') {
      console.log(`Process ended with code: ${data.code}`);
    }
    stopStream();
  };

  /**
   * 生成 Diff 预览
   * 
   * 显示前 10 行内容作为预览
   * 
   * @param content - 文件内容
   * @returns Diff 行数组
   */
  const generatePreviewDiff = (content: string) => {
    const lines = content.split('\n');
    return lines.slice(0, 10).map(l => ({ type: 'add' as const, content: '+ ' + l }));
  };

  return {
    startStream,
    stopStream,
    handleStreamEvent
  };
}
