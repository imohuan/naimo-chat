<template>
  <div class="custom-code-block" :style="maxWidthStyle">
    <div class="custom-code-block__header">
      <button class="collapse-btn" type="button" @click="toggleCollapse">
        <span class="chevron" :class="{ 'chevron--open': !collapsed }">▸</span>
        <span class="custom-code-block__lang">{{ language || "text" }}</span>
      </button>

      <div class="header-spacer" />

      <div class="header-actions">
        <button
          class="icon-btn"
          type="button"
          @click="copy"
          :title="copied ? 'Copied' : 'Copy'"
        >
          <Check v-if="copied" class="icon-btn__icon icon-btn__icon--success" />
          <Copy v-else class="icon-btn__icon" />
        </button>
        <button class="icon-btn" type="button" @click="preview" title="Preview">
          <Eye class="icon-btn__icon" />
        </button>
        <button
          class="icon-btn"
          type="button"
          @click="download"
          title="Download"
        >
          <Download class="icon-btn__icon" />
        </button>
      </div>
    </div>
    <div
      ref="element"
      v-show="!collapsed"
      class="custom-code-block__body"
      v-html="html"
    />
  </div>
</template>

<script setup lang="ts">
import { useShikiHighlighter } from "streamdown-vue";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { Check, Copy, Download, Eye } from "lucide-vue-next";
import { useMessageBranchWidth } from "@/components/ai-elements/message/context";

const branchWidth = useMessageBranchWidth();
const maxWidthStyle = computed(() => {
  let w = branchWidth?.value ?? 0;
  w = Math.ceil((w / 8) * 9.5);
  return w > 0 ? { maxWidth: `${w}px` } : undefined;
});

const props = defineProps<{
  code: string;
  language?: string;
}>();

const html = ref("<pre><code>Loading…</code></pre>");
const copied = ref(false);
const collapsed = ref(false);

const highlighterPromise = useShikiHighlighter();
let highlightTimer: number | null = null;
const element = ref<HTMLDivElement>();

// 检测是否在 .model-canvas 容器内
const isInModelCanvas = (): boolean => {
  if (!element.value) return false;
  return element.value.closest(".model-canvas") !== null;
};

// 只保留代码的最后 4 行
const limitCodeToLastLines = (code: string, lines: number = 4): string => {
  const codeLines = code.split(/\n/);
  if (codeLines.length <= lines) return code;
  return codeLines.slice(-lines).join("\n");
};

const runHighlight = async () => {
  try {
    // 确保 DOM 已挂载后再检测
    await nextTick();

    const highlighter = await highlighterPromise;
    const lang = (props.language || "text").toLowerCase();
    let code =
      typeof props.code === "string" ? props.code : String(props.code ?? "");

    // 如果是在 .model-canvas 内，只渲染最后 3 行
    if (isInModelCanvas()) {
      code = limitCodeToLastLines(code, 3);
    }

    // 对超大代码块做降级，避免严重卡顿
    if (code.length > 200_000) {
      html.value = `<pre><code>${code}</code></pre>`;
      return;
    }

    html.value = highlighter.codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
    });
  } catch (err) {
    console.error("代码高亮失败", err);
    html.value = `<pre><code>${props.code || ""}</code></pre>`;
  }
};

watch(
  () => [props.code, props.language],
  () => {
    if (highlightTimer !== null) {
      window.clearTimeout(highlightTimer);
      highlightTimer = null;
    }

    // 更小的防抖间隔，兼顾流式体验与性能
    const delay =
      typeof props.code === "string" && props.code.length > 4000 ? 50 : 20;

    highlightTimer = window.setTimeout(() => {
      runHighlight();
    }, delay);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  if (highlightTimer !== null) {
    window.clearTimeout(highlightTimer);
    highlightTimer = null;
  }
});

const copy = async () => {
  if (!props.code) return;
  await navigator.clipboard.writeText(props.code);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
};

const toggleCollapse = () => {
  collapsed.value = !collapsed.value;
};

const preview = () => {
  if (typeof window === "undefined" || !window.open) {
    console.error("当前环境不支持窗口预览。");
    return;
  }

  const code =
    typeof props.code === "string" ? props.code : String(props.code ?? "");

  const isFullHtml = /<!doctype html>/i.test(code) || /<html[\s>]/i.test(code);
  const html = isFullHtml
    ? code
    : `<html>
        <head>
          <meta charset="utf-8" />
          <title>Code Preview</title>
          <style>
            :root { color-scheme: light; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 16px;
              background: #ffffff;
              color: #0f172a;
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            }
            pre {
              margin: 0;
              white-space: pre-wrap;
              word-break: break-word;
              overflow-x: auto;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 14px 16px;
            }
          </style>
        </head>
        <body>
          ${code}
        </body>
      </html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    alert("请允许弹出窗口以查看代码预览。");
    URL.revokeObjectURL(url);
    return;
  }

  const timer = setInterval(() => {
    if (win.closed) {
      URL.revokeObjectURL(url);
      clearInterval(timer);
    }
  }, 1000);
};

const download = () => {
  const ext = guessExtension(props.language);
  const blob = new Blob([props.code], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `snippet.${ext}`;
  link.click();
  URL.revokeObjectURL(url);
};

function guessExtension(lang?: string) {
  const map: Record<string, string> = {
    ts: "ts",
    typescript: "ts",
    js: "js",
    javascript: "js",
    json: "json",
    vue: "vue",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "md",
    markdown: "md",
    py: "py",
    python: "py",
    go: "go",
    rust: "rs",
    rs: "rs",
    java: "java",
    c: "c",
    cpp: "cpp",
    csharp: "cs",
    cs: "cs",
    php: "php",
    ruby: "rb",
    rb: "rb",
    swift: "swift",
    kotlin: "kt",
    kt: "kt",
    sql: "sql",
    sh: "sh",
    bash: "sh",
    shell: "sh",
    yaml: "yml",
    yml: "yml",
  };
  if (!lang) return "txt";
  const key = lang.toLowerCase();
  return map[key] || "txt";
}

// 保留占位以便未来需要文本转义时可恢复
// function escapeHtml(str: string) {
//   return str
//     .replace(/&/g, "&amp;")
//     .replace(/</g, "&lt;")
//     .replace(/>/g, "&gt;")
//     .replace(/"/g, "&quot;")
//     .replace(/'/g, "&#039;");
// }
</script>

<style scoped>
.custom-code-block {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: #ffffff;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  color: #0f172a;
  max-width: 900px;
  margin-top: 10px;
}

.custom-code-block__header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
  background: #f5f5f5;
  border: 1px solid #e2e8f0;
  border-bottom: 1px solid #e9eef5;
  /* border-radius: 16px 16px 0 0; */
  color: #334155;
}

.collapse-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  border: none;
  transition: color 120ms ease, border-color 120ms ease,
    background-color 120ms ease;
}

.collapse-btn:hover {
  background: #ebebeb;
}

.chevron {
  display: inline-block;
  font-size: 13px;
  color: #64748b;
  transition: transform 150ms ease;
}

.chevron--open {
  transform: rotate(90deg);
}

.custom-code-block__lang {
  display: inline-block;
  padding: 1px 6px;
  color: #4338ca;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.header-spacer {
  flex: 1 1 auto;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 8px;
  color: #64748b;
  cursor: pointer;
  transition: color 120ms ease, background-color 120ms ease;
}

.icon-btn__icon {
  width: 14px;
  height: 14px;
}

.icon-btn__icon--success {
  color: #10b981;
}

.custom-code-block__body {
  background: #ffffff;
  color: #0f172a;
}

.custom-code-block__body :deep(pre) {
  margin: 0;
  padding: 1.1rem 1.2rem;
  overflow-x: auto;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 0 0 16px 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
  --sd-font-size-base: 16px !important;
  line-height: 1.4 !important;
}

.custom-code-block__body :deep(pre::-webkit-scrollbar) {
  height: 8px;
}

.custom-code-block__body :deep(pre::-webkit-scrollbar-thumb) {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.custom-code-block__body :deep(pre::-webkit-scrollbar-track) {
  background: transparent;
}
</style>
