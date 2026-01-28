<script setup lang="ts">
import { computed } from 'vue';
import { marked } from 'marked';
import type { ChatMessage } from '@/types';

const props = defineProps<{
  item: ChatMessage;
}>();

const htmlContent = computed(() => {
  if (props.item.html) {
    return props.item.html;
  }
  if (props.item.rawText) {
    return marked.parse(props.item.rawText);
  }
  return '';
});
</script>

<template>
  <div class="assistant-text text-slate-800" v-html="htmlContent"></div>
</template>

<style scoped>
.assistant-text :deep(p) {
  margin-bottom: 0.5rem;
}

.assistant-text :deep(code) {
  background-color: #f1f5f9;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

.assistant-text :deep(pre) {
  background-color: #1e293b;
  color: #e2e8f0;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}

.assistant-text :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
}
</style>
