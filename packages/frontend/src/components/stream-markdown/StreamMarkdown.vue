<template>
  <StreamMarkdown
    class="prose"
    :components="{ codeblock: CustomCodeBlock }"
    :shiki-theme="{ light: 'github-light', dark: 'github-dark' }"
  />
</template>

<script setup lang="ts">
import { StreamMarkdown } from "streamdown-vue";
import CustomCodeBlock from "./CustomCodeBlock.vue";
</script>
