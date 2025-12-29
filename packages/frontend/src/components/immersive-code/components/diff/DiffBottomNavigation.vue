<template>
  <div class="cursor-bottom-navigation" v-if="totalChanges > 0">
    <div class="cursor-nav-container">
      <!-- Nav Section -->
      <div class="nav-section">
        <button
          class="nav-btn prev-btn"
          @click="$emit('previous')"
          :disabled="props.isPrevDisabled"
          :title="'Previous Change'"
        >
          <ChevronUp class="w-4 h-4" />
        </button>

        <div class="change-counter">
          {{ props.currentIndex + 1 }} / {{ props.totalChanges }}
        </div>

        <button
          class="nav-btn next-btn"
          @click="$emit('next')"
          :disabled="props.isNextDisabled"
          :title="'Next Change'"
        >
          <ChevronDown class="w-4 h-4" />
        </button>
      </div>

      <!-- Action Section -->
      <div class="action-section">
        <button
          class="action-btn undo-all-btn"
          @click="$emit('undoAll')"
          :title="'Undo all'"
        >
          取消全部
          <!-- <span class="shortcut">Ctrl+Shift+U</span> -->
        </button>

        <button
          class="action-btn keep-all-btn"
          @click="$emit('acceptAll')"
          :title="'Keep all'"
        >
          接受全部
          <!-- <span class="shortcut">Ctrl+A</span> -->
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronUp, ChevronDown } from "lucide-vue-next";

interface Props {
  currentIndex: number;
  totalChanges: number;
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isPrevDisabled: false,
  isNextDisabled: false,
});

defineEmits<{
  previous: [];
  next: [];
  acceptAll: [];
  undoAll: [];
  close: [];
}>();
</script>

<style scoped>
.cursor-bottom-navigation {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  pointer-events: none;
}

.cursor-nav-container {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 3px 4px;
  background: #f3f3f3;
  border-radius: 5px;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.212);
  pointer-events: auto;
  font-size: 13px;
  border: 1px solid #d1d5db;
}

.nav-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #6b7280;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(107, 114, 128, 0.1);
  color: #374151;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.change-counter {
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-weight: 500;
  color: #374151;
  user-select: none;
  font-size: 12px;
}

.action-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.undo-all-btn {
  background: transparent;
  color: #6b7280;
}

.undo-all-btn:hover {
  background: rgba(107, 114, 128, 0.1);
  color: #374151;
}

.keep-all-btn {
  background: #3b82f6;
  color: white;
}

.keep-all-btn:hover {
  background: #2563eb;
}

.shortcut {
  font-size: 10px;
  opacity: 0.7;
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .cursor-nav-container {
    background: rgba(55, 55, 55, 0.9);
  }

  .nav-btn {
    color: #9ca3af;
  }

  .nav-btn:hover:not(:disabled) {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }

  .change-counter {
    color: #d1d5db;
  }

  .undo-all-btn {
    color: #9ca3af;
  }

  .undo-all-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }

  .keep-all-btn {
    background: #3b82f6;
    color: white;
  }

  .keep-all-btn:hover {
    background: #2563eb;
  }
}

.cursor-bottom-navigation {
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>
