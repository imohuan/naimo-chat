<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from "vue";
import { Trash2, Loader2 } from "lucide-vue-next";
import type { McpToolCall } from "../useMcpToolCalls";
import type { TimeRange } from "../types";
import Popconfirm from "@/components/llm/Popconfirm.vue";
import TimeRangePicker from "./TimeRangePicker.vue";

const props = defineProps<{
  toolCalls: McpToolCall[];
  selectedToolCallId: string | null;
  searchQuery: string;
  timeRange?: TimeRange;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  isRefreshing?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedToolCallId": [id: string | null];
  "update:searchQuery": [query: string];
  "update:timeRange": [range: TimeRange];
  refresh: [];
  "load-more": [];
  delete: [ids: string[]];
}>();

// 多选模式
const isMultiSelectMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const isDeleting = ref(false);
const lastSelectedIndex = ref<number | null>(null);

// 滚动容器引用
const scrollContainer = ref<HTMLElement | null>(null);
let scrollThrottleTimer: number | null = null;

// 用于触发时间更新的响应式变量
const now = ref(Date.now());
let intervalId: number | null = null;

// 全选状态
const isAllSelected = computed(() => {
  return (
    filteredToolCalls.value.length > 0 &&
    filteredToolCalls.value.every((call) => selectedIds.value.has(call.id))
  );
});

const hasSelected = computed(() => selectedIds.value.size > 0);

const filteredToolCalls = computed(() => {
  let filtered = props.toolCalls;

  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase();
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

function toggleSelect(id: string, event?: Event) {
  if (event) {
    event.stopPropagation();
  }
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  if (isMultiSelectMode.value) {
    emit("update:selectedToolCallId", id);
  }
}

function handleItemClick(id: string, index: number, event: MouseEvent) {
  if (!isMultiSelectMode.value) {
    emit("update:selectedToolCallId", id);
    return;
  }

  if (event.shiftKey && lastSelectedIndex.value !== null) {
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    const lastCall = filteredToolCalls.value[lastSelectedIndex.value];
    if (!lastCall) {
      lastSelectedIndex.value = index;
      toggleSelect(id);
      return;
    }
    const isLastSelected = selectedIds.value.has(lastCall.id);

    for (let i = start; i <= end; i++) {
      const call = filteredToolCalls.value[i];
      if (call) {
        if (isLastSelected) {
          selectedIds.value.add(call.id);
        } else {
          selectedIds.value.delete(call.id);
        }
      }
    }
    emit("update:selectedToolCallId", id);
  } else {
    toggleSelect(id);
    lastSelectedIndex.value = index;
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    filteredToolCalls.value.forEach((call) => {
      selectedIds.value.delete(call.id);
    });
  } else {
    filteredToolCalls.value.forEach((call) => {
      selectedIds.value.add(call.id);
    });
  }
}

function invertSelection() {
  filteredToolCalls.value.forEach((call) => {
    if (selectedIds.value.has(call.id)) {
      selectedIds.value.delete(call.id);
    } else {
      selectedIds.value.add(call.id);
    }
  });
}

async function handleDelete() {
  if (!hasSelected.value || isDeleting.value) return;

  const idsToDelete = Array.from(selectedIds.value);
  isDeleting.value = true;

  try {
    emit("delete", idsToDelete);
    selectedIds.value.clear();
  } finally {
    isDeleting.value = false;
  }
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (!target) return;

  if (scrollThrottleTimer !== null) return;

  scrollThrottleTimer = window.setTimeout(() => {
    scrollThrottleTimer = null;
  }, 200);

  const scrollTop = target.scrollTop;
  const scrollHeight = target.scrollHeight;
  const clientHeight = target.clientHeight;
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;

  if (distanceToBottom < 100 && props.hasMore && !props.isLoading) {
    emit("load-more");
  }
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = now.value - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSecs < 10) return "刚刚";
  if (diffSecs < 60) return `${diffSecs}秒前`;
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

onMounted(async () => {
  intervalId = window.setInterval(() => {
    now.value = Date.now();
  }, 60000);

  await nextTick();
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener("scroll", handleScroll);
  }
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  if (scrollThrottleTimer !== null) {
    clearTimeout(scrollThrottleTimer);
  }
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener("scroll", handleScroll);
  }
});
</script>

<template>
  <div class="h-full flex flex-col bg-white border-r border-slate-200">
    <!-- 头部 -->
    <div class="p-4 border-b border-slate-200 bg-slate-50">
      <!-- 搜索框 -->
      <div class="mb-3">
        <input type="text" :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)" placeholder="搜索工具名称、服务器..."
          class="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <!-- 时间范围选择器 -->
      <TimeRangePicker :model-value="timeRange" @update:model-value="emit('update:timeRange', $event)" />

      <!-- 操作栏 -->
      <div v-if="isMultiSelectMode"
        class="h-9 pl-3 flex items-center justify-between border border-slate-200 rounded-md bg-white">
        <div class="flex items-center gap-2 flex-wrap py-1">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll"
              class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
            <span class="text-xs text-slate-600 font-medium">全选</span>
          </label>

          <button @click="invertSelection" type="button"
            class="px-2 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
            反选
          </button>
        </div>
        <Popconfirm v-if="hasSelected" title="删除工具调用日志" :description="`确定要删除选中的 ${selectedIds.size} 条日志吗？此操作不可撤销。`"
          type="danger" confirm-text="删除" @confirm="handleDelete">
          <template #reference="{ toggle }">
            <button @click.stop="toggle" type="button" :disabled="isDeleting"
              class="px-3 py-1 hover:border-red-200 hover:text-red-600 rounded-md transition-all text-xs font-medium flex items-center gap-1.5 h-8 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash2 class="w-3.5 h-3.5" />
              <span>({{ selectedIds.size }})</span>
            </button>
          </template>
        </Popconfirm>
      </div>
    </div>

    <!-- 工具调用列表 -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto relative">
      <!-- 只在首次加载（没有数据）时显示加载状态 -->
      <div v-if="isLoading && toolCalls.length === 0" class="p-8 text-center text-slate-400">
        <p class="text-sm">加载中...</p>
      </div>
      <div v-else-if="filteredToolCalls.length === 0" class="p-8 text-center text-slate-400">
        <p class="text-sm">没有找到匹配的工具调用</p>
      </div>
      <div v-else v-for="(call, index) in filteredToolCalls" :key="call.id"
        @click="handleItemClick(call.id, index, $event)" :class="[
          'p-4 border-b border-slate-100 cursor-pointer transition-all relative',
          selectedToolCallId === call.id
            ? 'bg-indigo-50 border-l-4 border-l-indigo-600 shadow-sm z-10'
            : 'border-l-4 border-l-transparent',
          isMultiSelectMode && selectedIds.has(call.id)
            ? 'bg-indigo-100'
            : 'hover:bg-slate-100',
        ]">
        <!-- 复选框 -->
        <div v-if="isMultiSelectMode" class="absolute left-4 top-4 z-10" @click.stop="toggleSelect(call.id, $event)">
          <input type="checkbox" :checked="selectedIds.has(call.id)" @change="toggleSelect(call.id, $event)" @click.stop
            class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
        </div>

        <!-- 主要内容 -->
        <div :class="isMultiSelectMode ? 'pr-16 pl-8' : 'pr-16'">
          <!-- 工具名称 -->
          <div class="font-mono text-sm font-bold text-slate-800 mb-2 line-clamp-2 wrap-break-word"
            :title="call.toolName">
            {{ call.toolName }}
          </div>

          <!-- 服务器名称 -->
          <div class="text-xs text-slate-600 mb-2 truncate" :title="call.serverName">
            服务器: {{ call.serverName }}
          </div>

          <!-- 标签 -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span :class="[
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium shadow-sm whitespace-nowrap',
              call.success
                ? 'bg-linear-to-r from-green-50 to-green-50/80 text-green-700 border border-green-200/60'
                : 'bg-linear-to-r from-red-50 to-red-50/80 text-red-700 border border-red-200/60',
            ]">
              {{ call.success ? "成功" : "失败" }}
            </span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-linear-to-r from-blue-50 to-blue-50/80 text-blue-700 border border-blue-200/60 shadow-sm whitespace-nowrap">
              {{ formatDuration(call.duration) }}
            </span>
          </div>
        </div>

        <!-- 时间显示 -->
        <div class="absolute bottom-4 right-4">
          <span class="text-xs text-slate-400 font-medium">
            {{ formatRelativeTime(call.timestamp) }}
          </span>
        </div>
      </div>

      <!-- 加载更多 -->
      <div v-if="isLoadingMore" class="p-4 text-center border-t border-slate-200 bg-slate-50">
        <div class="flex items-center justify-center gap-2 text-slate-500">
          <Loader2 class="w-4 h-4 animate-spin" />
          <span class="text-xs font-medium">加载更多...</span>
        </div>
      </div>

      <!-- 没有更多 -->
      <div v-else-if="!hasMore && filteredToolCalls.length > 0"
        class="p-4 text-center border-t border-slate-200 bg-slate-50">
        <span class="text-xs text-slate-400">没有更多数据了</span>
      </div>
    </div>
  </div>
</template>
