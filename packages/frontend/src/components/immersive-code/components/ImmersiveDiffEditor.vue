<script setup lang="ts">
import {
  ref,
  onMounted,
  onBeforeUnmount,
  watch,
  shallowRef,
  h,
  render,
} from "vue";
import { loadMonaco, type MonacoInstance } from "../../code/monaco";
import type * as Monaco from "monaco-editor";
import DiffActionButtons from "./diff/DiffActionButtons.vue";
import DiffBottomNavigation from "./diff/DiffBottomNavigation.vue";

const props = defineProps({
  original: {
    type: String,
    default: "",
  },
  modified: {
    type: String,
    default: "",
  },
  language: {
    type: String,
    default: "javascript",
  },
  theme: {
    type: String,
    default: "vs",
  },
  fontSize: {
    type: Number,
    default: 14,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  "update:original": [value: string];
  save: [value: string];
  close: [];
  "font-size-change": [size: number];
}>();

const container = ref<HTMLElement | null>(null);
const diffEditor = shallowRef<Monaco.editor.IDiffEditor | null>(null);
const activeWidgets = ref<any[]>([]);
let monaco: MonacoInstance | null = null;
let isUpdating = false;

// Navigation State
const totalChanges = ref(0);
const currentIndex = ref(0);
const allChanges = ref<any[]>([]); // Monaco editor diff line information

// Initialize Editor
onMounted(async () => {
  if (!container.value) return;

  monaco = await loadMonaco();

  const originalModel = monaco.editor.createModel(
    props.original,
    props.language
  );
  const modifiedModel = monaco.editor.createModel(
    props.modified,
    props.language
  );

  // 与 CodeEditor.vue 保持一致的编辑器配置
  diffEditor.value = monaco.editor.createDiffEditor(container.value, {
    originalEditable: !props.readonly,
    readOnly: props.readonly,
    renderSideBySide: false, // Inline Diff
    ignoreTrimWhitespace: false,
    automaticLayout: true,
    theme: props.theme,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fontSize: props.fontSize,
    fontWeight: "bold",
    roundedSelection: false,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
  });

  diffEditor.value.setModel({
    original: originalModel,
    modified: modifiedModel,
  });

  // 隐藏原始编辑器的行号，只显示修改后编辑器的行号（单行行号效果）
  // 同时应用与 CodeEditor 一致的配置
  const originalEditor = diffEditor.value.getOriginalEditor();
  const modifiedEditor = diffEditor.value.getModifiedEditor();

  // 与 CodeEditor.vue 保持一致的编辑器配置
  const commonEditorOptions = {
    fontSize: props.fontSize,
    fontWeight: "bold" as const,
    scrollBeyondLastLine: false,
    roundedSelection: false,
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    tabSize: 2,
    wordWrap: "off" as const,
    // 代码提示功能配置
    quickSuggestions: {
      other: "on" as const,
      comments: false,
      strings: false,
    },
    parameterHints: {
      enabled: true,
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: "on" as const,
    wordBasedSuggestions: "allDocuments" as const,
    suggest: {
      showKeywords: true,
      showSnippets: true,
      showClasses: true,
      showFunctions: true,
      showVariables: true,
      showModules: true,
      showProperties: true,
      showValues: true,
      showConstants: true,
      showMethods: true,
    },
  };

  originalEditor.updateOptions({
    ...commonEditorOptions,
    lineNumbers: "off",
  });

  modifiedEditor.updateOptions({
    ...commonEditorOptions,
    lineNumbers: "on",
  });

  // Listen for changes
  diffEditor.value.onDidUpdateDiff(() => {
    updateDiffInfo();
  });

  // Listen to original model changes to sync back
  // 但只有在用戶手動編輯時才觸發，而不是通過程序化更新（如 acceptSpecificChange）
  originalModel.onDidChangeContent(() => {
    if (isUpdating) return;
    // 檢查是否是通過用戶編輯觸發的（而不是程序化更新）
    // 如果是用戶編輯，才 emit update:original
    emit("update:original", originalModel.getValue());
  });

  // Check initial diffs
  setTimeout(() => {
    updateDiffInfo();
  }, 200);

  // 支持 Ctrl + 鼠标滚轮缩放（与 CodeEditor 保持一致）
  const editorDomNode = modifiedEditor.getDomNode();
  if (editorDomNode) {
    editorDomNode.addEventListener("wheel", handleWheel, {
      passive: false,
    });
  }
});

// 处理滚轮缩放（与 CodeEditor 保持一致）
function handleWheel(event: WheelEvent) {
  if (event.ctrlKey && diffEditor.value && monaco) {
    event.preventDefault();
    const modifiedEditor = diffEditor.value.getModifiedEditor();
    const currentFontSize = modifiedEditor.getOption(
      monaco.editor.EditorOption.fontSize
    );
    const delta = event.deltaY > 0 ? -1 : 1;
    const newFontSize = Math.max(8, Math.min(30, currentFontSize + delta));

    // 同时更新两个编辑器
    const originalEditor = diffEditor.value.getOriginalEditor();
    originalEditor.updateOptions({ fontSize: newFontSize });
    modifiedEditor.updateOptions({ fontSize: newFontSize });

    // 通知父组件字体大小变化
    emit("font-size-change", newFontSize);
  }
}

// Clean up
onBeforeUnmount(() => {
  clearAllWidgets();

  // 移除滚轮事件监听器并清理
  // if (diffEditor.value) {
  //   const originalEditor = diffEditor.value.getOriginalEditor();
  //   const modifiedEditor = diffEditor.value.getModifiedEditor();

  //   const editorDomNode = modifiedEditor.getDomNode();
  //   if (editorDomNode) {
  //     editorDomNode.removeEventListener("wheel", handleWheel);
  //   }

  //   // 1. Disable all features that might trigger async background tasks
  //   originalEditor.updateOptions({
  //     occurrencesHighlight: "off",
  //     selectionHighlight: false,
  //   });

  //   modifiedEditor.updateOptions({
  //     occurrencesHighlight: "off",
  //     selectionHighlight: false,
  //   });

  //   diffEditor.value.updateOptions({
  //     renderOverviewRuler: false,
  //   });

  //   // 2. Get reference to models
  //   const model = diffEditor.value.getModel();

  //   // 3. Detach models from the editor immediately
  //   diffEditor.value.setModel(null);

  //   // 4. Dispose the editor
  //   diffEditor.value.dispose();

  //   // 5. Dispose the models safely
  //   if (model) {
  //     if (model.original) model.original.dispose();
  //     if (model.modified) model.modified.dispose();
  //   }
  // }
});

// --- Widget Logic & Navigation (Modified) ---

const clearAllWidgets = () => {
  if (!diffEditor.value) return;
  const modifiedEditor = diffEditor.value.getModifiedEditor();
  activeWidgets.value.forEach((widget: any) => {
    const domNode = widget.getDomNode();
    if (domNode) {
      render(null, domNode); // Unmount Vue
    }
    modifiedEditor.removeContentWidget(widget);
  });
  activeWidgets.value = [];
};

const updateDiffInfo = () => {
  if (!diffEditor.value || !monaco) return;

  clearAllWidgets();
  const changes = diffEditor.value.getLineChanges() || [];

  // Filter relevant changes (actually modifying lines)
  allChanges.value = changes;
  totalChanges.value = changes.length;

  // Add buttons
  changes.forEach((change) => {
    if (change.modifiedEndLineNumber > 0) {
      addActionButtonsToChange(change);
    }
  });

  // Update Current Index based on cursor position or just clamp it
  if (currentIndex.value >= totalChanges.value) {
    currentIndex.value = Math.max(0, totalChanges.value - 1);
  }
};

const addActionButtonsToChange = (change: any) => {
  if (!diffEditor.value || !monaco) return;
  // 只读模式下不显示操作按钮
  if (props.readonly) return;

  const modifiedEditor = diffEditor.value.getModifiedEditor();
  const lineNumber = change.modifiedEndLineNumber;

  // Try to get width to align buttons
  let width = modifiedEditor.getLayoutInfo().contentWidth;
  if (width < 100) width = 800; // Fallback

  const buttonContainer = document.createElement("div");
  buttonContainer.style.position = "absolute";
  buttonContainer.style.pointerEvents = "auto";
  buttonContainer.style.zIndex = "100";

  const innerBox = document.createElement("div");
  innerBox.style.display = "flex";
  innerBox.style.width = `${width - 80}px`; // Adjust padding
  innerBox.style.justifyContent = "flex-end";
  innerBox.style.alignItems = "center";
  buttonContainer.appendChild(innerBox);

  // Render Button Component
  const vnode = h(DiffActionButtons, {
    change: change,
    onAccept: (c) => acceptSpecificChange(c),
    onUndo: (c) => undoSpecificChange(c),
  });

  render(vnode, innerBox);

  const contentWidget = {
    getId: () => `diff.action.buttons.${lineNumber}`,
    getDomNode: () => buttonContainer,
    getPosition: () => {
      return {
        position: {
          lineNumber: lineNumber,
          column: 1,
        },
        positionAffinity: monaco!.editor.PositionAffinity.RightOfInjectedText,
        preference: [monaco!.editor.ContentWidgetPositionPreference.BELOW],
      };
    },
  };

  modifiedEditor.addContentWidget(contentWidget);
  activeWidgets.value.push(contentWidget);
};

// --- Action Logic ---

const acceptSpecificChange = (change: any) => {
  if (!diffEditor.value) return;
  const originalModel = diffEditor.value.getOriginalEditor().getModel();
  const modifiedModel = diffEditor.value.getModifiedEditor().getModel();
  if (!originalModel || !modifiedModel) return;

  isUpdating = true; // Prevent triggering onDidChangeContent event

  const originalContent = originalModel.getValue();
  const modifiedContent = modifiedModel.getValue();
  const originalLines = originalContent.split("\n");
  const modifiedLines = modifiedContent.split("\n");

  const originalStart = change.originalStartLineNumber - 1;
  const originalEnd = change.originalEndLineNumber;
  const modifiedStart = change.modifiedStartLineNumber - 1;
  const modifiedEnd = change.modifiedEndLineNumber;

  // Logic: Replace Original range with Modified range
  const newLines = [
    ...originalLines.slice(0, originalStart),
    ...modifiedLines.slice(modifiedStart, modifiedEnd),
    ...originalLines.slice(originalEnd),
  ];

  const newContent = newLines.join("\n");

  // 更新原始模型（這會觸發 diff 重新計算）
  originalModel.setValue(newContent);

  // 等待 Monaco 重新計算 diff，然後重置標誌
  setTimeout(() => {
    isUpdating = false;
    updateDiffInfo();

    // emit("update:original", newContent)

    // 關鍵修復：接受單個變更時，不觸發 update:original
    // 因為這會導致父組件清除 diffTarget，從而退出 diff 模式
    // 我們只在編輯器內部保持狀態，只有在用戶明確保存時才同步父組件
    // （通過 handleAcceptAll 或保存按鈕）
  }, 100);
};

const undoSpecificChange = (change: any) => {
  if (!diffEditor.value) return;
  const originalModel = diffEditor.value.getOriginalEditor().getModel();
  const modifiedModel = diffEditor.value.getModifiedEditor().getModel();
  if (!originalModel || !modifiedModel) return;

  isUpdating = true;

  const originalContent = originalModel.getValue();
  const modifiedContent = modifiedModel.getValue();
  const originalLines = originalContent.split("\n");
  const modifiedLines = modifiedContent.split("\n");

  const originalStart = change.originalStartLineNumber - 1;
  const originalEnd = change.originalEndLineNumber;
  const modifiedStart = change.modifiedStartLineNumber - 1;
  const modifiedEnd = change.modifiedEndLineNumber;

  // Logic: Replace Modified range with Original range
  const newLines = [
    ...modifiedLines.slice(0, modifiedStart),
    ...originalLines.slice(originalStart, originalEnd),
    ...modifiedLines.slice(modifiedEnd),
  ];

  modifiedModel.setValue(newLines.join("\n"));
  isUpdating = false;

  setTimeout(() => updateDiffInfo(), 100);
};

const handleAcceptAll = () => {
  if (!diffEditor.value) return;
  const modifiedModel = diffEditor.value.getModifiedEditor().getModel();
  const originalModel = diffEditor.value.getOriginalEditor().getModel();

  if (modifiedModel && originalModel) {
    isUpdating = true;
    const newContent = modifiedModel.getValue();
    originalModel.setValue(newContent);
    isUpdating = false;

    // We do NOT emit update:original here because we are about to exit.
    // If we emit update:original, it records a history state with contrast.
    // Then 'save' records a history state without contrast.
    // That creates two steps in undo history:
    // 1. Undo "Exit Diff" -> Back to Diff with Accepted Code
    // 2. Undo "Accept" -> Back to Diff with mixed Code

    // Ideally "Accept All" should be one atomic step that exits diff mode.
    // So we just emit 'save'.

    emit("save", newContent);
  }
};

const handleUndoAll = () => {
  if (!diffEditor.value) return;
  const modifiedModel = diffEditor.value.getModifiedEditor().getModel();
  const originalModel = diffEditor.value.getOriginalEditor().getModel();

  if (modifiedModel && originalModel) {
    // Revert all modifications (Modified = Original)
    // This clears the diff view without changing original code
    isUpdating = true;
    modifiedModel.setValue(originalModel.getValue());
    isUpdating = false;
    // Auto-exit after undoing all (keeping original)
    emit("close");
  }
};

// Navigation
const jumpToChange = (index: number) => {
  if (!diffEditor.value || index < 0 || index >= allChanges.value.length)
    return;
  const change = allChanges.value[index];
  currentIndex.value = index;

  // Jump to line in Modified Editor
  const editorToFocus = diffEditor.value.getModifiedEditor();

  // Choose start line
  const line =
    change.modifiedStartLineNumber > 0
      ? change.modifiedStartLineNumber
      : change.originalStartLineNumber; // Fallback if deletion?

  // Safe lookup
  const safeLine = line > 0 ? line : 1;

  editorToFocus.revealLineInCenter(safeLine);
  editorToFocus.setPosition({ lineNumber: safeLine, column: 1 });
  editorToFocus.focus();
};

const nextChange = () => {
  const next = (currentIndex.value + 1) % totalChanges.value;
  jumpToChange(next);
};

const prevChange = () => {
  const prev =
    (currentIndex.value - 1 + totalChanges.value) % totalChanges.value;
  jumpToChange(prev);
};

// Watch prop changes
watch(
  () => props.theme,
  (newTheme) => {
    if (monaco) monaco.editor.setTheme(newTheme);
  }
);

watch(
  () => props.fontSize,
  (newFontSize) => {
    if (diffEditor.value) {
      const originalEditor = diffEditor.value.getOriginalEditor();
      const modifiedEditor = diffEditor.value.getModifiedEditor();
      originalEditor.updateOptions({ fontSize: newFontSize });
      modifiedEditor.updateOptions({ fontSize: newFontSize });
    }
  }
);

watch(
  () => props.readonly,
  (newReadonly) => {
    if (diffEditor.value) {
      diffEditor.value.updateOptions({
        originalEditable: !newReadonly,
        readOnly: newReadonly,
      });
      // 如果切换到只读模式，清除所有操作按钮
      if (newReadonly) {
        clearAllWidgets();
      } else {
        // 如果切换到可编辑模式，重新更新 diff 信息
        updateDiffInfo();
      }
    }
  }
);

// 切换版本时观看原始和修改后的道具以更新编辑器内容
watch(
  () => [props.original, props.modified],
  ([newOriginal, newModified]) => {
    if (!diffEditor.value) return;

    const originalModel = diffEditor.value.getOriginalEditor().getModel();
    const modifiedModel = diffEditor.value.getModifiedEditor().getModel();

    if (originalModel && modifiedModel) {
      // 确保值不为 undefined
      const safeOriginal = newOriginal ?? "";
      const safeModified = newModified ?? "";

      // 更新模型内容
      const currentOriginal = originalModel.getValue();
      const currentModified = modifiedModel.getValue();

      // 只有在内容真正变化时才更新，避免不必要的更新
      if (currentOriginal !== safeOriginal) {
        isUpdating = true; // 防止触发 onDidChangeContent 事件
        originalModel.setValue(safeOriginal);
        isUpdating = false;
      }

      if (currentModified !== safeModified) {
        modifiedModel.setValue(safeModified);
      }

      // 更新 diff 信息
      setTimeout(() => {
        updateDiffInfo();
      }, 100);
    }
  },
  { deep: true }
);

// 获取当前字体大小
function getFontSize(): number {
  if (!diffEditor.value || !monaco) return props.fontSize;
  const modifiedEditor = diffEditor.value.getModifiedEditor();
  return modifiedEditor.getOption(monaco.editor.EditorOption.fontSize);
}

// 设置字体大小
function setFontSize(size: number) {
  if (!diffEditor.value) return;
  const originalEditor = diffEditor.value.getOriginalEditor();
  const modifiedEditor = diffEditor.value.getModifiedEditor();
  originalEditor.updateOptions({ fontSize: size });
  modifiedEditor.updateOptions({ fontSize: size });
}

defineExpose({
  handleAcceptAll,
  getFontSize,
  setFontSize,
  getDiffEditor: () => diffEditor.value,
});
</script>

<template>
  <div class="flex flex-col h-full w-full relative">
    <!-- Toolbar (Optional) -->
    <div class="h-full w-full relative" ref="container"></div>

    <DiffBottomNavigation
      v-if="!readonly"
      :current-index="currentIndex"
      :total-changes="totalChanges"
      @next="nextChange"
      @previous="prevChange"
      @accept-all="handleAcceptAll"
      @undo-all="handleUndoAll"
      @close="$emit('close')"
    />
  </div>
</template>

<style scoped>
/* Ensure content widgets are visible */
:deep(.monaco-editor .content-widget) {
  z-index: 100 !important;
}

/* 优化diff代码编辑器的位置 */
/* 编辑器的位置 */
:deep(.monaco-diff-editor .editor.modified) {
  left: 0 !important;
  right: 30px !important;
  width: auto !important;
}

/* 编辑器的宽度 */
:deep(.monaco-diff-editor .monaco-editor.modified-in-monaco-diff-editor.vs),
:deep(.monaco-diff-editor
    .monaco-editor.modified-in-monaco-diff-editor.vs
    .overflow-guard) {
  width: 100% !important;
}

/** 编辑器内容的位置 */
:deep(.monaco-diff-editor .monaco-scrollable-element.editor-scrollable) {
  width: calc(100% - 30px) !important;
}

/* 行号位置 */
:deep(.monaco-diff-editor .view-lines.monaco-mouse-cursor-text) {
  left: 16px !important;
}

/** 选中行或缩进的标志符 */
:deep(.monaco-diff-editor .view-overlays > div) {
  left: 16px !important;
}

/** - 号 */
:deep(.monaco-diff-editor .margin-view-zones) {
  /* left: 16px !important; */
  display: none;
}

/* + 号 */
:deep(.monaco-diff-editor .margin-view-overlays .codicon-diff-insert) {
  /* left: 16px !important; */
  display: none !important;
}

/* 
editor modified
monaco-editor modified-in-monaco-diff-editor no-user-select  showUnused showDeprecated vs
overflow-guard
monaco-scrollable-element editor-scrollable vs
*/
</style>
