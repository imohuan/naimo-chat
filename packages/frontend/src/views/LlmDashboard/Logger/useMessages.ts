import { ref, computed } from "vue";
import type { MessageListItem, MessageDetail } from "./types";
import { useLlmApi } from "@/hooks/useLlmApi";

export function useMessages() {
  const { fetchMessages: apiFetchMessages, fetchMessageDetail: apiFetchMessageDetail } = useLlmApi();
  const messages = ref<MessageListItem[]>([]);
  const selectedMessageId = ref<string | null>(null);
  const selectedMessageDetail = ref<MessageDetail | null>(null);
  const searchQuery = ref("");
  const filterTag = ref<"all" | "completed" | "pending" | "error">("all");
  const isLoading = ref(false);
  const isLoadingDetail = ref(false);
  const limit = ref(100);
  const offset = ref(0);

  /** 获取对话列表 */
  async function loadMessages(reset = false) {
    if (isLoading.value) return;

    isLoading.value = true;
    try {
      if (reset) {
        offset.value = 0;
      }

      const data = await apiFetchMessages(limit.value, offset.value);

      if (reset) {
        messages.value = data.messages;
      } else {
        messages.value = [...messages.value, ...data.messages];
      }

      offset.value += data.messages.length;
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      isLoading.value = false;
    }
  }

  /** 获取对话详情 */
  async function loadMessageDetail(requestId: string) {
    if (isLoadingDetail.value) return;

    isLoadingDetail.value = true;
    try {
      const detail = await apiFetchMessageDetail(requestId);
      selectedMessageDetail.value = detail as MessageDetail;
    } catch (error) {
      console.error("Error loading message detail:", error);
      selectedMessageDetail.value = null;
    } finally {
      isLoadingDetail.value = false;
    }
  }

  /** 选择对话 */
  async function selectMessage(requestId: string) {
    selectedMessageId.value = requestId;
    await loadMessageDetail(requestId);
  }

  // 判断对话状态（简化版，基于消息列表项的基本信息）
  function getMessageStatus(msg: MessageListItem): "completed" | "pending" | "error" {
    // 根据是否有响应来判断基本状态
    // 有响应或流式响应，认为已完成（实际可能还需要检查详情）
    if (msg.hasResponse || msg.hasStreamResponse) {
      return "completed";
    }

    // 有请求但没有响应，认为未完成
    if (msg.hasRequest && !msg.hasResponse && !msg.hasStreamResponse) {
      return "pending";
    }

    // 默认返回已完成
    return "completed";
  }

  /** 过滤后的对话列表 */
  const filteredMessages = computed(() => {
    let filtered = messages.value;

    // 按标签过滤
    if (filterTag.value !== "all") {
      filtered = filtered.filter((msg) => {
        const status = getMessageStatus(msg);
        return status === filterTag.value;
      });
    }

    // 搜索过滤
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      filtered = filtered.filter((msg) => {
        return (
          msg.requestId.toLowerCase().includes(q) ||
          (msg.model && msg.model.toLowerCase().includes(q)) ||
          (msg.timestamp && msg.timestamp.toLowerCase().includes(q))
        );
      });
    }

    return filtered;
  });

  return {
    messages,
    selectedMessageId,
    selectedMessageDetail,
    searchQuery,
    filterTag,
    isLoading,
    isLoadingDetail,
    filteredMessages,
    loadMessages,
    loadMessageDetail,
    selectMessage,
  };
}

