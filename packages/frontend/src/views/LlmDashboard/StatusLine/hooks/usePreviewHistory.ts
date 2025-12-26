import { ref, computed, watch, onMounted, onUnmounted, type Ref } from "vue";
import { useRefHistory, useDebounceFn } from "@vueuse/core";

// 保留 PreviewVariables 接口供其他地方使用
export interface PreviewVariables {
  workDirName: string;
  gitBranch: string;
  model: string;
  inputTokens: string;
  outputTokens: string;
  [key: string]: string;
}

/**
 * usePreviewHistory 配置选项
 */
export interface UsePreviewHistoryOptions {
  /** 是否启用键盘快捷键（Ctrl+Z/Ctrl+Y）默认 true */
  enableKeyboardShortcuts?: boolean;
  /** 防抖时间（毫秒），默认 100 */
  debounceMs?: number;
  /** 历史记录容量，默认 50 */
  capacity?: number;
  /** 是否开启调试日志，默认 false */
  debug?: boolean;
}

/**
 * 通用历史记录 hooks
 * 支持基于 JSON.stringify 的数据监听，延迟记录，支持 Ctrl+Z/Ctrl+Y 撤销恢复
 * 
 * @param sourceRef 需要追踪历史记录的响应式 ref
 * @param options 配置选项
 * @returns 历史记录相关的状态和方法
 */
export function usePreviewHistory<T extends Record<string, any>>(
  sourceRef: Ref<T>,
  options: UsePreviewHistoryOptions = {}
) {
  const {
    enableKeyboardShortcuts = true,
    debounceMs = 100,
    capacity = 50,
    debug = false,
  } = options;

  // 日志辅助函数
  const log = (...args: any[]) => {
    if (debug) {
      console.log("[usePreviewHistory]", ...args);
    }
  };

  const logError = (...args: any[]) => {
    if (debug) {
      console.error("[usePreviewHistory]", ...args);
    }
  };

  // 基于 JSON.stringify 的字符串 ref，用于历史记录追踪
  const serializedValue = ref<string>(JSON.stringify(sourceRef.value));

  // 标志位：防止循环更新
  let isUpdatingFromHistory = false;

  log("初始化，初始值:", sourceRef.value);
  log("初始序列化值:", serializedValue.value);

  // 使用 useRefHistory 管理历史记录
  const {
    history,
    undo: originalUndo,
    redo: originalRedo,
    canUndo,
    canRedo,
    clear: clearHistory,
    commit,
  } = useRefHistory(serializedValue, {
    capacity,
    deep: false,
    clone: (v) => v, // JSON 字符串已经是不可变的，不需要克隆
    dump: (v) => v,
    parse: (v) => v,
  });

  // 从历史记录同步到 sourceRef 的辅助函数
  const syncFromHistory = () => {
    if (history.value.length === 0) {
      return;
    }

    // 获取当前的历史记录快照（最后一个元素）
    const currentSnapshot = history.value[history.value.length - 1]?.snapshot;
    if (!currentSnapshot) {
      return;
    }

    const currentSerialized = JSON.stringify(sourceRef.value);

    // 如果值不同，需要更新
    if (currentSerialized !== currentSnapshot) {
      log("syncFromHistory: 同步历史记录到 sourceRef");
      log("syncFromHistory: 当前值:", currentSerialized);
      log("syncFromHistory: 历史值:", currentSnapshot);

      try {
        const parsed = JSON.parse(currentSnapshot) as T;
        isUpdatingFromHistory = true;
        sourceRef.value = parsed;
        // 也更新 serializedValue 以保持一致
        if (serializedValue.value !== currentSnapshot) {
          serializedValue.value = currentSnapshot;
        }
        setTimeout(() => {
          isUpdatingFromHistory = false;
        }, 50);
      } catch (e) {
        logError("syncFromHistory: 解析失败:", e);
        isUpdatingFromHistory = false;
      }
    }
  };

  // 包装 undo/redo 函数，添加日志并确保更新 sourceRef
  const undo = () => {
    log("undo() 开始执行");
    log("执行前状态:", {
      serializedValue: serializedValue.value,
      historyLength: history.value.length,
      canUndo: canUndo.value,
      canRedo: canRedo.value,
    });

    if (!canUndo.value) {
      log("无法撤销（canUndo 为 false）");
      return;
    }

    originalUndo();

    log("undo() 执行后状态:", {
      serializedValue: serializedValue.value,
      historyLength: history.value.length,
      canUndo: canUndo.value,
      canRedo: canRedo.value,
    });

    // 手动同步历史记录到 sourceRef
    // 使用 setTimeout 确保 useRefHistory 内部更新完成
    setTimeout(() => {
      syncFromHistory();
    }, 0);
  };

  const redo = () => {
    log("redo() 开始执行");
    log("执行前状态:", {
      serializedValue: serializedValue.value,
      historyLength: history.value.length,
      canUndo: canUndo.value,
      canRedo: canRedo.value,
    });

    if (!canRedo.value) {
      log("无法恢复（canRedo 为 false）");
      return;
    }

    originalRedo();

    log("redo() 执行后状态:", {
      serializedValue: serializedValue.value,
      historyLength: history.value.length,
      canUndo: canUndo.value,
      canRedo: canRedo.value,
    });

    // 手动同步历史记录到 sourceRef
    // 使用 setTimeout 确保 useRefHistory 内部更新完成
    setTimeout(() => {
      syncFromHistory();
    }, 0);
  };

  // 监听 history 变化
  watch(
    history,
    (newHistory) => {
      log("历史记录变化，长度:", newHistory.length);
      log("canUndo:", canUndo.value, "canRedo:", canRedo.value);
      if (newHistory.length > 0) {
        log("最新历史记录:", newHistory[newHistory.length - 1]);
      }
    },
    { deep: true }
  );

  // 监听 canUndo/canRedo 变化
  watch(canUndo, (val) => {
    log("canUndo 变化:", val);
  });
  watch(canRedo, (val) => {
    log("canRedo 变化:", val);
  });

  // 确保初始状态被记录到历史中
  onMounted(() => {
    // 延迟一帧，确保 useRefHistory 初始化完成
    setTimeout(() => {
      log("onMounted: 提交初始状态");
      commit();
      log("提交后历史记录长度:", history.value.length);
    }, 0);
  });

  // 防抖函数，延迟更新序列化值
  const debouncedUpdateSerialized = useDebounceFn(() => {
    log("debouncedUpdateSerialized 被调用");
    // 如果正在从历史记录更新，跳过
    if (isUpdatingFromHistory) {
      log("跳过更新（正在从历史记录更新）");
      return;
    }
    const newSerialized = JSON.stringify(sourceRef.value);
    log("准备更新序列化值:", {
      oldValue: serializedValue.value,
      newValue: newSerialized,
      isEqual: serializedValue.value === newSerialized,
    });
    // 只在值真正改变时更新
    if (serializedValue.value !== newSerialized) {
      log("更新 serializedValue");
      serializedValue.value = newSerialized;
    } else {
      log("跳过更新（值未改变）");
    }
  }, debounceMs);

  // 立即更新序列化值的函数（用于手动触发）
  const updateSerializedImmediately = () => {
    log("updateSerializedImmediately 被调用");
    if (isUpdatingFromHistory) {
      log("跳过立即更新（正在从历史记录更新）");
      return;
    }
    const newSerialized = JSON.stringify(sourceRef.value);
    if (serializedValue.value !== newSerialized) {
      log("立即更新 serializedValue:", newSerialized);
      serializedValue.value = newSerialized;
    }
  };

  // 监听 sourceRef 的变化，延迟更新序列化值
  watch(
    sourceRef,
    (newVal, oldVal) => {
      log("sourceRef 变化:", {
        newVal,
        oldVal,
        isUpdatingFromHistory,
      });
      // 如果正在从历史记录更新，跳过
      if (isUpdatingFromHistory) {
        log("跳过防抖更新（正在从历史记录更新）");
        return;
      }
      log("触发防抖更新");
      debouncedUpdateSerialized();
    },
    { deep: true }
  );

  // 当序列化值被撤销/恢复时，同步更新 sourceRef
  watch(
    serializedValue,
    (newValue, oldValue) => {
      log("serializedValue 变化:", {
        newValue,
        oldValue,
        isUpdatingFromHistory,
      });
      // 如果正在从历史记录更新，跳过（防止循环）
      if (isUpdatingFromHistory) {
        log("跳过同步 sourceRef（正在从历史记录更新）");
        return;
      }
      try {
        const parsed = JSON.parse(newValue) as T;
        const currentSerialized = JSON.stringify(sourceRef.value);
        log("比较序列化值:", {
          currentSerialized,
          newValue,
          isEqual: currentSerialized === newValue,
        });
        // 避免循环更新：只在值真正改变时更新
        if (currentSerialized !== newValue) {
          log("更新 sourceRef:", parsed);
          isUpdatingFromHistory = true;
          sourceRef.value = parsed;
          // 延迟重置标志，确保更新完成
          setTimeout(() => {
            log("重置 isUpdatingFromHistory 标志");
            isUpdatingFromHistory = false;
          }, 50);
        } else {
          log("跳过更新 sourceRef（值未改变）");
        }
      } catch (e) {
        logError("解析失败:", e);
        isUpdatingFromHistory = false;
      }
    },
    { immediate: false }
  );

  // 键盘事件处理：Ctrl+Z 撤销，Ctrl+Y 恢复
  const handleKeyDown = (e: KeyboardEvent) => {
    // 检查当前焦点是否在可编辑元素中
    const target = e.target as HTMLElement;
    const isEditableElement =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("[contenteditable]");

    // 如果焦点在可编辑元素中，不触发撤销/恢复操作
    if (isEditableElement) {
      log("键盘事件被忽略（在可编辑元素中）:", e.key);
      return;
    }

    // Ctrl+Z 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      log("Ctrl+Z 被按下，canUndo:", canUndo.value);
      e.preventDefault();
      if (canUndo.value) {
        log("执行 undo()");
        undo();
        log("undo() 执行后，serializedValue:", serializedValue.value);
      } else {
        log("无法撤销（canUndo 为 false）");
      }
    }

    // Ctrl+Y 或 Ctrl+Shift+Z 恢复
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      log("Ctrl+Y/Ctrl+Shift+Z 被按下，canRedo:", canRedo.value);
      e.preventDefault();
      if (canRedo.value) {
        log("执行 redo()");
        redo();
        log("redo() 执行后，serializedValue:", serializedValue.value);
      } else {
        log("无法恢复（canRedo 为 false）");
      }
    }
  };

  // 注册键盘事件监听（如果启用）
  onMounted(() => {
    if (enableKeyboardShortcuts) {
      document.addEventListener("keydown", handleKeyDown);
    }
  });

  onUnmounted(() => {
    if (enableKeyboardShortcuts) {
      document.removeEventListener("keydown", handleKeyDown);
    }
  });

  // 从历史记录恢复（用于点击历史记录项时）
  // 这个方法会直接设置数据，并立即更新历史记录
  function restoreFromHistory(historyItem: T) {
    isUpdatingFromHistory = true;
    sourceRef.value = { ...historyItem };
    // 立即更新序列化值，这样会创建一个新的历史记录项
    // 这样用户可以通过 Ctrl+Z 撤销这个恢复操作
    setTimeout(() => {
      isUpdatingFromHistory = false;
      updateSerializedImmediately();
    }, 10);
  }

  // 获取历史记录列表（用于显示）
  const previewHistory = computed(() => {
    return history.value
      .map((item) => {
        try {
          return JSON.parse(item.snapshot) as T;
        } catch {
          return null;
        }
      })
      .filter((item): item is T => item !== null)
      .slice(-10); // 只保留最近 10 条
  });

  return {
    previewHistory,
    restoreFromHistory,
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
    commit,
  };
}
