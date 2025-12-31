<script setup lang="ts">
import { ref, watch } from "vue";
import { X, Copy, Wrench, Check } from "lucide-vue-next";

const props = defineProps<{
  errorMessage: string | null;
}>();

const emit = defineEmits<{
  close: [];
  fix: [];
  copy: [];
}>();

const isVisible = ref(false);
const isCopied = ref(false);
const showTimeout = ref<ReturnType<typeof setTimeout> | null>(null);

// 监听错误消息变化
watch(
  () => props.errorMessage,
  (newMessage) => {
    if (newMessage) {
      // 如果已经有显示中的提示，先清除之前的定时器
      if (showTimeout.value) {
        clearTimeout(showTimeout.value);
      }
      // 显示新的错误提示
      isVisible.value = true;
      isCopied.value = false;
    } else {
      // 隐藏错误提示
      isVisible.value = false;
    }
  },
  { immediate: true }
);

// 处理关闭
function handleClose() {
  isVisible.value = false;
  emit("close");
}

// 处理修复
function handleFix() {
  emit("fix");
}

// 处理复制
async function handleCopy() {
  if (!props.errorMessage) return;

  try {
    await navigator.clipboard.writeText(
      `<error_message>${props.errorMessage}</error_message>`
    );
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
    emit("copy");
  } catch (err) {
    console.error("复制失败:", err);
  }
}
</script>

<template>
  <Transition name="error-notification">
    <div
      v-if="isVisible && errorMessage"
      class="error-notification absolute bottom-4 left-4 z-50 max-w-md bg-white rounded-lg overflow-hidden"
    >
      <!-- 右上角关闭按钮 -->
      <div class="absolute top-2 right-2 z-10">
        <button
          @click="handleClose"
          class="p-1 text-slate-400 hover:text-slate-600 transition rounded hover:bg-slate-100"
          title="关闭"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 内容区域 -->
      <div class="p-4 pr-10">
        <!-- 错误标题 -->
        <div class="flex items-center gap-2 mb-2">
          <div class="w-2 h-2 rounded-full bg-red-500"></div>
          <span class="text-sm font-semibold text-red-700">错误</span>
        </div>

        <!-- 错误信息 -->
        <div class="text-sm text-slate-700 mb-3 wrap-break-word">
          {{ errorMessage }}
        </div>

        <!-- 按钮组 -->
        <div class="flex items-center gap-2">
          <button
            @click="handleFix"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm font-medium"
          >
            <Wrench class="w-3.5 h-3.5" />
            <span>修复</span>
          </button>

          <button
            @click="handleCopy"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition text-sm font-medium"
          >
            <Check v-if="isCopied" class="w-3.5 h-3.5 text-green-600" />
            <Copy v-else class="w-3.5 h-3.5" />
            <span>{{ isCopied ? "已复制" : "复制" }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 错误提示容器样式 */
.error-notification {
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 10px 20px -5px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(0, 0, 0, 0.1);
}

/* 入场动画 */
.error-notification-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.error-notification-enter-from {
  opacity: 0;
  transform: translateX(-100%) scale(0.9);
}

.error-notification-enter-to {
  opacity: 1;
  transform: translateX(0) scale(1);
}

/* 出场动画 */
.error-notification-leave-active {
  transition: all 0.25s ease-in;
}

.error-notification-leave-from {
  opacity: 1;
  transform: translateX(0) scale(1);
}

.error-notification-leave-to {
  opacity: 0;
  transform: translateX(-100%) scale(0.9);
}
</style>
