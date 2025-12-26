import { ref, computed, readonly } from "vue";

export interface HistoryRecord {
  id: string;
  code: string;
  timestamp: number;
}

export interface MajorVersion {
  id: string;
  timestamp: number;
  label: string;
  records: HistoryRecord[];
  currentIndex: number;
}

export function useCodeHistory(initialCode: string = "") {
  const versions = ref<MajorVersion[]>([
    {
      id: generateId(),
      timestamp: Date.now(),
      label: "Initial Version",
      records: [
        {
          id: generateId(),
          code: initialCode,
          timestamp: Date.now(),
        },
      ],
      currentIndex: 0,
    },
  ]);

  const currentVersionIndex = ref(0);

  const currentVersion = computed(
    () => versions.value[currentVersionIndex.value]
  );

  const currentRecord = computed(() => {
    const v = currentVersion.value;
    return v.records[v.currentIndex];
  });

  const currentCode = computed(() => currentRecord.value?.code || "");

  const canUndo = computed(() => {
    const v = currentVersion.value;
    return v ? v.currentIndex > 0 : false;
  });
  const canRedo = computed(() => {
    const v = currentVersion.value;
    return v ? v.currentIndex < v.records.length - 1 : false;
  });

  function generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  /**
   * Add a new minor record (editor history) to the current Major Version.
   */
  function record(code: string) {
    // If code hasn't changed, ignore
    if (code === currentCode.value) return;

    const v = currentVersion.value;
    if (!v) return;

    // Remove future history if we are in the middle
    if (v.currentIndex < v.records.length - 1) {
      v.records = v.records.slice(0, v.currentIndex + 1);
    }

    v.records.push({
      id: generateId(),
      code,
      timestamp: Date.now(),
    });
    v.currentIndex = v.records.length - 1;
  }

  /**
   * Add a new Major Version.
   * This effectively starts a new history chain.
   */
  function addMajorVersion(code: string, label?: string) {
    const newVersion: MajorVersion = {
      id: generateId(),
      timestamp: Date.now(),
      label: label || `Version ${versions.value.length + 1}`,
      records: [
        {
          id: generateId(),
          code: code,
          timestamp: Date.now(),
        },
      ],
      currentIndex: 0,
    };

    versions.value.push(newVersion);
    currentVersionIndex.value = versions.value.length - 1;
  }

  function undo() {
    if (currentVersion.value && canUndo.value) {
      currentVersion.value.currentIndex--;
    }
  }

  function redo() {
    if (currentVersion.value && canRedo.value) {
      currentVersion.value.currentIndex++;
    }
  }

  /**
   * Switch to a specific Major Version index
   */
  function switchVersion(index: number) {
    if (index >= 0 && index < versions.value.length) {
      currentVersionIndex.value = index;
    }
  }

  return {
    versions: readonly(versions),
    currentVersionIndex: readonly(currentVersionIndex),
    currentVersion,
    currentRecord,
    currentCode,
    canUndo,
    canRedo,
    record,
    addMajorVersion,
    undo,
    redo,
    switchVersion,
  };
}
