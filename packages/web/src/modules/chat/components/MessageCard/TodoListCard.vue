<script setup lang="ts">
import { computed, watch } from 'vue';
import { useCollapseStore } from '../../stores/collapseStore';
import type { ChatMessage } from '@/types';

const props = defineProps<{
  item: ChatMessage;
  isCollapsed: boolean;
  isSubagent?: boolean;
}>();

const emit = defineEmits<{
  'toggle-collapse': [];
}>();

const collapseStore = useCollapseStore();

// 确保项目已注册
collapseStore.registerItem(props.item.id);

// 使用 computed 来响应 store 的变化
const actualIsCollapsed = computed(() => {
  return collapseStore.isCollapsed(props.item.id);
});

// 监听 store 的全局折叠状态变化
watch(() => collapseStore.allCollapsed, () => {
  // 触发重新渲染
});
</script>

<template>
  <div class="w-full">
    <div class="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden"
      :class="{ 'tool-collapsed': actualIsCollapsed }">
      <div @click="emit('toggle-collapse')"
        class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition select-none">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <i class="fa-solid fa-chevron-down text-slate-400 tool-collapse-btn shrink-0"></i>
          <span class="text-xs font-semibold text-slate-700 shrink-0">任务列表</span>
          <span class="text-[10px] text-slate-400 font-semibold truncate max-w-md">{{ item.todos?.length || 0 }}
            项</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">TOOL</span>
        </div>
      </div>

      <div v-show="!actualIsCollapsed">
        <div class="p-3 text-xs max-h-64 overflow-y-auto custom-scrollbar bg-white">
          <div v-for="todo in item.todos" :key="todo.id" class="mb-2 last:mb-0">
            <div class="flex items-center gap-2 p-2 rounded hover:bg-slate-50 transition">
              <span class="w-2 h-2 rounded-full shrink-0"
                :class="todo.status === 'completed' ? 'bg-green-500' : todo.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'"></span>
              <div class="font-medium text-slate-800 shrink-0"
                :class="{ 'line-through text-slate-400': todo.status === 'completed' }">
                {{ todo.content }}
              </div>
              <div v-if="todo.activeForm" class="text-[11px] text-slate-400 truncate flex-1 min-w-0"
                :title="todo.activeForm">
                {{ todo.activeForm }}
              </div>
              <span class="text-[10px] px-1.5 py-0.5 rounded shrink-0 ml-auto" :class="{
                'bg-green-100 text-green-700': todo.status === 'completed',
                'bg-blue-100 text-blue-700': todo.status === 'in_progress',
                'bg-slate-100 text-slate-600': todo.status === 'pending'
              }">
                {{ todo.status === 'completed' ? '完成' : todo.status === 'in_progress' ? '进行中' : '待处理' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
