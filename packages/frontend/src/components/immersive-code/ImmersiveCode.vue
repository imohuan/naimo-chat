<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import {
  Undo2,
  Redo2,
  Code2,
  Share2,
  RefreshCcw,
  Terminal,
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
import { useDebounceFn } from "@vueuse/core";

/**
 * Initial Code Template
 */
const DEFAULT_CODE = `
<div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-6">
  <h1 class="text-4xl font-bold mb-4">Code Immersive</h1>
  <p class="text-lg opacity-90 mb-8">Edit the code to see live changes!</p>
  <div class="bg-black/20 p-4 rounded-lg backdrop-blur-sm">
    <p class="font-mono text-sm">Hello World</p>
  </div>
</div>
`;

const props = defineProps<{
  initialCode?: string;
  enableShare?: boolean;
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
const logs = ref<LogEntry[]>([]);
const previewKey = ref(0);
const editorValue = ref(currentCode.value);
const fontSize = ref(14); // 字体大小状态

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
const diffResultCode = computed(() => {
  if (!currentDiffTarget.value) return "";

  // If we have a stored diff target, try to apply it to the current code
  const result = applyDiff(currentCode.value, currentDiffTarget.value);
  if (result.success) {
    return result.content;
  }

  // Fallback: If application fails (e.g. underlying code changed), return current code?
  // Or maybe return the FAILURE message to show something is wrong?
  // For now, let's return current code so it shows "No Changes" effectively.
  console.warn(
    "⚠️ [ImmersiveCode] Failed to apply stored diff to current code:",
    result.message
  );
  return currentCode.value; // Show same code on both sides if fail
});

const diffSuccess = ref(false);

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
});

// Sync Editor -> History (Debounced)
const debouncedRecord = useDebounceFn((val: string) => {
  // Only record if we are in 'code' mode
  if (mode.value === "code") {
    record(val);
  }
}, 800);

// Debounced record for Diff Mode (Typing in Diff Editor)
const debouncedDiffRecord = useDebounceFn((val: string) => {
  if (mode.value === "diff") {
    record(val, currentDiffTarget.value);
  }
}, 800);

watch(editorValue, (val) => {
  if (mode.value === "code") {
    debouncedRecord(val);
  }
});

// Sync History -> Editor
watch(currentCode, (val) => {
  if (val !== editorValue.value) {
    editorValue.value = val;
  }
});

// Console handling
function handleLog(log: any) {
  // Add to logs
  const entry: LogEntry = {
    method: log.method || "log",
    args: log.args || (log.message ? [log.message] : [log]), // Normalize
    timestamp: new Date().toLocaleTimeString(),
  };
  logs.value.push(entry);
}

function clearConsole() {
  logs.value = [];
}

function refreshPreview() {
  previewKey.value++;
  clearConsole();
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
</script>

<template>
  <div
    class="flex flex-col w-full h-[600px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 z-20"
    >
      <div class="flex items-center space-x-4">
        <div class="flex items-center space-x-2 text-slate-700 font-semibold select-none">
          <Code2 class="w-5 h-5 text-purple-600" />
          <span>Fixed Script</span>
        </div>

        <!-- History Controls -->
        <div class="flex items-center space-x-1 pl-4 border-l border-slate-200">
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

        <!-- Refresh -->
        <button
          @click="refreshPreview"
          class="p-1.5 text-slate-400 hover:text-slate-600 transition"
          title="Refresh Preview"
        >
          <RefreshCcw class="w-4 h-4" />
        </button>

        <!-- Mode Switcher -->
        <div class="flex items-center bg-slate-100 rounded-lg p-1">
          <button
            @click="uiMode = 'code'"
            :class="[
              'flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition',
              mode === 'code'
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
          :options="{ fontSize }"
          @font-size-change="handleFontSizeChange"
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
          :font-size="fontSize"
          @update:original="handleDiffUpdate"
          @save="exitDiffMode"
          @close="exitDiffMode"
          @font-size-change="handleFontSizeChange"
        />
      </div>

      <!-- Preview Area -->
      <div
        v-if="mode === 'preview'"
        class="flex-1 overflow-hidden bg-slate-50 relative z-0"
      >
        <div class="w-full h-full bg-white overflow-hidden relative ring-4">
          <PreviewFrame :key="previewKey" :code="currentCode" @console-log="handleLog" />
        </div>
      </div>

      <!-- Floating Console Overlay -->
      <div
        v-if="showConsole"
        class="absolute bottom-0 inset-x-0 h-48 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 transform bg-[#1e1e1e]"
      >
        <ConsolePanel :logs="logs" @clear="clearConsole" />
      </div>
    </div>
  </div>
</template>
