<script setup lang="ts">
import {
  CheckOutlined,
  ContentCopyOutlined,
  ExpandMoreOutlined,
  ExpandLessOutlined,
} from "@vicons/material";

interface Props {
  itemType: "message" | "full_response" | "error";
  itemData: any;
  shouldShowCollapse?: boolean;
  isCollapsed?: boolean;
  collapsedCharCount?: number;
  isCopySuccess?: boolean;
}

interface Emits {
  (e: "toggle-collapse"): void;
  (e: "copy-item"): void;
}

const props = withDefaults(defineProps<Props>(), {
  shouldShowCollapse: false,
  isCollapsed: false,
  collapsedCharCount: 0,
  isCopySuccess: false,
});

const emit = defineEmits<Emits>();

// 根据消息类型获取按钮样式和分隔线颜色
function getButtonStyles() {
  switch (props.itemType) {
    case "message":
      return {
        copyButtonClass: "text-slate-400 hover:text-slate-600",
        copySuccessClass: "text-green-600",
        collapseButtonClass: "text-slate-400 hover:text-slate-600",
        borderColor: "border-slate-100",
      };
    case "full_response":
      return {
        copyButtonClass: "text-green-500 hover:text-green-700",
        copySuccessClass: "text-green-600",
        collapseButtonClass: "text-slate-400 hover:text-slate-600",
        borderColor: "border-green-100",
      };
    case "error":
      return {
        copyButtonClass: "text-red-500 hover:text-red-700",
        copySuccessClass: "text-green-600",
        collapseButtonClass: "text-slate-400 hover:text-slate-600",
        borderColor: "border-red-100",
      };
    default:
      return {
        copyButtonClass: "text-slate-400 hover:text-slate-600",
        copySuccessClass: "text-green-600",
        collapseButtonClass: "text-slate-400 hover:text-slate-600",
        borderColor: "border-slate-100",
      };
  }
}

const {
  copyButtonClass,
  copySuccessClass,
  collapseButtonClass,
  borderColor,
} = getButtonStyles();
</script>

<template>
  <!-- 底部按钮组 -->
  <div
    class="sticky bottom-0 flex items-center justify-end gap-1 pt-1 pb-2 px-4 border-t bg-inherit z-10 -mx-4 rounded-b-2xl"
    :class="borderColor"
  >
    <!-- 折叠按钮 -->
    <button
      v-if="shouldShowCollapse"
      @click="emit('toggle-collapse')"
      class="text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors duration-200 hover:bg-slate-100"
      :class="collapseButtonClass"
    >
      <ExpandMoreOutlined v-if="isCollapsed" class="w-3.5 h-3.5" />
      <ExpandLessOutlined v-else class="w-3.5 h-3.5" />
      <span v-if="isCollapsed"> 展开 ({{ collapsedCharCount }} 字符) </span>
      <span v-else>折叠</span>
    </button>

    <!-- 复制按钮 -->
    <button
      @click="emit('copy-item')"
      class="text-xs p-1.5 rounded transition-colors duration-200 hover:bg-slate-100"
      :class="isCopySuccess ? copySuccessClass : copyButtonClass"
      :title="isCopySuccess ? '已复制!' : '复制对象数据'"
    >
      <CheckOutlined v-if="isCopySuccess" class="w-3.5 h-3.5" />
      <ContentCopyOutlined v-else class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
