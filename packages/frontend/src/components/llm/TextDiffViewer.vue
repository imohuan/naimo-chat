<template>
  <div class="space-y-2">
    <div class="code-font overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table class="w-full border-collapse text-sm text-slate-900">
        <tbody>
          <template v-for="(chunk, chunkIndex) in diffBlocks" :key="chunkIndex">
            <template
              v-for="(line, lineIndex) in chunk.lines"
              :key="`${chunkIndex}-${lineIndex}`"
            >
              <tr
                class="code-row whitespace-pre-wrap transition-colors duration-200"
                :class="lineClass(chunk)"
              >
                <td
                  class="sticky left-0 w-8 select-none text-center font-bold"
                  :class="indicatorClass(chunk)"
                >
                  {{ indicator(chunk) }}
                </td>
                <td class="px-3 py-1 align-top">
                  <pre class="m-0 p-0 text-slate-900">{{ line }}</pre>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <div class="grid gap-2 text-xs text-slate-500 md:grid-cols-2">
      <span>原始文本行数: {{ oldTextLineCount }}</span>
      <span>新文本行数: {{ newTextLineCount }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { diffLines, type Change } from "diff";
import { computed } from "vue";

type DiffBlock = Change & { lines: string[] };

const props = defineProps<{
  oldText?: string;
  newText?: string;
}>();

const oldTextValue = computed(() => props.oldText ?? "");
const newTextValue = computed(() => props.newText ?? "");

const diffBlocks = computed<DiffBlock[]>(() => {
  const changes = diffLines(oldTextValue.value, newTextValue.value);
  return changes
    .map((chunk: Change) => {
      const lines = chunk.value.split("\n");
      if (lines[lines.length - 1] === "") lines.pop();
      return { ...chunk, lines };
    })
    .filter((chunk: DiffBlock) => chunk.lines.length > 0);
});

const oldTextLineCount = computed(() => oldTextValue.value.split("\n").length);
const newTextLineCount = computed(() => newTextValue.value.split("\n").length);

const indicator = (chunk: DiffBlock) => {
  if (chunk.added) return "+";
  if (chunk.removed) return "-";
  return "";
};

const indicatorClass = (chunk: DiffBlock) => {
  const base = "code-font px-2";
  if (chunk.removed) return `${base} bg-red-200 text-red-700 border-r border-red-300`;
  if (chunk.added) return `${base} bg-green-200 text-green-700 border-r border-green-300`;
  return `${base} bg-slate-100 text-slate-400 border-r border-slate-200`;
};

const lineClass = (chunk: DiffBlock) => {
  if (chunk.added) return "bg-green-100 hover:bg-green-200";
  if (chunk.removed) return "bg-red-100 hover:bg-red-200";
  return "hover:bg-slate-50";
};
</script>

<style scoped>
.code-font {
  font-family: "Consolas", "Monaco", "Andale Mono", "Ubuntu Mono", monospace;
}

.code-row pre {
  line-height: 1.5;
  font-size: 12px;
}
</style>
