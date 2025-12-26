<template>
  <n-config-provider class="h-full">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <n-loading-bar-provider>
            <ContextInitializer />
            <RouterView />
            <ToastList :toasts="toastsList" @close="handleRemoveToast" />
          </n-loading-bar-provider>
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { RouterView } from "vue-router";
import {
  NConfigProvider,
  NMessageProvider,
  NNotificationProvider,
  NDialogProvider,
  NLoadingBarProvider,
} from "naive-ui";
import { initContext, type GlobalContext } from "./core/context";
import ToastList from "./components/llm/ToastList.vue";
import { useToasts } from "./hooks/useToasts";

const context = ref<GlobalContext | null>(null);

// 直接使用 useToasts 获取 toasts ref，确保响应式正确
const { toasts: toastsList, removeToast: handleRemoveToast } = useToasts();

// 内部组件：用于在 Provider 内部初始化 context
const ContextInitializer = {
  setup() {
    // 在 Provider 内部调用，此时 composables 可以正常工作
    const ctx = initContext();
    // 立即设置 context，以便 ToastList 可以访问
    context.value = ctx;
    return () => null; // 不渲染任何内容
  },
};
</script>
