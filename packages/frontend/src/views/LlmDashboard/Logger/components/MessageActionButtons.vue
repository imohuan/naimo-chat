<script setup lang="ts">
import {
  CheckOutlined,
  ContentCopyOutlined,
  ExpandMoreOutlined,
  ExpandLessOutlined,
  WrapTextOutlined,
} from "@vicons/material";

interface Props {
  itemType: "message" | "full_response" | "error";
  itemData: any;
  shouldShowCollapse?: boolean;
  isCollapsed?: boolean;
  collapsedCharCount?: number;
  isCopySuccess?: boolean;
  hasScrollbar?: boolean;
  wordWrap?: boolean;
}

interface Emits {
  (e: "toggle-collapse"): void;
  (e: "copy-item"): void;
  (e: "toggle-word-wrap"): void;
}

const props = withDefaults(defineProps<Props>(), {
  shouldShowCollapse: false,
  isCollapsed: false,
  collapsedCharCount: 0,
  isCopySuccess: false,
  hasScrollbar: false,
  wordWrap: false,
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
        wrapButtonClass: "text-slate-400 hover:text-slate-600",
        wrapButtonActiveClass: "text-indigo-600 hover:text-indigo-700",
        hoverBgClass: "hover:bg-slate-100",
        borderColor: "border-slate-100",
      };
    case "full_response":
      return {
        copyButtonClass: "text-green-500 hover:text-green-700",
        copySuccessClass: "text-green-600",
        collapseButtonClass: "text-green-500 hover:text-green-700",
        wrapButtonClass: "text-green-500 hover:text-green-700",
        wrapButtonActiveClass: "text-green-600 hover:text-green-700",
        hoverBgClass: "hover:bg-green-100",
        borderColor: "border-green-100",
      };
    case "error":
      return {
        copyButtonClass: "text-red-500 hover:text-red-700",
        copySuccessClass: "text-green-600",
        collapseButtonClass: "text-red-500 hover:text-red-700",
        wrapButtonClass: "text-red-500 hover:text-red-700",
        wrapButtonActiveClass: "text-red-600 hover:text-red-700",
        hoverBgClass: "hover:bg-red-100",
        borderColor: "border-red-100",
      };
    default:
      return {
        copyButtonClass: "text-slate-400 hover:text-slate-600",
        copySuccessClass: "text-green-600",
        collapseButtonClass: "text-slate-400 hover:text-slate-600",
        wrapButtonClass: "text-slate-400 hover:text-slate-600",
        wrapButtonActiveClass: "text-indigo-600 hover:text-indigo-700",
        hoverBgClass: "hover:bg-slate-100",
        borderColor: "border-slate-100",
      };
  }
}

const {
  copyButtonClass,
  copySuccessClass,
  collapseButtonClass,
  wrapButtonClass,
  wrapButtonActiveClass,
  hoverBgClass,
  borderColor,
} = getButtonStyles();
</script>

<template>
  <!-- 底部按钮组 -->
  <div
    class="sticky bottom-0 flex items-center justify-end gap-1 pt-1 pb-2 px-4 border-t bg-inherit z-10 -mx-4 rounded-b-2xl"
    :class="borderColor"
  >
    <!-- 换行切换按钮 -->
    <button
      @click="emit('toggle-word-wrap')"
      class="text-xs p-1.5 rounded transition-colors duration-200"
      :class="[hoverBgClass, wordWrap ? wrapButtonActiveClass : wrapButtonClass]"
      :title="wordWrap ? '关闭自动换行' : '开启自动换行'"
    >
      <WrapTextOutlined class="w-3.5 h-3.5" />
    </button>

    <!-- 折叠按钮 -->
    <button
      v-if="shouldShowCollapse"
      @click="emit('toggle-collapse')"
      class="text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors duration-200"
      :class="[hoverBgClass, collapseButtonClass]"
    >
      <ExpandMoreOutlined v-if="isCollapsed" class="w-3.5 h-3.5" />
      <ExpandLessOutlined v-else class="w-3.5 h-3.5" />
      <span v-if="isCollapsed"> 展开 ({{ collapsedCharCount }} 字符) </span>
      <span v-else>折叠</span>
    </button>

    <!-- 复制按钮 -->
    <button
      @click="emit('copy-item')"
      class="text-xs p-1.5 rounded transition-colors duration-200"
      :class="[hoverBgClass, isCopySuccess ? copySuccessClass : copyButtonClass]"
      :title="isCopySuccess ? '已复制!' : '复制对象数据'"
    >
      <CheckOutlined v-if="isCopySuccess" class="w-3.5 h-3.5" />
      <ContentCopyOutlined v-else class="w-3.5 h-3.5" />
    </button>
  </div>
</template>
