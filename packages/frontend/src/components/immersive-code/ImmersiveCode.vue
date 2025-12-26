<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import {
  Undo2,
  Redo2,
  Code2,
  Share2,
  RefreshCcw,
  Terminal,
  MousePointer2,
} from "lucide-vue-next";
import { useCodeHistory } from "./composables/useCodeHistory";
import { useCodeDiff } from "./composables/useCodeDiff";
import PreviewFrame from "./components/PreviewFrame.vue";
import ConsolePanel, { type LogEntry } from "./components/ConsolePanel.vue";
import ImmersiveDiffEditor from "./components/ImmersiveDiffEditor.vue"; // Import Component
import CodeEditor from "../code/CodeEditor.vue";
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
const props = withDefaults(defineProps<{
  initialCode?: string;
  enableShare?: boolean;
  readonly?: boolean;
  title?: string;
}>(), {
  title: 'Fixed Script',
});

// Define emits for error notifications
const emit = defineEmits<{
  error: [message: string];
  "element-selected": [selector: string, data?: any];
  "ctrl-i-pressed": [data: { code: string; startLine: number; endLine: number }];
}>();

const {
  versions,
  currentVersionIndex,
  currentCode,
  currentDiffTarget, // Added
  canUndo,
  canRedo,
  record,
  addMajorVersion,
  undo,
  redo,
  switchVersion,
} = useCodeHistory(props.initialCode || DEFAULT_CODE);

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

// Editor Refs
const codeEditorRef = ref<InstanceType<typeof CodeEditor> | null>(null);
const diffEditorRef = ref<InstanceType<typeof ImmersiveDiffEditor> | null>(null);

// Computed Mode based on History
const mode = computed<"code" | "preview" | "diff">(() => {
  // If we have a diff target, we are in diff mode
  if (currentDiffTarget.value) {
    return "diff";
  }
  // Otherwise, use the UI mode selected by the user
  return uiMode.value;
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
const diffResult = ref<{ content: string; success: boolean; message?: string }>({
  content: "",
  success: true,
});

// 监听 diff 应用，只在需要时执行一次
watch(
  [currentDiffTarget, currentCode],
  () => {
    if (!currentDiffTarget.value) {
      diffResult.value = { content: "", success: true };
      return;
    }

    // 执行一次 diff 应用
    const result = applyDiff(currentCode.value, currentDiffTarget.value);
    diffResult.value = result;

    // 如果应用失败，自动退出 diff 模式
    if (!result.success) {
      console.warn(
        "⚠️ [ImmersiveCode] Failed to apply stored diff to current code:",
        result.message
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
}

function endStreaming() {
  console.log("🌊 [ImmersiveCode] Ending streaming mode");
  isStreaming.value = false;
  // 流式写入结束后，记录一次最终状态
  if (mode.value === "code") {
    record(editorValue.value);
  } else if (mode.value === "diff") {
    record(editorValue.value, currentDiffTarget.value);
  }
}

function streamWrite(code: string) {
  if (!isStreaming.value) {
    console.warn("⚠️ [ImmersiveCode] streamWrite called but not in streaming mode");
    return;
  }
  // 直接更新编辑器值，不记录历史
  editorValue.value = code;
}

// Expose methods for parent control
defineExpose({
  addMajorVersion: (code?: string, label?: string) =>
    addMajorVersion(code || currentCode.value, label),
  getCurrentCode: () => currentCode.value,
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
      // We can still choose to record it, but maybe warn?
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
    if (mode.value === "code" && !isNavigatingHistory.value && !isStreaming.value) {
      record(val);
    }
    debounceTimer = null;
  }, 800);
};

watch(editorValue, (val) => {
  if (mode.value === "code") {
    debouncedRecord(val);
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

// Console handling
function handleLog(log: any) {
  // Add to logs
  const entry: LogEntry = {
    method: log.method || "log",
    args: log.args || (log.message ? [log.message] : [log]), // Normalize
    timestamp: new Date().toLocaleTimeString(),
    caller: log.caller,
    stack: log.stack,
  };
  logs.value.push(entry);

  // Emit error notification if it's an error
  if (entry.method === "error") {
    const errorMessage = entry.args?.[0]?.toString() || "发生了一个错误";
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
  previewKey.value++;
  clearConsole();
  // 等待 iframe 加载完成，使用 nextTick 和延迟来确保加载完成
  nextTick(() => {
    // 给 iframe 一些时间加载内容
    setTimeout(() => {
      isRefreshing.value = false;
    }, 300);
  });
}

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
 * @param finalContent Optional content to save. If null, uses current.
 */
function exitDiffMode(finalContent?: string) {
  console.group("👋 [ImmersiveCode] Exiting Diff Mode");
  const codeToSave =
    finalContent !== undefined ? finalContent : currentCode.value;

  console.log("Saving Final Content:", codeToSave.substring(0, 30) + "...");

  // Explicitly record a state with NO diffTarget to exit Diff Mode in history
  // This allows "Undo" to return to the Diff state later
  record(codeToSave, undefined);

  // Also switch UI mode just in case (though computed mode handles it)
  uiMode.value = "code";
  refreshPreview();
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
      target.closest(".monaco-editor") ||
      target.closest('[class*="monaco"]');
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

  // Ctrl+Z: 撤销
  if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    if (canUndo.value) {
      undo();
    }
    return;
  }

  // Ctrl+Y 或 Ctrl+Shift+Z: 恢复/重做
  if (
    (event.ctrlKey || event.metaKey) &&
    (event.key === "y" ||
      (event.key === "z" && event.shiftKey))
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (canRedo.value) {
      redo();
    }
    return;
  }

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
  if ((event.ctrlKey || event.metaKey) && (event.key === "s" || event.key === "S")) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // Ctrl+R: 刷新预览页面
  if ((event.ctrlKey || event.metaKey) && (event.key === "r" || event.key === "R")) {
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
          <span>{{ props.title }}</span>
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
              class="w-[160px] h-8 text-xs border-none bg-transparent hover:bg-slate-50 focus:ring-0 shadow-none px-2"
            >
              <SelectValue placeholder="Select Version" />
            </SelectTrigger>
            <SelectContent>
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

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden relative">
      <!-- Code Editor Area -->
      <div v-if="mode === 'code'" class="flex-1 overflow-hidden relative z-0">
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
          @save="exitDiffMode"
          @close="exitDiffMode"
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
            :key="previewKey"
            :code="currentCode"
            :enable-element-selector="isElementSelectorActive"
            @console-log="handleLog"
            @element-selected="handleElementSelected"
            @toggle-console="handleToggleConsole"
            @toggle-element-selector="handleToggleElementSelector"
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
