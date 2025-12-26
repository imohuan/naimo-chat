<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";

const props = defineProps<{
  code: string;
}>();

const emit = defineEmits<{
  (e: "console-log", log: any): void;
}>();

const iframeRef = ref<HTMLIFrameElement>();

// The shim URL provided by the user
const SHIM_URL =
  "https://3g4lalt740fefj4r2o39w1yrw93nnx9x222a7cbl9i3es2y5s6-h845251650.scf.usercontent.goog/gemini-code-immersive/shim.html?origin=https%3A%2F%2Fgemini.google.com&cache=1";

function updatePreview() {
  if (!iframeRef.value?.contentWindow) return;

  // Sending the code to the shim.
  // Based on "using doc to render code", we send the content.
  // We send it as 'doc' and 'html' to cover bases, or assuming a standard structure.
  // Ideally, the shim expects a message. We will send a generic structure that likely works or is intended.
  const message = {
    type: "render", // or 'preview'
    code: props.code,
    doc: props.code, // Explicitly honoring "use doc" hint if it refers to property name
    html: props.code,
  };

  iframeRef.value.contentWindow.postMessage(message, "*");
}

watch(
  () => props.code,
  () => {
    // Debounce slightly? Or direct.
    updatePreview();
  }
);

function handleMessage(event: MessageEvent) {
  // Filter messages relevant to us
  // The logging shim likely sends messages back.
  // We blindly accept logs for now to show in terminal.
  if (event.data) {
    // Check for log-like structures
    if (
      event.data.type === "log" ||
      event.data.console ||
      (event.data.method &&
        ["log", "error", "warn", "info"].includes(event.data.method))
    ) {
      emit("console-log", event.data);
    }
  }
}

onMounted(() => {
  window.addEventListener("message", handleMessage);
  // Allow time for iframe to load before first render
  if (iframeRef.value) {
    iframeRef.value.onload = () => {
      updatePreview();
    };
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage);
});

defineExpose({
  refresh: updatePreview,
});
</script>

<template>
  <div class="w-full h-full bg-white relative">
    <iframe
      ref="iframeRef"
      :src="SHIM_URL"
      class="w-full h-full border-none"
      allow="xr-spatial-tracking; web-share"
      sandbox="allow-pointer-lock allow-popups allow-forms allow-popups-to-escape-sandbox allow-downloads allow-scripts allow-same-origin"
    ></iframe>
  </div>
</template>
