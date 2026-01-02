<script setup lang="ts">
import { ref } from "vue";
import type { LlmProvider } from "@/interface";
import ProviderCard from "./ProviderCard.vue";

const props = defineProps<{
  providers: LlmProvider[];
  defaultVisibleModelCount?: number;
}>();

const emit = defineEmits<{
  edit: [provider: LlmProvider];
  remove: [provider: LlmProvider];
  toggle: [provider: LlmProvider];
  copyModelTag: [providerName: string, modelName: string];
}>();

// 展开状态：存储已展开的 provider 的 key
const expandedProviders = ref<Set<string>>(new Set());

function isProviderExpanded(providerKey: string): boolean {
  return expandedProviders.value.has(providerKey);
}

function toggleProviderExpanded(providerKey: string) {
  if (expandedProviders.value.has(providerKey)) {
    expandedProviders.value.delete(providerKey);
  } else {
    expandedProviders.value.add(providerKey);
  }
}

function handleCopyModelTag(providerName: string, modelName: string) {
  emit("copyModelTag", providerName, modelName);
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3">
    <ProviderCard
      v-for="provider in providers"
      :key="provider.id || provider.name"
      :provider="provider"
      :default-visible-model-count="defaultVisibleModelCount"
      :is-expanded="isProviderExpanded(provider.id || provider.name || '')"
      :show-drag-handle="false"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
      @toggle="emit('toggle', $event)"
      @toggle-expand="toggleProviderExpanded(provider.id || provider.name || '')"
      @copy-model-tag="handleCopyModelTag"
    />
  </div>
</template>
