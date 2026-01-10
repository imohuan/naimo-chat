import { ref, computed } from "vue";
import type { MessageListItem, MessageDetail } from "./types";
import { useLlmApi } from "@/hooks/useLlmApi";

export function useMessages() {
  const {
    fetchMessages: apiFetchMessages,
    fetchMessageDetail: apiFetchMessageDetail,
  } = useLlmApi();
  const messages = ref<MessageListItem[]>([]);
  const selectedMessageId = ref<string | null>(null);
  const selectedMessageDetail = ref<MessageDetail | null>(null);
  const searchQuery = ref("");
  const filterTag = ref<"all" | "completed" | "pending" | "error">("all");
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const isLoadingDetail = ref(false);
  const isRefreshing = ref(false);
  const limit = ref(100);
  const offset = ref(0);
  const total = ref(0);

  /** 获取对话列表 */
  async function loadMessages(reset = false) {
    // 如果正在加载，直接返回
    if (isLoading.value || isLoadingMore.value) return;

    // 区分首次加载和加载更多
    if (reset) {
      isLoading.value = true;
      isRefreshing.value = true;
    } else {
      isLoadingMore.value = true;
    }

    try {
      if (reset) {
        offset.value = 0;
      }

      const data = await apiFetchMessages(limit.value, offset.value);

      if (reset) {
        // 重置时替换整个列表
        messages.value = data.messages;
      } else {
        // 加载更多时，累加到现有列表（避免重复）
        const existingIds = new Set(messages.value.map((msg) => msg.requestId));
        const newMessages = data.messages.filter(
          (msg) => !existingIds.has(msg.requestId)
        );
        messages.value = [...messages.value, ...newMessages];
      }

      total.value = data.total;
      offset.value += data.messages.length;
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      isLoading.value = false;
      isLoadingMore.value = false;
      if (reset) {
        isRefreshing.value = false;
      }
    }
  }

  /** 获取对话详情 */
  async function loadMessageDetail(requestId: string, silent = false) {
    if (isLoadingDetail.value) return;

    if (!silent) {
      isLoadingDetail.value = true;
    }
    try {
      const detail = await apiFetchMessageDetail(requestId);
      selectedMessageDetail.value = detail as MessageDetail;
    } catch (error) {
      console.error("Error loading message detail:", error);
      selectedMessageDetail.value = null;
    } finally {
      if (!silent) {
        isLoadingDetail.value = false;
      }
    }
  }

  /** 选择对话 */
  async function selectMessage(requestId: string, silent = false) {
    selectedMessageId.value = requestId;
    await loadMessageDetail(requestId, silent);
  }

  // 判断对话状态（简化版，基于消息列表项的基本信息）
  function getMessageStatus(
    msg: MessageListItem
  ): "completed" | "pending" | "error" {
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

  /** 是否还有更多数据 */
  const hasMore = computed(() => {
    // 如果当前消息数量小于总数，说明还有更多
    return messages.value.length < total.value;
  });

  return {
    messages,
    selectedMessageId,
    selectedMessageDetail,
    searchQuery,
    filterTag,
    isLoading,
    isLoadingMore,
    isLoadingDetail,
    isRefreshing,
    filteredMessages,
    hasMore,
    loadMessages,
    loadMessageDetail,
    selectMessage,
  };
}
