<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import {
  DescriptionOutlined,
  ExpandMoreOutlined,
  RefreshOutlined,
  DeleteOutlined,
} from "@vicons/material";
import type { LogFile } from "../types";

const route = useRoute();
// 判断当前是否在 logger 路由
const isLoggerRoute = computed(() => route.name === "Logger");

const props = defineProps<{
  activeMode: "logs" | "messages";
  logFiles: LogFile[];
  selectedLogFileObj: LogFile | null;
  isRefreshing: boolean;
  isRefreshingMessages?: boolean;
}>();

const emit = defineEmits<{
  "update:activeMode": [mode: "logs" | "messages"];
  selectFile: [file: LogFile];
  refresh: [];
  refreshMessages: [];
  clearLog: [];
}>();

const logDropdownOpen = ref(false);

function formatLogFileDateTime(file: LogFile | null): string {
  if (!file || !file.lastModified) return "";
  try {
    const date = new Date(file.lastModified);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    return "";
  }
}

function getRelativeTime(dateString: string): string {
  if (!dateString) return "";
  try {
    const now = new Date();
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 1) return "最近1小时";
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 1) return "最近1天";
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  } catch (error) {
    return "";
  }
}

function setActiveMode(mode: "logs" | "messages") {
  emit("update:activeMode", mode);
}
</script>

<template>
  <Teleport defer to="#header-right-target" :disabled="!isLoggerRoute">
    <div class="flex items-center gap-2">
      <!-- 日志文件选择器（仅在 logs 模式下显示） -->
      <template v-if="activeMode === 'logs'">
        <div class="relative" data-log-dropdown @click.stop>
          <button
            @click="logDropdownOpen = !logDropdownOpen"
            type="button"
            class="bg-white border border-slate-200 text-sm rounded-md pl-8 pr-7 py-1.5 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer text-slate-700 min-w-[240px] text-left flex items-center justify-between hover:border-slate-300 shadow-sm h-8"
          >
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <DescriptionOutlined
                class="absolute left-2.5 w-4 h-4 text-slate-400 shrink-0"
              />
              <span v-if="selectedLogFileObj" class="truncate text-xs">
                <div class="text-[12px] text-slate-600 leading-tight">
                  {{ formatLogFileDateTime(selectedLogFileObj) }}
                </div>
                <div
                  class="text-[9px] text-slate-500 font-medium leading-tight align-right"
                >
                  {{ selectedLogFileObj.name }}
                </div>
              </span>
              <span v-else class="text-slate-400 text-xs">选择日志文件</span>
            </div>
            <ExpandMoreOutlined
              :class="[
                'w-3.5 h-3.5 text-slate-400 transition-transform shrink-0',
                { 'rotate-180': logDropdownOpen },
              ]"
            />
          </button>

          <!-- 下拉菜单 -->
          <div
            v-if="logDropdownOpen"
            class="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto min-w-[280px]"
          >
            <div
              v-for="file in logFiles"
              :key="file.path"
              @click="
                emit('selectFile', file);
                logDropdownOpen = false;
              "
              :class="[
                'px-4 pt-4 pb-2 border-l-2 cursor-pointer transition-colors',
                selectedLogFileObj?.path === file.path
                  ? 'bg-indigo-50 border-indigo-500'
                  : 'border-transparent hover:bg-slate-50',
              ]"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="text-sm text-slate-800 font-medium mb-1">
                    {{ formatLogFileDateTime(file) }}
                  </div>
                  <div class="text-xs text-slate-500 font-mono truncate">
                    {{ file.name }}
                  </div>
                </div>
                <div class="text-xs text-slate-400 whitespace-nowrap shrink-0">
                  {{ getRelativeTime(file.lastModified) }}
                </div>
              </div>
            </div>
            <div
              v-if="logFiles.length === 0"
              class="px-4 pt-4 pb-2 text-sm text-slate-400 text-center"
            >
              暂无日志文件
            </div>
          </div>
        </div>

        <!-- 刷新按钮 -->
        <button
          v-if="selectedLogFileObj"
          @click="emit('refresh')"
          type="button"
          class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm hover:shadow h-8"
          title="刷新日志"
        >
          <RefreshOutlined
            :class="[
              'w-3.5 h-3.5 text-slate-600',
              { 'animate-spin': isRefreshing },
            ]"
          />
          <span class="text-slate-700">刷新</span>
        </button>

        <!-- 清空当前日志按钮 -->
        <button
          v-if="selectedLogFileObj"
          @click="emit('clearLog')"
          type="button"
          class="px-3 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 rounded-md transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm hover:shadow h-8 text-rose-600"
          title="清空当前日志内容"
        >
          <DeleteOutlined class="w-3.5 h-3.5" />
          <span class="text-xs leading-none">清空</span>
        </button>

        <!-- 分割线（始终显示） -->
        <div class="h-6 w-px bg-slate-200 mx-2"></div>
      </template>

      <!-- 对话模式刷新按钮 -->
      <template v-if="activeMode === 'messages'">
        <!-- 刷新按钮 -->
        <button
          @click="emit('refreshMessages')"
          type="button"
          class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm hover:shadow h-8"
          title="刷新对话列表"
        >
          <RefreshOutlined
            :class="[
              'w-3.5 h-3.5 text-slate-600',
              { 'animate-spin': isRefreshingMessages },
            ]"
          />
          <span class="text-slate-700">刷新</span>
        </button>

        <!-- 分割线（始终显示） -->
        <div class="h-6 w-px bg-slate-200 mx-2"></div>
      </template>

      <!-- Tab 切换（始终显示） -->
      <nav class="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
        <button
          @click="setActiveMode('messages')"
          class="px-4 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-2 border border-transparent"
          :class="
            activeMode === 'messages'
              ? 'bg-white text-primary shadow-sm border border-primary/20'
              : 'text-slate-500 hover:text-slate-700'
          "
        >
          对话查询
        </button>

        <button
          @click="setActiveMode('logs')"
          class="px-4 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-2 border border-transparent"
          :class="
            activeMode === 'logs'
              ? 'bg-white text-primary shadow-sm border border-primary/20'
              : 'text-slate-500 hover:text-slate-700'
          "
        >
          完整日志
        </button>
      </nav>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
