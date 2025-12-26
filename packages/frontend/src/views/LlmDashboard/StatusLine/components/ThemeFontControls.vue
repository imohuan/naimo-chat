<script setup lang="ts">
import { ref, nextTick } from "vue";
import {
  SegmentOutlined,
  ToggleOnOutlined,
  ToggleOffOutlined,
  VisibilityOutlined,
  VisibilityOffOutlined,
} from "@vicons/material";
import ThemeItem from "./ThemeItem.vue";

const props = defineProps<{
  currentStyle: string;
  themeNames: string[];
  autoSeparator: boolean;
  enabled: boolean;
  showIcon: boolean;
}>();

const emit = defineEmits<{
  (e: "update:style", value: string): void;
  (e: "toggleAutoSeparator"): void;
  (e: "toggleShowIcon"): void;
  (e: "update:enabled", value: boolean): void;
  (e: "add-theme", name: string): void;
  (e: "delete-theme", name: string): void;
  (e: "rename-theme", oldName: string, newName: string): void;
}>();

const editingThemeRefs = ref<Record<string, InstanceType<typeof ThemeItem> | null>>({});

function handleAddTheme(name: string) {
  emit("add-theme", name);
}

function handleDeleteTheme(name: string) {
  emit("delete-theme", name);
}

function handleRenameTheme(oldName: string, newName: string) {
  emit("rename-theme", oldName, newName);
  // 重置编辑状态（如果重命名成功，组件会重新渲染，ref 可能会变化）
  // 使用 nextTick 确保在 DOM 更新后重置
  nextTick(() => {
    const ref = editingThemeRefs.value[newName] || editingThemeRefs.value[oldName];
    if (ref) {
      ref.cancelEdit();
    }
  });
}

function handleThemeClick(name: string) {
  emit("update:style", name);
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-end gap-4 flex-wrap">
      <div class="space-y-2">
        <label class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >启用 StatusLine</label
        >
        <button
          class="btn-secondary h-[38px] px-3 flex items-center gap-2 transition-colors"
          :class="props.enabled ? 'bg-green-50 hover:bg-green-100' : ''"
          @click="emit('update:enabled', !props.enabled)"
          title="启用/禁用 StatusLine"
        >
          <component
            :is="props.enabled ? ToggleOnOutlined : ToggleOffOutlined"
            class="w-5 h-5"
            :class="props.enabled ? 'text-green-600' : ''"
          />
          <span class="text-xs font-medium" :class="props.enabled ? 'text-green-700' : ''"
            >启用 StatusLine</span
          >
        </button>
      </div>

      <div class="space-y-2">
        <label class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >工具</label
        >
        <div class="flex gap-2">
          <button
            class="btn-secondary h-[38px] px-3 flex items-center gap-2"
            :class="
              props.autoSeparator ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : ''
            "
            @click="emit('toggleAutoSeparator')"
            title="自动分割：在组件之间添加分割线"
          >
            <SegmentOutlined class="w-4 h-4" />
            <span class="text-xs font-medium">自动分割</span>
          </button>
          <button
            class="btn-secondary h-[38px] px-3 flex items-center gap-2"
            :class="
              props.showIcon ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : ''
            "
            @click="emit('toggleShowIcon')"
            title="切换是否显示图标"
          >
            <component
              :is="props.showIcon ? VisibilityOutlined : VisibilityOffOutlined"
              class="w-4 h-4"
            />
            <span class="text-xs font-medium">显示图标</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 主题模板列表 -->
    <div class="space-y-2">
      <label class="text-xs font-semibold text-slate-700 uppercase tracking-wider"
        >主题模板</label
      >
      <div class="flex flex-wrap gap-2">
        <!-- 添加主题 item（第一个） -->
        <ThemeItem mode="add" @confirm="handleAddTheme" @cancel="() => {}" />

        <!-- 主题模板列表 -->
        <ThemeItem
          v-for="name in themeNames"
          :key="name"
          :ref="(el) => (editingThemeRefs[name] = el as InstanceType<typeof ThemeItem> | null)"
          mode="edit"
          :name="name"
          :is-current="name === currentStyle"
          @confirm="(newName) => handleRenameTheme(name, newName)"
          @cancel="
            () => {
              const ref = editingThemeRefs[name];
              if (ref) {
                ref.cancelEdit();
              }
            }
          "
          @click="() => handleThemeClick(name)"
          @delete="() => handleDeleteTheme(name)"
        />
      </div>
    </div>
  </div>
</template>
