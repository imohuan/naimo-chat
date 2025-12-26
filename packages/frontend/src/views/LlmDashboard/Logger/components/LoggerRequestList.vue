<script setup lang="ts">
import { computed } from "vue";
import type { LogRequest } from "../types";
import LoadMoreTrigger from "@/components/llm/LoadMoreTrigger.vue";

const props = defineProps<{
  requests: LogRequest[];
  selectedRequestId: string | null;
  searchQuery: string;
  filterType: "all" | "success" | "failed";
  isLoadingMore?: boolean;
  hasMore?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedRequestId": [id: string];
  "update:filterType": [type: "all" | "success" | "failed"];
  "update:searchQuery": [query: string];
  "load-more": [];
}>();

const filteredRequests = computed(() => {
  return props.requests.filter((req) => {
    if (
      props.filterType === "success" &&
      (req.hasError || (req.status !== null && req.status >= 400))
    ) {
      return false;
    }
    if (props.filterType === "failed") {
      const isFailed = req.hasError || (req.status !== null && req.status >= 400);
      if (!isFailed) return false;
    }

    if (props.searchQuery) {
      const q = props.searchQuery.toLowerCase();
      const searchBlob = (
        req.searchText ||
        `${req.id} ${req.url} ${req.model || ""} ${req.fullResponse || ""}`
      ).toLowerCase();
      return (
        searchBlob.includes(q) ||
        (req.error && JSON.stringify(req.error).toLowerCase().includes(q))
      );
    }
    return true;
  });
});

function formatTimeShort(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getMethodColor(method: string): string {
  const map: Record<string, string> = {
    GET: "text-blue-600",
    POST: "text-green-600",
    PUT: "text-yellow-600",
    DELETE: "text-red-600",
  };
  return map[method] || "text-slate-500";
}

function getStatusColor(status: number | null): string {
  if (!status) return "bg-slate-300";
  if (status >= 200 && status < 300) return "bg-green-500";
  if (status >= 300 && status < 400) return "bg-yellow-500";
  return "bg-red-500";
}
</script>

<template>
  <div class="h-full flex flex-col bg-white border-r border-slate-200">
    <!-- 头部 -->
    <div class="p-4 border-b border-slate-200 bg-slate-50">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide"
          >Requests ({{ filteredRequests.length }})</span
        >
      </div>

      <!-- 搜索框 -->
      <div class="relative mb-3">
        <input
          :value="searchQuery"
          @input="
            emit('update:searchQuery', ($event.target as HTMLInputElement).value)
          "
          type="text"
          placeholder="搜索 Request ID 或内容..."
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

      <!-- 过滤器 -->
      <div class="flex gap-1">
        <button
          @click="emit('update:filterType', 'all')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterType === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          全部
        </button>
        <button
          @click="emit('update:filterType', 'success')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterType === 'success'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          成功
        </button>
        <button
          @click="emit('update:filterType', 'failed')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterType === 'failed'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          失败
        </button>
      </div>
    </div>

    <!-- 请求列表 -->
    <div class="flex-1 overflow-y-auto relative">
      <div v-if="filteredRequests.length === 0" class="p-8 text-center text-slate-400">
        <p class="text-sm">没有找到匹配的请求</p>
      </div>
      <div
        v-for="req in filteredRequests"
        :key="req.id"
        @click="emit('update:selectedRequestId', req.id)"
        :class="[
          'p-3 border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50',
          selectedRequestId === req.id
            ? 'bg-indigo-50 border-l-4 border-l-indigo-600'
            : 'border-l-4 border-l-transparent',
        ]"
      >
        <div class="flex justify-between items-start mb-1">
          <span class="font-mono text-xs font-bold" :class="getMethodColor(req.method)">{{
            req.method
          }}</span>
          <span class="text-xs text-slate-400 font-mono">{{
            formatTimeShort(req.startTime)
          }}</span>
        </div>
        <div class="text-sm font-medium text-slate-700 truncate mb-1" :title="req.url">
          {{ req.url }}
        </div>
        <div class="flex justify-between items-center mt-2">
          <span
            class="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono"
            >{{ req.id }}</span
          >
          <div class="flex items-center gap-2">
            <span v-if="req.duration" class="text-xs text-slate-400"
              >{{ req.duration.toFixed(0) }}ms</span
            >
            <span class="w-2 h-2 rounded-full" :class="getStatusColor(req.status)"></span>
          </div>
        </div>
        <!-- Model badge -->
        <div v-if="req.model" class="mt-2">
          <span
            class="text-[10px] border border-indigo-200 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded"
            >{{ req.model }}</span
          >
        </div>
      </div>

      <!-- 加载更多触发器 -->
      <LoadMoreTrigger
        :has-more="hasMore"
        :is-loading-more="isLoadingMore"
        :enable-cycle-show-hide="true"
        :show-completed-message="filteredRequests.length > 0"
        @load-more="emit('load-more')"
      />
    </div>
  </div>
</template>
