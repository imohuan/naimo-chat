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

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;

        switch (data.type) {
          case "content_block_delta":
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

          case "message_complete":
            // 标记消息完成
            callbacks.onComplete?.();
            // 延迟关闭连接，确保最后的事件被处理
            setTimeout(() => {
              disconnect();
            }, 1000);
            break;

          case "error":
            // 处理错误
            const errorMessage = data.error || "未知错误";
            callbacks.onError?.(errorMessage);
            disconnect();
            break;
        }
      } catch (error) {
        console.error("解析 SSE 事件失败:", error);
        callbacks.onError?.(error instanceof Error ? error.message : "解析事件失败");
      }
    };

    es.onerror = (error) => {
      console.error("SSE 连接错误:", error);
      // 注意：EventSource 在错误时会自动重连，这里只记录错误
      // 如果确实是致命错误，会通过 message_complete 或 error 事件处理
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

