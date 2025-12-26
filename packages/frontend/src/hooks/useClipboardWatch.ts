import { ref } from "vue";
import type { ClipboardWatchStatus } from "@/interface";
import { useLlmApi } from "./useLlmApi";

export function useClipboardWatch() {
  const { fetchClipboardWatchStatus, startClipboardWatch, stopClipboardWatch } = useLlmApi();

  const status = ref<ClipboardWatchStatus | null>(null);
  const enabled = ref(false);
  const loading = ref(false);

  async function refreshStatus() {
    try {
      loading.value = true;
      status.value = await fetchClipboardWatchStatus();
      enabled.value = !!status.value?.running;
    } finally {
      loading.value = false;
    }
  }

  async function toggle(next: boolean) {
    try {
      loading.value = true;
      const result = next ? await startClipboardWatch() : await stopClipboardWatch();
      status.value = result;
      enabled.value = !!result.running;
      return result;
    } finally {
      loading.value = false;
    }
  }

  return {
    status,
    enabled,
    loading,
    refreshStatus,
    toggle,
  };
}

