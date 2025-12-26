<script setup lang="ts">
import { AddOutlined } from "@vicons/material";

const emit = defineEmits<{
  (e: "add", type: string): void;
}>();

// 模块类型选项
const MODULE_TYPES = [
  { label: "工作目录", value: "workDir" },
  { label: "Git分支", value: "gitBranch" },
  { label: "模型", value: "model" },
  { label: "使用量", value: "usage" },
  { label: "脚本", value: "script" },
  { label: "分割线", value: "separator" },
];
</script>

<template>
  <div
    class="bg-white border rounded-xl flex flex-col shadow-sm hover:shadow-md transition-shadow min-h-[200px]"
  >
    <div class="px-4 pt-3 pb-2.5 border-b border-slate-100 shrink-0">
      <h3 class="text-sm font-semibold text-slate-900">可用组件</h3>
      <p class="text-xs text-slate-500 mt-0.5">点击组件添加到状态栏</p>
    </div>
    <div class="px-3 py-3">
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="moduleType in MODULE_TYPES"
          :key="moduleType.value"
          class="group flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-pointer bg-white hover:bg-indigo-50/50 hover:border-indigo-300 hover:shadow-sm transition-all"
          @click="emit('add', moduleType.value)"
        >
          <div
            class="w-6 h-6 rounded-md bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center shrink-0 transition-colors"
          >
            <AddOutlined class="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <span
            class="text-xs font-medium text-slate-700 group-hover:text-indigo-900 transition-colors"
            >{{ moduleType.label }}</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
