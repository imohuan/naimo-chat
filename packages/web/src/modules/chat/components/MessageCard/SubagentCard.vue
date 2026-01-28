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
  'open-subagent': [];
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
    <div class="bg-white border rounded-lg shadow-sm overflow-hidden" :class="[
      actualIsCollapsed ? 'tool-collapsed' : '',
      item.isError ? 'border-red-300 bg-red-50' : 'border-purple-200'
    ]">
      <div @click="emit('toggle-collapse')"
        class="px-4 py-2.5 border-b flex justify-between items-center cursor-pointer transition select-none"
        :class="item.isError ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-purple-50 border-purple-200 hover:bg-purple-100'">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <i class="fa-solid fa-chevron-down tool-collapse-btn shrink-0"
            :class="item.isError ? 'text-red-400' : 'text-purple-400'"></i>
          <i class="fa-solid fa-robot shrink-0" :class="item.isError ? 'text-red-600' : 'text-purple-600'"></i>
          <span class="text-xs font-semibold shrink-0"
            :class="item.isError ? 'text-red-700' : 'text-purple-700'">Agent</span>
          <span v-if="actualIsCollapsed && item.input?.description" class="text-xs font-mono truncate max-w-md"
            :class="item.isError ? 'text-red-600' : 'text-purple-600'">
            {{ item.input.description }}
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button v-if="item.subagentMessages && item.subagentMessages.length > 0" @click.stop="emit('open-subagent')"
            class="text-xs px-2 py-1 rounded transition flex items-center gap-1"
            :class="item.isError ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'"
            title="打开子代理对话">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
            <span>打开</span>
          </button>
          <span v-if="item.isError"
            class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
            <i class="fa-solid fa-circle-exclamation"></i> ERROR
          </span>
          <span v-else-if="item.result"
            class="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
            <i class="fa-solid fa-circle-check"></i> SUCCESS
          </span>
          <span v-else class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">AGENT</span>
        </div>
      </div>

      <div v-show="!actualIsCollapsed">
        <div class="px-3 py-3 font-mono text-xs border-b"
          :class="item.isError ? 'bg-red-100 text-red-800 border-red-200' : 'bg-purple-50 text-purple-800 border-purple-200'">
          <div class="mb-2">
            <span class="font-bold">描述:</span> {{ item.input?.description || 'N/A' }}
          </div>
          <div class="mb-2">
            <span class="font-bold">类型:</span> {{ item.input?.subagent_type || 'N/A' }}
          </div>
          <div>
            <span class="font-bold">提示:</span> {{ item.input?.prompt || 'N/A' }}
          </div>
        </div>

        <div class="p-3 text-xs font-mono max-h-64 overflow-y-auto custom-scrollbar"
          :class="item.isError ? 'bg-red-50' : 'bg-white'">
          <div v-if="item.isError"
            class="bg-red-100 border-l-4 border-red-600 px-3 py-2 mb-2 rounded flex items-start gap-2">
            <i class="fa-solid fa-circle-xmark text-red-700 shrink-0 mt-0.5"></i>
            <span class="text-red-800 font-semibold">执行错误</span>
          </div>

          <div v-if="item.subagentMessages && item.subagentMessages.length > 0"
            class="bg-purple-50 border-l-4 border-purple-500 px-3 py-2 rounded flex items-start gap-2 mb-3">
            <i class="fa-solid fa-comments text-purple-600 shrink-0 mt-0.5"></i>
            <div class="flex-1">
              <div class="text-purple-800 font-semibold mb-1">子代理对话 ({{ item.subagentMessages.length }}
                条消息)</div>
              <div class="text-purple-600 text-[11px]">点击上方"打开"按钮查看完整对话</div>
            </div>
          </div>

          <div v-if="item.result">
            <div class="text-slate-500 font-semibold mb-2 text-[11px] uppercase tracking-wide">返回结果:</div>
            <pre class="whitespace-pre-wrap wrap-break-word"
              :class="item.isError ? 'text-red-700' : 'text-slate-700'">{{ item.result }}</pre>
          </div>
          <div v-else-if="!item.subagentMessages || item.subagentMessages.length === 0">
            <pre class="text-slate-400">执行中...</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
