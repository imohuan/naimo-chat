<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  Undo2,
  Redo2,
  Code2,
  Share2,
  RefreshCcw,
  Terminal,
} from "lucide-vue-next";
import { useCodeHistory } from "./composables/useCodeHistory";
import PreviewFrame from "./components/PreviewFrame.vue";
import ConsolePanel, { type LogEntry } from "./components/ConsolePanel.vue";
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
  canUndo,
  canRedo,
  record,
  addMajorVersion,
  undo,
  redo,
  switchVersion,
} = useCodeHistory(props.initialCode || DEFAULT_CODE);

// Expose methods for parent control
defineExpose({
  addMajorVersion: (code?: string, label?: string) =>
    addMajorVersion(code || currentCode.value, label),
  getCurrentCode: () => currentCode.value,
});

// View State
const mode = ref<"code" | "preview">("preview");
const showConsole = ref(true);
const logs = ref<LogEntry[]>([]);
const previewKey = ref(0);
const editorValue = ref(currentCode.value);

// Sync Editor -> History (Debounced)
const debouncedRecord = useDebounceFn((val: string) => {
  record(val);
}, 800);

watch(editorValue, (val) => {
  debouncedRecord(val);
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
        <div
          class="flex items-center space-x-2 text-slate-700 font-semibold select-none"
        >
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
            @click="mode = 'code'"
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
            @click="mode = 'preview'"
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
      <div v-show="mode === 'code'" class="flex-1 overflow-hidden relative z-0">
        <CodeEditor v-model="editorValue" language="html" theme="vs" />
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
            @console-log="handleLog"
          />
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
