<script setup lang="ts">
import type { ToastItem } from "../../interface";
import {
  CheckCircleOutlined,
  ErrorOutlined,
  InfoOutlined,
  CloseOutlined,
} from "@vicons/material";

defineProps<{
  toasts: ToastItem[];
}>();

const emit = defineEmits<{
  close: [id: number];
}>();
</script>

<template>
  <!-- <div class="absolute top-20 right-6 z-50 flex flex-col gap-3 pointer-events-none"> -->
  <div
    class="absolute bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"
  >
    <TransitionGroup name="toast" tag="div" class="flex flex-col gap-3">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="
          toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-white border-slate-200 text-slate-700'
        "
        class="pointer-events-auto min-w-[280px] p-4 rounded-lg shadow-lg border flex items-start gap-3"
      >
        <component
          :is="
            toast.type === 'error'
              ? ErrorOutlined
              : toast.type === 'success'
              ? CheckCircleOutlined
              : InfoOutlined
          "
          class="w-5 h-5 shrink-0"
          :class="
            toast.type === 'error'
              ? 'text-red-500'
              : toast.type === 'success'
              ? 'text-green-500'
              : 'text-blue-500'
          "
        />
        <div class="text-sm font-medium flex-1">{{ toast.message }}</div>
        <button
          class="text-slate-400 hover:text-slate-600"
          @click="emit('close', toast.id)"
        >
          <CloseOutlined class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.25s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-enter-to {
  opacity: 1;
  transform: translateX(0);
}

.toast-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}
</style>
