import { ref, computed, readonly, watch } from "vue";

export interface HistoryRecord {
  id: string;
  code: string;
  diffTarget?: string; // If present, implies we are in diff mode
  timestamp: number;
}

export interface MajorVersion {
  id: string;
  timestamp: number;
  label: string;
  records: HistoryRecord[];
  currentIndex: number;
}

// Global debug interface
declare global {
  interface Window {
    __ImmersiveHistory__?: any;
  }
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
    return v && v.records ? v.records[v.currentIndex] : null;
  });

  const currentCode = computed(() => currentRecord.value?.code || "");
  const currentDiffTarget = computed(() => currentRecord.value?.diffTarget);

  const canUndo = computed(() => {
    const v = currentVersion.value;
    return v ? v.currentIndex > 0 : false;
  });
  const canRedo = computed(() => {
    const v = currentVersion.value;
    return v && v.records ? v.currentIndex < v.records.length - 1 : false;
  });

  // Debugging & Logging
  watch(
    [
      currentVersionIndex,
      () => currentVersion.value?.currentIndex,
      currentCode,
      currentDiffTarget,
    ],
    () => {
      const state = {
        MajorVersion: currentVersionIndex.value,
        MinorIndex: currentVersion.value?.currentIndex,
        TotalRecords: currentVersion.value?.records.length,
        HasDiffTarget: !!currentDiffTarget.value,
        CurrentCodeLen: currentCode.value.length,
        DiffTargetLen: currentDiffTarget.value?.length || 0,
      };

      console.groupCollapsed("📜 [ImmersiveHistory] State Update");
      console.table(state);
      console.log("Current Record:", currentRecord.value);
      console.groupEnd();

      // Update global window object
      if (typeof window !== "undefined") {
        window.__ImmersiveHistory__ = {
          versions: versions.value,
          currentVersion: currentVersion.value,
          currentRecord: currentRecord.value,
          functions: { record, undo, redo, addMajorVersion, switchVersion },
        };
      }
    },
    { deep: true, immediate: true }
  );

  function generateId() {
    return Math.random().toString(36).substring(2, 9);
  }

  /**
   * Add a new minor record (editor history) to the current Major Version.
   */
  function record(code: string, diffTarget?: string) {
    const last = currentRecord.value;

    // De-duplication Logic
    // 1. If strict equality match on both code and diffTarget, do nothing.
    if (last && code === last.code && diffTarget === last.diffTarget) {
      return;
    }

    const v = currentVersion.value;
    if (!v || !v.records) return;

    // Remove future history if we are in the middle (Standard Undo/Redo behavior)
    if (v.currentIndex < v.records.length - 1) {
      console.log(
        `✂️ [ImmersiveHistory] Truncating future history from index ${
          v.currentIndex + 1
        }`
      );
      v.records = v.records.slice(0, v.currentIndex + 1);
    }

    const newRecord: HistoryRecord = {
      id: generateId(),
      code,
      diffTarget: diffTarget, // Can be undefined, which means EXIT diff mode
      timestamp: Date.now(),
    };

    v.records.push(newRecord);
    v.currentIndex = v.records.length - 1;

    console.log("📝 [ImmersiveHistory] Recorded new state", {
      id: newRecord.id,
      hasDiff: !!diffTarget,
      codeSnippet: code.substring(0, 30).replace(/\n/g, "\\n") + "...",
    });
  }

  /**
   * Add a new Major Version.
   * This effectively starts a new history chain.
   */
  function addMajorVersion(code: string, label?: string) {
    console.group("🌟 [ImmersiveHistory] New Major Version");
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
    console.log("Created:", newVersion);
    console.groupEnd();
  }

  function undo() {
    if (currentVersion.value && canUndo.value) {
      console.log("⬅️ [ImmersiveHistory] Undo");
      currentVersion.value.currentIndex--;
    } else {
      console.warn("🚫 [ImmersiveHistory] Cannot Undo");
    }
  }

  function redo() {
    if (currentVersion.value && canRedo.value) {
      console.log("➡️ [ImmersiveHistory] Redo");
      currentVersion.value.currentIndex++;
    } else {
      console.warn("🚫 [ImmersiveHistory] Cannot Redo");
    }
  }

  /**
   * Switch to a specific Major Version index
   */
  function switchVersion(index: number) {
    if (index >= 0 && index < versions.value.length) {
      console.log(`🔀 [ImmersiveHistory] Switching to Major Version ${index}`);
      currentVersionIndex.value = index;
    }
  }

  return {
    versions: readonly(versions),
    currentVersionIndex: readonly(currentVersionIndex),
    currentVersion,
    currentRecord,
    currentCode,
    currentDiffTarget,
    canUndo,
    canRedo,
    record,
    addMajorVersion,
    undo,
    redo,
    switchVersion,
  };
}
