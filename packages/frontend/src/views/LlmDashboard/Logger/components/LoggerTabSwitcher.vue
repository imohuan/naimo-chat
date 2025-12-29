<script setup lang="ts">
const props = defineProps<{
  activeMode: "logs" | "messages";
  currentTab: "chat" | "providers" | "logger" | "statusline" | "mcp";
}>();

const emit = defineEmits<{
  "update:activeMode": [mode: "logs" | "messages"];
}>();

function setActiveMode(mode: "logs" | "messages") {
  emit("update:activeMode", mode);
}
</script>

<template>
  <Teleport defer to="#header-right-target" :disabled="currentTab !== 'logger'">
    <nav class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg scale-90">
      <button
        @click="setActiveMode('logs')"
        class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border border-transparent"
        :class="
          activeMode === 'logs'
            ? 'bg-white text-primary shadow-sm border border-primary/20'
            : 'text-slate-500 hover:text-slate-700'
        "
      >
        普通日志
      </button>
      <button
        @click="setActiveMode('messages')"
        class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border border-transparent"
        :class="
          activeMode === 'messages'
            ? 'bg-white text-primary shadow-sm border border-primary/20'
            : 'text-slate-500 hover:text-slate-700'
        "
      >
        对话查询
      </button>
    </nav>
  </Teleport>
</template>
