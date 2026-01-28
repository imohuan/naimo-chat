<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDraggable } from '@vueuse/core'
import { onKeyStroke } from '@vueuse/core'

interface Props {
  src: string
  visible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Refs
const imageWrapper = ref<HTMLElement>()
const currentZoom = ref(1)

// Draggable
const { x, y, style: dragStyle } = useDraggable(imageWrapper, {
  initialValue: { x: 0, y: 0 }
})

// Computed
const zoomPercentage = computed(() => Math.round(currentZoom.value * 100))

const transformStyle = computed(() => ({
  transform: `translate(${x.value}px, ${y.value}px) scale(${currentZoom.value})`
}))

// Methods
const close = () => {
  emit('close')
}

const zoomIn = () => {
  currentZoom.value = Math.min(5, currentZoom.value + 0.5)
}

const zoomOut = () => {
  currentZoom.value = Math.max(0.5, currentZoom.value - 0.5)
}

const resetZoom = () => {
  currentZoom.value = 1
  x.value = 0
  y.value = 0
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  currentZoom.value = Math.max(0.5, Math.min(5, currentZoom.value + delta))
}

// Watch for visibility changes to reset zoom
watch(() => props.visible, (newVal) => {
  if (newVal) {
    resetZoom()
  }
})

// ESC key to close
onKeyStroke('Escape', () => {
  if (props.visible) {
    close()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="image-viewer"
        @wheel="handleWheel"
      >
        <!-- Close button -->
        <button
          class="viewer-close"
          @click="close"
          aria-label="关闭图片查看器"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <!-- Image wrapper -->
        <div
          ref="imageWrapper"
          class="viewer-image-wrapper"
          :style="transformStyle"
        >
          <img
            :src="src"
            alt="预览图片"
            class="viewer-image"
          >
        </div>

        <!-- Zoom controls -->
        <div class="viewer-controls">
          <button
            class="viewer-btn"
            @click="zoomOut"
            aria-label="缩小"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>

          <div class="viewer-zoom-level">
            {{ zoomPercentage }}%
          </div>

          <button
            class="viewer-btn"
            @click="zoomIn"
            aria-label="放大"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>

          <button
            class="viewer-btn"
            @click="resetZoom"
            aria-label="重置缩放"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M1 4v6h6M23 20v-6h-6"></path>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Image Viewer - Full Screen */
.image-viewer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.viewer-image-wrapper {
  max-width: 90%;
  max-height: 90%;
  cursor: grab;
  user-select: none;
  transition: transform 0.1s ease-out;
}

.viewer-image-wrapper:active {
  cursor: grabbing;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.viewer-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 100000;
  border: none;
  transition: background 0.2s;
}

.viewer-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.viewer-controls {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.viewer-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  color: #202124;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}

.viewer-btn:hover {
  background: #e8eaed;
}

.viewer-zoom-level {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  font-size: 14px;
  font-weight: 500;
  color: #202124;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
