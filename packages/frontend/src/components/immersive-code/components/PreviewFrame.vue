<script setup lang="ts">
/* eslint-disable no-useless-escape */
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import LOG_SCRIPT from "./preload/log.js?raw";
import ELEMENT_SELECTOR_SCRIPT from "./preload/element-selector.js?raw";
import SHORTCUTS_SCRIPT from "./preload/shortcuts.js?raw";

const props = defineProps<{
  code: string;
  enableElementSelector?: boolean;
}>();

const emit = defineEmits<{
  (e: "console-log", log: any): void;
  (e: "element-selected", selector: string, data?: any): void;
  (e: "toggle-console"): void;
  (e: "toggle-element-selector", enabled: boolean): void;
  (e: "load-complete"): void;
  (e: "load-error"): void;
}>();

const iframeRef = ref<HTMLIFrameElement>();
const loadTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const hasLoaded = ref(false);

// Console interception script to inject
const INJECTED_SCRIPT = "<script>" + LOG_SCRIPT + "<\/script>";
// Element selector script to inject
const ELEMENT_SELECTOR_INJECTED_SCRIPT =
  "<script>" + ELEMENT_SELECTOR_SCRIPT + "<\/script>";
// Shortcuts script to inject
const SHORTCUTS_INJECTED_SCRIPT = "<script>" + SHORTCUTS_SCRIPT + "<\/script>";

const srcDoc = computed(() => {
  // Inject the scripts at the beginning of the code
  // This works for both Fragments and full HTML documents in most browsers
  return (
    INJECTED_SCRIPT +
    ELEMENT_SELECTOR_INJECTED_SCRIPT +
    SHORTCUTS_INJECTED_SCRIPT +
    props.code
  );
});

// 监听代码变化，重置加载状态并启动超时
watch(
  () => props.code,
  () => {
    hasLoaded.value = false;
    startLoadTimeout();
  },
  { immediate: false }
);

function handleMessage(event: MessageEvent) {
  const data = event.data;
  if (data && data.type === "console-log") {
    emit("console-log", {
      method: data.method,
      args: data.args,
      caller: data.caller,
      stack: data.stack,
    });
  } else if (data && data.type === "element-selected") {
    emit("element-selected", data.selector, data.data);
  } else if (data && data.type === "toggle-console") {
    emit("toggle-console");
  } else if (data && data.type === "toggle-element-selector") {
    emit("toggle-element-selector", data.enabled || false);
  }
}

function clearLoadTimeout() {
  if (loadTimeout.value) {
    clearTimeout(loadTimeout.value);
    loadTimeout.value = null;
  }
}

function startLoadTimeout() {
  clearLoadTimeout();
  hasLoaded.value = false;
  // 设置超时时间为 10 秒，如果在这个时间内没有加载完成，认为加载失败
  loadTimeout.value = setTimeout(() => {
    if (!hasLoaded.value) {
      hasLoaded.value = true;
      emit("load-error");
    }
  }, 10000);
}

// Re-expose refresh if needed, though srcdoc updates reactive
function refresh() {
  // Force refresh logic if necessary, usually srcdoc change triggers it.
}

// Toggle element selector in iframe
function toggleElementSelector(enabled: boolean) {
  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage(
      {
        type: "toggle-element-selector",
        enabled: enabled,
      },
      "*"
    );
  }
}

// Select and highlight element by selector
function selectElementBySelector(selector: string) {
  if (iframeRef.value?.contentWindow) {
    iframeRef.value.contentWindow.postMessage(
      {
        type: "select-element-by-selector",
        selector: selector,
      },
      "*"
    );
  }
}

// Watch for element selector prop changes
watch(
  () => props.enableElementSelector,
  (enabled) => {
    // Wait for iframe to load before sending message
    nextTick(() => {
      if (iframeRef.value?.contentWindow) {
        toggleElementSelector(enabled || false);
        // Focus iframe when element selector is enabled
        if (enabled) {
          // Focus the iframe element itself
          iframeRef.value?.focus();
          // Also send focus message to iframe content
          iframeRef.value.contentWindow.postMessage(
            {
              type: "focus-iframe",
            },
            "*"
          );
        }
      }
    });
  },
  { immediate: true }
);

// Handle iframe error
function handleIframeError() {
  clearLoadTimeout();
  if (!hasLoaded.value) {
    hasLoaded.value = true;
    emit("load-error");
  }
}

// Listen for iframe load to initialize selector state
function handleIframeLoad() {
  // 清除超时
  clearLoadTimeout();
  if (!hasLoaded.value) {
    hasLoaded.value = true;
    emit("load-complete");
  }

  if (props.enableElementSelector && iframeRef.value?.contentWindow) {
    toggleElementSelector(true);
  }
}

// 检查 iframe 是否已经加载完成
function checkIfLoaded(): boolean {
  if (!iframeRef.value) return false;
  try {
    const iframeDoc =
      iframeRef.value.contentDocument ||
      iframeRef.value.contentWindow?.document;
    return iframeDoc?.readyState === "complete" || hasLoaded.value;
  } catch (e) {
    // 跨域或其他错误，使用内部状态
    return hasLoaded.value;
  }
}

defineExpose({
  refresh,
  selectElementBySelector,
  checkIfLoaded,
  getIframe: () => iframeRef.value,
});

// Listen to messages
if (typeof window !== "undefined") {
  window.addEventListener("message", handleMessage);
}

// 监听代码变化，重置加载状态并启动超时
watch(
  () => props.code,
  () => {
    hasLoaded.value = false;
    startLoadTimeout();
  },
  { immediate: true }
);

// 清理
onBeforeUnmount(() => {
  clearLoadTimeout();
});
</script>

<template>
  <div class="w-full h-full bg-white relative">
    <iframe
      ref="iframeRef"
      :srcdoc="srcDoc"
      class="w-full h-full border-none"
      allow="xr-spatial-tracking; web-share"
      sandbox="allow-pointer-lock allow-popups allow-forms allow-popups-to-escape-sandbox allow-downloads allow-scripts allow-same-origin"
      @load="handleIframeLoad"
      @error="handleIframeError"
    ></iframe>
  </div>
</template>
