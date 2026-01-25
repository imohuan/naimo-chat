<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import LoggerHeaderControls from "./components/LoggerHeaderControls.vue";
import MessageList from "./components/MessageList.vue";
import LoggerRequestDetail from "./components/LoggerRequestDetail.vue";
import McpToolCallList from "./components/McpToolCallList.vue";
import McpToolCallDetail from "./components/McpToolCallDetail.vue";
import CodeEditor from "@/components/code/CodeEditor.vue";
import { useLogger } from "./useLogger";
import { useMessages } from "./useMessages";
import { useMcpToolCalls } from "./useMcpToolCalls";
import type { LogRequest, MessageDetail } from "./types";

// LoggerPanel 现在作为路由组件，不再需要 currentTab prop

// Tab 切换：普通日志 / 对话 / MCP 工具调用
const activeMode = ref<"logs" | "messages" | "mcp-tools">("messages");

// 普通日志相关
const {
  logFiles,
  selectedLogFileObj,
  isRefreshing,
  loadLogFiles,
  selectLogFile,
  refreshLogFile,
  clearCurrentLogFile,
} = useLogger();

const selectedLogContent = ref<string>("");
const isLoadingLogContent = ref(false);
const isLoadingLogFiles = ref(false);

// 对话相关
const {
  messages,
  selectedMessageId,
  selectedMessageDetail,
  searchQuery: messageSearchQuery,
  filterTag,
  isLoading: isLoadingMessages,
  isLoadingMore: isLoadingMoreMessages,
  isLoadingDetail,
  isRefreshing: isRefreshingMessages,
  filteredMessages,
  hasMore,
  loadMessages,
  selectMessage,
} = useMessages();

// MCP 工具调用相关
const {
  toolCalls,
  selectedToolCallId,
  selectedToolCallDetail,
  searchQuery: mcpSearchQuery,
  isLoading: isLoadingMcpToolCalls,
  isLoadingMore: isLoadingMoreMcpToolCalls,
  isLoadingDetail: isLoadingMcpDetail,
  isRefreshing: isRefreshingMcpToolCalls,
  hasMore: hasMoreMcpToolCalls,
  loadToolCalls,
  selectToolCall,
  refreshToolCalls,
  deleteToolCall,
} = useMcpToolCalls();

// 刷新对话列表
async function refreshMessages() {
  await loadMessages(true);

  // 刷新后保持选中状态（使用当前的 ID，以防用户在刷新过程中切换了对话）
  const idToRefresh = selectedMessageId.value;

  if (idToRefresh) {
    // 检查该消息是否仍然存在
    const stillExists = filteredMessages.value.some(
      (msg) => msg.requestId === idToRefresh
    );
    if (stillExists) {
      await selectMessage(idToRefresh, true);
    } else {
      // 如果消息不存在了，选择第一个
      if (filteredMessages.value.length > 0) {
        const firstMessage = filteredMessages.value[0];
        if (firstMessage?.requestId) {
          await selectMessage(firstMessage.requestId);
        }
      }
    }
  }
}

// 加载更多消息
async function loadMoreMessages() {
  if (hasMore.value && !isLoadingMessages.value) {
    await loadMessages(false);
  }
}

// 刷新日志文件并重新加载内容
async function handleRefreshLogFile() {
  const currentSelectedPath = selectedLogFileObj.value?.path;

  // refreshLogFile 已经会更新 selectedLogFileObj（如果文件还在列表中）
  await refreshLogFile();

  // 确保刷新后仍然选中同一个文件
  if (currentSelectedPath) {
    // 检查该文件是否仍然存在，如果不存在则选择第一个
    const updatedFile = logFiles.value.find(
      (f) => f.path === currentSelectedPath
    );
    if (updatedFile && updatedFile.path !== selectedLogFileObj.value?.path) {
      // 如果文件存在但 selectedLogFileObj 没有更新，手动选择
      await selectLogFile(updatedFile);
    } else if (!updatedFile && logFiles.value.length > 0) {
      // 如果文件不存在了，选择第一个
      const firstFile = logFiles.value[0];
      if (firstFile) {
        await selectLogFile(firstFile);
      }
    }
  }

  // 重新加载当前文件的内容（无感刷新，不显示loading）
  if (selectedLogFileObj.value) {
    await loadLogContent(selectedLogFileObj.value.path);
  } else {
    selectedLogContent.value = "";
  }
}

// 清空当前日志文件并更新显示
async function handleClearLogFile() {
  await clearCurrentLogFile();
  // 清空后重新加载文件列表，并重新加载当前文件内容（应该是空的）
  if (selectedLogFileObj.value) {
    await loadLogContent(selectedLogFileObj.value.path);
  } else {
    // 如果没有选中的文件，清空显示内容
    selectedLogContent.value = "";
  }
}

// 加载 messages 并自动选择第一个
async function loadMessagesAndSelectFirst() {
  // isLoadingMessages 已经在 loadMessages 中管理
  await loadMessages(true);
  // 加载完成后，如果 filteredMessages 有数据且当前没有选中，就选择第一个
  if (filteredMessages.value.length > 0 && !selectedMessageId.value) {
    const firstMessage = filteredMessages.value[0];
    if (firstMessage?.requestId) {
      await selectMessage(firstMessage.requestId);
    }
  }
}

// 加载 MCP 工具调用并自动选择第一个
async function loadMcpToolCallsAndSelectFirst() {
  await loadToolCalls(true);
  if (toolCalls.value.length > 0 && !selectedToolCallId.value) {
    const firstCall = toolCalls.value[0];
    if (firstCall?.id) {
      await selectToolCall(firstCall.id);
    }
  }
}

// 包装 loadLogFiles 以添加加载状态
async function loadLogFilesWithLoading(autoSelectFirst = false) {
  isLoadingLogFiles.value = true;
  try {
    await loadLogFiles(autoSelectFirst);
  } finally {
    isLoadingLogFiles.value = false;
  }
}

// 加载普通日志内容
async function loadLogContent(filePath: string) {
  if (isLoadingLogContent.value) return;

  isLoadingLogContent.value = true;
  try {
    const { useLlmApi } = await import("@/hooks/useLlmApi");
    const { fetchLogs: apiFetchLogs } = useLlmApi();

    const logLines = await apiFetchLogs(filePath, 0, 10000);
    selectedLogContent.value = Array.isArray(logLines)
      ? logLines.join("\n")
      : "";
  } catch (error) {
    console.error("Error loading log content:", error);
    selectedLogContent.value = "";
  } finally {
    isLoadingLogContent.value = false;
  }
}

// 监听日志文件选择
watch(
  () => selectedLogFileObj.value,
  async (file) => {
    if (file && activeMode.value === "logs") {
      await loadLogContent(file.path);
    }
  }
);

// 将 MessageDetail 转换为 LogRequest 格式
function convertMessageDetailToLogRequest(
  detail: MessageDetail | null
): LogRequest | null {
  if (!detail) return null;

  const request = detail.request || {};
  const body = request.body || {};
  const messages = body.messages || request.messages || [];

  // 构建日志条目
  const logs: any[] = [];

  // 添加请求体日志
  if (body.messages || request.messages) {
    logs.push({
      type: "request body",
      time: new Date(detail.request?.timestamp || detail.requestId).getTime(),
      level: 30,
      data: {
        // system: body.system || request.system,
        // model: body.model || request.model,
        // tools: body.tools || request.tools, // 保存 tools 信息，包括 MCP 工具
        ...body,
        messages: messages,
      },
    });
  }

  // 如果没有从 body 中获取到 tools，尝试从原始请求中获取
  if (!body.tools && !request.tools && request.body) {
    try {
      const parsedBody =
        typeof request.body === "string"
          ? JSON.parse(request.body)
          : request.body;
      if (parsedBody.tools) {
        const bodyLog = logs.find((l) => l.type === "request body");
        if (bodyLog) {
          bodyLog.data.tools = parsedBody.tools;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  let hasContent = false;
  let errorInfo: any = null;

  // 辅助函数：从错误消息中提取 message_zh
  function extractErrorMessage(errorObj: any): any {
    if (!errorObj) return null;

    const error = { ...errorObj };

    // 尝试从 error.message 中提取嵌套的 JSON 字符串
    if (error.message && typeof error.message === "string") {
      try {
        // 尝试找到 JSON 对象（可能包含在错误消息中）
        // 例如: "Error from provider(...): {\"error\":{\"message_zh\":\"...\"}}"
        // 使用更精确的匹配，找到第一个完整的 JSON 对象
        const message = error.message;
        let braceCount = 0;
        let jsonStart = -1;

        for (let i = 0; i < message.length; i++) {
          if (message[i] === "{") {
            if (braceCount === 0) jsonStart = i;
            braceCount++;
          } else if (message[i] === "}") {
            braceCount--;
            if (braceCount === 0 && jsonStart !== -1) {
              // 找到完整的 JSON 对象
              const jsonStr = message.substring(jsonStart, i + 1);
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.error?.message_zh) {
                  // 提取 message_zh 作为主要错误消息
                  error.message = parsed.error.message_zh;
                  error.originalMessage = errorObj.message;
                  break;
                } else if (parsed.message_zh) {
                  error.message = parsed.message_zh;
                  error.originalMessage = errorObj.message;
                  break;
                }
              } catch (parseError) {
                // 继续尝试下一个 JSON 对象
              }
            }
          }
        }
      } catch (e) {
        // 如果解析失败，保持原始错误消息
      }
    }

    return error;
  }

  // 处理流式响应
  if (detail.response?.full && Array.isArray(detail.response.full)) {
    let fullResponseText = "";
    const events = detail.response.full;

    for (const event of events) {
      // 检查事件中是否有错误（可能在不同的位置）
      const eventAny = event as any;
      if (eventAny.error) {
        errorInfo = extractErrorMessage(eventAny.error);
      } else if (eventAny.message?.error) {
        errorInfo = extractErrorMessage(eventAny.message.error);
      } else if (eventAny.delta?.error) {
        errorInfo = extractErrorMessage(eventAny.delta.error);
      }

      if (event.type === "content_block_delta" && event.delta) {
        if (event.delta.type === "text_delta" && event.delta.text) {
          fullResponseText += event.delta.text;
        }
      }
    }

    if (fullResponseText) {
      hasContent = true;
      logs.push({
        type: "full_response",
        time: Date.now(),
        level: 30,
        data: {
          content: fullResponseText,
          model: body.model || request.model,
        },
      });
    }
  }

  if (!hasContent && detail.response?.content) {
    hasContent = true;
    logs.push({
      type: "full_response",
      time: Date.now(),
      level: 30,
      data: {
        content: detail.response.content,
        model: body.model || request.model,
      },
    });
  }

  // 如果有错误，添加错误日志条目
  if (errorInfo) {
    logs.push({
      type: "error",
      time: Date.now(),
      level: 50, // 错误级别
      err: errorInfo,
    });
  }

  // 构建 LogRequest
  const logRequest: LogRequest = {
    id: detail.requestId,
    startTime: new Date(
      detail.request?.timestamp || detail.requestId
    ).getTime(),
    logs: logs,
    method: request.method || "POST",
    url: request.url || "/v1/messages",
    status: 200,
    model: body.model || request.model || "",
    fullResponse: detail.response?.content || "",
    hasError: !!errorInfo,
    error: errorInfo,
    responseFull: detail.response?.full || undefined,
  };

  return logRequest;
}

// 转换后的 LogRequest
const convertedLogRequest = computed(() => {
  return convertMessageDetailToLogRequest(selectedMessageDetail.value);
});

// 监听对话选择
watch(
  () => selectedMessageId.value,
  async (id) => {
    if (id) {
      await selectMessage(id);
    }
  }
);

// 监听模式切换
watch(activeMode, async (mode) => {
  if (mode === "messages") {
    await loadMessagesAndSelectFirst();
  } else if (mode === "logs") {
    await loadLogFilesWithLoading(true);
    if (selectedLogFileObj.value) {
      await loadLogContent(selectedLogFileObj.value.path);
    }
  } else if (mode === "mcp-tools") {
    await loadMcpToolCallsAndSelectFirst();
  }
});

function handleClickOutside(e: MouseEvent) {
  const dropdown = (e.target as Element).closest("[data-log-dropdown]");
  if (!dropdown) {
    // 可以在这里处理关闭下拉菜单的逻辑
  }
}

onMounted(async () => {
  // 根據當前默認 tab 來調用對應的方法
  if (activeMode.value === "messages") {
    await loadMessagesAndSelectFirst();
  } else if (activeMode.value === "logs") {
    await loadLogFilesWithLoading(true);
    if (selectedLogFileObj.value) {
      await loadLogContent(selectedLogFileObj.value.path);
    }
  } else if (activeMode.value === "mcp-tools") {
    await loadMcpToolCallsAndSelectFirst();
  }
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="h-full flex flex-col bg-slate-50 overflow-hidden">
    <!-- 日志头部控制组件（文件选择器 + Tab 切换，通过 Teleport 传送到顶部导航栏） -->
    <LoggerHeaderControls :active-mode="activeMode" :log-files="logFiles" :selected-log-file-obj="selectedLogFileObj"
      :is-refreshing="isRefreshing" :is-refreshing-messages="isRefreshingMessages"
      :is-refreshing-mcp-tools="isRefreshingMcpToolCalls" @update:active-mode="(mode) => (activeMode = mode)"
      @select-file="selectLogFile" @refresh="handleRefreshLogFile" @refresh-messages="refreshMessages"
      @refresh-mcp-tools="refreshToolCalls" @clear-log="handleClearLogFile" />

    <!-- 主内容区域 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 普通日志模式 -->
      <template v-if="activeMode === 'logs'">
        <div class="flex-1 min-w-0 w-full h-full">
          <div v-if="isLoadingLogFiles || isLoadingLogContent" class="flex items-center justify-center h-full">
            <div class="flex flex-col items-center gap-3">
              <Loader2 class="w-6 h-6 text-slate-400 animate-spin" />
              <p class="text-slate-400 text-sm">加载中...</p>
            </div>
          </div>
          <CodeEditor v-else class="h-full" :model-value="selectedLogContent" language="json" :readonly="true" :options="{
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }" />
        </div>
      </template>

      <!-- 对话查询模式 -->
      <template v-else-if="activeMode === 'messages'">
        <!-- 左侧：对话列表 -->
        <div class="w-80 shrink-0">
          <MessageList :messages="messages" :selected-message-id="selectedMessageId" :search-query="messageSearchQuery"
            :filter-tag="filterTag" :is-loading="isLoadingMessages" :is-loading-more="isLoadingMoreMessages"
            :is-refreshing="isRefreshingMessages" :has-more="hasMore"
            @update:selected-message-id="(id) => (selectedMessageId = id)"
            @update:filter-tag="(tag) => (filterTag = tag)"
            @update:search-query="(query) => (messageSearchQuery = query)" @refresh="refreshMessages"
            @load-more="loadMoreMessages" />
        </div>

        <!-- 右侧：对话详情 -->
        <div class="flex-1 min-w-0 w-full h-full flex items-center justify-center">
          <div v-if="
            isLoadingDetail || (isLoadingMessages && !selectedMessageDetail)
          " class="flex flex-col items-center gap-3">
            <Loader2 class="w-6 h-6 text-slate-400 animate-spin" />
            <p class="text-slate-400 text-sm">加载中...</p>
          </div>
          <LoggerRequestDetail v-else :request="convertedLogRequest" />
        </div>
      </template>

      <!-- MCP 工具调用模式 -->
      <template v-else-if="activeMode === 'mcp-tools'">
        <!-- 左侧：工具调用列表 -->
        <div class="w-80 shrink-0">
          <McpToolCallList :tool-calls="toolCalls" :selected-tool-call-id="selectedToolCallId"
            :search-query="mcpSearchQuery" :is-loading="isLoadingMcpToolCalls"
            :is-loading-more="isLoadingMoreMcpToolCalls" :is-refreshing="isRefreshingMcpToolCalls"
            :has-more="hasMoreMcpToolCalls" @update:selected-tool-call-id="(id) => (selectedToolCallId = id)"
            @update:search-query="(query) => (mcpSearchQuery = query)" @refresh="refreshToolCalls"
            @load-more="loadToolCalls(false)" @delete="deleteToolCall" />
        </div>

        <!-- 右侧：工具调用详情 -->
        <div class="flex-1 min-w-0 w-full h-full flex items-center justify-center">
          <div v-if="
            isLoadingMcpDetail || (isLoadingMcpToolCalls && !selectedToolCallDetail)
          " class="flex flex-col items-center gap-3">
            <Loader2 class="w-6 h-6 text-slate-400 animate-spin" />
            <p class="text-slate-400 text-sm">加载中...</p>
          </div>
          <McpToolCallDetail v-else :tool-call="selectedToolCallDetail" />
        </div>
      </template>
    </div>
  </div>
</template>
