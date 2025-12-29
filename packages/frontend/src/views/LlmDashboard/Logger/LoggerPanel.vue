<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import LoggerHeaderControls from "./components/LoggerHeaderControls.vue";
import MessageList from "./components/MessageList.vue";
import LoggerRequestDetail from "./components/LoggerRequestDetail.vue";
import CodeEditor from "@/components/code/CodeEditor.vue";
import { useLogger } from "./useLogger";
import { useMessages } from "./useMessages";
import type { LogRequest, MessageDetail } from "./types";

const props = defineProps<{
  currentTab: "chat" | "providers" | "logger" | "statusline" | "mcp";
}>();

// Tab 切换：普通日志 / 对话
const activeMode = ref<"logs" | "messages">("logs");

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

// 对话相关
const {
  messages,
  selectedMessageId,
  selectedMessageDetail,
  searchQuery: messageSearchQuery,
  filterTag,
  isLoading: isLoadingMessages,
  isLoadingDetail,
  filteredMessages,
  loadMessages,
  selectMessage,
} = useMessages();

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
        messages: messages,
        system: body.system || request.system,
        model: body.model || request.model,
        tools: body.tools || request.tools, // 保存 tools 信息，包括 MCP 工具
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

  // 处理流式响应
  if (detail.response?.full && Array.isArray(detail.response.full)) {
    let fullResponseText = "";
    const events = detail.response.full;

    for (const event of events) {
      if (event.type === "content_block_delta" && event.delta) {
        if (event.delta.type === "text_delta" && event.delta.text) {
          fullResponseText += event.delta.text;
        }
      }
    }

    if (fullResponseText) {
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
  } else if (detail.response?.content) {
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
    hasError: false,
    error: null,
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
    await loadMessages(true);
  } else if (mode === "logs") {
    await loadLogFiles(true);
    if (selectedLogFileObj.value) {
      await loadLogContent(selectedLogFileObj.value.path);
    }
  }
});

function handleClickOutside(e: MouseEvent) {
  const dropdown = (e.target as Element).closest("[data-log-dropdown]");
  if (!dropdown) {
    // 可以在这里处理关闭下拉菜单的逻辑
  }
}

onMounted(async () => {
  await loadLogFiles(true);
  if (selectedLogFileObj.value) {
    await loadLogContent(selectedLogFileObj.value.path);
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
    <LoggerHeaderControls
      :active-mode="activeMode"
      :log-files="logFiles"
      :selected-log-file-obj="selectedLogFileObj"
      :is-refreshing="isRefreshing"
      :current-tab="currentTab"
      @update:active-mode="(mode) => (activeMode = mode)"
      @select-file="selectLogFile"
      @refresh="refreshLogFile"
      @clear-log="clearCurrentLogFile"
    />

    <!-- 主内容区域 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 普通日志模式 -->
      <template v-if="activeMode === 'logs'">
        <div class="flex-1 min-w-0 w-full h-full">
          <div
            v-if="isLoadingLogContent"
            class="flex items-center justify-center h-full"
          >
            <p class="text-slate-400">加载中...</p>
          </div>
          <CodeEditor
            v-else
            class="h-full"
            :model-value="selectedLogContent"
            language="json"
            :readonly="true"
            :options="{
              wordWrap: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }"
          />
        </div>
      </template>

      <!-- 对话查询模式 -->
      <template v-else-if="activeMode === 'messages'">
        <!-- 左侧：对话列表 -->
        <div class="w-80 shrink-0">
          <MessageList
            :messages="filteredMessages"
            :selected-message-id="selectedMessageId"
            :search-query="messageSearchQuery"
            :filter-tag="filterTag"
            :is-loading="isLoadingMessages"
            @update:selected-message-id="(id) => (selectedMessageId = id)"
            @update:filter-tag="(tag) => (filterTag = tag)"
            @update:search-query="(query) => (messageSearchQuery = query)"
          />
        </div>

        <!-- 右侧：对话详情 -->
        <div
          class="flex-1 min-w-0 w-full h-full flex items-center justify-center"
        >
          <LoggerRequestDetail :request="convertedLogRequest" />
        </div>
      </template>
    </div>
  </div>
</template>
