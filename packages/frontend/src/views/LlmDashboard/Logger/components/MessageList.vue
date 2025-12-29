<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import type { MessageListItem, TimeRange } from "../types";
import TimeRangePicker from "./TimeRangePicker.vue";

const props = defineProps<{
  messages: MessageListItem[];
  selectedMessageId: string | null;
  searchQuery: string;
  filterTag: "all" | "completed" | "pending" | "error";
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedMessageId": [id: string];
  "update:filterTag": [tag: "all" | "completed" | "pending" | "error"];
  "update:searchQuery": [query: string];
}>();

// 时间范围选择
const timeRange = ref<TimeRange>({ start: null, end: null });

// 用于触发时间更新的响应式变量
const now = ref(Date.now());

// 定时更新当前时间，使相对时间能够实时更新
let intervalId: number | null = null;
onMounted(() => {
  intervalId = window.setInterval(() => {
    now.value = Date.now();
  }, 60000); // 每分钟更新一次
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});

const filteredMessages = computed(() => {
  let filtered = props.messages;

  // 搜索过滤
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase();
    filtered = filtered.filter((msg) => {
      return (
        msg.requestId.toLowerCase().includes(q) ||
        (msg.model && msg.model.toLowerCase().includes(q)) ||
        (msg.timestamp && msg.timestamp.toLowerCase().includes(q))
      );
    });
  }

  // 时间范围过滤
  if (timeRange.value.start || timeRange.value.end) {
    filtered = filtered.filter((msg) => {
      if (!msg.timestamp) return false;

      try {
        const msgTime = new Date(msg.timestamp).getTime();
        if (isNaN(msgTime)) return false;

        const startTime = timeRange.value.start?.getTime() ?? null;
        const endTime = timeRange.value.end?.getTime() ?? null;

        // 如果有开始时间，消息时间必须 >= 开始时间
        if (startTime !== null && msgTime < startTime) {
          return false;
        }

        // 如果有结束时间，消息时间必须 <= 结束时间
        if (endTime !== null && msgTime > endTime) {
          return false;
        }

        return true;
      } catch {
        return false;
      }
    });
  }

  // TODO: 根据实际数据结构实现标签过滤
  // if (props.filterTag !== "all") {
  //   filtered = filtered.filter((msg) => {
  //     // 根据消息内容判断类型
  //   });
  // }

  return filtered;
});

// 格式化相对时间
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";

    const diffMs = now.value - date.getTime();
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
  } catch {
    return "";
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white border-r border-slate-200">
    <!-- 头部 -->
    <div class="p-4 border-b border-slate-200 bg-slate-50">
      <!-- 时间范围选择器 -->
      <div class="mb-3">
        <TimeRangePicker v-model="timeRange" />
      </div>

      <!-- 标签过滤器 -->
      <div class="flex gap-1 flex-wrap">
        <button
          @click="emit('update:filterTag', 'all')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          全部 ({{ filteredMessages.length }})
        </button>
        <button
          @click="emit('update:filterTag', 'completed')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'completed'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          已完成
        </button>
        <button
          @click="emit('update:filterTag', 'pending')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'pending'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          未完成
        </button>
        <button
          @click="emit('update:filterTag', 'error')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'error'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          错误
        </button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="flex-1 overflow-y-auto relative">
      <div v-if="isLoading" class="p-8 text-center text-slate-400">
        <p class="text-sm">加载中...</p>
      </div>
      <div
        v-else-if="filteredMessages.length === 0"
        class="p-8 text-center text-slate-400"
      >
        <p class="text-sm">没有找到匹配的对话</p>
      </div>
      <div
        v-else
        v-for="msg in filteredMessages"
        :key="msg.requestId"
        @click="emit('update:selectedMessageId', msg.requestId)"
        :class="[
          'p-4 border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50/80 relative',
          selectedMessageId === msg.requestId
            ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600 shadow-sm'
            : 'border-l-4 border-l-transparent',
        ]"
      >
        <!-- 主要内容区域 -->
        <div class="pr-16">
          <!-- 模型名称（主标题） -->
          <div
            v-if="msg.model"
            class="font-mono text-sm font-bold text-slate-800 mb-2 line-clamp-2 break-words"
            :title="msg.model"
          >
            {{ msg.model }}
          </div>

          <!-- Request ID（可选显示） -->
          <div
            v-if="msg.requestId"
            class="text-xs font-mono text-slate-500 mb-2 truncate"
            :title="msg.requestId"
          >
            {{ msg.requestId }}
          </div>

          <!-- Tags 区域 -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <!-- 请求/响应/流式标签 -->
            <span
              v-if="msg.hasRequest"
              class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r from-green-50 to-green-50/80 text-green-700 border border-green-200/60 shadow-sm whitespace-nowrap"
              >请求</span
            >
            <span
              v-if="msg.hasResponse"
              class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r from-blue-50 to-blue-50/80 text-blue-700 border border-blue-200/60 shadow-sm whitespace-nowrap"
              >响应</span
            >
            <span
              v-if="msg.hasStreamResponse"
              class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r from-purple-50 to-purple-50/80 text-purple-700 border border-purple-200/60 shadow-sm whitespace-nowrap"
              >流式</span
            >
          </div>
        </div>

        <!-- 时间显示在右下角 -->
        <div class="absolute bottom-4 right-4">
          <span class="text-xs text-slate-400 font-medium">{{
            formatRelativeTime(msg.timestamp)
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
