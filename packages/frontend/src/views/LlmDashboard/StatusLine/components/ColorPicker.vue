<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Dropdown from "@/components/llm/Dropdown.vue";
import type { SelectOption } from "@/components/llm/BaseSelect.vue";
import { isHexColor } from "../utils";

const props = defineProps<{
  modelValue: string | null | undefined;
  options?: SelectOption[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
}>();

const isOpen = ref(false);
const rgbInput = ref("");
const colorInputRef = ref<HTMLInputElement | null>(null);

// 预设颜色选项（常用 RGB 颜色）
const defaultColorOptions: SelectOption[] = [
  { label: "黑色", value: "rgb(0, 0, 0)" },
  { label: "白色", value: "rgb(255, 255, 255)" },
  { label: "红色", value: "rgb(220, 38, 38)" },
  { label: "绿色", value: "rgb(22, 163, 74)" },
  { label: "蓝色", value: "rgb(59, 130, 246)" },
  { label: "黄色", value: "rgb(234, 179, 8)" },
  { label: "紫色", value: "rgb(168, 85, 247)" },
  { label: "青色", value: "rgb(6, 182, 212)" },
  { label: "橙色", value: "rgb(251, 146, 60)" },
  { label: "粉色", value: "rgb(236, 72, 153)" },
  { label: "棕色", value: "rgb(154, 52, 18)" },
  { label: "灰色", value: "rgb(107, 114, 128)" },
  { label: "亮红", value: "rgb(248, 113, 113)" },
  { label: "亮绿", value: "rgb(74, 222, 128)" },
  { label: "亮蓝", value: "rgb(147, 197, 253)" },
  { label: "亮黄", value: "rgb(253, 224, 71)" },
];

// 合并外部传入的 options 和默认的预设颜色
const colorOptions = computed(() => {
  if (props.options && props.options.length > 0) {
    return props.options;
  }
  return defaultColorOptions;
});

// HEX 转 RGB
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) return "rgb(0, 0, 0)";
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// RGB 转 HEX（用于 HTML5 color input）
function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!match || !match[1] || !match[2] || !match[3]) return "#000000";
  const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
  const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
  const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

// 检查是否为 RGB 格式
function isRgbColor(color: string): boolean {
  return /^rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color);
}

// 将任何颜色格式转换为 RGB
function toRgbColor(color: string): string {
  if (isRgbColor(color)) {
    return color;
  }
  if (isHexColor(color)) {
    return hexToRgb(color);
  }
  // 如果是预设颜色，尝试从选项中获取
  const option = props.options?.find((opt) => opt.value === color);
  if (option?.value && isHexColor(option.value as string)) {
    return hexToRgb(option.value as string);
  }
  if (option?.value && isRgbColor(option.value as string)) {
    return option.value as string;
  }
  // 如果有 colorStyle，尝试提取颜色
  if (option?.colorStyle?.backgroundColor) {
    const bgColor = option.colorStyle.backgroundColor;
    if (isHexColor(bgColor)) {
      return hexToRgb(bgColor);
    }
    if (isRgbColor(bgColor)) {
      return bgColor;
    }
  }
  return "rgb(0, 0, 0)";
}

// 计算当前显示的颜色值（始终显示 RGB）
const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder || "未选择颜色";
  return toRgbColor(props.modelValue);
});

// 计算当前颜色的实际显示值（用于色块背景和 HTML5 color input，需要 HEX）
const colorValue = computed(() => {
  if (!props.modelValue) return "#ffffff";

  const rgb = toRgbColor(props.modelValue);
  return rgbToHex(rgb);
});

// 计算当前颜色的类名（用于预设颜色）
const colorClass = computed(() => {
  if (!props.modelValue || isHexColor(props.modelValue) || isRgbColor(props.modelValue)) {
    return "";
  }

  const option = props.options?.find((opt) => opt.value === props.modelValue);
  return option?.colorClass || "";
});

// 当打开时，同步 rgbInput
watch(isOpen, (open) => {
  if (open && props.modelValue) {
    rgbInput.value = toRgbColor(props.modelValue);
  } else {
    rgbInput.value = "";
  }
});

// 处理颜色选择（HTML5 color input 返回 HEX，需要转换为 RGB）
const handleColorChange = (e: Event) => {
  const hexValue = (e.target as HTMLInputElement).value;
  const rgbValue = hexToRgb(hexValue);
  emit("update:modelValue", rgbValue);
};

// 处理预设颜色选择
const handlePresetColorClick = (option: SelectOption) => {
  // 预设颜色值转换为 RGB
  let rgbValue: string;
  const optionValue = option.value as string;

  if (isHexColor(optionValue)) {
    rgbValue = hexToRgb(optionValue);
  } else if (isRgbColor(optionValue)) {
    rgbValue = optionValue;
  } else if (option.colorStyle?.backgroundColor) {
    const bgColor = option.colorStyle.backgroundColor;
    if (isHexColor(bgColor)) {
      rgbValue = hexToRgb(bgColor);
    } else if (isRgbColor(bgColor)) {
      rgbValue = bgColor;
    } else {
      rgbValue = "rgb(0, 0, 0)";
    }
  } else {
    rgbValue = "rgb(0, 0, 0)";
  }
  emit("update:modelValue", rgbValue);
  isOpen.value = false;
};

// 检查选项是否被选中
const isOptionSelected = (option: SelectOption): boolean => {
  if (!props.modelValue) return false;
  const currentRgb = toRgbColor(props.modelValue);
  const optionRgb = toRgbColor(option.value as string);
  return currentRgb === optionRgb;
};

// 清除颜色
const handleClear = () => {
  emit("update:modelValue", null);
  isOpen.value = false;
};

// 打开调色盘时聚焦到 color input
const handleOpen = () => {
  isOpen.value = true;
  // 延迟聚焦，确保 DOM 已更新
  setTimeout(() => {
    colorInputRef.value?.focus();
  }, 100);
};
</script>

<template>
  <Dropdown v-model:show="isOpen" :min-width="280" position="top">
    <template #trigger>
      <button
        type="button"
        class="w-full flex items-center gap-3 px-3 py-2 border border-slate-300 rounded-md bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        @click="handleOpen"
      >
        <!-- 左侧色块 -->
        <span
          class="w-6 h-6 rounded-md border border-slate-300 shrink-0"
          :class="colorClass"
          :style="
            colorClass
              ? {}
              : {
                  backgroundColor: colorValue,
                }
          "
        ></span>
        <!-- 右侧颜色值 -->
        <span class="flex-1 text-left text-sm text-slate-700 font-mono">
          {{ displayValue }}
        </span>
        <!-- 下拉箭头 -->
        <svg
          class="w-4 h-4 text-slate-400 shrink-0 transition-transform"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
    </template>

    <div class="p-4 space-y-4">
      <!-- 标题和清除按钮 -->
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-semibold text-slate-700">选择颜色</h4>
        <button
          type="button"
          class="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
          @click="handleClear"
        >
          清除
        </button>
      </div>

      <!-- HTML5 颜色选择器和 RGB 颜色输入（横向布局） -->
      <div class="flex items-center gap-4">
        <!-- HTML5 颜色选择器 -->
        <div class="space-y-2 flex-1">
          <label class="text-xs font-medium text-slate-600">调色盘</label>
          <input
            ref="colorInputRef"
            type="color"
            :value="colorValue"
            class="w-full h-10 rounded border border-slate-300 cursor-pointer"
            @input="handleColorChange"
          />
        </div>

        <!-- RGB 颜色输入 -->
        <div class="space-y-2 flex-1">
          <label class="text-xs font-medium text-slate-600">颜色</label>
          <div class="w-full truncate h-9 rounded border border-slate-300 p-2 font-mono">
            {{ colorValue }}
          </div>
        </div>
      </div>

      <!-- 预设颜色选项 -->
      <div v-if="colorOptions.length > 0" class="space-y-2">
        <label class="text-xs font-medium text-slate-600">预设颜色</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="option in colorOptions"
            :key="option.value"
            type="button"
            class="inline-block cursor-pointer hover:opacity-80 transition-opacity rounded"
            :style="{
              width: '24px',
              height: '24px',
              border: isOptionSelected(option) ? '2px solid #6366f1' : '1px solid #e5e7eb',
              boxSizing: 'border-box',
              backgroundColor: (() => {
                const val = option.value as string;
                if (isRgbColor(val)) return val;
                if (isHexColor(val)) return val;
                return option.colorStyle?.backgroundColor as string || '#ffffff';
              })(),
            }"
            @click.stop="handlePresetColorClick(option)"
            :title="option.label"
          ></button>
        </div>
      </div>
    </div>
  </Dropdown>
</template>
