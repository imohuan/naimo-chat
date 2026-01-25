import { ref, computed } from "vue";
import { useLlmApi } from "@/hooks/useLlmApi";
import type { TimeRange } from "./types";

export interface McpToolCall {
  id: string;
  timestamp: number;
  date: string;
  toolName: string;
  serverName: string;
  sessionId: string | null;
  arguments: Record<string, any>;
  result: any;
  error: {
    message: string;
    code?: string | number;
    stack?: string;
  } | null;
  duration: number;
  success: boolean;
}

export interface McpToolCallsQuery {
  logs: McpToolCall[];
  total: number;
  limit: number;
  offset: number;
}

export function useMcpToolCalls() {
  const { fetchMcpToolCalls, fetchMcpToolCallDetail, deleteMcpToolCalls } = useLlmApi();

  const toolCalls = ref<McpToolCall[]>([]);
  const selectedToolCallId = ref<string | null>(null);
  const selectedToolCallDetail = ref<McpToolCall | null>(null);
  const searchQuery = ref("");
  const timeRange = ref<TimeRange>({ start: null, end: null });
  const filterSuccess = ref<boolean | undefined>(undefined);
  const filterToolName = ref<string | undefined>(undefined);
  const filterServerName = ref<string | undefined>(undefined);
  const isLoading = ref(false);
  const isLoadingMore = ref(false);
  const isLoadingDetail = ref(false);
  const isRefreshing = ref(false);
  const hasMore = ref(true);

  const offset = ref(0);
  const limit = 50;

  // 过滤后的工具调用列表
  const filteredToolCalls = computed(() => {
    let filtered = toolCalls.value;

    // 搜索过滤
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      filtered = filtered.filter((call) => {
        return (
          call.toolName.toLowerCase().includes(q) ||
          call.serverName.toLowerCase().includes(q) ||
          call.id.toLowerCase().includes(q)
        );
      });
    }

    return filtered;
  });

  // 加载工具调用列表
  async function loadToolCalls(reset = false) {
    if (reset) {
      offset.value = 0;
      toolCalls.value = [];
      hasMore.value = true;
      isLoading.value = true;
    } else {
      isLoadingMore.value = true;
    }

    try {
      const result = await fetchMcpToolCalls({
        limit,
        offset: offset.value,
        toolName: filterToolName.value,
        serverName: filterServerName.value,
        success: filterSuccess.value,
        startTime: timeRange.value.start?.getTime(),
        endTime: timeRange.value.end?.getTime(),
      });

      if (reset) {
        toolCalls.value = result.logs;
      } else {
        toolCalls.value.push(...result.logs);
      }

      offset.value += result.logs.length;
      hasMore.value = result.logs.length === limit;
    } catch (error) {
      console.error("加载 MCP 工具调用列表失败:", error);
    } finally {
      isLoading.value = false;
      isLoadingMore.value = false;
    }
  }

  // 选择工具调用
  async function selectToolCall(id: string, forceRefresh = false) {
    if (selectedToolCallId.value === id && !forceRefresh) {
      return;
    }

    selectedToolCallId.value = id;
    isLoadingDetail.value = true;

    try {
      const detail = await fetchMcpToolCallDetail(id);
      selectedToolCallDetail.value = detail;
    } catch (error) {
      console.error("加载 MCP 工具调用详情失败:", error);
      selectedToolCallDetail.value = null;
    } finally {
      isLoadingDetail.value = false;
    }
  }

  // 刷新列表
  async function refreshToolCalls() {
    isRefreshing.value = true;
    try {
      await loadToolCalls(true);
    } finally {
      isRefreshing.value = false;
    }
  }

  // 删除工具调用
  async function deleteToolCall(ids: string[]) {
    try {
      await deleteMcpToolCalls(ids);
      await refreshToolCalls();

      // 如果删除的是当前选中的，清空选中
      if (selectedToolCallId.value && ids.includes(selectedToolCallId.value)) {
        selectedToolCallId.value = null;
        selectedToolCallDetail.value = null;
      }
    } catch (error) {
      console.error("删除 MCP 工具调用失败:", error);
      throw error;
    }
  }

  return {
    toolCalls,
    selectedToolCallId,
    selectedToolCallDetail,
    searchQuery,
    timeRange,
    filterSuccess,
    filterToolName,
    filterServerName,
    isLoading,
    isLoadingMore,
    isLoadingDetail,
    isRefreshing,
    filteredToolCalls,
    hasMore,
    loadToolCalls,
    selectToolCall,
    refreshToolCalls,
    deleteToolCall,
  };
}
