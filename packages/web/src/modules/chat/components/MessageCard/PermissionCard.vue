<script setup lang="ts">
import type { ChatMessage } from '@/types';

defineProps<{
  item: ChatMessage;
}>();

const emit = defineEmits<{
  'approve': [];
  'deny': [];
}>();
</script>

<template>
  <div class="w-full">
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div class="flex gap-3">
        <div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
          <i class="fa-solid fa-shield-halved text-lg"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="text-sm font-bold text-amber-800 flex items-center gap-2">
            <i class="fa-solid fa-lock"></i>
            操作权限请求: {{ item.toolName }}
          </h4>
          <div
            class="bg-white/50 rounded p-2 mt-2 font-mono text-[10px] text-slate-600 border border-amber-100 max-h-64 overflow-auto custom-scrollbar">
            <pre
              class="whitespace-pre-wrap wrap-break-word">{{ JSON.stringify(item.toolInput || item.payload, null, 2) }}</pre>
          </div>
          <div class="mt-4 flex gap-2">
            <button @click="emit('approve')"
              class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5">
              <i class="fa-solid fa-check"></i> 允许执行
            </button>
            <button @click="emit('deny')"
              class="px-4 py-2 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
              <i class="fa-solid fa-xmark"></i> 拒绝
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
