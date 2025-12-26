<template>
  <div class="p-6 h-screen flex justify-center">
    <div class="w-[700px]">
      <TransformerConfigList v-model="config" :models="models" :options="options" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TransformerConfigList from "@/components/Transformer/TransformerConfigList.vue";
import type { TransformerConfig } from "@/interface";

const config = ref<TransformerConfig>({
  use: ["LowerCaseTransformer"],
  "gpt-3.5-turbo": [["JsonParseTransformer", { strict: true }], "TrimTransformer"],
  "gpt-4": {
    use: ["UpperCaseTransformer", ["SplitTransformer", { separator: "," }]],
  },
});

const models = ["gpt-3.5-turbo", "gpt-4", "claude-3", "gemini-pro"];

const options = [
  { name: "LowerCaseTransformer", endpoint: null },
  { name: "UpperCaseTransformer", endpoint: null },
  { name: "ReplaceTransformer", endpoint: null },
  { name: "SplitTransformer", endpoint: null },
  { name: "JoinTransformer", endpoint: null },
  { name: "TrimTransformer", endpoint: null },
  { name: "JsonParseTransformer", endpoint: "http://localhost:3000/parse" },
  { name: "JsonStringifyTransformer", endpoint: "http://localhost:3000/stringify" },
];
</script>

<style scoped>
/* 隐藏滚动条 */
::-webkit-scrollbar {
  display: none;
}

* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>
