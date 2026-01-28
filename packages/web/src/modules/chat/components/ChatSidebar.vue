<script setup lang="ts">
import type { ChatHistory } from '@/types';

defineProps<{
  chatHistory: ChatHistory[];
  selectedHistoryId: string | number | null;
}>();

const emit = defineEmits<{
  'reset-chat': [];
  'load-history': [history: ChatHistory];
  'delete-session': [sessionId: string];
}>();

// 格式化时间显示
const formatTime = (dateStr?: string): string => {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }

  // 小于1小时
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}分钟前`;
  }

  // 小于24小时
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}小时前`;
  }

  // 小于7天
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}天前`;
  }

  // 超过7天，显示具体日期
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // 如果是今年，不显示年份
  if (year === now.getFullYear()) {
    return `${month}-${day}`;
  }

  return `${year}-${month}-${day}`;
};
</script>

<template>
  <aside class="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col hidden md:flex">
    <div class="p-4 border-b border-slate-100 flex items-center gap-2">
      <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
      <span class="font-semibold text-lg">Claude Chat</span>
    </div>
    <div class="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-2 sidebar-history-container">
      <button @click="emit('reset-chat')"
        class="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
        <i class="fa-solid fa-plus"></i> 新对话
      </button>
      <div class="mt-4">
        <h3 class="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">对话记录</h3>
        <div class="space-y-1">
          <div v-for="h in chatHistory" :key="h.id" @click="emit('load-history', h)"
            class="group relative px-3 py-2.5 text-sm text-slate-700 hover:bg-blue-50 rounded-md cursor-pointer transition-colors font-medium flex items-center justify-between hover:gap-2"
            :class="{ 'bg-blue-100 text-blue-700': selectedHistoryId === h.id }">
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="truncate">{{ h.projectPath }}</span>
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs text-slate-400 whitespace-nowrap">{{ formatTime(h.modifiedAt || h.createdAt)
                  }}</span>
                <span class="text-xs text-slate-400 truncate">{{ h.title }}</span>
              </div>
            </div>
            <button v-if="h.isRemote" @click.stop="emit('delete-session', h.sessionId!)"
              class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-slate-400 hover:text-red-600"
              title="删除会话">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>
