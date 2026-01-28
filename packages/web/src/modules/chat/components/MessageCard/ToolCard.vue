<script setup lang="ts">
import type { ChatMessage } from '@/types';

defineProps<{
  item: ChatMessage;
  isCollapsed: boolean;
  isSubagent?: boolean;
}>();

const emit = defineEmits<{
  'toggle-collapse': [];
}>();
</script>

<template>
  <div class="w-full">
    <div class="bg-white border rounded-lg shadow-sm overflow-hidden" :class="[
      isCollapsed ? 'tool-collapsed' : '',
      item.isError ? 'border-red-300 bg-red-50' : 'border-slate-200'
    ]">
      <div @click="emit('toggle-collapse')"
        class="px-4 py-2.5 border-b flex justify-between items-center cursor-pointer transition select-none"
        :class="item.isError ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <i class="fa-solid fa-chevron-down tool-collapse-btn shrink-0"
            :class="item.isError ? 'text-red-400' : 'text-slate-400'"></i>
          <span class="text-xs font-semibold shrink-0" :class="item.isError ? 'text-red-700' : 'text-slate-700'">{{
            item.name }}</span>
          <span v-if="isCollapsed && item.name === 'Bash' && item.input?.command"
            class="text-xs font-mono truncate max-w-md" :class="item.isError ? 'text-red-600' : 'text-slate-500'">
            {{ item.input.command }}
          </span>
          <span v-else-if="item.input?.path || item.input?.file_path" class="text-[10px] font-mono truncate max-w-md"
            :class="item.isError ? 'text-red-500' : 'text-slate-400'">
            {{ item.input.path || item.input.file_path }}
          </span>
          <span v-if="isCollapsed && item.name !== 'Bash' && item.input && Object.keys(item.input).length > 0"
            class="text-[10px] font-mono truncate max-w-md" :class="item.isError ? 'text-red-500' : 'text-slate-400'">
            {{ item.input }}
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span v-if="item.isError"
            class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation"></i> ERROR
          </span>
          <span v-else-if="item.result"
            class="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
            <i class="fa-solid fa-circle-check"></i> SUCCESS
          </span>
          <span v-else class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">TOOL</span>
        </div>
      </div>

      <div v-show="!isCollapsed">
        <div class="px-3 font-mono text-xs border-b"
          :class="item.isError ? 'bg-red-100 text-red-800 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'">
          <div v-if="item.name === 'Bash'" class="py-3" :class="item.isError ? 'text-red-900' : 'text-slate-800'">{{
            item.input?.command }}</div>
          <div v-else-if="item.name === 'Write'"></div>
          <div v-else class="py-3">{{ JSON.stringify(item.input) }}</div>
        </div>

        <div class="p-3 text-xs font-mono max-h-64 overflow-y-auto custom-scrollbar"
          :class="item.isError ? 'bg-red-50' : 'bg-white'">
          <div v-if="item.isError"
            class="bg-red-100 border-l-4 border-red-600 px-3 py-2 mb-2 rounded flex items-start gap-2">
            <i class="fa-solid fa-circle-xmark text-red-700 shrink-0 mt-0.5"></i>
            <span class="text-red-800 font-semibold">执行错误</span>
          </div>
          <div v-if="item.diffLines">
            <div v-for="(line, idx) in item.diffLines" :key="idx"
              :class="line.type === 'add' ? 'diff-added' : line.type === 'rem' ? 'diff-removed' : 'text-slate-500'"
              class="px-2 py-0.5">
              {{ line.content }}
            </div>
          </div>
          <pre v-else :class="item.isError ? 'text-red-700' : 'text-slate-600'">{{ item.result || '执行中...' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
