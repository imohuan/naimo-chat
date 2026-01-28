<script setup lang="ts">
import { computed } from 'vue';
import { diffLines, type Change } from 'diff';
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

// 检查是否是编辑类型的工具
const isEditOperation = computed(() => {
  return (
    props.item.name === 'Edit' ||
    props.item.name?.toLowerCase().includes('edit') ||
    (props.item.input && (props.item.input.old_string || props.item.input.new_string || props.item.input.oldStr || props.item.input.newStr))
  );
});

// 获取文件路径
const filePath = computed(() => {
  return props.item.input?.path || props.item.input?.file_path || props.item.input?.targetFile || 'Unknown file';
});

// 获取旧文本
const oldText = computed(() => {
  return props.item.input?.old_string || props.item.input?.oldStr || '';
});

// 获取新文本
const newText = computed(() => {
  return props.item.input?.new_string || props.item.input?.newStr || '';
});

// 格式化文件路径显示
const displayFilePath = computed(() => {
  const path = filePath.value;
  if (path.length > 60) {
    return '...' + path.substring(path.length - 57);
  }
  return path;
});

// Diff 计算
type DiffBlock = Change & { lines: string[] };

const diffBlocks = computed<DiffBlock[]>(() => {
  if (!oldText.value && !newText.value) return [];

  const changes = diffLines(oldText.value, newText.value);
  return changes
    .map((chunk: Change) => {
      const lines = chunk.value.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      return { ...chunk, lines };
    })
    .filter((chunk: DiffBlock) => chunk.lines.length > 0);
});

const indicator = (chunk: DiffBlock) => {
  if (chunk.added) return '+';
  if (chunk.removed) return '-';
  return ' ';
};
</script>

<template>
  <div class="w-full">
    <div class="bg-white border rounded-lg shadow-sm overflow-hidden" :class="[
      actualIsCollapsed ? 'tool-collapsed' : '',
      item.isError ? 'border-red-300 bg-red-50' : 'border-slate-200'
    ]">
      <!-- 标题栏 -->
      <div @click="emit('toggle-collapse')"
        class="px-4 py-2.5 border-b flex justify-between items-center cursor-pointer transition select-none"
        :class="item.isError ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <i class="fa-solid fa-chevron-down tool-collapse-btn shrink-0"
            :class="item.isError ? 'text-red-400' : 'text-slate-400'"></i>
          <i class="fa-solid fa-pen-to-square shrink-0 text-xs"
            :class="item.isError ? 'text-red-600' : 'text-slate-600'"></i>
          <span class="text-xs font-semibold shrink-0" :class="item.isError ? 'text-red-700' : 'text-slate-700'">{{
            item.name }}</span>
          <span class="text-[10px] font-mono truncate max-w-md"
            :class="item.isError ? 'text-red-500' : 'text-slate-400'">
            {{ displayFilePath }}
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
          <span v-else class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">EDIT</span>
        </div>
      </div>

      <!-- 内容区域 -->
      <div v-show="!actualIsCollapsed">
        <!-- 折叠状态预览 -->
        <div v-if="actualIsCollapsed && (oldText || newText)" class="p-3 text-xs font-mono bg-slate-50">
          <div v-if="oldText && newText" class="space-y-1">
            <div class="text-red-600 truncate">- {{ oldText.trim().substring(0, 100) }}{{ oldText.length > 100 ? '...' :
              '' }}</div>
            <div class="text-green-600 truncate">+ {{ newText.trim().substring(0, 100) }}{{ newText.length > 100 ? '...'
              : '' }}</div>
          </div>
          <div v-else-if="newText" class="text-green-600 truncate">+ {{ newText.trim().substring(0, 200) }}{{
            newText.length > 200 ? '...' : '' }}</div>
          <div v-else-if="oldText" class="text-red-600 truncate">- {{ oldText.trim().substring(0, 200) }}{{
            oldText.length > 200 ? '...' : '' }}</div>
        </div>

        <!-- Diff 视图 -->
        <div v-if="oldText || newText" class="overflow-x-auto">
          <table class="w-full border-collapse text-sm font-mono">
            <tbody>
              <template v-for="(chunk, chunkIndex) in diffBlocks" :key="chunkIndex">
                <tr v-for="(line, lineIndex) in chunk.lines" :key="`${chunkIndex}-${lineIndex}`" :class="{
                  'bg-green-50 hover:bg-green-100': chunk.added,
                  'bg-red-50 hover:bg-red-100': chunk.removed,
                  'hover:bg-slate-50': !chunk.added && !chunk.removed
                }" class="transition-colors">
                  <!-- 指示符列 -->
                  <td class="w-8 px-2 text-center font-bold select-none sticky left-0" :class="{
                    'bg-green-200 text-green-700 border-r border-green-300': chunk.added,
                    'bg-red-200 text-red-700 border-r border-red-300': chunk.removed,
                    'bg-slate-100 text-slate-400 border-r border-slate-200': !chunk.added && !chunk.removed
                  }">
                    {{ indicator(chunk) }}
                  </td>
                  <!-- 代码内容列 -->
                  <td class="py-1 px-3 align-top">
                    <pre class="m-0 p-0 text-slate-900 leading-relaxed">{{ line }}</pre>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- 结果输出 -->
        <div v-if="item.result" class="p-3 text-xs font-mono border-t max-h-64 overflow-y-auto custom-scrollbar"
          :class="item.isError ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'">
          <div v-if="item.isError"
            class="bg-red-100 border-l-4 border-red-600 px-3 py-2 mb-2 rounded flex items-start gap-2">
            <i class="fa-solid fa-circle-xmark text-red-700 shrink-0 mt-0.5"></i>
            <span class="text-red-800 font-semibold">执行错误</span>
          </div>
          <pre :class="item.isError ? 'text-red-700' : 'text-slate-600'">{{ item.result }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
