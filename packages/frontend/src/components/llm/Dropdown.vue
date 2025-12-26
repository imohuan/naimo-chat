<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  limitShift,
  arrow,
} from "@floating-ui/vue";
import { onClickOutside, useMagicKeys } from "@vueuse/core";

const props = defineProps<{
  show: boolean;
  disabled?: boolean;
  minWidth?: number;
  maxWidth?: number;
  maxHeight?: number;
  spacing?: number;
  // position 若传入 'auto' 或不传，flip 中间件会自动处理
  position?: "bottom" | "top" | "left" | "right" | "auto";
  showArrow?: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
}>();

const referenceRef = ref<HTMLElement | null>(null); // 触发器
const floatingRef = ref<HTMLElement | null>(null); // 下拉框
const arrowRef = ref<HTMLElement | null>(null); // 箭头

// 1. 配置 Floating UI
const { floatingStyles, placement, middlewareData } = useFloating(
  referenceRef,
  floatingRef,
  {
    // 核心：当元素挂载时，autoUpdate 会自动监听 滚动、Resize、布局变化
    // 彻底解决 "内容变了定位没变" 的问题
    whileElementsMounted: autoUpdate,
    open: computed(() => props.show),
    placement: props.position === "auto" ? "bottom" : props.position || "bottom",
    strategy: "fixed", // 使用 fixed 定位，避免父级 overflow 干扰
    middleware: [
      // 间距
      offset(props.spacing || 8),

      // 自动翻转 (空间不足时切到上方)
      flip({
        fallbackAxisSideDirection: "start",
      }),

      // 自动偏移 (防止超出屏幕左右边界)
      shift({
        limiter: limitShift(),
        padding: 12, // 添加与窗口边界的边距
      }),

      // 核心：动态尺寸控制 (解决 maxHeight 问题)
      size({
        apply({ availableHeight, elements, rects }) {
          // 1. 宽度逻辑：默认最小宽度为触发器宽度
          const targetMinWidth = props.minWidth ?? rects.reference.width;

          Object.assign(elements.floating.style, {
            maxWidth: props.maxWidth ? `${props.maxWidth}px` : undefined,
            minWidth: `${targetMinWidth}px`,
            // 2. 高度逻辑：确保不超过屏幕可用空间，也不超过 props.maxHeight
            maxHeight: `${Math.min(availableHeight, props.maxHeight || 400)}px`,
          });
        },
      }),

      // 箭头
      arrow({
        element: arrowRef,
        padding: 8,
      }),
    ],
  }
);

// 计算箭头样式
const arrowStyles = computed(() => {
  const data = middlewareData.value.arrow;
  if (!data) return {};

  const { x, y } = data;
  const side = placement.value.split("-")[0] as "top" | "bottom" | "left" | "right";
  const staticSide = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right",
  }[side];

  // 根据方向旋转和显示边框
  // 默认是 border-l border-t (向上箭头方向是 45deg)
  const rotation = {
    top: "rotate(225deg)", // 向下
    bottom: "rotate(45deg)", // 向上
    left: "rotate(135deg)", // 向右
    right: "rotate(315deg)", // 向左
  }[side];

  return {
    left: x != null ? `${x}px` : "",
    top: y != null ? `${y}px` : "",
    [staticSide]: "-5px", // 稍微多偏移一点，盖住 border
    transform: rotation,
  };
});

// 2. 处理点击外部关闭 (使用 VueUse 简化)
onClickOutside(
  referenceRef,
  () => emit("update:show", false),
  { ignore: [floatingRef] } // 忽略点击下拉框内部
);

// 3. ESC 关闭
const { escape } = useMagicKeys();
if (escape) {
  watch(escape, (v) => {
    if (v && props.show) emit("update:show", false);
  });
}
</script>

<template>
  <div ref="referenceRef" class="relative">
    <!-- 触发器 Slot -->
    <slot
      name="trigger"
      :show="show"
      :toggle="() => emit('update:show', !show)"
      class="w-full"
    />

    <!-- 下拉内容 -->
    <Teleport to="body">
      <div
        v-if="show && !disabled"
        ref="floatingRef"
        :style="floatingStyles"
        class="z-50"
      >
        <div class="relative bg-white border border-slate-200 rounded-lg shadow-lg">
          <!-- 箭头 -->
          <div
            v-if="showArrow"
            ref="arrowRef"
            class="absolute w-2.5 h-2.5 bg-white border-l border-t border-slate-200 z-10"
            :style="arrowStyles"
          ></div>

          <!-- 滚动内容区 -->
          <div class="dropdown-content overflow-y-auto rounded-lg relative z-20 bg-white">
            <slot />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* floatingStyles 会自动处理 top/left/position。
     这里只需要处理内部样式。
  */
.dropdown-content {
  /* 确保 box-sizing 正确，避免 padding 撑破计算出的宽高 */
  box-sizing: border-box;
}
</style>
