<script setup lang="ts">
import { computed } from "vue";
import type { MessageListItem } from "../types";

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

  // TODO: 根据实际数据结构实现标签过滤
  // if (props.filterTag !== "all") {
  //   filtered = filtered.filter((msg) => {
  //     // 根据消息内容判断类型
  //   });
  // }

  return filtered;
});

function formatTimeShort(timestamp: string | null): string {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white border-r border-slate-200">
    <!-- 头部 -->
    <div class="p-4 border-b border-slate-200 bg-slate-50">
      <div class="flex items-center justify-between mb-3">
        <span
          class="text-xs font-semibold text-slate-600 uppercase tracking-wide"
          >对话 ({{ filteredMessages.length }})</span
        >
      </div>

      <!-- 搜索框 -->
      <div class="relative mb-3">
        <input
          :value="searchQuery"
          @input="
            emit(
              'update:searchQuery',
              ($event.target as HTMLInputElement).value
            )
          "
          type="text"
          placeholder="搜索 Request ID 或模型..."
          class="w-full bg-white border border-slate-200 text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder-slate-400"
        />
        <svg
          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
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
          全部
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
          'p-3 border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50',
          selectedMessageId === msg.requestId
            ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
            : 'border-l-4 border-l-transparent',
        ]"
      >
        <div class="flex justify-between items-start mb-1">
          <span class="text-xs text-slate-400 font-mono">{{
            formatTimeShort(msg.timestamp)
          }}</span>
        </div>
        <div
          class="text-sm font-medium text-slate-700 truncate mb-1"
          :title="msg.requestId"
        >
          {{ msg.requestId }}
        </div>
        <div v-if="msg.model" class="mt-2">
          <span
            class="text-[10px] border border-indigo-200 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
            >{{ msg.model }}</span
          >
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span
            v-if="msg.hasRequest"
            class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
            >请求</span
          >
          <span
            v-if="msg.hasResponse"
            class="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
            >响应</span
          >
          <span
            v-if="msg.hasStreamResponse"
            class="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
            >流式</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
