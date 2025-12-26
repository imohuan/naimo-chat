<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  code: string;
}>();

const emit = defineEmits<{
  (e: "console-log", log: any): void;
}>();

const iframeRef = ref<HTMLIFrameElement>();

// Console interception script to inject
const INJECTED_SCRIPT = `
<script>
  (function() {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info
    };

    function sendLog(method, args) {
      try {
        // Simple serialization to pass across iframe boundary
        const serializedArgs = args.map(arg => {
          if (typeof arg === 'undefined') return 'undefined';
          if (arg === null) return 'null';
          if (typeof arg === 'function') return arg.toString();
          if (arg instanceof Error) return arg.message;
          try {
             return JSON.parse(JSON.stringify(arg));
          } catch (e) {
             return String(arg);
          }
        });
        
        window.parent.postMessage({
          type: 'console-log', 
          method, 
          args: serializedArgs 
        }, '*');
      } catch (err) {
        console.error('Failed to send log to parent', err);
      }
    }

    console.log = (...args) => { originalConsole.log(...args); sendLog('log', args); };
    console.warn = (...args) => { originalConsole.warn(...args); sendLog('warn', args); };
    console.error = (...args) => { originalConsole.error(...args); sendLog('error', args); };
    console.info = (...args) => { originalConsole.info(...args); sendLog('info', args); };

    window.addEventListener('error', (event) => {
      sendLog('error', [event.message]);
    });
  })();
<\/script>
`;

const srcDoc = computed(() => {
  // Inject the script at the beginning of the code
  // This works for both Fragments and full HTML documents in most browsers
  return INJECTED_SCRIPT + props.code;
});

function handleMessage(event: MessageEvent) {
  const data = event.data;
  if (data && data.type === "console-log") {
    emit("console-log", {
      method: data.method,
      args: data.args,
    });
  }
}

// Re-expose refresh if needed, though srcdoc updates reactive
function refresh() {
  // Force refresh logic if necessary, usually srcdoc change triggers it.
}

defineExpose({ refresh });

// Listen to messages
if (typeof window !== "undefined") {
  window.addEventListener("message", handleMessage);
}
</script>

<template>
  <div class="w-full h-full bg-white relative">
    <iframe
      ref="iframeRef"
      :srcdoc="srcDoc"
      class="w-full h-full border-none"
      allow="xr-spatial-tracking; web-share"
      sandbox="allow-pointer-lock allow-popups allow-forms allow-popups-to-escape-sandbox allow-downloads allow-scripts allow-same-origin"
    ></iframe>
  </div>
</template>
