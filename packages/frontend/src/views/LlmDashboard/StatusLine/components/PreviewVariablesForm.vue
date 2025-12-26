<script setup lang="ts">
import { computed } from "vue";
import type { PreviewVariables } from "../hooks/usePreviewHistory";
import Input from "@/components/llm/Input.vue";

const props = defineProps<{
  previewVariables: PreviewVariables;
}>();

const emit = defineEmits<{
  (e: "update", key: keyof PreviewVariables, value: string): void;
}>();

interface FieldConfig {
  key: keyof PreviewVariables;
  label: string;
  group: string;
}

const fieldConfigs: FieldConfig[] = [
  // 基础信息
  { key: "workDirName", label: "工作目录", group: "基础信息" },
  { key: "gitBranch", label: "Git分支", group: "基础信息" },
  { key: "model", label: "模型", group: "基础信息" },
  // Token 信息
  { key: "inputTokens", label: "输入Token", group: "Token 信息" },
  { key: "outputTokens", label: "输出Token", group: "Token 信息" },
  { key: "totalInputTokens", label: "总输入Token", group: "Token 信息" },
  { key: "totalOutputTokens", label: "总输出Token", group: "Token 信息" },
  { key: "contextWindowSize", label: "上下文窗口大小", group: "Token 信息" },
  // 成本信息
  { key: "totalCost", label: "总成本", group: "成本信息" },
  { key: "totalDuration", label: "总耗时", group: "成本信息" },
  { key: "totalApiDuration", label: "API总耗时", group: "成本信息" },
  // 代码统计
  { key: "totalLinesAdded", label: "总新增行数", group: "代码统计" },
  { key: "totalLinesRemoved", label: "总删除行数", group: "代码统计" },
];

// 按分组组织字段
const groupedFields = computed(() => {
  const groups = new Map<string, FieldConfig[]>();
  fieldConfigs.forEach((field) => {
    if (!groups.has(field.group)) {
      groups.set(field.group, []);
    }
    groups.get(field.group)!.push(field);
  });
  return Array.from(groups.entries());
});
</script>

<template>
  <div class="space-y-4 p-5">
    <template v-for="[groupName, fields] in groupedFields" :key="groupName">
      <div class="space-y-3">
        <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {{ groupName }}
        </h3>
        <div v-for="field in fields" :key="field.key" class="flex flex-col gap-2">
          <label class="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            {{ field.label }}
            <span class="ml-1 text-slate-400 font-mono normal-case"
              >({{ field.key }})</span
            >
          </label>
          <Input
            :model-value="props.previewVariables[field.key] || ''"
            @update:model-value="(value) => emit('update', field.key, value)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
