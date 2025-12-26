import { ref } from "vue";
import type { ToastItem } from "../interface";

const toasts = ref<ToastItem[]>([]);

function pushToast(message: string, type: ToastItem["type"] = "info", duration = 3000) {
  const id = Date.now();
  toasts.value.push({ id, message, type });
  setTimeout(() => removeToast(id), duration);
}

function removeToast(id: number) {
  toasts.value = toasts.value.filter((item) => item.id !== id);
}

export function useToasts() {
  return {
    toasts,
    pushToast,
    removeToast,
  };
}

