<script setup lang="ts">
import { computed } from "vue";
import IconSearchInput from "./IconSearchInput.vue";
import ColorPicker from "./ColorPicker.vue";
import StyleButton from "./StyleButton.vue";
import VariableTextInput from "@/components/variables-inputs/VariableTextInput.vue";
import { DeleteOutlined } from "@vicons/material";
import type { StatusLineModuleConfig } from "../types";
import type { PreviewVariables } from "../hooks/usePreviewHistory";
import { replaceVariables } from "../utils";

const props = defineProps<{
  selectedModule: StatusLineModuleConfig | null;
  selectedModuleIndex: number | null;
  currentStyle: string;
  previewVariables?: PreviewVariables;
}>();

const emit = defineEmits<{
  (
    e: "update-module",
    field: keyof StatusLineModuleConfig,
    value: string
  ): void;
  (e: "delete-module"): void;
}>();

// 获取当前选中的样式数组
const selectedStyles = computed(() => {
  const style = props.selectedModule?.style;
  if (!style) return [];
  if (Array.isArray(style)) return style;
  if (typeof style === "string") {
    try {
      const parsed = JSON.parse(style);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [style];
    }
  }
  return [];
});

// 定义冲突的样式组
const conflictGroups: Record<string, string[]> = {
  bold: ["dim"],
  dim: ["bold"],
};

// 已移除的默认样式（不需要显式设置）
const removedStyles = ["normal", "noUnderline", "noReverse"];

// 直接使用原始文本，不进行格式转换
const variableTextValue = computed({
  get: () => {
    return props.selectedModule?.text || "";
  },
  set: (val: string) => {
    emit("update-module", "text", val);
  },
});

// 创建变量解析函数，用于实时预览
const resolveVariable = computed(() => {
  return (text: string): string => {
    if (!props.previewVariables) {
      return text;
    }
    // 将 PreviewVariables 转换为 Record<string, string> 格式
    const variables: Record<string, string> = {};
    Object.keys(props.previewVariables).forEach((key) => {
      const value = props.previewVariables![key as keyof PreviewVariables];
      variables[key] = value || "";
    });
    return replaceVariables(text, variables);
  };
});

// 创建可用变量列表，用于自动完成
const availableVariables = computed(() => {
  if (!props.previewVariables) {
    return [];
  }

  const variableLabels: Record<string, string> = {
    workDirName: "工作目录名",
    gitBranch: "Git 分支",
    model: "模型名称",
    inputTokens: "输入 Tokens",
    outputTokens: "输出 Tokens",
    totalInputTokens: "总输入 Tokens",
    totalOutputTokens: "总输出 Tokens",
    contextWindowSize: "上下文窗口大小",
    totalCost: "总成本 (USD)",
    totalDuration: "总耗时",
    totalApiDuration: "API 总耗时",
    totalLinesAdded: "总新增行数",
    totalLinesRemoved: "总删除行数",
  };

  return Object.keys(props.previewVariables).map((key) => ({
    label: variableLabels[key] || key,
    value: key,
    description: `当前值: ${
      props.previewVariables![key as keyof PreviewVariables] || ""
    }`,
  }));
});

// 切换样式选择
function toggleStyle(styleValue: string) {
  const current = selectedStyles.value;
  const isCurrentlySelected = current.includes(styleValue);

  let newStyles: string[];

  if (isCurrentlySelected) {
    // 如果当前已选中，则移除该样式
    newStyles = current.filter((s) => s !== styleValue);
  } else {
    // 如果当前未选中，则添加该样式，并移除冲突的样式
    const conflicts = conflictGroups[styleValue] || [];
    newStyles = [...current.filter((s) => !conflicts.includes(s)), styleValue];
  }

  // 清理已移除的默认样式（确保数据一致性）
  newStyles = newStyles.filter((s) => !removedStyles.includes(s));

  // 将数组转换为 JSON 字符串
  const value = newStyles.length > 0 ? JSON.stringify(newStyles) : "";
  emit("update-module", "style", value);
}
</script>

<template>
  <template v-if="props.selectedModule && props.selectedModuleIndex !== null">
    <div class="h-full flex-1 flex flex-col gap-2">
      <div class="flex-1 flex flex-col gap-5 overflow-y-auto p-5">
        <!-- 进度条类型不显示通用配置项 -->
        <template v-if="props.selectedModule.type !== 'progress'">
          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >图标</label
            >
            <IconSearchInput
              :model-value="props.selectedModule.icon || ''"
              @update:model-value="(val: string) => emit('update-module', 'icon', val)"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >文本</label
            >
            <VariableTextInput
              v-model="variableTextValue"
              placeholder="例如: {{workDirName}}"
              preview-mode="dropdown"
              :show-tip="true"
              :show-left-icon="false"
              :multiline="true"
              :resolve-variable="resolveVariable"
              :available-variables="availableVariables"
              :autocomplete-trigger-chars="['{', '[']"
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >文字颜色</label
            >
            <ColorPicker
              :model-value="props.selectedModule.color || null"
              placeholder="选择文字颜色"
              @update:model-value="
                (val) => {
                  emit('update-module', 'color', val || '');
                }
              "
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >背景颜色</label
            >
            <ColorPicker
              :model-value="props.selectedModule.background || null"
              placeholder="选择背景颜色"
              @update:model-value="
                (val) => {
                  emit('update-module', 'background', val || '');
                }
              "
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >文本样式</label
            >
            <div class="grid grid-cols-3 gap-2">
              <!-- 粗体 -->
              <StyleButton
                value="bold"
                label="粗体"
                description="加粗文本"
                :is-selected="selectedStyles.includes('bold')"
                @click="toggleStyle"
              >
                <template #icon>
                  <svg
                    class="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                  </svg>
                </template>
              </StyleButton>

              <!-- 暗淡 -->
              <StyleButton
                value="dim"
                label="暗淡"
                description="弱化文本"
                :is-selected="selectedStyles.includes('dim')"
                @click="toggleStyle"
              >
                <template #icon>
                  <svg
                    class="w-4 h-4 opacity-60 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M4 12h16" />
                    <path d="M4 16h12" />
                    <path d="M4 8h14" />
                  </svg>
                </template>
              </StyleButton>

              <!-- 下划线 -->
              <StyleButton
                value="underline"
                label="下划线"
                description="添加下划线"
                :is-selected="selectedStyles.includes('underline')"
                @click="toggleStyle"
              >
                <template #icon>
                  <svg
                    class="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M6 4v6a6 6 0 0 0 12 0V4" />
                    <path d="M4 20h16" />
                  </svg>
                </template>
              </StyleButton>

              <!-- 反色 -->
              <StyleButton
                value="reverse"
                label="反色"
                description="前景色和背景色互换"
                :is-selected="selectedStyles.includes('reverse')"
                @click="toggleStyle"
              >
                <template #icon>
                  <svg
                    class="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8" />
                    <path d="M12 17v4" />
                    <path d="M7 8l5-5 5 5" />
                  </svg>
                </template>
              </StyleButton>
            </div>
            <p class="text-xs text-slate-500 mt-1">可多选，支持组合样式效果</p>
          </div>
        </template>

        <div v-if="props.selectedModule.type === 'script'" class="space-y-2">
          <label
            class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >脚本路径</label
          >
          <input
            :value="props.selectedModule.scriptPath || ''"
            class="input-base"
            placeholder="/path/to/script.js"
            @input="
              (e) => emit('update-module', 'scriptPath', (e.target as HTMLInputElement).value)
            "
          />
        </div>

        <div v-if="props.selectedModule.type === 'progress'" class="space-y-4">
          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >输入变量</label
            >
            <VariableTextInput
              :model-value="props.selectedModule.progressInput || ''"
              placeholder="例如: {{totalInputTokens}}"
              preview-mode="dropdown"
              :show-tip="true"
              :show-left-icon="false"
              :multiline="false"
              :resolve-variable="resolveVariable"
              :available-variables="availableVariables"
              :autocomplete-trigger-chars="['{', '[']"
              @update:model-value="(val: string) => emit('update-module', 'progressInput', val)"
            />
            <p class="text-xs text-slate-500">当前进度值（如：2.11k）</p>
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >输出变量</label
            >
            <VariableTextInput
              :model-value="props.selectedModule.progressOutput || ''"
              placeholder="例如: {{contextWindowSize}}"
              preview-mode="dropdown"
              :show-tip="true"
              :show-left-icon="false"
              :multiline="false"
              :resolve-variable="resolveVariable"
              :available-variables="availableVariables"
              :autocomplete-trigger-chars="['{', '[']"
              @update:model-value="(val: string) => emit('update-module', 'progressOutput', val)"
            />
            <p class="text-xs text-slate-500">最大值（如：200k）</p>
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >进度条长度</label
            >
            <input
              type="number"
              :value="props.selectedModule.progressLength || 20"
              class="input-base"
              placeholder="20"
              min="1"
              max="100"
              @input="
                (e) =>
                  emit(
                    'update-module',
                    'progressLength',
                    (e.target as HTMLInputElement).value
                  )
              "
            />
            <p class="text-xs text-slate-500">进度条的字符长度（1-100）</p>
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >进度条背景颜色</label
            >
            <ColorPicker
              :model-value="props.selectedModule.progressBgColor || null"
              placeholder="选择背景颜色"
              @update:model-value="
                (val) => {
                  emit('update-module', 'progressBgColor', val || '');
                }
              "
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >进度条颜色</label
            >
            <ColorPicker
              :model-value="props.selectedModule.progressColor || null"
              placeholder="选择进度条颜色"
              @update:model-value="
                (val) => {
                  emit('update-module', 'progressColor', val || '');
                }
              "
            />
          </div>

          <div class="space-y-2">
            <label
              class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
              >进度条样式</label
            >
            <select
              :value="props.selectedModule.progressStyle || 'block'"
              class="input-base"
              @change="
                (e) =>
                  emit('update-module', 'progressStyle', (e.target as HTMLSelectElement).value)
              "
            >
              <option value="block">实心块 (█)</option>
              <option value="thin">细块 (▏▎▍▌▋▊▉)</option>
              <option value="smooth">平滑 (▁▂▃▄▅▆▇█)</option>
              <option value="bar">条形 (=)</option>
              <option value="dot">点状 (●)</option>
            </select>
            <p class="text-xs text-slate-500">选择进度条的显示风格</p>
          </div>
        </div>
      </div>
      <div class="p-5 pt-0">
        <button
          class="btn-secondary w-full text-red-600! hover:bg-red-50! hover:border-red-300! hover:shadow-sm transition-all mt-auto shrink-0"
          @click="emit('delete-module')"
        >
          <DeleteOutlined class="w-4 h-4" />
          删除模块
        </button>
      </div>
    </div>
  </template>
  <div
    v-else
    class="flex flex-col items-center justify-center h-full min-h-[200px] text-center px-4"
  >
    <div
      class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4"
    >
      <svg
        class="w-8 h-8 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
    </div>
    <p class="text-slate-500 text-sm font-medium mb-1">选择模块以编辑属性</p>
    <p class="text-slate-400 text-xs">在预览区域点击任意模块开始编辑</p>
  </div>
</template>
