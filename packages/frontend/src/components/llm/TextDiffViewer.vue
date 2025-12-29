<template>
  <div class="diff-wrapper">
    <div class="diff-container code-font">
      <table class="diff-table">
        <tbody>
          <template v-for="(chunk, chunkIndex) in diffBlocks" :key="chunkIndex">
            <template
              v-for="(line, lineIndex) in chunk.lines"
              :key="`${chunkIndex}-${lineIndex}`"
            >
              <tr class="code-row" :class="lineClass(chunk)">
                <td
                  v-if="showIndicators"
                  class="indicator-col"
                  :class="indicatorClass(chunk)"
                >
                  {{ indicator(chunk) }}
                </td>
                <td class="code-cell">
                  <pre class="code-pre" :style="preStyle">{{ line }}</pre>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="showFooter" class="diff-footer">
      <span>原始文本行數: {{ oldTextLineCount }}</span>
      <span>新文本行數: {{ newTextLineCount }}</span>
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
  /** 是否显示左侧 +/- 指示列 */
  showIndicators?: boolean;
  /** 是否显示底部统计 UI */
  showFooter?: boolean;
  /** 字体大小（px） */
  fontSize?: number;
  /** 行高（倍数） */
  lineHeight?: number;
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

const preStyle = computed(() => ({
  lineHeight: String(props.lineHeight ?? 1.5),
  fontSize: `${props.fontSize ?? 12}px`,
}));

const indicator = (chunk: DiffBlock) => {
  if (chunk.added) return "+";
  if (chunk.removed) return "-";
  return "";
};

const indicatorClass = (chunk: DiffBlock) => {
  const base = "indicator-cell";
  if (chunk.removed) return `${base} indicator-removed`;
  if (chunk.added) return `${base} indicator-added`;
  return `${base} indicator-neutral`;
};

const lineClass = (chunk: DiffBlock) => {
  if (chunk.added) return "line-added";
  if (chunk.removed) return "line-removed";
  return "line-neutral";
};
</script>

<style scoped>
.code-font {
  font-family: "Consolas", "Monaco", "Andale Mono", "Ubuntu Mono", monospace;
}

.diff-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem; /* 原 space-y-2 */
}

.diff-container {
  overflow-x: auto;
  border-radius: 0.75rem; /* 原 rounded-xl */
  border: 1px solid #e2e8f0; /* 原 border-slate-200 */
  box-shadow: 0 1px 2px 0 rgb(15 23 42 / 0.08); /* 近似 shadow-sm */
  background-color: #ffffff;
}

.diff-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem; /* 原 text-sm */
  color: #0f172a; /* 原 text-slate-900 */
}

.code-row {
  white-space: pre-wrap;
  transition: background-color 0.2s ease;
}

.indicator-col {
  position: sticky;
  left: 0;
  width: 2rem; /* 原 w-8 */
  user-select: none;
  text-align: center;
  font-weight: 700; /* 原 font-bold */
}

.indicator-cell {
  padding: 0 0.5rem; /* 原 px-2 */
}

.indicator-removed {
  background-color: #fecaca; /* 原 bg-red-200 */
  color: #b91c1c; /* 原 text-red-700 */
  border-right: 1px solid #fca5a5; /* 原 border-red-300 */
}

.indicator-added {
  background-color: #bbf7d0; /* 原 bg-green-200 */
  color: #15803d; /* 原 text-green-700 */
  border-right: 1px solid #86efac; /* 原 border-green-300 */
}

.indicator-neutral {
  background-color: #f1f5f9; /* 原 bg-slate-100 */
  color: #94a3b8; /* 原 text-slate-400 */
  border-right: 1px solid #e2e8f0; /* 原 border-slate-200 */
}

.code-cell {
  padding: 0.25rem 0.75rem; /* 原 py-1 px-3 */
  vertical-align: top; /* 原 align-top */
}

.code-pre {
  margin: 0; /* 原 m-0 */
  padding: 0; /* 原 p-0 */
  color: #0f172a; /* 原 text-slate-900 */
}

.line-added {
  background-color: #dcfce7; /* 原 bg-green-100 */
}

.line-added:hover {
  background-color: #bbf7d0; /* 原 hover:bg-green-200 */
}

.line-removed {
  background-color: #fee2e2; /* 原 bg-red-100 */
}

.line-removed:hover {
  background-color: #fecaca; /* 原 hover:bg-red-200 */
}

.line-neutral:hover {
  background-color: #f8fafc; /* 原 hover:bg-slate-50 */
}

.diff-footer {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem; /* 原 gap-2 */
  font-size: 0.75rem; /* 原 text-xs */
  color: #6b7280; /* 近似 text-slate-500 */
}

@media (min-width: 768px) {
  .diff-footer {
    grid-template-columns: repeat(2, minmax(0, 1fr)); /* 原 md:grid-cols-2 */
  }
}

.code-row pre {
  /* 默认值会被 props.fontSize / lineHeight 覆盖 */
  line-height: 1.5;
  font-size: 12px;
  color: #0f172a;
}
</style>
