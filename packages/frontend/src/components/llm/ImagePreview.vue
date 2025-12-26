<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

interface Props {
  src: string;
  alt?: string;
  isOpen: boolean;
  debug?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  alt: "Image",
  debug: false,
});

const emit = defineEmits<{
  close: [];
}>();

const previewError = ref(false);

// Zoom and pan state
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const imageContainerRef = ref<HTMLElement | null>(null);
let rafId: number | null = null;

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.1;

const closePreview = () => {
  emit("close");
  // Reset zoom and pan when closing
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
};

const handleWheel = (e: WheelEvent) => {
  if (!props.isOpen) return;
  e.preventDefault();

  const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale.value + delta));

  if (newScale === scale.value) return;

  // Get mouse position relative to the image container
  const rect = imageContainerRef.value?.getBoundingClientRect();
  if (!rect) return;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Calculate the point in the image before zoom
  const imageX = (mouseX - translateX.value - rect.width / 2) / scale.value;
  const imageY = (mouseY - translateY.value - rect.height / 2) / scale.value;

  // Update scale
  scale.value = newScale;

  // Adjust translate to zoom towards mouse position
  translateX.value = mouseX - rect.width / 2 - imageX * scale.value;
  translateY.value = mouseY - rect.height / 2 - imageY * scale.value;
};

const handleMouseDown = (e: MouseEvent) => {
  if (!props.isOpen || e.button !== 0) return; // Only left mouse button
  isDragging.value = true;
  dragStart.value = {
    x: e.clientX - translateX.value,
    y: e.clientY - translateY.value,
  };
  document.body.style.cursor = "grabbing";
};

const handleMouseMove = (e: MouseEvent) => {
  if (!props.isOpen || !isDragging.value) return;

  // Use requestAnimationFrame for smooth dragging
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }

  rafId = requestAnimationFrame(() => {
    translateX.value = e.clientX - dragStart.value.x;
    translateY.value = e.clientY - dragStart.value.y;
    rafId = null;
  });
};

const handleMouseUp = () => {
  if (!props.isOpen) return;
  isDragging.value = false;
  document.body.style.cursor = "";
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
  if (e.key === "Escape") {
    closePreview();
  }
};

const resetZoom = () => {
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
};

const handlePreviewError = () => {
  previewError.value = true;
};

// Cache the processed image src using computed to avoid repeated processing
const validImageSrc = computed(() => {
  const src = props.src;
  if (!src || typeof src !== "string") {
    if (props.debug) console.warn("Invalid image source provided:", src);
    return "";
  }

  // If it's already a data URI, return as is
  if (src.startsWith("data:image/")) {
    if (props.debug) console.log("Source is already a data URI");
    return src;
  }

  // Clean up the base64 string - remove any data: prefix that doesn't include mime type
  let cleanBase64 = src;
  if (src.startsWith("data:")) {
    cleanBase64 = src.replace(/^data:[^;]*;base64,/, "");
  }

  // Remove any whitespace
  cleanBase64 = cleanBase64.trim();

  if (props.debug) {
    console.log("Image processing:", {
      originalLength: src.length,
      cleanLength: cleanBase64.length,
      startsWithData: src.startsWith("data:"),
      hasImageType: src.startsWith("data:image/"),
      first50Chars: src.substring(0, 50),
    });
  }

  // Validate base64 format (basic check)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
    if (props.debug)
      console.warn("Invalid base64 format detected:", src.substring(0, 50) + "...");
  }

  // Detect image type from base64 header if possible
  let mimeType = "image/png"; // default
  try {
    // Try to detect from base64 header
    const binaryString = atob(cleanBase64.substring(0, 10));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Check for common image signatures
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      mimeType = "image/jpeg";
    } else if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    ) {
      mimeType = "image/png";
    } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      mimeType = "image/gif";
    } else if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      mimeType = "image/webp";
    }
  } catch (e) {
    if (props.debug) console.warn("Could not detect image type:", e);
  }

  const dataUri = `data:${mimeType};base64,${cleanBase64}`;
  if (props.debug) {
    console.log("Generated image src:", {
      original: src.substring(0, 50) + "...",
      result: dataUri.substring(0, 50) + "...",
      mimeType,
      length: cleanBase64.length,
    });
  }

  return dataUri;
});

// Watch isOpen to reset zoom/pan when opening
watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      previewError.value = false;
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
    }
  }
);

onMounted(() => {
  window.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("wheel", handleWheel);
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
  window.removeEventListener("keydown", handleKeyDown);
  document.body.style.cursor = "";
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
  }
});
</script>

<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click="closePreview"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black bg-opacity-75 backdrop-blur-sm"></div>

      <!-- Close Button (Page top-right corner) -->
      <button
        @click.stop="closePreview"
        class="absolute top-4 right-4 z-10 text-white hover:text-slate-300 transition-colors p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <!-- Reset Zoom Button -->
      <button
        v-if="scale !== 1 || translateX !== 0 || translateY !== 0"
        @click.stop="resetZoom"
        class="absolute top-4 left-4 z-10 text-white hover:text-slate-300 transition-colors p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70"
        title="Reset zoom"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>

      <!-- Modal Content -->
      <div
        ref="imageContainerRef"
        class="relative w-full h-full flex items-center justify-center overflow-hidden"
        @click.stop
        @mousedown="handleMouseDown"
        :style="{ cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default' }"
      >
        <!-- Image Preview -->
        <div v-if="!previewError" class="flex flex-col items-center">
          <!-- Image wrapper div with transform -->
          <div
            :style="{
              transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'none',
              willChange: 'transform',
            }"
          >
            <img
              :src="validImageSrc"
              :alt="alt"
              class="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
              style="pointer-events: none"
              @error="handlePreviewError"
              draggable="false"
            />
          </div>

          <!-- Image Info -->
          <div
            class="mt-4 text-white text-sm text-center bg-black bg-opacity-50 px-4 py-2 rounded-lg pointer-events-none"
          >
            <p>{{ alt }}</p>
            <p v-if="src" class="text-xs text-slate-300 mt-1">
              Size: {{ Math.round((src.length * 0.75) / 1024) }}KB
            </p>
            <p class="text-xs text-slate-300 mt-1">
              Scroll to zoom • Drag to pan • Press ESC to close
            </p>
            <p v-if="scale !== 1" class="text-xs text-slate-300 mt-1">
              Zoom: {{ Math.round(scale * 100) }}%
            </p>
          </div>
        </div>

        <!-- Error State -->
        <div v-else class="text-center text-white">
          <svg
            class="w-16 h-16 mx-auto mb-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.734-.833-2.504 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p class="text-lg">Failed to load image</p>
          <p class="text-sm text-slate-300 mt-2">
            The image data might be corrupted or in an unsupported format
          </p>
        </div>
      </div>
    </div>
  </teleport>
</template>
