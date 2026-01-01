<script setup lang="ts">
import { computed, ref, useTemplateRef, watch, onUnmounted, onMounted } from "vue";
import { useIntersectionObserver, useDebounceFn } from "@vueuse/core";
import {
  VisibilityOutlined,
  CodeOutlined,
  ListOutlined,
  KeyboardArrowDownOutlined,
} from "@vicons/material";
import CodeEditor from "@/components/code/CodeEditor.vue";
import PreviewMessageItem from "./PreviewMessageItem.vue";
import MCPPreview from "./MCPPreview.vue";
import type { LogRequest, LogChatMessage } from "../types";
import { useCharLoading } from "@/hooks/useCharLoading";

const props = defineProps<{
  request: LogRequest | null;
}>();

const activeTab = ref<"preview" | "timeline" | "raw">("preview");
const showMCPPreview = ref(false);
const rawJson = computed(() => formatJson(props.request || {}));

// 时间轴日志源：包含原始日志 + responseFull 中的每一项
const logsSource = computed(() => {
  const baseLogs = props.request?.logs || [];
  const responseFull = props.request?.responseFull;

  // 如果没有 responseFull，直接返回原始日志
  if (!responseFull || !Array.isArray(responseFull) || responseFull.length === 0) {
    return baseLogs;
  }

  // 合并原始日志和 responseFull 中的每一项
  const allLogs = [...baseLogs];

  // 计算基础时间（使用最后一个日志的时间，或者使用请求开始时间）
  const lastLog = baseLogs.length > 0 ? baseLogs[baseLogs.length - 1] : undefined;
  const baseTime =
    lastLog && typeof lastLog.time === "number"
      ? lastLog.time
      : props.request?.startTime ?? Date.now();

  // 将 responseFull 中的每一项转换为日志项
  if (responseFull && Array.isArray(responseFull)) {
    responseFull.forEach((event, index) => {
      allLogs.push({
        type: "stream_event",
        time: baseTime + (index + 1) * 10, // 每个事件间隔 10ms，保持时间顺序
        level: 30,
        msg: `Stream Event: ${event?.type || "unknown"}`,
        data: event,
      });
    });
  }

  // 按时间排序
  return allLogs.sort((a, b) => a.time - b.time);
});

// 过滤后的消息源，排除空内容
const messagesSource = computed(() => {
  if (!props.request || !isChatRequest(props.request)) return [];

  const messages = getChatMessages(props.request);
  return messages.filter((msg) => {
    if (Array.isArray(msg.content)) {
      return msg.content.some((part) => {
        // Check for text content
        if (part.type === "text" && part.text && part.text.trim()) {
          return true;
        }
        // Check for tool_use content
        if (part.type === "tool_use") {
          return true; // tool_use is always meaningful content
        }
        // Check for tool_result content
        if (part.type === "tool_result") {
          return true; // tool_result is always meaningful content
        }
        // Check for other content types
        return part && Object.keys(part).length > 0;
      });
    }
    return msg.content && msg.content.trim();
  });
});

// 获取所有显示项（消息 + Full Response + Error）
const allDisplayItems = computed(() => {
  if (!props.request || !isChatRequest(props.request)) return [];

  const items: Array<{
    type: "message" | "full_response" | "error";
    data: any;
  }> = [];

  // 添加消息
  messagesSource.value.forEach((msg) => {
    items.push({
      type: "message",
      data: msg,
    });
  });

  // 添加 Full Response 和 Error 日志
  const logs = props.request.logs || [];
  logs.forEach((log) => {
    if (log.type === "full_response") {
      items.push({
        type: "full_response",
        data: log,
      });
    } else if (log.type === "error") {
      items.push({
        type: "error",
        data: log,
      });
    }
  });

  return items;
});

// 使用字符加载hooks - 时间轴
const timelineLoading = useCharLoading(
  logsSource,
  (log) => {
    return JSON.stringify(log).length;
  },
  {
    initialChars: 1000,
    loadMoreChars: 1000,
  }
);

const messageContainerRef = useTemplateRef<HTMLElement>("messageContainerRef");
const timelineContainerRef = useTemplateRef<HTMLElement>("timelineContainerRef");
const messageLoadTriggerRef = useTemplateRef<HTMLElement>("messageLoadTriggerRef");
const timelineLoadTriggerRef = useTemplateRef<HTMLElement>("timelineLoadTriggerRef");

// 使用字符加载hooks - 所有显示项
const messageLoading = useCharLoading(
  allDisplayItems,
  (item) => {
    if (item.type === "message") {
      const message = item.data;
      if (Array.isArray(message.content)) {
        // Count actual content length, including tool and image content
        return message.content.reduce((total: number, part: any) => {
          if (part.type === "text") {
            return total + String(part.text || "").length;
          } else if (part.type === "tool_use") {
            return (
              total +
              String(part.name || "").length +
              JSON.stringify(part.input || {}).length
            );
          } else if (part.type === "tool_result") {
            return total + String(part.content || "").length;
          } else if (part.type === "image") {
            // Images have a fixed character count for loading purposes
            return total + 200; // Treat images as 200 characters for loading calculation
          }
          return total + JSON.stringify(part).length;
        }, 0);
      }
      return String(message.content || "").length;
    } else if (item.type === "full_response") {
      return JSON.stringify(item.data.data?.content || "").length;
    } else if (item.type === "error") {
      return JSON.stringify(item.data.err || "").length;
    }
    return 0;
  },
  {
    initialChars: 5000,
    loadMoreChars: 5000,
  }
);

// Debounce 加载更多函数
const debouncedTimelineLoadMore = useDebounceFn(() => {
  if (timelineLoading.hasMore.value && !timelineLoading.isLoading.value) {
    timelineLoading.loadMore();
  }
}, 66);

const debouncedMessageLoadMore = useDebounceFn(() => {
  if (messageLoading.hasMore.value && !messageLoading.isLoading.value) {
    messageLoading.loadMore();
  }
}, 66);

// 设置底部触发器的可见性监听
const { stop: stopTimelineObserver } = useIntersectionObserver(
  timelineLoadTriggerRef,
  ([entry]) => {
    const isIntersecting = entry?.isIntersecting;
    if (isIntersecting) {
      debouncedTimelineLoadMore();
    }
  },
  {
    threshold: 0.1,
    rootMargin: "50px",
  }
);

const { stop: stopMessageObserver } = useIntersectionObserver(
  messageLoadTriggerRef,
  ([entry]) => {
    const isIntersecting = entry?.isIntersecting;
    if (isIntersecting) {
      debouncedMessageLoadMore();
    }
  },
  {
    threshold: 0.1,
    rootMargin: "50px",
  }
);

// 请求变化时重置加载状态
watch(
  () => props.request,
  () => {
    timelineLoading.reset();
    messageLoading.reset();

    // 自动折叠超过阈值的内容
    collapsedItems.value.clear();
    if (props.request && isChatRequest(props.request)) {
      const items = allDisplayItems.value;
      items.forEach((item) => {
        if (shouldAutoCollapse(item)) {
          const itemId = `${item.type}-${
            item.data.time || item.data.role || Math.random()
          }`;
          collapsedItems.value.add(itemId);
        }
      });
    }

    // 自动折叠时间轴中超过阈值的内容
    if (props.request) {
      const logs = props.request.logs || [];
      logs.forEach((log, index) => {
        if (shouldAutoCollapseTimeline(log)) {
          const logId = getTimelineLogId(log, index);
          collapsedItems.value.add(logId);
        }
      });
    }

    messageContainerRef.value?.scrollTo({ top: 0, behavior: "instant" });
    timelineContainerRef.value?.scrollTo({ top: 0, behavior: "instant" });
  }
);

// 获取可见项目
const visibleLogs = computed(() => timelineLoading.visibleItems.value);
const visibleItems = computed(() => messageLoading.visibleItems.value);

const previewEnabled = computed(() => {
  const req = props.request;
  if (!req) return false;
  if (!isChatRequest(req)) return false;
  const hasMessages = getChatMessages(req).length > 0;
  const hasResponse = req.logs.some((log) => log.type === "full_response");
  const hasError = req.logs.some((log) => log.type === "error");
  return hasMessages || hasResponse || hasError;
});

watch(
  () => props.request,
  (req) => {
    if (!req) {
      activeTab.value = "timeline";
      return;
    }
    if (previewEnabled.value) {
      activeTab.value = "preview";
      return;
    }
    if (activeTab.value === "preview") {
      activeTab.value = "timeline";
    }
  },
  { immediate: true }
);

function formatTimeLong(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatTimeDetail(ts: number): string {
  const d = new Date(ts);
  return `${d
    .getHours()
    .toString()
    .padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d
    .getSeconds()
    .toString()
    .padStart(2, "0")}.${d.getMilliseconds().toString().padStart(3, "0")}`;
}

function computeTimeDelta(logs: any[], idx: number): number {
  if (!Array.isArray(logs) || idx <= 0) return 0;
  const prev = logs[idx - 1];
  const curr = logs[idx];
  if (!prev || !curr) return 0;
  if (typeof curr.time !== "number" || typeof prev.time !== "number") return 0;
  return curr.time - prev.time;
}

function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

function isChatRequest(req: LogRequest | null): boolean {
  return (
    !!req && (req.url.includes("/messages") || req.url.includes("/chat/completions"))
  );
}

function getChatMessages(req: LogRequest): LogChatMessage[] {
  if (!req) return [];
  const bodyLog = req.logs.find(
    (l) => l.type === "request body" && l.data && l.data.messages
  );

  let messages: LogChatMessage[] = [];

  if (bodyLog) {
    messages = [...bodyLog.data.messages];
    if (bodyLog.data.system) {
      messages.unshift({
        role: "system",
        content: bodyLog.data.system,
      });
    }
  } else {
    const finalReqLog = req.logs.find((l) => l.request && l.request.body);
    if (finalReqLog) {
      try {
        const parsedBody = JSON.parse(finalReqLog.request.body);
        if (parsedBody.messages) messages = parsedBody.messages;
      } catch (e) {
        // ignore
      }
    }
  }

  return messages;
}

// 提取所有工具列表
const allTools = computed(() => {
  if (!props.request) return [];

  // 首先从 request body 日志中查找
  const bodyLog = props.request.logs.find((l) => l.type === "request body" && l.data);

  if (bodyLog && bodyLog.data.tools && Array.isArray(bodyLog.data.tools)) {
    return bodyLog.data.tools;
  }

  // 如果没有找到，尝试从其他日志中查找原始请求体
  const finalReqLog = props.request.logs.find((l) => l.request && l.request.body);
  if (finalReqLog) {
    try {
      const parsedBody =
        typeof finalReqLog.request.body === "string"
          ? JSON.parse(finalReqLog.request.body)
          : finalReqLog.request.body;
      if (parsedBody.tools && Array.isArray(parsedBody.tools)) {
        return parsedBody.tools;
      }
    } catch (e) {
      // ignore
    }
  }

  return [];
});

// 提取 MCP 工具列表（仅以 mcp__ 开头的工具）
const mcpTools = computed(() => {
  return allTools.value.filter((tool: any) => tool.name && tool.name.startsWith("mcp__"));
});

function getLevelColor(level: number): string {
  if (level === 30) return "bg-blue-500";
  if (level === 40) return "bg-yellow-500";
  if (level >= 50) return "bg-red-500";
  return "bg-slate-400";
}

// 处理长内容折叠
const collapsedItems = ref(new Set<string>());

// 复制成功状态管理
const copySuccessStates = ref(new Map<string, boolean>());

// 换行状态管理（每个 item 独立管理）
const wordWrapStates = ref(new Map<string, boolean>());

// 获取或设置 item 的换行状态
function getWordWrap(itemId: string): boolean {
  return wordWrapStates.value.get(itemId) ?? false; // 默认关闭换行
}

function toggleWordWrap(itemId: string) {
  const current = getWordWrap(itemId);
  wordWrapStates.value.set(itemId, !current);
}

function getItemId(item: any): string {
  return `${item.type}-${item.data.time || item.data.role || Math.random()}`;
}

function toggleCollapse(id: string) {
  const newSet = new Set(collapsedItems.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  collapsedItems.value = newSet;
}

function isCollapsed(id: string): boolean {
  return collapsedItems.value.has(id);
}

function getItemContent(item: any): string {
  if (item.type === "message") {
    const message = item.data;
    if (Array.isArray(message.content)) {
      return message.content
        .map((part: any) => {
          if (part.type === "text") {
            return part.text || "";
          } else if (part.type === "tool_use") {
            return `[Tool: ${part.name || "Unknown"}] ${
              part.input ? JSON.stringify(part.input) : ""
            }`;
          } else if (part.type === "tool_result") {
            return `[Tool Result] ${
              part.content
                ? Array.isArray(part.content)
                  ? part.content.join("\n")
                  : part.content
                : ""
            }`;
          } else if (part.type === "image") {
            return `[Image: ${part.alt || "Generated image"}] ${
              part.detail ? `(${part.detail})` : ""
            }`;
          }
          return `[${part.type}] ${JSON.stringify(part)}`;
        })
        .join("");
    }
    return message.content || "";
  } else if (item.type === "full_response") {
    return item.data.data?.content || "";
  } else if (item.type === "error") {
    return JSON.stringify(item.data.err || "");
  }
  return "";
}

const showCollapseNum = 1000;
const showAutoCollapseNum = 1000;

function shouldShowCollapse(item: any): boolean {
  const content = getItemContent(item);
  return content.length > showCollapseNum; // 超过500字符显示折叠按钮
}

function shouldAutoCollapse(item: any): boolean {
  const content = getItemContent(item);
  return content.length > showAutoCollapseNum; // 超过5000字符自动折叠
}

function getDisplayContent(item: any): string {
  const content = getItemContent(item);

  if (!shouldShowCollapse(item)) {
    return content.trim();
  }

  const itemId = `${item.type}-${item.data.time || item.data.role || Math.random()}`;
  if (!isCollapsed(itemId)) {
    return content.trim();
  }

  return content.trim().substring(0, showAutoCollapseNum) + "...";
}

function getCollapsedCharCount(item: any): number {
  const content = getItemContent(item);
  if (content.length <= showCollapseNum) return 0;
  return content.length - showCollapseNum;
}

// 时间轴相关函数
function getLogContent(log: any): string {
  if (log.type === "full_response" && log.data?.content) {
    return String(log.data.content || "").trim();
  } else if (log.type === "stream_event" && log.data) {
    // 处理 stream_event 类型（response.full 中的每一项）
    return formatJson(log.data).trim();
  } else if (log.type === "error" && log.err) {
    return formatJson(log.err).trim();
  } else {
    // 组合所有数据
    const parts: string[] = [];
    if (log.data && log.type !== "recieved data") {
      parts.push(formatJson(log.data).trim());
    }
    if (log.req) {
      parts.push(formatJson(log.req).trim());
    }
    if (log.request) {
      parts.push(formatJson(log.request).trim());
    }
    if (log.response && !log.data) {
      parts.push(formatJson(log.response).trim());
    }
    if (log.err) {
      parts.push(formatJson(log.err).trim());
    }
    return parts.join("\n\n");
  }
}

function shouldShowTimelineCollapse(log: any): boolean {
  const content = getLogContent(log);
  return content.length > showCollapseNum;
}

function shouldAutoCollapseTimeline(log: any): boolean {
  const content = getLogContent(log);
  return content.length > showAutoCollapseNum;
}

function getTimelineCollapsedCharCount(log: any): number {
  const content = getLogContent(log);
  if (content.length <= showCollapseNum) return 0;
  return content.length - showCollapseNum;
}

function getTimelineLogId(log: any, index: number): string {
  return `timeline-${log.time || index || Math.random()}`;
}

// 复制对象数据到剪贴板
async function copyItemData(item: any) {
  const itemId = `${item.type}-${item.data.time || item.data.role || Math.random()}`;

  try {
    const dataToCopy = {
      type: item.type,
      data: item.data,
      // 添加一些额外的上下文信息
      context: {
        requestId: props.request?.id,
        timestamp: item.data.time || Date.now(),
      },
    };

    await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));

    // 设置复制成功状态
    copySuccessStates.value.set(itemId, true);

    // 3秒后恢复原状态
    setTimeout(() => {
      copySuccessStates.value.delete(itemId);
    }, 3000);
  } catch (err) {
    console.error("Failed to copy:", err);
    // 降级方案：使用传统的复制方法
    const textArea = document.createElement("textarea");
    textArea.value = JSON.stringify(
      {
        type: item.type,
        data: item.data,
        context: {
          requestId: props.request?.id,
          timestamp: item.data.time || Date.now(),
        },
      },
      null,
      2
    );
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);

    // 即使降级成功也显示成功状态
    copySuccessStates.value.set(itemId, true);
    setTimeout(() => {
      copySuccessStates.value.delete(itemId);
    }, 3000);
  }
}

// 检查是否显示复制成功状态
function isCopySuccess(itemId: string): boolean {
  return copySuccessStates.value.get(itemId) || false;
}

// 检查是否是 TodoWrite tool_use
function isTodoWrite(toolData: any): boolean {
  return toolData?.name === "TodoWrite" && toolData?.input?.todos;
}

// 转换 TodoWrite 的 todos 格式为 QueueTodo 格式
function convertTodosToQueueFormat(
  todos: any[]
): Array<{
  id: string;
  title: string;
  description?: string;
  status?: "pending" | "completed";
}> {
  return todos.map((todo, index) => ({
    id: todo.id || `todo-${index}`,
    title: todo.content || "",
    description: todo.activeForm || undefined,
    status: todo.status === "completed" ? "completed" : "pending",
  }));
}

// 组件卸载时清理观察器
onUnmounted(() => {
  stopTimelineObserver();
  stopMessageObserver();
});

// 添加键盘事件监听器
let handleKeyDown: (e: KeyboardEvent) => void;

onMounted(() => {
  handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      // 关闭所有打开的图片预览
      const openPreviews = document.querySelectorAll('[data-preview-open="true"]');
      openPreviews.forEach((preview) => {
        (preview as any).closePreview?.();
      });
    }
  };
  document.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  if (handleKeyDown) {
    document.removeEventListener("keydown", handleKeyDown);
  }
});

// 加载全部内容并滚动到底部
async function loadAllAndScrollToBottom() {
  const currentLoading = activeTab.value === "preview" ? messageLoading : timelineLoading;
  const currentContainer =
    activeTab.value === "preview"
      ? messageContainerRef.value
      : timelineContainerRef.value;
  const currentSource =
    activeTab.value === "preview" ? allDisplayItems.value : logsSource.value;

  // 直接设置 lastIndex 为数组长度，一次性加载所有内容
  if (currentLoading.lastIndex.value < currentSource.length) {
    currentLoading.lastIndex.value = currentSource.length;
  }

  // 等待 DOM 更新后滚动到底部
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (currentContainer) {
    currentContainer.scrollTo({
      top: currentContainer.scrollHeight,
      behavior: "smooth",
    });
  }
}
</script>

<template>
  <div v-if="request" class="w-full h-full flex flex-col bg-slate-50">
    <!-- 请求头部 -->
    <div class="bg-white p-4 border-b border-slate-200 shadow-sm">
      <div class="flex justify-between items-start">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 mb-2">
            <span
              class="px-3 py-1 rounded-md text-sm font-bold"
              :class="
                request.method === 'GET'
                  ? 'bg-blue-100 text-blue-700'
                  : request.method === 'POST'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700'
              "
              >{{ request.method }}</span
            >
            <span
              class="max-w-[200px] truncate text-base text-blue-700 underline break-all font-mono"
              >{{ request.url }}</span
            >
            <span
              v-if="request.status"
              class="px-2 py-1 rounded text-xs font-bold"
              :class="
                request.status === 200
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-red-100 text-red-700 border border-red-300'
              "
            >
              {{ request.status }}
            </span>

            <!-- Model Info -->
            <div v-if="request.model" class="flex justify-center">
              <span
                class="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-1 rounded text-xs font-mono shadow-sm"
              >
                <span class="font-bold">{{ request.model }}</span>
              </span>
            </div>
          </div>
          <div class="flex gap-6 text-xs text-slate-500 font-mono">
            <span>Start: {{ formatTimeLong(request.startTime) }}</span>
            <span v-if="request.duration"
              >Duration: {{ request.duration.toFixed(2) }}ms</span
            >
            <span>{{ request.id }}</span>
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <button
            @click="activeTab = 'preview'"
            :disabled="!previewEnabled"
            :class="[
              'px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 border border-slate-200',
              !previewEnabled
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : activeTab === 'preview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50',
            ]"
          >
            <VisibilityOutlined class="w-4 h-4" /> 预览
          </button>
          <!-- Tools 标签 -->
          <button
            v-if="allTools.length > 0"
            @click="showMCPPreview = true"
            class="bg-purple-50 border border-purple-200 text-purple-700 px-3 py-1.5 rounded-md text-xs font-mono shadow-sm hover:bg-purple-100 hover:border-purple-300 transition-colors cursor-pointer"
            :title="`点击查看 ${allTools.length} 个工具详情 (${mcpTools.length} 个 MCP 工具)`"
          >
            Tools: <span class="font-bold">{{ allTools.length }}</span>
            <span v-if="mcpTools.length > 0" class="ml-1 opacity-70"
              >({{ mcpTools.length }} MCP)</span
            >
          </button>
          <button
            @click="activeTab = 'timeline'"
            :class="[
              'px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 border border-slate-200',
              activeTab === 'timeline'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50',
            ]"
          >
            <ListOutlined class="w-4 h-4" /> 时间轴
          </button>
          <button
            @click="activeTab = 'raw'"
            :class="[
              'px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 border border-slate-200',
              activeTab === 'raw'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50',
            ]"
          >
            <CodeOutlined class="w-4 h-4" /> 原始数据
          </button>
        </div>
      </div>
    </div>

    <!-- Tab 内容 -->
    <div class="flex-1 overflow-hidden relative">
      <!-- 加载全部并滚动到底部按钮 -->
      <button
        v-if="activeTab === 'preview' || activeTab === 'timeline'"
        @click="loadAllAndScrollToBottom"
        class="fixed right-12 bottom-8 z-50 w-8 h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        title="加载全部内容并滚动到底部"
      >
        <KeyboardArrowDownOutlined class="w-6 h-6" />
      </button>
      <!-- 预览 Tab -->
      <div v-if="activeTab === 'preview'" class="w-full h-full p-6 pr-2">
        <div v-if="!isChatRequest(request)" class="text-center py-20 text-slate-400">
          <p class="text-lg">此请求不是聊天补全请求，无法预览对话。</p>
          <p class="text-sm mt-2">请切换到"时间轴"或"原始数据"查看详情。</p>
        </div>

        <div v-else class="h-full flex flex-col">
          <!-- Messages (lazy loaded) -->
          <div ref="messageContainerRef" class="flex-1 overflow-y-auto">
            <div>
              <template v-for="(item, index) in visibleItems" :key="index">
                <PreviewMessageItem
                  :item="item"
                  :should-show-collapse="shouldShowCollapse(item)"
                  :is-collapsed="isCollapsed(getItemId(item))"
                  :collapsed-char-count="getCollapsedCharCount(item)"
                  :is-copy-success="isCopySuccess(getItemId(item))"
                  :word-wrap="getWordWrap(getItemId(item))"
                  :format-json="formatJson"
                  :get-display-content="getDisplayContent"
                  :is-todo-write="isTodoWrite"
                  :convert-todos-to-queue-format="convertTodosToQueueFormat"
                  @toggle-collapse="toggleCollapse(getItemId(item))"
                  @copy-item="copyItemData(item)"
                  @toggle-word-wrap="toggleWordWrap(getItemId(item))"
                />
              </template>
            </div>

            <!-- Load More Trigger for Messages -->
            <div
              ref="messageLoadTriggerRef"
              v-if="messageLoading.hasMore.value"
              class="w-full h-1 flex items-center justify-center py-2"
            >
              <div
                v-if="messageLoading.isLoading.value"
                class="text-xs text-slate-400 animate-pulse"
              >
                Loading more...
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 时间轴 Tab -->
      <div
        v-if="activeTab === 'timeline'"
        ref="timelineContainerRef"
        class="h-full overflow-y-auto overflow-x-hidden p-6 py-0 my-6 mr-2"
      >
        <div class="max-w-5xl mx-auto">
          <div
            v-for="(log, index) in visibleLogs"
            :key="index"
            class="flex gap-4 group mb-4 last:mb-0"
          >
            <!-- Time Column -->
            <div class="flex flex-col items-end w-24 shrink-0 pt-1">
              <span class="text-xs text-slate-500 font-mono">{{
                formatTimeDetail(log.time)
              }}</span>
              <span class="text-[10px] text-slate-400 font-mono">
                +{{ computeTimeDelta(logsSource, index) }}ms
              </span>
            </div>

            <!-- Dot & Line -->
            <div class="relative flex flex-col items-center">
              <div
                class="w-3 h-3 rounded-full border-2 border-white shadow-sm z-10"
                :class="getLevelColor(log.level || 30)"
              ></div>
              <div
                v-if="index !== (logsSource.length || 0) - 1"
                class="w-0.5 bg-slate-200 h-full absolute top-3"
              ></div>
            </div>

            <!-- Content -->
            <div class="pb-6 flex-1 min-w-0 max-w-full">
              <div
                class="bg-white rounded-lg px-4 pt-4 pb-2 border border-slate-200 group-hover:border-slate-300 transition-all shadow-sm flex flex-col w-full"
              >
                <div class="flex justify-between items-start mb-1">
                  <span class="text-xs font-bold text-indigo-600" v-if="log.msg">{{
                    log.msg
                  }}</span>
                  <span class="text-xs font-bold text-slate-500" v-else>Log Entry</span>
                  <span
                    class="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded"
                    >Level {{ log.level }}</span
                  >
                </div>

                <!-- Structured Data Preview -->
                <div
                  v-if="
                    log.type === 'stream_event' ||
                    log.type === 'full_response' ||
                    log.type === 'error' ||
                    log.data ||
                    log.request ||
                    log.response ||
                    log.req ||
                    log.res ||
                    log.err
                  "
                  class="mt-2 text-xs font-mono bg-slate-50 p-3 rounded border border-slate-100 overflow-x-auto overflow-y-visible text-slate-600 flex flex-col relative wrap-break-word"
                >
                  <!-- Full Response Log -->
                  <div v-if="log.type === 'full_response' && log.data?.content">
                    <span class="text-green-600 font-bold mb-1 flex items-center gap-2">
                      <AutoAwesomeOutlined class="w-4 h-4" />
                      > Full Response:
                    </span>
                    <div
                      class="bg-white border border-green-200 p-3 rounded mt-2 relative overflow-hidden shadow-sm"
                    >
                      <div class="absolute top-0 left-0 w-1 h-full bg-green-600"></div>
                      <pre
                        class="text-slate-800 whitespace-pre-wrap wrap-break-word select-text overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? (log.data.content?.trim() || "").substring(
                                0,
                                showAutoCollapseNum
                              ) + "..."
                            : log.data.content?.trim() || ""
                        }}</pre
                      >
                      <div class="text-xs text-slate-500 mt-2 text-right">
                        Length: {{ log.data.content.length }} chars
                        <span v-if="log.data.model" class="ml-2"
                          >Model: {{ log.data.model }}</span
                        >
                      </div>
                    </div>
                  </div>

                  <!-- Stream Event Log (response.full 中的每一项) -->
                  <div v-else-if="log.type === 'stream_event'">
                    <span class="text-cyan-600 font-bold mb-1 flex items-center gap-2">
                      <AutoAwesomeOutlined class="w-4 h-4" />
                      > Stream Event: {{ log.data?.type || "unknown" }}
                    </span>
                    <div
                      class="bg-cyan-50 border border-cyan-200 p-3 rounded mt-2 relative overflow-hidden shadow-sm"
                    >
                      <div class="absolute top-0 left-0 w-1 h-full bg-cyan-600"></div>
                      <pre
                        class="text-slate-800 whitespace-pre-wrap wrap-break-word select-text pl-2 overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? formatJson(log.data)
                                .trim()
                                .substring(0, showAutoCollapseNum) + "..."
                            : formatJson(log.data).trim()
                        }}</pre
                      >
                    </div>
                  </div>

                  <!-- Error Log -->
                  <div v-else-if="log.type === 'error'">
                    <span class="text-red-600 font-bold mb-1 flex items-center gap-2">
                      <WarningOutlined class="w-4 h-4" />
                      > Error:
                    </span>
                    <div class="bg-red-50 border border-red-200 p-3 rounded mt-2">
                      <pre
                        class="text-red-600 select-text whitespace-pre-wrap wrap-break-word overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? formatJson(log.err)
                                .trim()
                                .substring(0, showAutoCollapseNum) + "..."
                            : formatJson(log.err).trim()
                        }}</pre
                      >
                    </div>
                  </div>

                  <!-- Other logs -->
                  <template v-else>
                    <div v-if="log.data && log.type !== 'recieved data'">
                      <span class="text-blue-600 font-bold block mb-1"
                        >> Payload Data:</span
                      >
                      <pre
                        class="text-slate-700 whitespace-pre-wrap wrap-break-word overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? formatJson(log.data)
                                .trim()
                                .substring(0, showAutoCollapseNum) + "..."
                            : formatJson(log.data).trim()
                        }}</pre
                      >
                    </div>
                    <div v-if="log.req">
                      <span class="text-purple-600 font-bold block mb-1"
                        >> Request Info:</span
                      >
                      <pre
                        class="text-slate-700 whitespace-pre-wrap wrap-break-word overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? formatJson(log.req)
                                .trim()
                                .substring(0, showAutoCollapseNum) + "..."
                            : formatJson(log.req).trim()
                        }}</pre
                      >
                    </div>
                    <div v-if="log.request">
                      <span class="text-purple-600 font-bold block mb-1"
                        >> Outbound Request:</span
                      >
                      <pre
                        class="text-slate-700 whitespace-pre-wrap wrap-break-word overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? formatJson(log.request)
                                .trim()
                                .substring(0, showAutoCollapseNum) + "..."
                            : formatJson(log.request).trim()
                        }}</pre
                      >
                    </div>
                    <div v-if="log.response && !log.data">
                      <span class="text-green-600 font-bold block mb-1"
                        >> Response Info:</span
                      >
                      <pre
                        class="text-slate-700 whitespace-pre-wrap wrap-break-word overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? formatJson(log.response)
                                .trim()
                                .substring(0, showAutoCollapseNum) + "..."
                            : formatJson(log.response).trim()
                        }}</pre
                      >
                    </div>
                    <div v-if="log.type === 'recieved data'" class="opacity-70">
                      <span class="text-teal-600 font-bold">> Stream Chunk Received</span>
                    </div>
                    <div v-if="log.err">
                      <span class="text-red-600 font-bold block mb-1"
                        >> Error Trace:</span
                      >
                      <pre
                        class="text-red-600 whitespace-pre-wrap wrap-break-word overflow-x-auto"
                        >{{
                          shouldShowTimelineCollapse(log) &&
                          isCollapsed(getTimelineLogId(log, index))
                            ? formatJson(log.err)
                                .trim()
                                .substring(0, showAutoCollapseNum) + "..."
                            : formatJson(log.err).trim()
                        }}</pre
                      >
                    </div>
                  </template>
                </div>

                <!-- 时间轴折叠展开按钮 -->
                <div
                  v-if="shouldShowTimelineCollapse(log)"
                  class="sticky bottom-0 flex items-center justify-end gap-1 pt-2 pb-1 mt-2 border-t border-slate-200 bg-white"
                >
                  <button
                    @click="toggleCollapse(getTimelineLogId(log, index))"
                    class="text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors duration-200 hover:bg-slate-100 text-slate-600"
                  >
                    <KeyboardArrowDownOutlined
                      v-if="isCollapsed(getTimelineLogId(log, index))"
                      class="w-3.5 h-3.5"
                    />
                    <KeyboardArrowDownOutlined v-else class="w-3.5 h-3.5 rotate-180" />
                    <span v-if="isCollapsed(getTimelineLogId(log, index))">
                      展开 ({{ getTimelineCollapsedCharCount(log) }} 字符)
                    </span>
                    <span v-else>折叠</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Load More Trigger for Timeline -->
          <div
            ref="timelineLoadTriggerRef"
            v-if="timelineLoading.hasMore.value"
            class="w-full h-1 flex items-center justify-center py-2"
          >
            <div
              v-if="timelineLoading.isLoading.value"
              class="text-xs text-slate-400 animate-pulse"
            >
              Loading more...
            </div>
          </div>
        </div>
      </div>

      <!-- 原始数据 Tab -->
      <div v-if="activeTab === 'raw'" class="w-full h-full p-6">
        <div class="max-w-8xl h-full mx-auto">
          <CodeEditor
            class="bg-white p-4 rounded-lg border border-slate-200 shadow-sm h-full"
            :model-value="rawJson"
            language="json"
            :readonly="true"
            :options="{
              wordWrap: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- 占位符 -->
  <div
    v-else
    class="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400"
  >
    <p class="text-xl font-semibold mb-2">选择一个请求查看详情</p>
    <p class="text-sm max-w-md text-center">
      左侧列表展示了所有捕获的请求。点击任意条目可以查看时间轴、对话还原及原始日志数据。
    </p>
  </div>

  <!-- MCP 预览组件 -->
  <MCPPreview
    :show="showMCPPreview"
    :request="request"
    @update:show="showMCPPreview = $event"
  />
</template>
