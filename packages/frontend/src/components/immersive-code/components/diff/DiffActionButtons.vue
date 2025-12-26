<template>
  <div class="cursor-diff-buttons">
    <button class="cursor-btn undo-btn" @click="handleUndo" :title="`Undo Change`">
      取消
    </button>
    <button
      class="cursor-btn keep-btn"
      @click="handleAccept"
      :title="`Keep Code Suggestion`"
    >
      接受
    </button>
  </div>
</template>

<script setup lang="ts">
interface Props {
  change: any;
  onAccept?: (change: any) => void;
  onUndo?: (change: any) => void;
}

const props = defineProps<Props>();

const handleAccept = () => {
  if (props.onAccept) {
    props.onAccept(props.change);
  }
};

const handleUndo = () => {
  if (props.onUndo) {
    props.onUndo(props.change);
  }
};
</script>

<style scoped>
.cursor-diff-buttons {
  display: flex;
  padding: 0px;
  background: rgba(245, 245, 245, 0.9);
  border-top-left-radius: 0px;
  border-top-right-radius: 0px;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.cursor-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1px 10px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.undo-btn {
  background: #949ba5;
  color: white;
}

.undo-btn:hover {
  background: #5c6066;
}

.keep-btn {
  background: #10b981;
  color: white;
}

.keep-btn:hover {
  background: #059669;
}

.cursor-btn:active {
  transform: scale(0.98);
}

.cursor-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

/* Dark mode adapter */
@media (prefers-color-scheme: dark) {
  .cursor-diff-buttons {
    background: rgba(55, 55, 55, 0.9);
  }

  .undo-btn {
    color: #9ca3af;
  }

  .undo-btn:hover {
    background: rgba(156, 163, 175, 0.1);
    color: #d1d5db;
  }

  .keep-btn {
    background: #10b981;
    color: white;
  }

  .keep-btn:hover {
    background: #059669;
  }
}
</style>
