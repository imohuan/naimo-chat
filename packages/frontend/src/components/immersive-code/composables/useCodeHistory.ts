import { ref, computed, readonly, watch } from "vue";

export interface HistoryRecord {
  id: string;
  code: string;
  diffTarget?: string; // If present, implies we are in diff mode
  timestamp: number;
  isStreamingRecord?: boolean; // 标识是否由流式写入产生的记录
  /**
   * backend 原始字段，仅在通过 setHistory 注入时存在
   * originalCode: 进入 diff 模式时左侧（原始代码）
   */
  originalCode?: string;
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
  const lastNavigationTime = ref(0); // 记录最近一次历史导航的时间戳

  const currentVersion = computed(() => versions.value[currentVersionIndex.value]);

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
   * @param code 代码内容
   * @param diffTarget 可选的差异目标（用于 diff 模式）
   * @param isStreamingRecord 是否为流式写入产生的记录（用于 canvas 模式保存时过滤）
   */
  function record(code: string, diffTarget?: string, isStreamingRecord?: boolean) {
    const last = currentRecord.value;

    // De-duplication Logic
    // 1. If strict equality match on both code and diffTarget, do nothing.
    if (last && code === last.code && diffTarget === last.diffTarget) {
      return;
    }

    const v = currentVersion.value;
    if (!v || !v.records) return;

    // 2. 如果代码相同，但只是要清除 diffTarget（退出 diff 模式），更新当前记录而不是添加新记录
    const isCodeUnchanged = last && code === last.code;
    const isClearingDiffTarget = last?.diffTarget && !diffTarget;

    if (isCodeUnchanged && isClearingDiffTarget) {
      console.log(
        "🔄 [ImmersiveHistory] Code unchanged, updating current record to clear diffTarget"
      );
      // 更新当前记录的 diffTarget 为 undefined，避免重复添加历史记录
      // const currentRecordIndex = v.currentIndex;
      // if (v.records[currentRecordIndex]) {
      //   v.records[currentRecordIndex].diffTarget = undefined;
      //   v.records[currentRecordIndex].timestamp = Date.now();
      // }
      return;
    }

    // 保护机制：如果当前不在历史末尾，且新代码与当前记录相同，且最近刚导航过历史（1秒内）
    // 这很可能是切换历史导致的同步，而不是真正的编辑，应该忽略
    const now = Date.now();
    const timeSinceNavigation = now - lastNavigationTime.value;
    const isInMiddleOfHistory = v.currentIndex < v.records.length - 1;

    if (isInMiddleOfHistory && isCodeUnchanged && timeSinceNavigation < 1000) {
      console.log(
        `🚫 [ImmersiveHistory] Ignoring record: likely navigation sync (${timeSinceNavigation}ms ago)`
      );
      return;
    }

    // Remove future history if we are in the middle (Standard Undo/Redo behavior)
    if (v.currentIndex < v.records.length - 1) {
      console.log(
        `✂️ [ImmersiveHistory] Truncating future history from index ${v.currentIndex + 1}`
      );
      v.records = v.records.slice(0, v.currentIndex + 1);
    }

    const newRecord: HistoryRecord = {
      id: generateId(),
      code,
      diffTarget: diffTarget, // Can be undefined, which means EXIT diff mode
      timestamp: Date.now(),
      isStreamingRecord: isStreamingRecord ?? false,
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
      label: label || `版本 ${versions.value.length + 1}`,
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
      lastNavigationTime.value = Date.now(); // 记录导航时间
      currentVersion.value.currentIndex--;
    } else {
      console.warn("🚫 [ImmersiveHistory] Cannot Undo");
    }
  }

  function redo() {
    if (currentVersion.value && canRedo.value) {
      console.log("➡️ [ImmersiveHistory] Redo");
      lastNavigationTime.value = Date.now(); // 记录导航时间
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
      lastNavigationTime.value = Date.now(); // 记录导航时间
      currentVersionIndex.value = index;
    }
  }

  /**
   * 获取完整的历史版本数据（用于保存）
   * 包含完整的 records 字段，用于保存代码内容
   */
  function getHistory() {
    return {
      versions: versions.value.map((v) => ({
        id: v.id,
        timestamp: v.timestamp,
        label: v.label,
        records: v.records.map((r) => ({
          id: r.id,
          code: r.code,
          diffTarget: r.diffTarget,
          timestamp: r.timestamp,
          isStreamingRecord: r.isStreamingRecord,
        })),
        currentIndex: v.currentIndex,
      })),
      currentVersionIndex: currentVersionIndex.value,
    };
  }

  /**
   * 设置历史版本数据（用于恢复）
   * 如果版本没有 records 字段，会为每个版本创建一个默认的 record
   * 支持后端返回的 diff 和 originalCode 格式
   */
  function setHistory(history: {
    versions: Array<{
      id: string;
      timestamp: number;
      label: string;
      currentIndex?: number;
      records?: Array<{
        id: string;
        code?: string;
        diffTarget?: string;
        diff?: string; // 后端格式
        originalCode?: string; // 后端格式
        timestamp: number;
      }>;
    }>;
    currentVersionIndex: number;
  }) {
    if (history.versions && history.versions.length > 0) {
      // 为每个版本创建完整的 MajorVersion 结构
      versions.value = history.versions.map((v) => ({
        id: v.id,
        timestamp: v.timestamp,
        label: v.label,
        // 如果有 records，转换格式；否则创建一个默认的 record
        records:
          v.records && v.records.length > 0
            ? v.records.map((r) => {
              // 处理后端格式：如果有 diff 和 originalCode，但没有 code
              // 使用 originalCode 作为 code，diff 作为 diffTarget
              let code = r.code;
              let diffTarget = r.diffTarget;
              // 如果记录有 diff 和 originalCode，但没有 code（或 code 为空）
              if (r.diff && r.originalCode && (!r.code || r.code.trim() === "")) {
                code = r.originalCode;
                diffTarget = r.diff;
                console.log(
                  "🔄 [ImmersiveHistory] Converting diff record to diff mode",
                  {
                    recordId: r.id,
                    hasOriginalCode: !!r.originalCode,
                    hasDiff: !!r.diff,
                  }
                );
              } else if (r.diff && !diffTarget) {
                // 如果只有 diff 字段，使用它作为 diffTarget
                diffTarget = r.diff;
              }

              // 如果仍然没有 code，使用 originalCode 或空字符串
              if (!code || code.trim() === "") {
                code = r.originalCode || "";
              }

              return {
                id: r.id,
                code: code || "",
                diffTarget: diffTarget,
                timestamp: r.timestamp,
                originalCode: r.originalCode,
              } as HistoryRecord;
            })
            : [
              {
                id: generateId(),
                code: currentCode.value || "", // 使用当前代码或空字符串
                timestamp: v.timestamp,
              },
            ],
        currentIndex: v.currentIndex ?? 0,
      }));
      const validIndex = Math.max(
        0,
        Math.min(history.currentVersionIndex, versions.value.length - 1)
      );
      currentVersionIndex.value = validIndex;
      console.log("📥 [ImmersiveHistory] History restored", {
        versionCount: versions.value.length,
        currentIndex: currentVersionIndex.value,
      });
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
    getHistory,
    setHistory,
  };
}
