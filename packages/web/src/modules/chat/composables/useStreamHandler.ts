import { ref } from 'vue';
import { marked } from 'marked';
import type { ChatMessage } from '@/types';

export function useStreamHandler(
  addChatItem: (item: Partial<ChatMessage>) => void,
  chatItems: { value: ChatMessage[] }
) {
  const eventSource = ref<EventSource | null>(null);

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

  const stopStream = () => {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
  };

  const handleStreamEvent = (data: any, onSessionId?: (sessionId: string) => void) => {
    if (data.session_id && onSessionId) {
      onSessionId(data.session_id);
    }

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
    } else if (data.type === 'content') {
      updateTextContent(data.content);
    } else if (data.type === 'content_block_delta' && data.delta?.text) {
      updateTextContent(data.delta.text);
    } else if (data.type === 'tool_use') {
      handleToolUse(data);
    } else if (data.type === 'tool_result') {
      updateToolResult(data);
    } else if (data.type === 'permission_request') {
      handlePermissionRequest(data);
    } else if (data.type === 'error') {
      handleError(data);
    } else if (data.type === 'process_end' || data.type === 'aborted') {
      handleEnd(data);
    }
  };

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

  const handleError = (data: any) => {
    addChatItem({
      role: 'assistant',
      kind: 'text',
      rawText: `❌ 错误: ${data.stderr || data.error || 'unknown'}`,
      html: marked.parse(`❌ 错误: ${data.stderr || data.error || 'unknown'}`) as string
    });
  };

  const handleEnd = (data: any) => {
    if (data.type === 'aborted') {
      addChatItem({
        role: 'assistant',
        kind: 'text',
        rawText: `⚠️ ${data.message || '会话已被用户中断'}`,
        html: marked.parse(`⚠️ ${data.message || '会话已被用户中断'}`) as string
      });
    }
    stopStream();
  };

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
