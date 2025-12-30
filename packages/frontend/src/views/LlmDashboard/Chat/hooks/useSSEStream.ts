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
    let hasToolCalls = false; // 标记是否有工具调用
    let pendingToolResults = 0; // 等待工具结果的数量
    let messageCompleteCount = 0; // 记录收到的 message_complete 事件数量

    // 工具调用状态跟踪
    const toolCallsMap = new Map<number, {
      toolCallId: string;
      toolName: string;
      inputJson: string;
    }>();

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;

        switch (data.type) {
          case "content_block_start":
            // 处理工具调用开始
            if (data.content_block?.type === "tool_use" && data.index !== undefined) {
              const toolCallId = data.content_block.id || `tool-${data.index}`;
              const toolName = data.content_block.name || "unknown";

              hasToolCalls = true;
              pendingToolResults++;

              toolCallsMap.set(data.index, {
                toolCallId,
                toolName,
                inputJson: "",
              });

              callbacks.onToolCallStart?.({
                index: data.index,
                toolCallId,
                toolName,
              });
            }
            break;

          case "content_block_delta":
            // 处理工具参数增量
            if (data.delta?.type === "input_json_delta" && data.index !== undefined) {
              const toolCall = toolCallsMap.get(data.index);
              if (toolCall && data.delta.partial_json) {
                toolCall.inputJson += data.delta.partial_json;
                callbacks.onToolCallDelta?.({
                  index: data.index,
                  partialJson: data.delta.partial_json,
                });
              }
            }
            // 累积文本内容
            if (data.delta?.text) {
              accumulatedContent += data.delta.text;
              callbacks.onChunk?.(accumulatedContent);
            }
            break;

          case "content_block_stop":
            // 处理工具调用结束
            if (data.index !== undefined) {
              callbacks.onToolCallStop?.({
                index: data.index,
              });
              // 清理工具调用状态（但保留数据，等待 tool:result 事件）
            }
            break;

          case "message_delta":
            // 累积内容
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
            messageCompleteCount++;
            isCompleted = true;
            callbacks.onComplete?.();

            // 如果有工具调用，延迟关闭连接，等待工具执行完成后的第二次请求流输出
            // 工具执行完成后，后端会发送第二次请求，并转发新的流输出
            // 第一个 message_complete 是第一次请求完成，第二个是工具执行后的第二次请求完成
            if (hasToolCalls) {
              if (messageCompleteCount === 1) {
                // 第一个 message_complete：第一次请求完成，工具调用开始执行
                console.log(`[useSSEStream] 检测到工具调用，等待工具执行完成和后续流输出（剩余 ${pendingToolResults} 个工具结果）`);
                // 不立即关闭连接，等待第二次请求完成
              } else if (messageCompleteCount === 2) {
                // 第二个 message_complete：工具执行后的第二次请求完成
                console.log(`[useSSEStream] 工具执行后的第二次请求完成，关闭连接`);
                disconnect();
              }
            } else {
              // 没有工具调用，立即关闭连接
              disconnect();
            }
            break;

          case "session_end":
            // 服务器端会话结束事件（在 closeSession 时发送）
            // 如果还没完成，说明是异常关闭
            if (!isCompleted) {
              console.warn("SSE 会话意外结束:", data);
            }
            // 标记为已完成，避免 onerror 触发错误回调
            isCompleted = true;

            // 如果有工具调用，延迟关闭连接，等待工具执行完成后的第二次请求流输出
            // 工具执行完成后，后端会发送第二次请求，并转发新的流输出
            if (hasToolCalls) {
              console.log(`[useSSEStream] 检测到工具调用，即使收到 session_end 也等待工具执行完成和后续流输出`);
              // 不立即关闭连接，等待第二个 message_complete 或 tool:continue_complete 事件
            } else {
              // 没有工具调用，立即关闭连接
              disconnect();
            }
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

          // 工具调用结果事件
          case "tool:result":
            if (data.tool_use_id && data.tool_name && data.index !== undefined) {
              pendingToolResults = Math.max(0, pendingToolResults - 1);
              callbacks.onToolResult?.({
                tool_use_id: data.tool_use_id,
                tool_name: data.tool_name,
                result: data.result,
                index: data.index,
              });
            }
            break;

          case "tool:error":
            if (data.tool_use_id && data.tool_name && data.index !== undefined) {
              pendingToolResults = Math.max(0, pendingToolResults - 1);
              callbacks.onToolError?.({
                tool_use_id: data.tool_use_id,
                tool_name: data.tool_name,
                error: data.error || "工具执行失败",
                index: data.index,
              });
            }
            break;

          case "tool:continue_error":
            // 工具执行后继续对话失败
            console.error("工具执行后继续对话失败:", data.error);
            // 工具执行失败，可以关闭连接了
            if (hasToolCalls) {
              disconnect();
            }
            break;

          case "tool:continue_complete":
            // 工具执行后的第二次请求完成
            console.log(`[useSSEStream] 工具执行后的第二次请求完成，关闭连接`);
            if (hasToolCalls) {
              disconnect();
            }
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

