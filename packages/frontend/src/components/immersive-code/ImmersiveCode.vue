<script setup lang="ts">
import {
  ref,
  watch,
  computed,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import {
  Undo2,
  Redo2,
  Code2,
  Share2,
  RefreshCcw,
  Terminal,
  MousePointer2,
  History,
} from "lucide-vue-next";
import { useCodeHistory } from "./composables/useCodeHistory";
import { useCodeDiff } from "./composables/useCodeDiff";
import PreviewFrame from "./components/PreviewFrame.vue";
import ConsolePanel, { type LogEntry } from "./components/ConsolePanel.vue";
import ImmersiveDiffEditor from "./components/ImmersiveDiffEditor.vue"; // Import Component
import CodeEditor from "../code/CodeEditor.vue";
import LoadingProgressBar from "./components/LoadingProgressBar.vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DEFAULT_CODE from "./default-ui.html?raw";

/**
 * Initial Code Template
 */
const props = withDefaults(
  defineProps<{
    initialCode?: string;
    enableShare?: boolean;
    readonly?: boolean;
    title?: string;
  }>(),
  {}
);

// Define emits for error notifications
const emit = defineEmits<{
  error: [message: string];
  "element-selected": [selector: string, data?: any];
  "ctrl-i-pressed": [
    data: { code: string; startLine: number; endLine: number }
  ];
  "diff-exited": [code: string, recordId?: string];
}>();

const {
  versions,
  currentVersionIndex,
  currentCode,
  currentDiffTarget, // Added
  currentRecord, // Added: 获取当前记录以获取 recordId
  canUndo,
  canRedo,
  record,
  addMajorVersion,
  addMajorDiffVersion,
  undo,
  redo,
  switchVersion,
  getHistory,
  setHistory,
} = useCodeHistory(props.initialCode ?? DEFAULT_CODE);

const { applyDiff } = useCodeDiff();

// View State
const uiMode = ref<"code" | "preview">("code"); // Renamed to avoid conflict with computed 'mode'
const showConsole = ref(false);
const consoleExpanded = ref(false);
const logs = ref<LogEntry[]>([]);
const previewKey = ref(0);
const editorValue = ref(currentCode.value);
const fontSize = ref(14); // 字体大小状态
const isNavigatingHistory = ref(false); // 标志：是否正在切换历史版本
let navigationTimer: ReturnType<typeof setTimeout> | null = null; // 导航保护计时器
const isRefreshing = ref(false); // 标志：是否正在刷新预览
const isElementSelectorActive = ref(false); // 标志：元素选择器是否激活
const isStreaming = ref(false); // 标志：是否正在流式写入
const isLoadingPreview = ref(false); // 标志：预览是否正在加载
const previewLoadError = ref(false); // 标志：预览加载是否失败
const throttledPreviewCode = ref(""); // 节流后的预览代码（用于流式写入期间）
let throttleTimer: ReturnType<typeof setTimeout> | null = null; // 节流计时器
let isThrottling = false; // 标志：是否正在节流期间内

// Editor Refs
const codeEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null);
const diffEditorRef = ref<InstanceType<typeof ImmersiveDiffEditor> | null>(
  null
);
const previewFrameRef = ref<InstanceType<typeof PreviewFrame> | null>(null);

// Computed Mode based on History
const mode = computed<"code" | "preview" | "diff">(() => {
  // If we have a diff target, check if we should be in diff mode
  if (currentDiffTarget.value) {
    const record = currentRecord.value as
      | (typeof currentRecord.value & { originalCode?: string })
      | null;
    const currentCodeValue = currentCode.value;

    // 参考第 205-209 行的逻辑：如果同时存在 originalCode 和 code，且二者不相等，
    // 说明当前 code 已经是「应用 diff 之后」的结果，此时不应该进入 diff 模式。
    // 这种记录通常来自后端已经应用过 diff 并把最终代码保存在 code 字段的情况。
    if (
      record?.originalCode &&
      currentCodeValue.trim() !== "" &&
      currentCodeValue.trim() !== record.originalCode.trim()
    ) {
      // 代码已经应用过 diff，不应该进入 diff 模式
      return uiMode.value;
    }
    // 否则，进入 diff 模式
    return "diff";
  }
  // Otherwise, use the UI mode selected by the user
  return uiMode.value;
});

// 预览代码：流式写入期间使用节流后的 editorValue，否则使用 currentCode
const previewCode = computed(() => {
  // 流式写入期间，使用节流后的代码（每500ms更新一次）
  if (isStreaming.value) {
    return throttledPreviewCode.value || editorValue.value;
  }
  // 否则使用历史记录中的 currentCode
  return currentCode.value;
});

// 监听模式变化，同步字体大小
watch(
  () => mode.value,
  async (newMode, oldMode) => {
    // 从 code 模式进入 diff 模式
    if (oldMode === "code" && newMode === "diff") {
      // 等待 DiffEditor 挂载
      await nextTick();
      // 从 CodeEditor 获取当前字体大小
      const editor = codeEditorRef.value?.getEditor();
      if (editor) {
        const monaco = codeEditorRef.value?.getMonaco();
        if (monaco) {
          const currentFontSize = editor.getOption(
            monaco.editor.EditorOption.fontSize
          );
          fontSize.value = currentFontSize;
          // 等待一下确保 DiffEditor 已完全初始化
          setTimeout(() => {
            if (diffEditorRef.value) {
              diffEditorRef.value.setFontSize(currentFontSize);
            }
          }, 100);
        }
      }
    }
    // 从 diff 模式退出到 code 模式
    else if (oldMode === "diff" && newMode === "code") {
      // 从 DiffEditor 获取当前字体大小
      if (diffEditorRef.value) {
        const currentFontSize = diffEditorRef.value.getFontSize();
        fontSize.value = currentFontSize;
        // 等待 CodeEditor 重新挂载
        await nextTick();
        // 同步到 CodeEditor
        const editor = codeEditorRef.value?.getEditor();
        if (editor) {
          editor.updateOptions({ fontSize: currentFontSize });
        }
      }
    }
  }
);

// Diff State
// For Diff Editor, the "Modified" side is the target of the diff (the proposal)
// The "Original" side is the current code (what we are editing/keeping into)
// Diff State
// The "Modified" side is computed by applying the stored DIFF (patch) to the current code.
// This makes the history the single source of truth for the Diff state.
// 使用 ref 存储 diff 应用结果，避免在计算属性中重复计算
const diffResult = ref<{ content: string; success: boolean; message?: string }>(
  {
    content: "",
    success: true,
  }
);

// 监听 diff 应用，只在需要时执行一次
watch(
  [currentDiffTarget, currentCode],
  () => {
    if (!currentDiffTarget.value) {
      diffResult.value = { content: "", success: true };
      // 退出 diff 模式
      exitDiffMode();
      return;
    }

    const record = currentRecord.value as
      | (typeof currentRecord.value & { originalCode?: string })
      | null;
    const currentCodeValue = currentCode.value;

    // 复用 mode 计算属性的逻辑：如果 mode 不是 "diff"，说明不应该进入 diff 模式
    // 这通常是因为代码已经应用过 diff（存在 originalCode 且当前代码不等于 originalCode）
    if (mode.value !== "diff") {
      console.log(
        "🔄 [ImmersiveCode] Skip auto diff: code already includes applied diff",
        {
          recordId: record?.id,
        }
      );
      // 保持 diffResult.content 与当前代码一致，避免右侧为空白
      diffResult.value = { content: currentCodeValue, success: true };
      // 退出 diff 模式
      exitDiffMode();
      return;
    }

    // 默认情况下，如果有 originalCode，则以 originalCode 作为 diff 的基准；
    // 否则以当前代码作为基准。
    const baseCode = record?.originalCode ?? currentCodeValue;

    console.log("🔄 [ImmersiveCode] Applying diff:", {
      baseCodeLength: baseCode.length,
      currentCodeLength: currentCodeValue.length,
      diffTargetLength: currentDiffTarget.value.length,
      diffTargetPreview: currentDiffTarget.value.substring(0, 200),
      fullDiffTarget: currentDiffTarget.value,
    });

    // 执行一次 diff 应用
    const result = applyDiff(baseCode, currentDiffTarget.value);
    diffResult.value = result;

    console.log("📊 [ImmersiveCode] Diff application result:", {
      success: result.success,
      message: result.message,
      appliedCount: result.appliedCount,
      failedBlocks: result.failedBlocks,
      resultContentLength: result.content.length,
      resultContentPreview: result.content.substring(0, 200),
    });

    // 如果应用失败，自动退出 diff 模式
    if (!result.success) {
      console.warn(
        "⚠️ [ImmersiveCode] Failed to apply stored diff to current code:",
        result.message,
        {
          currentCode: currentCode.value.substring(0, 200),
          diffTarget: currentDiffTarget.value,
          failedBlocks: result.failedBlocks,
        }
      );
      // 自动退出 diff 模式
      exitDiffMode();
    }
  },
  { immediate: true }
);

// 计算属性使用存储的结果
const diffResultCode = computed(() => {
  if (!currentDiffTarget.value) return "";
  return diffResult.value.success
    ? diffResult.value.content
    : currentCode.value; // 失败时返回当前代码
});

const diffSuccess = ref(false);

// 流式写入方法
function startStreaming() {
  console.log("🌊 [ImmersiveCode] Starting streaming mode");
  isStreaming.value = true;
  // 重置节流状态
  isThrottling = false;
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
  // 初始化节流后的预览代码
  throttledPreviewCode.value = editorValue.value;
}

function endStreaming() {
  console.log("🌊 [ImmersiveCode] Ending streaming mode");
  isStreaming.value = false;
  // 清除节流状态
  isThrottling = false;
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
  // 立即更新节流后的预览代码为最终值
  throttledPreviewCode.value = editorValue.value;
  // 流式写入结束后，记录一次最终状态，并标记为流式写入记录
  // 无论当前模式如何，都应该记录最新的代码
  if (mode.value === "code") {
    record(editorValue.value, undefined, true);
  } else if (mode.value === "diff") {
    record(editorValue.value, currentDiffTarget.value, true);
  } else if (mode.value === "preview") {
    // 预览模式下也需要记录代码
    record(editorValue.value, undefined, true);
  }
}

function streamWrite(code: string) {
  if (!isStreaming.value) {
    console.warn(
      "⚠️ [ImmersiveCode] streamWrite called but not in streaming mode"
    );
    return;
  }

  console.log("🌊 [ImmersiveCode] streamWrite called:", {
    codeLength: code.length,
    mode: mode.value,
    hasCodeEditorRef: !!codeEditorRef.value,
  });

  // 直接更新编辑器值，不记录历史（历史记录在 endStreaming 时统一记录）
  // 这样可以避免在流式写入过程中频繁记录历史
  editorValue.value = code;

  // 确保代码编辑器也同步更新（如果编辑器已初始化）
  // 使用 nextTick 确保编辑器已经挂载
  nextTick(() => {
    if (mode.value === "code" && codeEditorRef.value) {
      const editor = codeEditorRef.value.getEditor();
      if (editor) {
        const currentValue = editor.getValue();
        if (currentValue !== code) {
          console.log("🌊 [ImmersiveCode] Updating editor value:", {
            currentLength: currentValue.length,
            newLength: code.length,
          });
          editor.setValue(code);
        } else {
          console.log(
            "🌊 [ImmersiveCode] Editor value unchanged, skipping update"
          );
        }
      } else {
        console.warn("⚠️ [ImmersiveCode] Editor not available");
      }
    } else if (mode.value === "diff" && diffEditorRef.value) {
      // 在 diff 模式下，流式写入应该更新右侧（modified side）
      // 获取 diff 编辑器的 modified editor 并更新其内容
      const diffEditor = diffEditorRef.value.getDiffEditor();
      if (diffEditor) {
        const modifiedEditor = diffEditor.getModifiedEditor();
        const modifiedModel = modifiedEditor.getModel();
        if (modifiedModel && modifiedModel.getValue() !== code) {
          modifiedModel.setValue(code);
        }
      }
    } else if (mode.value === "preview") {
      // 预览模式下不需要更新编辑器，editorValue 已经更新
      // 历史记录会在 endStreaming 时统一记录
      console.log("🌊 [ImmersiveCode] Preview mode: editorValue updated");
    } else {
      console.warn("⚠️ [ImmersiveCode] Cannot update editor:", {
        mode: mode.value,
        hasCodeEditorRef: !!codeEditorRef.value,
        hasDiffEditorRef: !!diffEditorRef.value,
      });
    }
  });
}

/**
 * 切换到预览模式并选中指定元素
 * @param selector 元素选择器
 */
function selectElementInPreview(selector: string) {
  console.log("🔍 [ImmersiveCode] Selecting element in preview:", selector);

  // 1. 切换到预览模式
  uiMode.value = "preview";

  // 2. 等待模式切换和 iframe 加载完成后再选中元素
  nextTick(() => {
    // 等待 iframe 加载
    const trySelect = (retryCount: number = 0) => {
      const maxRetries = 20;

      if (previewFrameRef.value?.selectElementBySelector) {
        previewFrameRef.value.selectElementBySelector(selector);
        console.log("✅ [ImmersiveCode] Element selected in preview");
      } else {
        if (retryCount < maxRetries) {
          setTimeout(() => {
            trySelect(retryCount + 1);
          }, 100);
        } else {
          console.warn(
            "⚠️ [ImmersiveCode] Failed to select element after max retries"
          );
        }
      }
    };

    trySelect();
  });
}

/**
 * 设置代码并选中指定行区域，滚动到可视区域
 * @param code 要设置的代码
 * @param startLine 开始行号（从1开始）
 * @param endLine 结束行号（从1开始）
 * @param retryCount 内部重试计数器，外部调用时不需要传递
 */
function setCodeAndSelectLines(
  code: string,
  startLine: number,
  endLine: number,
  retryCount: number = 0
) {
  const maxRetries = 10; // 最大重试次数

  console.log("📝 [ImmersiveCode] Setting code and selecting lines:", {
    codeLength: code.length,
    startLine,
    endLine,
    retryCount,
  });

  // 1. 切换到代码模式
  uiMode.value = "code";

  // 2. 等待模式切换完成后再设置代码和选中
  nextTick(() => {
    // 3. 标记正在导航，避免触发自动历史记录
    isNavigatingHistory.value = true;

    // 4. 直接记录到历史（作为新版本），然后设置代码
    record(code);
    editorValue.value = code;

    // 5. 等待编辑器更新完成后再选中和滚动
    nextTick(() => {
      const editor = codeEditorRef.value?.getEditor();
      const monaco = codeEditorRef.value?.getMonaco();

      if (editor && monaco) {
        // 确保行号有效
        const model = editor.getModel();
        if (!model) {
          // 清除导航标记
          setTimeout(() => {
            isNavigatingHistory.value = false;
          }, 100);
          return;
        }

        const totalLines = model.getLineCount();
        const safeStartLine = Math.max(1, Math.min(startLine, totalLines));
        const safeEndLine = Math.max(
          safeStartLine,
          Math.min(endLine, totalLines)
        );

        // 6. 设置选中区域
        editor.setSelection({
          startLineNumber: safeStartLine,
          startColumn: 1,
          endLineNumber: safeEndLine,
          endColumn: model.getLineMaxColumn(safeEndLine),
        });

        // 7. 滚动到选中区域，使其在可视区域中心
        editor.revealLineInCenter(safeStartLine);

        // 如果选中多行，也确保结束行可见
        if (safeEndLine !== safeStartLine) {
          editor.revealLineInCenter(safeEndLine);
        }

        // 清除导航标记
        setTimeout(() => {
          isNavigatingHistory.value = false;
        }, 100);

        console.log("✅ [ImmersiveCode] Code set and lines selected:", {
          safeStartLine,
          safeEndLine,
        });
      } else {
        if (retryCount < maxRetries) {
          console.warn(
            `⚠️ [ImmersiveCode] Editor not ready yet, retrying... (${
              retryCount + 1
            }/${maxRetries})`
          );
          // 如果编辑器还没准备好，延迟重试
          setTimeout(() => {
            setCodeAndSelectLines(code, startLine, endLine, retryCount + 1);
          }, 100);
        } else {
          console.error(
            "❌ [ImmersiveCode] Failed to set code after max retries"
          );
          // 清除导航标记
          setTimeout(() => {
            isNavigatingHistory.value = false;
          }, 100);
        }
      }
    });
  });
}

// 获取上一个主要版本的代码
function getPreviousVersionCode(): string {
  if (currentVersionIndex.value > 0) {
    const previousVersion = versions.value[currentVersionIndex.value - 1];
    if (
      previousVersion &&
      previousVersion.records &&
      previousVersion.records.length > 0
    ) {
      const lastRecordIndex =
        previousVersion.currentIndex ?? previousVersion.records.length - 1;
      return previousVersion.records[lastRecordIndex]?.code || "";
    }
  }
  // 如果当前版本有多个记录，获取上一个记录的代码
  const currentVersion = versions.value[currentVersionIndex.value];
  if (
    currentVersion &&
    currentVersion.records &&
    currentVersion.records.length > 1
  ) {
    const previousRecordIndex =
      (currentVersion.currentIndex ?? currentVersion.records.length - 1) - 1;
    if (previousRecordIndex >= 0) {
      return currentVersion.records[previousRecordIndex]?.code || "";
    }
  }
  return "";
}

// Expose methods for parent control
defineExpose({
  addMajorVersion: (code?: string, label?: string) => {
    // 优先使用传入的代码，否则使用 editorValue（最新的编辑器值），最后才使用 currentCode
    const codeToUse = code || editorValue.value || currentCode.value;
    return addMajorVersion(codeToUse, label);
  },
  addMajorDiffVersion: (
    code: string,
    diffTarget: string,
    recordId: string,
    label?: string
  ) => {
    console.group("🔄 [ImmersiveCode] Adding Major Diff Version");

    // 1. Validate the Diff
    const dryRun = applyDiff(code, diffTarget);
    if (!dryRun.success) {
      console.warn("⚠️ [ImmersiveCode] Diff (Dry Run) Failed:", dryRun.message);
      console.groupEnd();
      return {
        success: false,
        appliedCount: dryRun.appliedCount,
        message: dryRun.message || "未找到可以應用的 Diff。",
      };
    }

    // 2. Create new major version with diff record
    addMajorDiffVersion(code, diffTarget, recordId, label);

    // 3. Set diff success flag to trigger UI update
    diffSuccess.value = true;

    console.log(
      "✅ [ImmersiveCode] Major Diff Version created and diff mode activated"
    );
    console.groupEnd();
    return { success: true, message: "Major Diff Version created." };
  },
  getCurrentCode: () => {
    return editorValue.value || currentCode.value;
  },
  getPreviousVersionCode,
  /**
   * Enter Diff/Contrast Mode
   * @param diffContent The RAW diff content (SEARCH/REPLACE blocks)
   * @param originalContent Optional: Update the "original" (base) code before comparing.
   */
  diff: (diffContent: string, originalContent?: string) => {
    console.group("🔄 [ImmersiveCode] Triggering Diff Mode (Raw)");

    // 1. Optionally update base code first
    const baseCode =
      originalContent !== undefined ? originalContent : currentCode.value;

    // 2. Validate the Diff?
    // We *could* validate it here, but generally we want to just store it.
    // However, checking if it applies cleanly is good feedback.
    const dryRun = applyDiff(baseCode, diffContent);
    if (!dryRun.success) {
      console.warn("⚠️ [ImmersiveCode] Diff (Dry Run) Failed:", dryRun.message);

      // 没有找到可應用的內容時，直接退出 / 保持在非 diff 模式
      // 不記錄這次 diff，並且主動調用 exitDiffMode 以確保從現有 diff 狀態中退出
      exitDiffMode({ finalContent: baseCode });

      console.groupEnd();
      return {
        success: false,
        appliedCount: dryRun.appliedCount,
        message: dryRun.message || "未找到可以應用的 Diff。",
      };
    }

    // 3. Record new state:
    // Code: baseCode (The state we are coming FROM / keeping)
    // DiffTarget: diffContent (The raw patch)
    console.log("Recording Raw Diff:", {
      baseLen: baseCode.length,
      diffLen: diffContent.length,
    });
    record(baseCode, diffContent);

    diffSuccess.value = true;
    console.groupEnd();
    return { success: true, message: "Opening Diff View with Raw Patch." };
  },
  // 流式写入相关方法
  startStreaming,
  endStreaming,
  streamWrite,
  // 设置代码并选中行
  setCodeAndSelectLines,
  // 在预览模式中选中元素
  selectElementInPreview,
  // 获取和设置历史版本
  getHistory,
  setHistory,
});

// Sync Editor -> History (Debounced)
// 使用可取消的防抖函数
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const debouncedRecord = (val: string) => {
  // 如果正在流式写入，不记录历史
  if (isStreaming.value) {
    return;
  }
  // 如果正在切换历史版本，取消之前的防抖任务并直接返回
  if (isNavigatingHistory.value) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    return;
  }
  // 取消之前的防抖任务
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  // 设置新的防抖任务
  debounceTimer = setTimeout(() => {
    // Only record if we are in 'code' mode
    if (
      mode.value === "code" &&
      !isNavigatingHistory.value &&
      !isStreaming.value
    ) {
      record(val);
    }
    debounceTimer = null;
  }, 800);
};

watch(editorValue, (val) => {
  if (mode.value === "code") {
    debouncedRecord(val);
  }
  // 在流式写入期间，使用节流更新预览代码（每500ms更新一次）
  if (isStreaming.value) {
    // 如果不在节流期间内，立即更新并开始节流
    if (!isThrottling) {
      throttledPreviewCode.value = val;
      isThrottling = true;
      // 设置定时器，500ms后清除节流标志，允许下一次更新
      throttleTimer = setTimeout(() => {
        isThrottling = false;
        throttleTimer = null;
        // 节流期间结束后，立即更新到最新的值（如果有变化）
        if (editorValue.value !== throttledPreviewCode.value) {
          throttledPreviewCode.value = editorValue.value;
        }
      }, 500);
    }
    // 如果正在节流期间内，忽略本次触发（不更新）
  }
});

// Sync History -> Editor
watch(currentCode, (val) => {
  if (val !== editorValue.value) {
    // 标记正在切换历史版本，防止编辑器变化触发记录
    isNavigatingHistory.value = true;
    // 取消任何待执行的防抖记录任务
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    // 清除之前的导航保护计时器（如果存在）
    if (navigationTimer) {
      clearTimeout(navigationTimer);
      navigationTimer = null;
    }
    editorValue.value = val;
    // 等待编辑器同步完成后再清除标志
    nextTick(() => {
      // 使用更长的延迟确保编辑器完全同步后再允许记录
      // 快速切换时，新的切换会清除这个计时器并重新设置
      navigationTimer = setTimeout(() => {
        isNavigatingHistory.value = false;
        navigationTimer = null;
      }, 500);
    });
  }
});

// Adjust line numbers in stack trace or caller for about:srcdoc
// Replace about:srcdoc with index.html and adjust line numbers
function adjustStackTrace(text: string | undefined, lineOffset: number | undefined): string | undefined {
  if (!text || !lineOffset) return text;

  return text.replace(/about:srcdoc:(\d+)(:\d+)/mg, (_match, lineNum, suffix) => {
    const originalLine = parseInt(lineNum, 10);
    // Only adjust if the line number is greater than the offset
    // (meaning it's in user code, not in injected scripts)
    if (originalLine > lineOffset) {
      const adjustedLine = originalLine - lineOffset;
      return `index.html:${adjustedLine}${suffix}`;
    }
    // If line number is within injected scripts, still replace but don't adjust
    return `index.html:${originalLine}${suffix}`;
  });
}

// Console handling
function handleLog(log: any) {
  // Adjust stack trace and caller before creating entry
  const adjustedStack = adjustStackTrace(log.stack, log.lineOffset);
  const adjustedCaller = adjustStackTrace(log.caller, log.lineOffset);

  // Add to logs
  const entry: LogEntry = {
    method: log.method || "log",
    args: log.args || (log.message ? [log.message] : [log]), // Normalize
    timestamp: new Date().toLocaleTimeString(),
    caller: adjustedCaller,
    stack: adjustedStack,
    lineOffset: log.lineOffset,
  };
  logs.value.push(entry);

  // Emit error notification if it's an error
  if (entry.method === "error") {
    // const errorMessage = JSON.stringify(entry.args?.[0], null) + "\n" + entry.stack;
    const errorMessage = `error: ${entry.args?.[0]?.message}\nstack: ${entry.stack}\ncaller: ${entry.caller}`;
    emit("error", errorMessage);
  }
}

function clearConsole() {
  logs.value = [];
}

function handleElementSelected(selector: string, data?: any) {
  emit("element-selected", selector, data);
}

function handleToggleConsole() {
  showConsole.value = !showConsole.value;
}

function handleToggleElementSelector(enabled: boolean) {
  isElementSelectorActive.value = enabled;
}

function refreshPreview() {
  isRefreshing.value = true;
  isLoadingPreview.value = true;
  previewLoadError.value = false;
  previewKey.value++;
  clearConsole();
  // 等待 PreviewFrame 的 load-complete 或 load-error 事件来更新状态
}

function handlePreviewLoadComplete() {
  isRefreshing.value = false;
  isLoadingPreview.value = false;
  previewLoadError.value = false;
}

function handlePreviewLoadError() {
  isRefreshing.value = false;
  isLoadingPreview.value = false;
  previewLoadError.value = true;
  // 2秒后清除错误状态，以便下次加载时可以重新显示
  setTimeout(() => {
    previewLoadError.value = false;
  }, 2000);
}

// 监听代码变化，当处于预览模式时启动加载状态
// 监听 previewCode（流式写入期间会使用 editorValue，否则使用 currentCode）
watch(
  () => previewCode.value,
  () => {
    if (mode.value === "preview") {
      isLoadingPreview.value = true;
      previewLoadError.value = false;
    }
  }
);

// 监听模式变化，当切换到预览模式时启动加载状态
watch(
  () => mode.value,
  async (newMode) => {
    if (newMode === "preview") {
      isLoadingPreview.value = true;
      previewLoadError.value = false;

      // 如果从其他模式切换到预览模式，检查 iframe 是否已经加载完成
      // 如果已经加载完成，立即隐藏进度条
      await nextTick();
      if (previewFrameRef.value?.checkIfLoaded) {
        const isLoaded = previewFrameRef.value.checkIfLoaded();
        if (isLoaded) {
          // iframe 已经加载完成，立即隐藏进度条
          isLoadingPreview.value = false;
          previewLoadError.value = false;
        } else {
          // 如果 iframe 还没有加载完成，设置一个后备超时
          // 如果 500ms 后还没有收到 load 事件，假设已经加载完成（可能是跨域问题）
          setTimeout(() => {
            if (isLoadingPreview.value && mode.value === "preview") {
              isLoadingPreview.value = false;
            }
          }, 500);

          // 注意：如果之后收到 load 事件，handlePreviewLoadComplete 会清除加载状态
          // 这个超时只是一个后备方案
        }
      } else {
        // 如果组件还没有准备好，设置一个短暂的后备超时
        setTimeout(() => {
          if (isLoadingPreview.value && mode.value === "preview") {
            if (previewFrameRef.value?.checkIfLoaded?.()) {
              isLoadingPreview.value = false;
            }
          }
        }, 100);
      }
    } else {
      // 离开预览模式时重置状态
      isLoadingPreview.value = false;
      previewLoadError.value = false;
    }
  }
);

// 处理 DiffEditor 字体大小变化
function handleFontSizeChange(size: number) {
  fontSize.value = size;
}

// Diff Handlers
// Diff Handlers
// Diff Handlers
function handleDiffUpdate(newOriginal: string) {
  // Update the current code (Source of Truth) as user explicitly navigates "Keep"
  editorValue.value = newOriginal;

  // CRITICAL FIX: If the code changes (via edit or accept), the old "Raw Diff" (Patch)
  // is likely no longer valid (line numbers/context mismatch).
  // Therefore, we MUST clear the diffTarget (pass undefined) to avoid a broken state
  // where we have [New Code + Old Invalid Patch].
  // This effectively means "Any edit exits Diff Mode".
  console.log(
    "📝 [ImmersiveCode] Code updated in Diff Mode. Clearing Diff Target."
  );
  record(newOriginal, undefined);
}

/**
 * Handle "Save" or "Close" from Diff Editor.
 * This should EXIT diff mode by recording a state with content but NO diffTarget.
 * @param options Configuration options
 * @param options.finalContent Optional content to save. If null, uses current.
 * @param options.enableEmit Whether to emit the diff-exited event. Defaults to true.
 */
function exitDiffMode(options?: {
  finalContent?: string;
  enableEmit?: boolean;
}) {
  console.group("👋 [ImmersiveCode] Exiting Diff Mode");
  const codeToSave =
    options?.finalContent !== undefined
      ? options.finalContent
      : currentCode.value;
  const enableEmit =
    options?.enableEmit !== undefined ? options.enableEmit : false;
  const isFinalRecordVersion =
    versions.value[currentVersionIndex.value]?.currentIndex === 0;

  console.log("Saving Final Content:", codeToSave.substring(0, 30) + "...");

  // 获取当前记录的 ID（如果有 diffTarget，说明当前记录有 recordId）
  const currentRecordId = currentRecord.value?.id;

  // Explicitly record a state with NO diffTarget to exit Diff Mode in history
  // This allows "Undo" to return to the Diff state later
  record(codeToSave, undefined);

  // Also switch UI mode just in case (though computed mode handles it)
  uiMode.value = "code";
  refreshPreview();

  // 触发 diff-exited 事件，通知父组件 diff 操作已完成，传递 recordId
  if (enableEmit && isFinalRecordVersion)
    emit("diff-exited", codeToSave, currentRecordId);

  console.groupEnd();
}

// Select Version
const versionValue = computed({
  get: () => String(currentVersionIndex.value),
  set: (val) => switchVersion(Number(val)),
});

// Format time for dropdown
function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

// 当前记录是否包含后端 diff 信息（originalCode + diffTarget）
const hasBackendDiffForCurrentRecord = computed(() => {
  const record = currentRecord.value as
    | (typeof currentRecord.value & {
        originalCode?: string;
        diffTarget?: string;
      })
    | null;

  if (!record) return false;
  console.log("record", currentRecord.value);

  return !!(record.originalCode && record.diffTarget);
});

// 从预览 HTML 代码中提取 title
const previewHtmlTitle = computed(() => {
  const code = previewCode.value;
  if (!code) return "";

  // 尝试匹配 <title>...</title> 标签
  const titleMatch = code.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim();
  }

  return "";
});

// 计算显示的标题：优先使用 props.title，如果没有则使用预览 HTML 的 title，最后使用默认值
const displayTitle = computed(() => {
  // 如果 props.title 存在且不为空字符串，使用 props.title
  if (props.title && props.title.trim() !== "") {
    return props.title;
  }

  // 如果预览 HTML 有 title，使用预览 HTML 的 title
  if (previewHtmlTitle.value) {
    return previewHtmlTitle.value;
  }

  // 最后使用默认值
  return "Fixed Script";
});

// 处理历史 diff 按钮点击：基于 originalCode + diffTarget 进入 / 退出 diff 模式
function handleHistoryDiffToggle() {
  const historyRecord = currentRecord.value as
    | (typeof currentRecord.value & {
        originalCode?: string;
        diffTarget?: string;
      })
    | null;

  if (
    !historyRecord ||
    !historyRecord.originalCode ||
    !historyRecord.diffTarget
  )
    return;

  // 如果当前已经在 diff 模式，则退出（保持默认的保存行为）
  if (mode.value === "diff") {
    exitDiffMode();
    return;
  }

  // 使用 originalCode 作为左侧代码，diffTarget 作为 diff 字符串，进入 diff 模式
  const baseCode = historyRecord.originalCode;
  const diffContent = historyRecord.diffTarget;
  const dryRun = applyDiff(baseCode, diffContent);
  if (!dryRun.success) {
    console.warn(
      "⚠️ [ImmersiveCode] Backend diff (dry run) failed when toggling history diff:",
      dryRun.message
    );
  }

  // 记录一个新的历史记录：code = originalCode, diffTarget = diff
  // 这会让 currentDiffTarget 有值，从而自动进入 diff 模式
  record(baseCode, diffContent);
}

// Keyboard shortcuts handler
function handleKeyDown(event: KeyboardEvent) {
  // 检查是否在输入框或文本区域中，如果是则不处理快捷键
  const target = event.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    // 检查是否在 Monaco Editor 中（Monaco Editor 有自己的快捷键处理）
    // 如果焦点在编辑器内，让编辑器自己处理 Ctrl+Z/Ctrl+Y
    const isInEditor =
      target.closest(".monaco-editor") || target.closest('[class*="monaco"]');
    if (isInEditor) {
      // 对于编辑器内的快捷键，我们仍然需要处理一些全局快捷键
      // 但跳过编辑器的默认快捷键（如 Ctrl+Z, Ctrl+Y）
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "s" || event.key === "S")
      ) {
        // Ctrl+S: 阻止系统默认保存
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "r" || event.key === "R")
      ) {
        // Ctrl+R: 刷新预览
        event.preventDefault();
        event.stopPropagation();
        refreshPreview();
        return;
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "`" || event.key === "Backquote")
      ) {
        // Ctrl+`: 切换终端
        event.preventDefault();
        event.stopPropagation();
        showConsole.value = !showConsole.value;
        return;
      }
      return;
    }
  }

  // // Ctrl+Z: 撤销
  // if (
  //   (event.ctrlKey || event.metaKey) &&
  //   event.key === "z" &&
  //   !event.shiftKey
  // ) {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   if (canUndo.value) {
  //     undo();
  //   }
  //   return;
  // }

  // // Ctrl+Y 或 Ctrl+Shift+Z: 恢复/重做
  // if (
  //   (event.ctrlKey || event.metaKey) &&
  //   (event.key === "y" || (event.key === "z" && event.shiftKey))
  // ) {
  //   event.preventDefault();
  //   event.stopPropagation();
  //   if (canRedo.value) {
  //     redo();
  //   }
  //   return;
  // }

  // Ctrl+`: 切换终端显示
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "`" || event.key === "Backquote")
  ) {
    event.preventDefault();
    event.stopPropagation();
    showConsole.value = !showConsole.value;
    return;
  }

  // Ctrl+S: 阻止系统默认保存
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "s" || event.key === "S")
  ) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // Ctrl+R: 刷新预览页面
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "r" || event.key === "R")
  ) {
    event.preventDefault();
    event.stopPropagation();
    refreshPreview();
    return;
  }
}

// Setup keyboard shortcuts
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeyDown);
  // 清理节流计时器
  if (throttleTimer) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
});
</script>

<template>
  <div
    class="flex flex-col w-full h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 z-20"
    >
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2 text-slate-700 font-semibold select-none">
          <Code2 class="w-5 h-5 text-purple-600" />
          <span class="max-w-[200px] truncate">{{ displayTitle }}</span>
        </div>

        <!-- History Controls -->
        <div
          v-if="!props.readonly"
          class="flex items-center space-x-1 pl-4 border-l border-slate-200"
        >
          <button
            @click="undo"
            :disabled="!canUndo"
            class="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-600"
            title="Undo"
          >
            <Undo2 class="w-4 h-4" />
          </button>
          <button
            @click="redo"
            :disabled="!canRedo"
            class="p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-600"
            title="Redo"
          >
            <Redo2 class="w-4 h-4" />
          </button>

          <!-- Versions Dropdown -->
          <Select v-model="versionValue">
            <SelectTrigger
              class="w-[160px] h-8 text-xs border-none bg-slate-50 px-4 hover:bg-slate-100 focus:ring-0 shadow-none"
            >
              <SelectValue placeholder="Select Version" />
            </SelectTrigger>
            <SelectContent class="max-h-[300px]">
              <SelectItem
                v-for="(ver, idx) in versions"
                :key="ver.id"
                :value="String(idx)"
              >
                <div class="flex flex-col text-xs">
                  <span class="font-medium truncate">{{ ver.label }}</span>
                  <span class="text-[10px] text-gray-400">{{
                    formatTime(ver.timestamp)
                  }}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- 历史 diff 按钮：基于 originalCode + diff 进入 / 退出 diff 模式 -->
          <button
            v-if="hasBackendDiffForCurrentRecord"
            @click="handleHistoryDiffToggle"
            class="p-1.5 rounded-md hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-400"
            title="查看历史 Diff"
          >
            <History class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <!-- Console Toggle -->
        <button
          @click="showConsole = !showConsole"
          :class="[
            'p-1.5 rounded transition',
            showConsole
              ? 'bg-purple-100 text-purple-700'
              : 'text-slate-400 hover:text-slate-600',
          ]"
          title="Toggle Console"
        >
          <Terminal class="w-4 h-4" />
        </button>

        <template v-if="mode === 'preview'">
          <!-- Refresh -->
          <button
            @click="refreshPreview"
            class="p-1.5 text-slate-400 hover:text-slate-600 transition"
            title="Refresh Preview"
          >
            <RefreshCcw
              :class="[
                'w-4 h-4 transition-transform duration-300',
                isRefreshing ? 'animate-spin' : '',
              ]"
            />
          </button>
          <!-- Select Area -->
          <button
            @click="isElementSelectorActive = !isElementSelectorActive"
            :class="[
              'p-1.5 rounded transition',
              isElementSelectorActive
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'text-slate-400 hover:text-slate-600',
            ]"
            :title="
              isElementSelectorActive
                ? 'Disable Element Selector'
                : 'Enable Element Selector'
            "
          >
            <MousePointer2 class="w-4 h-4" />
          </button>
        </template>

        <!-- Mode Switcher -->
        <div class="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            @click="uiMode = 'code'"
            :class="[
              'flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition',
              ['code', 'diff'].includes(mode)
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ]"
          >
            <span>代码</span>
          </button>
          <button
            @click="uiMode = 'preview'"
            :class="[
              'flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition',
              mode === 'preview'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ]"
          >
            <span>预览</span>
          </button>
        </div>

        <!-- Share -->
        <button
          v-if="props.enableShare"
          class="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
        >
          <Share2 class="w-3.5 h-3.5" />
          <span>分享</span>
        </button>

        <slot name="right-actions" />
      </div>
    </div>

    <!-- Progress Bar -->
    <LoadingProgressBar
      v-if="mode === 'preview'"
      :is-loading="isLoadingPreview"
      :is-error="previewLoadError"
    />

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden relative">
      <!-- Code Editor Area -->
      <div v-show="mode === 'code'" class="flex-1 overflow-hidden relative z-0">
        <CodeEditor
          ref="codeEditorRef"
          v-model="editorValue"
          language="html"
          theme="vs"
          :readonly="props.readonly"
          :options="{ fontSize }"
          @font-size-change="handleFontSizeChange"
          @ctrl-i-pressed="(data: { code: string; startLine: number; endLine: number }) => emit('ctrl-i-pressed', data)"
        />
      </div>

      <!-- Diff Editor Area -->
      <div v-if="mode === 'diff'" class="flex-1 overflow-hidden relative z-0">
        <ImmersiveDiffEditor
          ref="diffEditorRef"
          :original="currentCode"
          :modified="diffResultCode"
          language="html"
          theme="vs"
          :readonly="props.readonly"
          :font-size="fontSize"
          @update:original="handleDiffUpdate"
          @save="(finalContent: string) => exitDiffMode({ finalContent, enableEmit: true })"
          @close="() => exitDiffMode()"
          @font-size-change="handleFontSizeChange"
        />
      </div>

      <!-- Preview Area -->
      <div
        v-show="mode === 'preview'"
        class="flex-1 overflow-hidden bg-slate-50 relative z-0"
      >
        <div class="w-full h-full bg-white overflow-hidden relative ring-4">
          <PreviewFrame
            ref="previewFrameRef"
            :key="previewKey"
            :code="previewCode"
            :enable-element-selector="isElementSelectorActive"
            @console-log="handleLog"
            @element-selected="handleElementSelected"
            @toggle-console="handleToggleConsole"
            @toggle-element-selector="handleToggleElementSelector"
            @load-complete="handlePreviewLoadComplete"
            @load-error="handlePreviewLoadError"
          />
        </div>
      </div>

      <!-- Floating Console Overlay -->
      <div
        v-if="showConsole"
        :class="[
          'absolute bottom-0 inset-x-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 transform bg-[#1e1e1e]',
          consoleExpanded ? 'top-0' : 'h-48',
        ]"
      >
        <ConsolePanel
          :logs="logs"
          @clear="clearConsole"
          @expand="consoleExpanded = $event"
        />
      </div>
    </div>
  </div>
</template>
