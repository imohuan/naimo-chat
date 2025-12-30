<template>
  <div class="custom-code-block" :style="maxWidthStyle">
    <div class="custom-code-block__header">
      <div class="header-left">
        <button class="collapse-btn" type="button" @click="toggleCollapse">
          <span class="chevron" :class="{ 'chevron--open': !collapsed }">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4.5 3L7.5 6L4.5 9"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </button>
        <span class="custom-code-block__lang">{{
          formatLanguage(language)
        }}</span>
      </div>

      <div class="header-spacer" />

      <div class="header-actions">
        <button
          v-if="showApplyDiffButton"
          class="icon-btn"
          type="button"
          @click="applyDiff"
          title="应用diff"
        >
          <GitMerge class="icon-btn__icon" />
        </button>
        <button
          class="icon-btn"
          type="button"
          @click="copy"
          :title="copied ? 'Copied' : 'Copy'"
        >
          <Check v-if="copied" class="icon-btn__icon icon-btn__icon--success" />
          <Copy v-else class="icon-btn__icon" />
        </button>
        <button
          v-if="isHtmlCode"
          class="icon-btn"
          type="button"
          @click="preview"
          title="Preview"
        >
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
      :class="[
        'custom-code-block__body',
        { 'custom-code-block__body--diff': isDiffBlock },
      ]"
    >
      <!-- diff 格式时，使用 TextDiffViewer 渲染 -->
      <template v-if="isDiffBlock">
        <TextDiffViewer
          :old-text="diffOldText"
          :new-text="diffNewText"
          :show-indicators="false"
          :show-footer="false"
          :font-size="14"
          :line-height="1.4"
        />
      </template>
      <!-- 否则使用语法高亮后的 HTML -->
      <template v-else>
        <div v-html="html" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useShikiHighlighter } from "streamdown-vue";
import { computed, nextTick, onBeforeUnmount, ref, watch, toRef } from "vue";
import { Check, Copy, Download, Eye, GitMerge } from "lucide-vue-next";
import { useMessageBranchWidth } from "@/components/ai-elements/message/context";
import { getContext } from "@/core/context";
import TextDiffViewer from "@/components/llm/TextDiffViewer.vue";
import { useDiffCodeBlock } from "./useDiffCodeBlock";

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

const formatLanguage = (lang?: string): string => {
  const language = lang || "text";
  return language.charAt(0).toUpperCase() + language.slice(1).toLowerCase();
};

const html = ref("<pre><code>Loading…</code></pre>");
const copied = ref(false);
const collapsed = ref(false);

const highlighterPromise = useShikiHighlighter();
let highlightTimer: number | null = null;
const element = ref<HTMLDivElement>();

// diff 相关逻辑抽象为 hook
const codeRef = toRef(props, "code");
const { isDiffBlock, diffOldText, diffNewText } = useDiffCodeBlock(codeRef);

// 检测是否在 .model-canvas 容器内
const isInModelCanvas = (): boolean => {
  if (!element.value) return false;
  return element.value.closest(".model-canvas") !== null;
};

// 计算是否显示应用diff按钮
const showApplyDiffButton = computed(() => {
  return isInModelCanvas() && isDiffBlock.value;
});

// 计算是否为 HTML 代码模式
const isHtmlCode = computed(() => {
  const lang = (props.language || "").toLowerCase();
  return lang === "html";
});

const { eventBus } = getContext();

// 处理应用diff按钮点击
const applyDiff = () => {
  if (!props.code) return;
  // 通过 eventBus 发送 diff 事件
  eventBus.emit("codeblock:apply-diff", {
    code: props.code,
  });
};

// 只保留代码的最后 4 行
const limitCodeToLastLines = (code: string, lines: number = 4): string => {
  const codeLines = code.split(/\n/);
  if (codeLines.length <= lines) return code;
  return codeLines.slice(-lines).join("\n");
};

// 在画布模式下，代码渲染完成后滚动到底部
const scrollToBottomIfInModelCanvas = async () => {
  if (!isInModelCanvas()) return;
  await nextTick();
  const container = element.value;
  if (container) {
    container.scrollTop = container.scrollHeight;
  }

  // const pre = container?.querySelector("pre");
  // if (pre) {
  //   pre.scrollTop = pre.scrollHeight;
  // }
};

const runHighlight = async () => {
  try {
    // diff 代码块使用 TextDiffViewer，不需要语法高亮
    if (isDiffBlock.value) {
      html.value = `<pre><code>${props.code || ""}</code></pre>`;
      await scrollToBottomIfInModelCanvas();
      return;
    }
    // 确保 DOM 已挂载后再检测
    await nextTick();

    const highlighter = await highlighterPromise;
    const lang = (props.language || "text").toLowerCase();
    let code =
      typeof props.code === "string" ? props.code : String(props.code ?? "");

    // 如果是在 .model-canvas 内，只渲染最后 3 行
    // if (isInModelCanvas()) {
    //   code = limitCodeToLastLines(code, 3);
    // }

    // 对超大代码块做降级，避免严重卡顿
    if (code.length > 200_000) {
      html.value = `<pre><code>${code}</code></pre>`;

      await scrollToBottomIfInModelCanvas();
      return;
    }

    html.value = highlighter.codeToHtml(code, {
      lang,
      themes: { light: "github-light", dark: "github-dark" },
    });

    await scrollToBottomIfInModelCanvas();
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
  width: 100%;
  min-width: 100%; /* 突破父容器 w-fit 的限制 */
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

.header-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
  color: #64748b;
  cursor: pointer;
  border: none;
  background: transparent;
  transition: all 150ms ease;
}

.collapse-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #475569;
}

.chevron {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.chevron svg {
  width: 12px;
  height: 12px;
}

.chevron--open {
  transform: rotate(90deg);
}

.custom-code-block__lang {
  display: inline-flex;
  align-items: center;
  padding: 5px 0px;
  color: #64748b;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-bottom-left-radius: 8px;
  border-bottom-right-radius: 8px;
}

/* 嵌入 TextDiffViewer 时，减小内边距、保证文字颜色正确 */
.custom-code-block__body :deep(.code-row td) {
  padding-top: 2px;
  padding-bottom: 2px;
}

.custom-code-block__body :deep(.code-row pre) {
  color: #0f172a;
}

.custom-code-block__body > div:not(.diff-wrapper) :deep(pre) {
  margin: 0;
  padding: 1.1rem 1.2rem;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 0 0 16px 16px;
  --sd-font-size-base: 16px !important;
  line-height: 1.4 !important;
  width: fit-content;
  overflow: hidden;
  border: none !important;
}

.custom-code-block__body > .diff-wrapper :deep(pre) {
  padding-bottom: 0;
}

:deep(*::-webkit-scrollbar) {
  width: 10px !important;
  height: 10px !important;
}

.custom-code-block__body::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
  transition: background 0.2s ease;
}

/* diff 模式下：去掉 body 圆角 / 额外内边距，由内部 TextDiffViewer 自己控制 */
.custom-code-block__body--diff {
  padding: 0 !important;
}

.custom-code-block__body--diff :deep(.diff-wrapper .diff-container.code-font) {
  border-radius: 0 !important;
  border: none !important;
}

.custom-code-block__body--diff :deep(.diff-wrapper pre) {
  padding-bottom: 0 !important;
  overflow: hidden;
  border-radius: 0 !important;
  border: none !important;
}

.custom-code-block__body--diff :deep(.diff-wrapper td) {
  /* padding-left: 0px !important;
  padding-right: 0px !important;
  padding-top: 2px !important;
  padding-bottom: 2px !important; */
  padding: 0 !important;
  border-bottom: none !important;
}
</style>
