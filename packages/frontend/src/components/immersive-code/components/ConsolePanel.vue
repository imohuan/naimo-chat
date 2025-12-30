<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronUp, ChevronDown, Trash2, Copy, Check } from "lucide-vue-next";

export interface LogEntry {
  method: "log" | "error" | "warn" | "info" | string;
  args: any[];
  timestamp?: string;
  caller?: string;
  stack?: string;
  lineOffset?: number;
}

const props = defineProps<{
  logs: LogEntry[];
}>();

const emit = defineEmits<{
  (e: "clear"): void;
  (e: "expand", expanded: boolean): void;
}>();

const isExpanded = ref(false);

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
  emit("expand", isExpanded.value);
}

const scrollContainer = ref<HTMLDivElement>();
const selectedLog = ref<LogEntry | null>(null);
const showDetailDialog = ref(false);
const isCopied = ref(false);

function logClass(method: string) {
  switch (method) {
    case "error":
      return "text-red-700";
    case "warn":
      return "text-yellow-700";
    case "info":
      return "text-blue-700";
    default:
      return "text-gray-900";
  }
}

function formatArg(arg: any): string {
  // If it's an Error object (serialized from iframe), only show the message
  if (typeof arg === "object" && arg !== null) {
    // Check if it's a serialized Error object (has message and stack properties)
    if (
      arg.message !== undefined &&
      arg.stack !== undefined &&
      Object.keys(arg).length === 2
    ) {
      return arg.message;
    }
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function openDetailDialog(log: LogEntry) {
  selectedLog.value = log;
  showDetailDialog.value = true;
}

async function copyLogs() {
  const logText = props.logs
    .map((log) => {
      const timestamp = log.timestamp ? `[${log.timestamp}] ` : "";
      const method = log.method.toUpperCase();
      const content = log.args.map((arg) => formatArg(arg)).join(" ");
      return `${timestamp}${method}: ${content}`;
    })
    .join("\n");

  try {
    await navigator.clipboard.writeText(logText);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error("复制失败:", err);
  }
}

// Auto-scroll to bottom
watch(
  () => props.logs.length,
  () => {
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
      }
    });
  }
);
</script>

<template>
  <div
    class="flex flex-col h-full bg-white text-gray-900 font-mono text-sm overflow-hidden border border-gray-200"
  >
    <div
      class="flex items-center justify-between px-4 py-2 border-b border-gray-300 bg-gray-50"
    >
      <div class="flex items-center gap-2">
        <button
          @click="toggleExpand"
          class="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
          :title="isExpanded ? '折叠' : '展开'"
        >
          <ChevronUp v-if="!isExpanded" :size="16" />
          <ChevronDown v-else :size="16" />
        </button>
        <span class="font-semibold select-none text-gray-900">控制台</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="copyLogs"
          class="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
          title="复制日志"
        >
          <Check v-if="isCopied" :size="16" class="text-green-600" />
          <Copy v-else :size="16" />
        </button>
        <button
          @click="$emit('clear')"
          class="p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors"
          title="清除日志"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>
    <div ref="scrollContainer" class="flex-1 overflow-auto p-3">
      <div
        v-for="(log, idx) in logs"
        :key="idx"
        :class="['border-b border-gray-200 last:border-b-0', logClass(log.method)]"
      >
        <div class="flex items-start gap-2 py-1">
          <!-- Timestamp (clickable) -->
          <button
            v-if="log.timestamp"
            @click="openDetailDialog(log)"
            class="font-mono text-xs text-gray-600 hover:text-gray-900 hover:underline cursor-pointer shrink-0 mt-0.5"
            :title="log.caller || log.stack ? '点击查看详情' : ''"
          >
            {{ log.timestamp }}
          </button>
          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(arg, ai) in log.args"
                :key="ai"
                class="text-sm whitespace-pre-wrap select-text"
                >{{ formatArg(arg) }}</span
              >
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="logs.length === 0"
        class="text-gray-500 italic p-4 select-none text-center"
      >
        No logs available
      </div>
    </div>

    <!-- Detail Dialog -->
    <Dialog v-model:open="showDetailDialog">
      <DialogContent
        class="sm:max-w-10/12 lg:max-w-6xl h-[80vh] overflow-hidden flex flex-col"
      >
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span :class="logClass(selectedLog?.method || 'log')">
              {{ selectedLog?.method?.toUpperCase() || "LOG" }}
            </span>
            <span class="text-gray-500 text-sm font-normal"> - 日志详情 </span>
          </DialogTitle>
        </DialogHeader>
        <div class="flex-1 overflow-auto space-y-4 font-mono text-sm">
          <!-- Timestamp -->
          <div v-if="selectedLog?.timestamp">
            <div class="text-xs font-semibold text-gray-600 mb-1">时间</div>
            <div class="text-gray-900 bg-gray-50 p-2 rounded">
              {{ selectedLog.timestamp }}
            </div>
          </div>

          <!-- Caller -->
          <div v-if="selectedLog?.caller">
            <div class="text-xs font-semibold text-gray-600 mb-1">调用者</div>
            <div class="text-gray-900 bg-gray-50 p-2 rounded break-all">
              {{ selectedLog.caller }}
            </div>
          </div>

          <!-- Content -->
          <div>
            <div class="text-xs font-semibold text-gray-600 mb-1">内容</div>
            <div
              :class="[
                'p-2 rounded bg-gray-50 select-text',
                logClass(selectedLog?.method || 'log'),
              ]"
            >
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(arg, ai) in selectedLog?.args || []"
                  :key="ai"
                  class="whitespace-pre-wrap"
                  >{{ formatArg(arg) }}</span
                >
              </div>
            </div>
          </div>

          <!-- Stack Trace -->
          <div v-if="selectedLog?.stack">
            <div class="text-xs font-semibold text-gray-600 mb-1">堆栈信息</div>
            <pre
              class="text-sm text-gray-800 bg-gray-50 p-4 rounded overflow-auto border border-gray-200 whitespace-pre-wrap break-all select-all font-mono leading-relaxed"
              >{{ selectedLog.stack }}</pre
            >
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
