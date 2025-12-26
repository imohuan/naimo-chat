<script setup lang="ts">
import { ref, computed } from "vue";
import ImagePreview from "./ImagePreview.vue";

interface Props {
  src: string;
  alt?: string;
  maxWidth?: string;
  maxHeight?: string;
  className?: string;
  debug?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  alt: "Image",
  maxWidth: "300px",
  maxHeight: "200px",
  className: "",
  debug: false,
});

const isPreviewOpen = ref(false);
const thumbnailError = ref(false);

const openPreview = () => {
  isPreviewOpen.value = true;
};

const closePreview = () => {
  isPreviewOpen.value = false;
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

const handleThumbnailError = () => {
  thumbnailError.value = true;
  console.error("Thumbnail image failed to load:", {
    src: validImageSrc.value,
    alt: props.alt,
    originalSrc: props.src,
  });
};

// Expose methods for external access
defineExpose({
  closePreview,
  isPreviewOpen,
});
</script>

<template>
  <div class="image-display">
    <!-- Thumbnail -->
    <div
      class="inline-block cursor-pointer group relative"
      @click="openPreview"
      :class="className"
    >
      <!-- Error fallback -->
      <div
        v-if="thumbnailError"
        class="rounded-lg border border-red-200 bg-red-50 p-4 flex flex-col items-center justify-center"
        :style="{ maxWidth, maxHeight }"
      >
        <svg
          class="w-8 h-8 text-red-400 mb-2"
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
        <p class="text-xs text-red-600 text-center">Image failed to load</p>
        <p class="text-xs text-red-400 mt-1">Click to try preview</p>
      </div>

      <!-- Normal image -->
      <img
        v-else
        :src="validImageSrc"
        :alt="props.alt"
        class="rounded-lg border border-slate-200 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-slate-300"
        :style="{ maxWidth, maxHeight }"
        loading="lazy"
        @error="handleThumbnailError"
      />

      <!-- Overlay icon -->
      <div
        class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-lg flex items-center justify-center"
      >
        <svg
          class="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
          />
        </svg>
      </div>
    </div>

    <!-- Debug Panel (only when debug mode is enabled) -->
    <div
      v-if="debug && !thumbnailError"
      class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs"
    >
      <p class="font-mono text-yellow-800">
        <strong>Debug Info:</strong><br />
        Src: {{ props.src.substring(0, 100) }}{{ props.src.length > 100 ? "..." : ""
        }}<br />
        Length: {{ props.src.length }} chars<br />
        Type: {{ props.src.startsWith("data:") ? "Data URI" : "Raw Base64" }}<br />
        Has Image Type: {{ props.src.startsWith("data:image/") ? "Yes" : "No" }}
      </p>
    </div>

    <!-- Image Preview Component -->
    <ImagePreview
      :src="props.src"
      :alt="props.alt"
      :is-open="isPreviewOpen"
      :debug="debug"
      @close="closePreview"
    />
  </div>
</template>

<style scoped>
.image-display img {
  display: block;
}
</style>
