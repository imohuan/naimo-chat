import { ref, computed, readonly } from "vue";

export interface HistoryRecord {
  id: string;
  code: string;
  timestamp: number;
}

export function useCodeHistory(initialCode: string = "") {
  const history = ref<HistoryRecord[]>([
    {
      id: generateId(),
      code: initialCode,
      timestamp: Date.now(),
    },
  ]);
  const currentIndex = ref(0);

  const currentRecord = computed(() => history.value[currentIndex.value]);
  const currentCode = computed(() => currentRecord.value.code);

  const canUndo = computed(() => currentIndex.value > 0);
  const canRedo = computed(() => currentIndex.value < history.value.length - 1);

  function generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  /**
   * Add a new record to history.
   * If we are not at the end of history, this branches off (removes future records).
   */
  function record(code: string) {
    if (code === currentCode.value) return;

    // Remove future history if we are in the middle
    if (currentIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, currentIndex.value + 1);
    }

    history.value.push({
      id: generateId(),
      code,
      timestamp: Date.now(),
    });
    currentIndex.value = history.value.length - 1;
  }

  function undo() {
    if (canUndo.value) {
      currentIndex.value--;
    }
  }

  function redo() {
    if (canRedo.value) {
      currentIndex.value++;
    }
  }

  function jumpTo(index: number) {
    if (index >= 0 && index < history.value.length) {
      currentIndex.value = index;
    }
  }

  function clear() {
    history.value = [history.value[currentIndex.value]];
    currentIndex.value = 0;
  }

  return {
    history: readonly(history),
    currentIndex: readonly(currentIndex),
    currentRecord,
    currentCode,
    canUndo,
    canRedo,
    record,
    undo,
    redo,
    jumpTo,
    clear,
  };
}
