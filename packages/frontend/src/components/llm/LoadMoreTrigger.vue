<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useIntersectionObserver, useDebounceFn } from "@vueuse/core";

const props = withDefaults(
  defineProps<{
    hasMore?: boolean;
    isLoadingMore?: boolean;
    enableCycleShowHide?: boolean;
    showCompletedMessage?: boolean;
  }>(),
  {
    hasMore: false,
    isLoadingMore: false,
    enableCycleShowHide: false,
    showCompletedMessage: false,
  }
);

const emit = defineEmits<{
  "load-more": [];
}>();

// 底部触发器元素引用
const loadMoreTrigger = ref<HTMLElement | null>(null);

// 控制触发器显示/隐藏，用于在没有滚动时触发 Intersection Observer
const showTrigger = ref(true);
let triggerInterval: number | null = null;

// Debounce 加载更多函数
const debouncedLoadMore = useDebounceFn(() => {
  if (props.hasMore && !props.isLoadingMore) {
    emit("load-more");
  }
}, 66);

// 使用 Intersection Observer 检测滚动到底部
useIntersectionObserver(
  loadMoreTrigger,
  ([entry]) => {
    const isIntersecting = entry?.isIntersecting;
    if (isIntersecting) {
      debouncedLoadMore();
    }
  },
  {
    threshold: 0.1,
    rootMargin: "50px",
  }
);

// 清理定时器的函数
function clearTriggerInterval() {
  if (triggerInterval !== null) {
    clearInterval(triggerInterval);
    triggerInterval = null;
  }
}

// 启动定时器切换触发器显示状态，以触发 Intersection Observer 检测
function startTriggerInterval() {
  clearTriggerInterval();
  if (props.hasMore && props.enableCycleShowHide) {
    triggerInterval = window.setInterval(() => {
      showTrigger.value = !showTrigger.value;
      // 使用 setTimeout 确保 DOM 更新后再切换回来
      setTimeout(() => {
        showTrigger.value = true;
      }, 50);
    }, 1000); // 每1秒切换一次
  }
}

// 监听 hasMore 和 enableCycleShowHide 变化，动态管理定时器
watch(
  () => [props.hasMore, props.enableCycleShowHide],
  () => {
    if (props.hasMore && props.enableCycleShowHide) {
      startTriggerInterval();
    } else {
      clearTriggerInterval();
    }
  },
  { immediate: true }
);

onMounted(() => {
  if (props.enableCycleShowHide) {
    startTriggerInterval();
  }
});

onUnmounted(() => {
  clearTriggerInterval();
});
</script>

<template>
  <!-- 加载更多触发器 -->
  <div v-if="hasMore && showTrigger" ref="loadMoreTrigger" class="p-4 text-center">
    <slot>
      <div v-if="isLoadingMore" class="text-sm text-slate-400">加载中...</div>
      <div v-else class="text-sm text-slate-400">滚动加载更多</div>
    </slot>
  </div>
  <div v-else-if="showCompletedMessage" class="p-4 text-center text-sm text-slate-400">
    已加载全部数据
  </div>
</template>
