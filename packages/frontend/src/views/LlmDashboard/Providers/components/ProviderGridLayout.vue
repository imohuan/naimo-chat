<script setup lang="ts">
import type { LlmProvider } from "@/interface";
import ProviderGridCard from "./ProviderGridCard.vue";

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

function handleCopyModelTag(providerName: string, modelName: string) {
  emit("copyModelTag", providerName, modelName);
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <ProviderGridCard
      v-for="provider in providers"
      :key="provider.id || provider.name"
      :provider="provider"
      @edit="emit('edit', $event)"
      @remove="emit('remove', $event)"
      @toggle="emit('toggle', $event)"
      @copy-model-tag="handleCopyModelTag"
    />
  </div>
</template>
