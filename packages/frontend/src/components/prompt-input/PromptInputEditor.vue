<template>
  <div class="prompt-input-editor-wrapper">
    <div
      ref="editorContainer"
      class="prompt-input-editor"
      :class="cn('field-sizing-content max-h-48 min-h-16 px-4', props.class)"
      @paste="handlePaste"
      @click="handleClick"
    />
    <!-- Placeholder overlay -->
    <span v-if="showPlaceholder" class="prompt-input-placeholder-overlay">
      {{ props.placeholder }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";
import { EditorView, type NodeView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import { cn } from "@/lib/utils";
import { usePromptInput } from "@/components/ai-elements/prompt-input/context";
import {
  createSchema,
  createEditorState,
  getEditorTextContent,
  getEditorContent,
  setEditorContent,
  insertTag,
  createTagDragPlugin,
  type TagNodeAttributes,
} from "@/components/prompt-input/editor/prosemirrorSetup";

interface Props {
  class?: HTMLAttributes["class"];
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "你想知道什么？",
});

const emit = defineEmits<{
  "tag-click": [
    data: {
      id: string;
      label: string;
      icon?: string;
      data?: Record<string, any>;
    }
  ];
}>();

const { textInput, setTextInput, submitForm, addFiles, files, removeFile } =
  usePromptInput();
const editorContainer = ref<HTMLDivElement | null>(null);
const isComposing = ref(false);
const isUpdating = ref(false);
let editorView: EditorView | null = null;
const schema = createSchema();
const isEmpty = ref(true);

/**
 * 检查编辑器是否为空（没有文本和标签）
 */
const showPlaceholder = computed(() => {
  return isEmpty.value;
});

/**
 * 更新编辑器空状态
 */
function updateEmptyState() {
  if (!editorView) {
    isEmpty.value = true;
    return;
  }
  const content = getEditorContent(editorView.state);
  const hasText = content.text.trim().length > 0;
  const hasTags = content.tags.length > 0;
  isEmpty.value = !hasText && !hasTags;
}

/**
 * 处理标签点击事件
 */
function handleTagClick(data: {
  id: string;
  label: string;
  icon?: string;
  data?: Record<string, any>;
}) {
  emit("tag-click", data);
}

/**
 * 处理点击事件
 */
function handleClick() {
  editorView?.focus();
}

/**
 * 初始化编辑器
 */
function initEditor() {
  if (!editorContainer.value) return;

  const initialState = createEditorState(schema, textInput.value || "", {
    onTagDelete: (_tagId: string, _position: number) => {
      // 标签删除时的回调
      // 可以在这里添加额外的处理逻辑
    },
  });

  editorView = new EditorView(editorContainer.value, {
    state: initialState,
    dispatchTransaction(tr) {
      if (!editorView) return;

      const newState = editorView.state.apply(tr);
      editorView.updateState(newState);

      // 更新空状态
      updateEmptyState();

      // 发出更新事件
      if (!isUpdating.value) {
        const content = getEditorTextContent(newState);
        setTextInput(content);
      }
    },
    attributes: {
      class: "ProseMirror prompt-input-prosemirror",
    },
    editable: () => true,
    // 自定义节点视图用于标签渲染
    nodeViews: {
      tag(node, view, getPos) {
        return new TagNodeView(
          view,
          node,
          getPos as () => number,
          handleTagClick
        );
      },
    },
  });

  // 添加拖拽插件
  const dragPlugin = createTagDragPlugin();
  const newState = editorView.state.reconfigure({
    plugins: [...editorView.state.plugins, dragPlugin],
  });
  editorView.updateState(newState);

  // 初始化空状态
  updateEmptyState();

  // 添加键盘事件处理
  editorView.dom.addEventListener("keydown", handleKeyDown);
  editorView.dom.addEventListener("compositionstart", () => {
    isComposing.value = true;
  });
  editorView.dom.addEventListener("compositionend", () => {
    isComposing.value = false;
  });
}

/**
 * 标签节点视图
 */
class TagNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM?: HTMLElement;
  view: EditorView;
  node: ProseMirrorNode;
  getPos: () => number;
  onTagClick: (data: {
    id: string;
    label: string;
    icon?: string;
    data?: Record<string, any>;
  }) => void;

  constructor(
    view: EditorView,
    node: ProseMirrorNode,
    getPos: () => number,
    onTagClick: (data: {
      id: string;
      label: string;
      icon?: string;
      data?: Record<string, any>;
    }) => void
  ) {
    this.view = view;
    this.node = node;
    this.getPos = getPos;
    this.onTagClick = onTagClick;
    this.dom = document.createElement("span");
    const tagType = node.attrs.tagType || "";
    this.dom.className = tagType ? `prompt-tag tag-${tagType}` : "prompt-tag";
    this.dom.setAttribute("data-tag-id", node.attrs.id);
    this.dom.setAttribute("draggable", "true");
    this.dom.contentEditable = "false";

    this.render();
    this.attachEvents();
  }

  render() {
    const icon = this.node.attrs.icon || "🏷️";
    const label = this.node.attrs.label || "";

    this.dom.innerHTML = `
      <span class="prompt-tag-icon-wrapper">
        <span class="prompt-tag-icon">${icon}</span>
        <span class="prompt-tag-delete" contenteditable="false">×</span>
      </span>
      <span class="prompt-tag-label">${label}</span>
    `;
  }

  attachEvents() {
    let isDragging = false;

    // 删除按钮点击 - 点击图标区域时删除标签
    const iconWrapper = this.dom.querySelector(
      ".prompt-tag-icon-wrapper"
    ) as HTMLElement;
    if (iconWrapper) {
      iconWrapper.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.deleteTag();
      });
      // 阻止图标区域的 mousedown 触发拖拽
      iconWrapper.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });
    }

    // 标签点击事件 - 点击标签主体时触发（不包括图标区域）
    this.dom.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      // 如果点击的是图标区域，不触发标签点击事件（允许删除）
      if (target.closest(".prompt-tag-icon-wrapper")) {
        return;
      }
      // 如果是拖拽操作，不触发点击事件
      if (isDragging) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      this.handleTagClick();
    });

    // 拖拽事件 - 避免在图标区域触发拖拽
    this.dom.addEventListener("dragstart", (e) => {
      const target = e.target as HTMLElement;
      // 如果点击的是图标区域，不触发拖拽（允许删除）
      if (target.closest(".prompt-tag-icon-wrapper")) {
        e.preventDefault();
        return false;
      }
      isDragging = true;
      // 拖拽数据和视觉效果由插件处理，这里只需要标记状态
      // The drag data and visual effects are handled by the plugin
      return true;
    });

    // 重置拖拽状态
    this.dom.addEventListener("dragend", () => {
      // 延迟重置，避免在拖拽结束时触发点击事件
      setTimeout(() => {
        isDragging = false;
      }, 100);
    });
  }

  handleTagClick() {
    const attrs = this.node.attrs;
    this.onTagClick({
      id: attrs.id || "",
      label: attrs.label || "",
      icon: attrs.icon,
      data: attrs.data || undefined,
    });
  }

  deleteTag() {
    const pos = this.getPos();
    if (pos === undefined || pos === null) return;

    const { state, dispatch } = this.view;
    const tr = state.tr.delete(pos, pos + this.node.nodeSize);
    dispatch(tr);
  }

  update(node: ProseMirrorNode) {
    if (node.type !== this.node.type) return false;
    if (node.attrs.id !== this.node.attrs.id) return false;

    this.node = node;
    // 更新类名（如果 tagType 发生变化）
    const tagType = node.attrs.tagType || "";
    const newClassName = tagType ? `prompt-tag tag-${tagType}` : "prompt-tag";
    if (this.dom.className !== newClassName) {
      this.dom.className = newClassName;
    }
    this.render();
    return true;
  }

  destroy() {
    // 清理
  }

  selectNode() {
    this.dom.classList.add("ProseMirror-selectednode");
  }

  deselectNode() {
    this.dom.classList.remove("ProseMirror-selectednode");
  }

  ignoreMutation() {
    return true;
  }

  stopEvent(event: Event) {
    // 允许拖拽事件传播，以便插件能够处理
    // Allow drag events to propagate so plugins can handle them
    if (event.type.startsWith("drag") || event.type === "drop") {
      return false;
    }
    return true;
  }
}

/**
 * 处理键盘事件
 */
function handleKeyDown(e: KeyboardEvent) {
  // Ctrl+Enter 或 Cmd+Enter 插入换行（由 ProseMirror keymap 处理，这里不做处理）
  // 只处理普通的 Enter 键
  if (e.key === "Enter") {
    // Ctrl+Enter 已经被 ProseMirror keymap 处理，不在这里拦截
    if (e.ctrlKey || e.metaKey) {
      return; // 让 ProseMirror 处理
    }

    if (isComposing.value || e.shiftKey) return;
    e.preventDefault();
    submitForm();
  }

  // Remove last attachment on backspace if input is empty
  if (
    e.key === "Backspace" &&
    textInput.value === "" &&
    files.value.length > 0
  ) {
    const lastFile = files.value[files.value.length - 1];
    if (lastFile) {
      removeFile(lastFile.id);
    }
  }
}

/**
 * 处理粘贴事件
 */
function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items) return;

  const pastedFiles: File[] = [];
  for (const item of Array.from(items)) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) pastedFiles.push(file);
    }
  }

  if (pastedFiles.length > 0) {
    e.preventDefault();
    addFiles(pastedFiles);
  }
}

/**
 * 监听 textInput 变化
 */
watch(
  () => textInput.value,
  (newValue) => {
    if (!editorView || isUpdating.value) return;

    const currentContent = getEditorTextContent(editorView.state);
    if (currentContent !== newValue) {
      isUpdating.value = true;
      const newState = setEditorContent(
        editorView.state,
        schema,
        newValue || ""
      );
      editorView.updateState(newState);
      // 更新空状态
      updateEmptyState();
      isUpdating.value = false;
    }
  }
);

/**
 * 插入标签
 */
function insertTagAtCursor(attrs: TagNodeAttributes) {
  if (!editorView) return;

  const { state, dispatch } = editorView;
  const tr = insertTag(state, schema, attrs);
  dispatch(tr);
}

/**
 * 生命周期
 */
onMounted(() => {
  initEditor();
});

onBeforeUnmount(() => {
  if (editorView) {
    editorView.dom.removeEventListener("keydown", handleKeyDown);
    editorView.destroy();
    editorView = null;
  }
});

/**
 * 暴露方法
 */
defineExpose({
  insertTag: insertTagAtCursor,
  focus: () => editorView?.focus(),
  blur: () => editorView?.dom.blur(),
  getContent: () => {
    if (!editorView) return { text: "", tags: [] };
    return getEditorContent(editorView.state);
  },
});
</script>

<style scoped>
.prompt-input-editor-wrapper {
  position: relative;
  width: 100%;
  overflow-y: auto;
}

.prompt-input-editor {
  width: 100%;
}

.prompt-input-placeholder-overlay {
  position: absolute;
  left: 1rem;
  top: 0;
  pointer-events: none;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
  z-index: 1;
  opacity: 0.5;
  user-select: none;
}

:deep(.prompt-input-prosemirror) {
  outline: none;
  border: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  min-height: 1rem;
  width: 100%;
}

:deep(.prompt-tag) {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 0.4rem;
  margin: 0 0.125rem;
  background-color: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 0.2rem;
  font-size: 0.875rem;
  line-height: 1;
  height: 1.25rem;
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: background-color 0.15s, border-color 0.15s;
  vertical-align: middle;
}

:deep(.prompt-tag:hover) {
  background-color: rgba(0, 0, 0, 0.08);
  border-color: rgba(0, 0, 0, 0.15);
}

/* 浏览器选择的标签样式 */
:deep(.prompt-tag.tag-browser) {
  background-color: #e3f2fd;
  border: none;
  color: #1976d2;
}

:deep(.prompt-tag.tag-browser:hover) {
  background-color: #bbdefb;
}

:deep(.prompt-tag.tag-browser .prompt-tag-label) {
  color: #1976d2;
}

:deep(.prompt-tag.tag-browser .prompt-tag-icon svg) {
  color: #1976d2;
}

:deep(.prompt-tag.tag-browser .prompt-tag-icon svg path) {
  fill: #1976d2;
}

/* 浏览器标签选中时的样式 - 使用高亮颜色 */
:deep(.prompt-tag.tag-browser.tag-selected) {
  background-color: Highlight !important;
  color: HighlightText !important;
  border: none !important;
}

:deep(.prompt-tag.tag-browser.tag-selected .prompt-tag-label) {
  color: HighlightText !important;
}

:deep(.prompt-tag.tag-browser.tag-selected .prompt-tag-icon svg path) {
  fill: HighlightText !important;
}

/* 选中时不显示 hover 效果 */
:deep(.prompt-tag.tag-browser.tag-selected:hover) {
  background-color: Highlight !important;
  color: HighlightText !important;
}

:deep(.prompt-tag.tag-browser.ProseMirror-selectednode) {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

:deep(.prompt-tag-icon-wrapper) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  line-height: 0;
  vertical-align: middle;
}

:deep(.prompt-tag-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  line-height: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  transition: opacity 0.15s;
}

:deep(.prompt-tag-icon svg) {
  width: 16px;
  height: 16px;
  display: block;
}

:deep(.prompt-tag-delete) {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  font-size: 0.875rem;
  line-height: 1;
  color: hsl(var(--destructive));
  transition: opacity 0.15s, color 0.15s;
  border-radius: 0.125rem;
}

:deep(.prompt-tag:hover .prompt-tag-icon) {
  opacity: 0;
}

:deep(.prompt-tag:hover .prompt-tag-delete) {
  opacity: 1;
}

:deep(.prompt-tag-delete:hover) {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 0.1);
}

:deep(.prompt-tag-label) {
  font-weight: 500;
  color: hsl(var(--foreground));
  position: relative;
  font-family: var(
    --font-mono,
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    "Liberation Mono",
    "Courier New",
    monospace
  );
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
  line-height: 1.25rem;
  display: inline-flex;
  align-items: center;
}

:deep(.prompt-tag.ProseMirror-selectednode) {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

:deep(.prompt-tag.tag-selected) {
  position: relative;
  background-color: Highlight !important;
  color: HighlightText !important;
  border-color: transparent !important;
}

:deep(.prompt-tag.tag-selected::before) {
  position: absolute;
  left: -1px;
  right: -1px;
  top: -2px;
  bottom: -1px;
  display: inline-block;
  content: "";
  z-index: 0;
  background-color: Highlight;
}

:deep(.prompt-tag.tag-selected .prompt-tag-icon),
:deep(.prompt-tag.tag-selected .prompt-tag-label),
:deep(.prompt-tag.tag-selected .prompt-tag-delete) {
  color: HighlightText !important;
}

/* 确保标签和文本正确显示 */
:deep(.ProseMirror) {
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 强制统一编辑器内的选区样式为系统高亮色，以确保与标签选中色一致 */
:deep(.ProseMirror::selection) {
  background-color: Highlight;
  color: HighlightText;
}

:deep(.ProseMirror p) {
  margin: 0;
  padding: 0;
  display: inline;
}

:deep(.prosemirror-drop-target) {
  display: inline-block;
  width: 2px;
  background-color: #000000;
  margin: 0 1px;
  vertical-align: text-bottom;
  height: 1.25em;
  pointer-events: none;
  border-radius: 1px;
}
</style>
