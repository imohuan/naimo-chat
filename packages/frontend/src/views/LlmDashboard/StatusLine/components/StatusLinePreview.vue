<script setup lang="ts">
import { computed } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import type { StatusLineModuleConfig } from "../types";
import ProgressBar from "./ProgressBar.vue";

const props = defineProps<{
  modules: StatusLineModuleConfig[];
  currentStyle: string;
  selectedIndex: number | null;
  showIcon: boolean;
  renderModulePreview: (
    module: StatusLineModuleConfig,
    isPowerline: boolean
  ) => {
    bgColorStyle?: Record<string, string>;
    bgColorClass?: string;
    textColorStyle?: Record<string, string>;
    textColorClass?: string;
    textStyle?: Record<string, string>;
    textClass?: string;
    borderLeftColor?: string;
    icon?: string;
    text: string;
    background?: string;
    // 进度条相关属性
    isProgress?: boolean;
    percentage?: number;
    progressLength?: number;
    progressStyle?: string;
    bgColor?: string;
    progressColor?: string;
  };
}>();

const emit = defineEmits<{
  (e: "update:selected", index: number): void;
  (e: "reorder"): void;
  (e: "update:modules", val: StatusLineModuleConfig[]): void;
}>();

const draggableModules = computed({
  get: () => props.modules,
  set: (val) => emit("update:modules", val),
});
</script>

<template>
  <div
    class="bg-white border rounded-xl p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow min-h-[200px]"
  >
    <div class="flex items-center justify-between mb-4 shrink-0">
      <h3 class="text-sm font-semibold text-slate-900">预览</h3>
    </div>
    <div
      class="rounded-lg bg-slate-900 text-white font-mono text-sm overflow-x-auto flex items-start justify-start border border-slate-800/50 p-4 shadow-inner min-h-[144px] ring-1 ring-slate-800/20"
      :class="
        props.currentStyle === 'powerline'
          ? 'gap-0 p-0 items-start relative min-h-[28px]'
          : 'gap-1 items-start min-h-[20px]'
      "
    >
      <template v-if="draggableModules.length > 0">
        <VueDraggable
          v-model="draggableModules"
          :animation="200"
          :item-key="(_: StatusLineModuleConfig, idx: number) => idx"
          class="flex items-center flex-wrap gap-2"
          ghost-class="drag-ghost"
          chosen-class="drag-chosen"
          drag-class="dragging"
          @end="emit('reorder')"
        >
          <template v-if="props.currentStyle === 'powerline'">
            <div
              v-for="(module, index) in draggableModules"
              :key="index"
              class="powerline-module px-4 cursor-pointer transition-all relative group"
              :class="[
                props.renderModulePreview(module, true)?.bgColorClass || '',
                props.renderModulePreview(module, true)?.textColorClass ||
                  'text-white',
                props.selectedIndex === index
                  ? 'shadow-md shadow-indigo-500/30 scale-[1.01] z-10'
                  : 'hover:shadow-sm hover:brightness-110',
              ]"
              :style="{
                ...props.renderModulePreview(module, true)?.bgColorStyle,
              }"
              @click="emit('update:selected', index)"
            >
              <div
                class="powerline-module-content"
                :style="{
                  ...props.renderModulePreview(module, true)?.textColorStyle,
                }"
              >
                <span
                  v-if="
                    props.showIcon &&
                    props.renderModulePreview(module, true)?.icon
                  "
                >
                  {{ props.renderModulePreview(module, true)?.icon }}
                </span>
                <template
                  v-if="props.renderModulePreview(module, true)?.isProgress"
                >
                  <ProgressBar
                    :percentage="
                      props.renderModulePreview(module, true)?.percentage ?? 0
                    "
                    :length="
                      props.renderModulePreview(module, true)?.progressLength ??
                      20
                    "
                    :style="
                      props.renderModulePreview(module, true)?.progressStyle ??
                      'block'
                    "
                    :bg-color="props.renderModulePreview(module, true)?.bgColor"
                    :progress-color="
                      props.renderModulePreview(module, true)?.progressColor
                    "
                    :height="14"
                  />
                </template>
                <span v-else>{{
                  props.renderModulePreview(module, true)?.text
                }}</span>
              </div>
              <div
                v-if="index < draggableModules.length - 1"
                class="powerline-separator"
                :style="{
                  borderLeftColor:
                    props.renderModulePreview(module, true)?.borderLeftColor ||
                    '#374151',
                }"
              ></div>
            </div>
          </template>
          <div
            v-else
            v-for="(module, index) in draggableModules"
            :key="index"
            class="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-all group"
            :class="[
              props.renderModulePreview(module, false)?.textClass || '',
              props.selectedIndex === index
                ? 'bg-white/25 shadow-md shadow-indigo-500/20'
                : 'hover:bg-white/15',
            ]"
            :style="props.renderModulePreview(module, false)?.textStyle"
            @click="emit('update:selected', index)"
          >
            <span
              v-if="
                props.showIcon && props.renderModulePreview(module, false)?.icon
              "
            >
              {{ props.renderModulePreview(module, false)?.icon }}
            </span>
            <template
              v-if="props.renderModulePreview(module, false)?.isProgress"
            >
              <ProgressBar
                :percentage="
                  props.renderModulePreview(module, false)?.percentage ?? 0
                "
                :length="
                  props.renderModulePreview(module, false)?.progressLength ?? 20
                "
                :style="
                  props.renderModulePreview(module, false)?.progressStyle ??
                  'block'
                "
                :bg-color="props.renderModulePreview(module, false)?.bgColor"
                :progress-color="
                  props.renderModulePreview(module, false)?.progressColor
                "
                :height="12"
              />
            </template>
            <span v-else>{{
              props.renderModulePreview(module, false)?.text
            }}</span>
          </div>
        </VueDraggable>
      </template>
      <div
        v-else
        class="flex flex-col items-center justify-center w-full py-8 text-center"
      >
        <div
          class="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3"
        >
          <svg
            class="w-5 h-5 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M12 5v14m-7-7h14"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
        <span class="text-sm text-slate-400 font-medium"
          >点击下方组件添加模块</span
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.powerline-module {
  display: inline-flex;
  align-items: center;
  height: 28px;
  position: relative;
  padding: 0 12px;
  overflow: visible;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.powerline-module-content {
  display: flex;
  align-items: center;
  gap: 5px;
  position: relative;
  z-index: 1;
}

.powerline-separator {
  width: 0;
  height: 0;
  border-top: 14px solid transparent;
  border-bottom: 14px solid transparent;
  border-left: 10px solid;
  position: absolute;
  right: -10px;
  top: 0;
  display: block;
  z-index: 0;
  transition: border-left-color 0.2s ease;
  border-left-color: #374151; /* 默认颜色 */
}
</style>
