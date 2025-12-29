<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  percentage: number; // 0-100
  length: number; // 进度条长度（字符数）
  style: string; // 样式：block, thin, smooth, bar, dot
  bgColor?: string; // 背景颜色
  progressColor?: string; // 进度条颜色
  height?: number; // 高度（像素）
}>();

const percentageValue = computed(() => {
  if (props.percentage < 0) return 0;
  if (props.percentage > 100) return 100;
  return props.percentage;
});

// 将字符长度转换为像素宽度（每个字符约 8-10px，取决于字体）
const width = computed(() => props.length * 9);
const barHeight = computed(() => props.height || 12);

// 计算填充宽度
const filledWidth = computed(() => (percentageValue.value / 100) * width.value);

// 颜色处理
const bgColorValue = computed(() => {
  if (!props.bgColor) return "rgb(51, 65, 85)";
  return props.bgColor;
});

const progressColorValue = computed(() => {
  if (!props.progressColor) return "rgb(34, 211, 238)";
  return props.progressColor;
});

// 计算不同样式需要的元素数量
const thinStripeCount = computed(() => Math.floor(filledWidth.value / 2));
const barCount = computed(() => Math.floor(filledWidth.value / 4));
const dotCount = computed(() => Math.floor(filledWidth.value / 4));

// 生成唯一 ID 用于渐变
const gradientId = computed(() => `gradient-${props.length}-${Date.now()}`);
</script>

<template>
  <svg :width="width" :height="barHeight" class="progress-bar-svg">
    <defs v-if="style === 'smooth'">
      <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop
          offset="0%"
          :style="`stop-color:${progressColorValue};stop-opacity:0.8`"
        />
        <stop
          offset="100%"
          :style="`stop-color:${progressColorValue};stop-opacity:1`"
        />
      </linearGradient>
    </defs>
    <!-- 背景 -->
    <rect
      x="0"
      y="0"
      :width="width"
      :height="barHeight"
      rx="2"
      :fill="bgColorValue"
      opacity="0.3"
    />
    <!-- 进度条 -->
    <!-- Block 样式 -->
    <template v-if="style === 'block'">
      <rect
        x="0"
        y="0"
        :width="filledWidth"
        :height="barHeight"
        rx="2"
        :fill="progressColorValue"
      />
    </template>
    <!-- Thin 样式 -->
    <template v-else-if="style === 'thin'">
      <rect
        v-for="i in thinStripeCount"
        :key="i"
        :x="(i - 1) * 2"
        y="0"
        width="1.5"
        :height="barHeight"
        :fill="progressColorValue"
      />
    </template>
    <!-- Smooth 样式 -->
    <template v-else-if="style === 'smooth'">
      <rect
        x="0"
        y="0"
        :width="filledWidth"
        :height="barHeight"
        rx="2"
        :fill="`url(#${gradientId})`"
      />
    </template>
    <!-- Bar 样式 -->
    <template v-else-if="style === 'bar'">
      <rect
        v-for="i in barCount"
        :key="i"
        :x="(i - 1) * 4"
        y="0"
        width="3"
        :height="barHeight"
        :fill="progressColorValue"
      />
    </template>
    <!-- Dot 样式 -->
    <template v-else-if="style === 'dot'">
      <circle
        v-for="i in dotCount"
        :key="i"
        :cx="(i - 1) * 4 + 2"
        :cy="barHeight / 2"
        r="2"
        :fill="progressColorValue"
      />
    </template>
    <!-- 默认 Block 样式 -->
    <template v-else>
      <rect
        x="0"
        y="0"
        :width="filledWidth"
        :height="barHeight"
        rx="2"
        :fill="progressColorValue"
      />
    </template>
  </svg>
</template>

<style scoped>
.progress-bar-svg {
  display: inline-block;
  vertical-align: middle;
}
</style>
