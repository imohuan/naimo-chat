<script setup lang="ts">
import { inject } from "vue";
import ProvidersPanel from "../Providers/ProvidersPanel.vue";
import { useLlmDashboardStore } from "@/stores/llmDashboard";

defineOptions({
  name: "ProvidersPanelWrapper",
});

const store = inject("llmDashboardStore") as ReturnType<
  typeof useLlmDashboardStore
>;
const actions = inject("llmDashboardActions") as any;

if (!store || !actions) {
  throw new Error("llmDashboardStore and llmDashboardActions must be provided");
}

function handleOpenJson() {
  actions.openProvidersJsonEditor();
}

function handleCreate() {
  actions.openEditor();
}

function handleEdit(provider: any) {
  actions.openEditor(provider);
}

function handleToggle(provider: any) {
  actions.handleToggleProvider(provider);
}

function handleRemove(provider: any) {
  actions.handleDeleteProvider(provider);
}

function handleReorder(providers: any[]) {
  actions.handleReorderProviders(providers);
}
</script>

<template>
  <ProvidersPanel
    :providers="store.providers"
    @openJson="handleOpenJson"
    @create="handleCreate"
    @edit="handleEdit"
    @toggle="handleToggle"
    @remove="handleRemove"
    @reorder="handleReorder"
  />
</template>
