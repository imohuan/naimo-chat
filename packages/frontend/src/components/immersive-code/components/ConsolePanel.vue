<script setup lang="ts">
import { ref, watch, nextTick } from "vue";

export interface LogEntry {
  method: "log" | "error" | "warn" | "info" | string;
  args: any[];
  timestamp?: string;
}

const props = defineProps<{
  logs: LogEntry[];
}>();

const emit = defineEmits<{
  (e: "clear"): void;
}>();

const scrollContainer = ref<HTMLDivElement>();

function logClass(method: string) {
  switch (method) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-yellow-400";
    case "info":
      return "text-blue-400";
    default:
      return "text-gray-300";
  }
}

function formatArg(arg: any): string {
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
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
    class="flex flex-col h-full bg-[#1e1e1e] text-white font-mono text-xs overflow-hidden"
  >
    <div
      class="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-[#252526]"
    >
      <span class="font-semibold select-none">控制台</span>
      <button
        @click="$emit('clear')"
        class="text-gray-400 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-white/10"
      >
        Clear
      </button>
    </div>
    <div ref="scrollContainer" class="flex-1 overflow-auto p-2 space-y-1">
      <div
        v-for="(log, idx) in logs"
        :key="idx"
        :class="['border-b border-white/5 pb-0.5', logClass(log.method)]"
      >
        <span v-if="log.timestamp" class="opacity-30 mr-2 text-[10px]">{{
          log.timestamp
        }}</span>
        <!-- Render args -->
        <span
          v-for="(arg, ai) in log.args"
          :key="ai"
          class="mr-2 whitespace-pre-wrap break-all inline-block align-top"
          >{{ formatArg(arg) }}</span
        >
      </div>
      <div
        v-if="logs.length === 0"
        class="text-gray-500 italic p-2 select-none"
      >
        No logs available
      </div>
    </div>
  </div>
</template>
