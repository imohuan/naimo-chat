<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useEventListener } from "@vueuse/core";
import { SaveOutlined, RestoreOutlined } from "@vicons/material";
import { usePreviewHistory, type PreviewVariables } from "./hooks/usePreviewHistory";
import { useStatusLine } from "./hooks/useStatusLine";
import ThemeFontControls from "./components/ThemeFontControls.vue";
import StatusLinePreview from "./components/StatusLinePreview.vue";
import ModulePalette from "./components/ModulePalette.vue";
import ModuleProperties from "./components/ModuleProperties.vue";
import PreviewVariablesForm from "./components/PreviewVariablesForm.vue";

// 创建预览变量的响应式 ref
const previewVariables = ref<PreviewVariables>({
  workDirName: "project",
  gitBranch: "main",
  model: "Claude Sonnet 4",
  inputTokens: "1.2k",
  outputTokens: "2.5k",
  totalInputTokens: "10.5k",
  totalOutputTokens: "25.3k",
  contextWindowSize: "200k",
  totalCost: "$0.15",
  totalDuration: "2.5s",
  totalApiDuration: "1.8s",
  totalLinesAdded: "150",
  totalLinesRemoved: "45",
});

// 更新预览变量的辅助函数
function updatePreviewVariable(key: keyof PreviewVariables, value: string) {
  previewVariables.value = {
    ...previewVariables.value,
    [key]: value,
  };
}
const {
  statusLineConfig,
  selectedModuleIndex,
  selectedModule,
  autoSeparator,
  showIcon,
  isLoading,
  isSaving,
  hasUnsavedChanges,
  draggableModules,
  themeNames,
  handleSave,
  refreshConfig,
  handleAddModule,
  handleModuleChange,
  handleDeleteModule,
  toggleAutoSeparator,
  toggleShowIcon,
  renderModulePreview,
  loadConfig,
  handleEnabledChange,
  addThemeTemplate,
  deleteThemeTemplate,
  duplicateThemeTemplate,
  renameThemeTemplate,
  switchThemeTemplate,
} = useStatusLine(previewVariables);

// 使用历史记录 hooks 跟踪模块拖拽与配置变更
usePreviewHistory(draggableModules, {
  enableKeyboardShortcuts: true,
  debounceMs: 120,
  capacity: 80,
  debug: false,
});

const rightPanelTab = ref<"properties" | "preview">("properties");

useEventListener(window, "keydown", (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;
  const isEditableElement =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    target.closest("input") ||
    target.closest("textarea") ||
    target.closest("[contenteditable]");

  if (isEditableElement) return;

  if (
    selectedModuleIndex.value !== null &&
    (e.key === "Delete" || e.key === "Backspace")
  ) {
    e.preventDefault();
    handleDeleteModule();
  }
});

onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="max-w-7xl mx-auto h-full overflow-hidden flex flex-col bg-slate-50/50">
    <div class="flex justify-between items-center p-6 pb-4 border-b shrink-0">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">StatusLine 配置</h2>
        <p class="text-slate-500 text-sm mt-1">可视化编辑 StatusLine 状态栏配置</p>
      </div>
      <div class="flex items-center gap-4">
        <button
          class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isLoading || isSaving"
          @click="refreshConfig"
        >
          <RestoreOutlined class="w-4 h-4 inline-block mr-2" />
          刷新配置
        </button>
        <button
          class="btn-primary shadow-lg transition-all duration-200"
          :class="
            hasUnsavedChanges
              ? 'shadow-amber-500/30 bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400 ring-offset-2'
              : 'shadow-primary-500/20'
          "
          :disabled="isSaving"
          @click="handleSave"
        >
          <SaveOutlined class="w-4 h-4" />
          {{ isSaving ? "保存中..." : hasUnsavedChanges ? "保存配置 *" : "保存配置" }}
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="flex-1 flex items-center justify-center bg-white/50">
      <div class="flex flex-col items-center gap-3">
        <div
          class="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"
        ></div>
        <div class="text-slate-500 text-sm font-medium">加载中...</div>
      </div>
    </div>

    <div v-else class="flex-1 overflow-hidden flex flex-col gap-4 p-6">
      <div class="grid grid-cols-3 gap-2 flex-1 overflow-hidden min-h-0">
        <div class="flex flex-col gap-4 col-span-2 overflow-y-auto min-h-0 pr-2">
          <ThemeFontControls
            :current-style="statusLineConfig.currentStyle"
            :theme-names="themeNames"
            :auto-separator="autoSeparator"
            :show-icon="showIcon"
            :enabled="statusLineConfig.enabled"
            @update:style="(val) => switchThemeTemplate(val)"
            @toggle-auto-separator="toggleAutoSeparator"
            @toggle-show-icon="toggleShowIcon"
            @update:enabled="(val) => handleEnabledChange(val)"
            @add-theme="(name) => addThemeTemplate(name)"
            @delete-theme="(name) => deleteThemeTemplate(name)"
            @duplicate-theme="(name) => duplicateThemeTemplate(name)"
            @rename-theme="(oldName, newName) => renameThemeTemplate(oldName, newName)"
          />

          <div class="flex flex-col gap-4">
            <div class="min-h-[200px] shrink-0">
              <StatusLinePreview
                :modules="draggableModules"
                :current-style="statusLineConfig.currentStyle"
                :selected-index="selectedModuleIndex"
                :show-icon="showIcon"
                :render-module-preview="renderModulePreview"
                @update:selected="(idx) => (selectedModuleIndex = idx)"
                @update:modules="(val) => (draggableModules = val)"
                @reorder="() => {}"
              />
            </div>
            <div class="min-h-[200px] shrink-0">
              <ModulePalette @add="handleAddModule" />
            </div>
          </div>
        </div>

        <div
          class="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden col-span-1 shadow-sm hover:shadow-md transition-shadow"
        >
          <div class="flex border-b border-slate-100 bg-slate-50/50">
            <button
              class="flex-1 px-4 pt-4 pb-2 text-sm font-semibold relative transition-colors"
              :class="
                rightPanelTab === 'properties'
                  ? 'text-indigo-600 bg-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              "
              @click="rightPanelTab = 'properties'"
            >
              属性配置
              <span
                v-if="rightPanelTab === 'properties'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"
              ></span>
            </button>
            <button
              class="flex-1 px-4 pt-4 pb-2 text-sm font-semibold relative transition-colors"
              :class="
                rightPanelTab === 'preview'
                  ? 'text-indigo-600 bg-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              "
              @click="rightPanelTab = 'preview'"
            >
              预览数据
              <span
                v-if="rightPanelTab === 'preview'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"
              ></span>
            </button>
          </div>
          <div class="overflow-y-auto flex-1 flex flex-col h-full">
            <template v-if="rightPanelTab === 'properties'">
              <ModuleProperties
                :selected-module="selectedModule"
                :selected-module-index="selectedModuleIndex"
                :current-style="statusLineConfig.currentStyle"
                :preview-variables="previewVariables"
                @update-module="handleModuleChange"
                @delete-module="handleDeleteModule"
              />
            </template>
            <template v-else>
              <PreviewVariablesForm
                :preview-variables="previewVariables"
                @update="(key, val) => updatePreviewVariable(key, val)"
              />
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
