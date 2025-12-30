<script setup lang="ts">
import { inject } from "vue";
import ChatPanel from "../Chat/ChatPanel.vue";
import { useLlmDashboardStore } from "@/stores/llmDashboard";

defineOptions({ name: "ChatPanelWrapper" });

const store = inject("llmDashboardStore") as ReturnType<
  typeof useLlmDashboardStore
>;

if (!store) {
  throw new Error("llmDashboardStore must be provided");
}
</script>

<template>
  <ChatPanel :providers="store.providers" />
</template>
