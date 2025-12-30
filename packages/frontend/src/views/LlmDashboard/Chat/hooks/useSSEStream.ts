import { ref, computed, onUnmounted } from "vue";
import type { SSEEvent, StreamCallbacks } from "@/views/LlmDashboard/Chat/types";
import { useChatApi } from "../../../../hooks/useChatApi";

/**
 * SSE 流式响应处理 Hook
 */
export function useSSEStream() {
  const { endpoint } = useChatApi();
  const eventSource = ref<EventSource | null>(null);
  const isConnected = computed(() => eventSource.value !== null);

  /**
   * 连接到 SSE 流
   */
  function connectToStream(
    conversationId: string,
    requestId: string,
    callbacks: StreamCallbacks
  ) {
    // 关闭之前的连接
    disconnect();

    const streamUrl = `${endpoint.value}/api/ai_chat/conversations/${conversationId}/stream/${requestId}`;
    const es = new EventSource(streamUrl);
    eventSource.value = es;

    let accumulatedContent = "";
    let isCompleted = false; // 标记是否已经正常完成
    let currentTextBlockId: string | null = null; // 当前文字块的 ID
    let currentTextContent = ""; // 当前文字块的内容

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;

        switch (data.type) {
          case "content_block_start":
            // 内容块开始
            if (data.content_block?.name) {
              // 工具调用开始
              callbacks.onContentBlockStart?.({
                index: data.index ?? 0,
                blockId: data.content_block.id,
                blockType: "tool",
                toolName: data.content_block.name,
              });
            } else {
              // 文字块开始
              currentTextBlockId = data.content_block?.id || `text-${Date.now()}-${Math.random()}`;
              currentTextContent = "";
              callbacks.onContentBlockStart?.({
                index: data.index ?? 0,
                blockId: currentTextBlockId,
                blockType: "text",
              });
            }
            break;

          case "content_block_delta":
            // 内容块增量更新
            if (data.delta?.text) {
              // 文字增量
              currentTextContent += data.delta.text;
              accumulatedContent += data.delta.text;
              callbacks.onContentBlockDelta?.({
                index: data.index ?? 0,
                text: data.delta.text,
              });
              callbacks.onChunk?.(accumulatedContent);
            } else if (data.delta?.partial_json) {
              // 工具参数增量
              callbacks.onContentBlockDelta?.({
                index: data.index ?? 0,
                partialJson: data.delta.partial_json,
              });
            }
            break;

          case "content_block_stop":
            // 内容块结束
            callbacks.onContentBlockStop?.({
              index: data.index ?? 0,
            });
            currentTextBlockId = null;
            currentTextContent = "";
            break;

          case "message_delta":
            // 消息增量（兼容旧版本）
            if (data.delta?.text) {
              accumulatedContent += data.delta.text;
              callbacks.onChunk?.(accumulatedContent);
            }
            break;

          case "request_id":
            // 更新 requestId
            if (data.requestId) {
              callbacks.onRequestId?.(data.requestId);
            }
            break;

          case "conversation:updated":
            // 对话消息列表更新
            if (data.conversationId && data.messages && data.requestId) {
              callbacks.onConversationUpdated?.({
                conversationId: data.conversationId,
                messages: data.messages,
                requestId: data.requestId,
              });
            }
            break;

          case "conversation:title_updated":
            // 对话标题更新
            if (data.conversationId && data.title) {
              callbacks.onConversationTitleUpdated?.({
                conversationId: data.conversationId,
                title: data.title,
              });
            }
            break;

          case "message_complete":
            // 标记消息完成
            isCompleted = true;
            callbacks.onComplete?.();
            // 立即关闭连接，避免服务器关闭时触发错误事件
            disconnect();
            break;

          case "session_end":
            // 服务器端会话结束事件（在 closeSession 时发送）
            // 如果还没完成，说明是异常关闭
            if (!isCompleted) {
              console.warn("SSE 会话意外结束:", data);
            }
            // 标记为已完成，避免 onerror 触发错误回调
            isCompleted = true;
            disconnect();
            break;

          case "error":
            // 处理错误
            const errorMessage = data.error || "未知错误";
            callbacks.onError?.(errorMessage);
            disconnect();
            break;

          // Canvas 事件处理
          case "canvas:code_delta":
            if (data.code) {
              callbacks.onCanvasCodeDelta?.(data.code);
            }
            break;

          case "canvas:diff_detected":
            if (data.diff && data.recordId) {
              callbacks.onCanvasDiffDetected?.({
                diff: data.diff,
                recordId: data.recordId,
                originalCode: data.originalCode,
              });
            }
            break;

          case "canvas:show_editor":
            callbacks.onCanvasShowEditor?.();
            break;

          case "canvas:code_complete":
            if (data.recordId && data.codeType) {
              callbacks.onCanvasCodeComplete?.({
                recordId: data.recordId,
                codeType: data.codeType,
                code: data.code,
              });
            }
            break;

          case "canvas:record_created":
            if (data.recordId) {
              callbacks.onCanvasRecordCreated?.(data.recordId);
            }
            break;

          // 工具事件处理
          case "tool:start":
            if (data.tool_id && data.tool_name) {
              callbacks.onToolStart?.({
                toolId: data.tool_id,
                toolName: data.tool_name,
                timestamp: data.timestamp,
              });
            }
            break;

          case "tool:result":
            if (data.tool_id && data.tool_name) {
              callbacks.onToolResult?.({
                toolId: data.tool_id,
                toolName: data.tool_name,
                input: data.input, // 添加输入参数
                result: data.result,
                timestamp: data.timestamp,
              });
            }
            break;

          case "tool:error":
            if (data.tool_id && data.tool_name) {
              callbacks.onToolError?.({
                toolId: data.tool_id,
                toolName: data.tool_name,
                error: data.error || "未知错误",
                timestamp: data.timestamp,
              });
            }
            break;

          case "tool:continue_error":
            callbacks.onToolContinueError?.({
              error: data.error || "未知错误",
              timestamp: data.timestamp,
            });
            break;

          case "tool:continue_complete":
            callbacks.onToolContinueComplete?.({
              timestamp: data.timestamp,
            });
            break;
        }
      } catch (error) {
        console.error("解析 SSE 事件失败:", error);
        callbacks.onError?.(error instanceof Error ? error.message : "解析事件失败");
      }
    };

    es.onerror = (event) => {
      // EventSource 的错误事件不包含详细的错误信息
      // 需要检查 readyState 来判断连接状态
      const state = es.readyState;

      // 如果已经正常完成，忽略错误事件（可能是服务器正常关闭连接）
      if (isCompleted) {
        console.log("SSE 连接已正常完成，忽略关闭时的错误事件");
        return;
      }

      if (state === EventSource.CLOSED) {
        // 连接已关闭，且不是正常完成的情况
        const errorMessage = "SSE 连接意外关闭";
        console.error("SSE 连接错误:", {
          message: errorMessage,
          readyState: state,
          url: streamUrl,
          event: event
        });
        callbacks.onError?.(errorMessage);
        disconnect();
      } else if (state === EventSource.CONNECTING) {
        // 连接失败，正在重连
        console.warn("SSE 连接失败，正在重连...", {
          readyState: state,
          url: streamUrl,
          event: event
        });
        // EventSource 会自动重连，这里只记录警告，不触发错误回调
      } else {
        // 其他错误状态
        console.error("SSE 连接错误:", {
          message: "SSE 连接错误",
          readyState: state,
          url: streamUrl,
          event: event
        });
        // 只有在 OPEN 状态出错时才触发错误回调
        if (state === EventSource.OPEN) {
          callbacks.onError?.("SSE 连接错误");
        }
      }
    };
  }

  /**
   * 断开 SSE 连接
   */
  function disconnect() {
    if (eventSource.value) {
      eventSource.value.close();
      eventSource.value = null;
    }
  }

  // 组件卸载时自动断开连接
  onUnmounted(() => {
    disconnect();
  });

  return {
    isConnected,
    connectToStream,
    disconnect,
  };
}

