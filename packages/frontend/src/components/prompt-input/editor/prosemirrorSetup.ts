import { Schema, Node as ProseMirrorNode, type DOMOutputSpec } from "prosemirror-model";
import { EditorState, Plugin, PluginKey, Transaction, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";

/**
 * 标签节点的属性定义
 */
export interface TagNodeAttributes {
  id: string;
  label: string;
  icon?: string;
  data?: Record<string, any>;
}

/**
 * 创建 ProseMirror Schema
 * 支持文本和标签节点
 */
export function createSchema(): Schema {
  return new Schema({
    nodes: {
      doc: {
        content: "(text|hard_break|tag)*",
      },
      text: {
        group: "inline",
      },
      hard_break: {
        inline: true,
        group: "inline",
        selectable: false,
        parseDOM: [{ tag: "br" }],
        toDOM() {
          return ["br"];
        },
      },
      tag: {
        inline: true,
        group: "inline",
        attrs: {
          id: { default: "" },
          label: { default: "" },
          icon: { default: "" },
          data: { default: null },
        },
        selectable: true,
        atom: true, // 标签作为原子节点，不能被部分选中
        toDOM(node): DOMOutputSpec {
          return [
            "span",
            {
              class: "prompt-tag",
              "data-tag-id": node.attrs.id,
              "data-label": node.attrs.label,
            },
            [
              "span",
              { class: "prompt-tag-icon-wrapper" },
              [
                "span",
                { class: "prompt-tag-icon" },
                node.attrs.icon || "🏷️",
              ],
              [
                "span",
                {
                  class: "prompt-tag-delete",
                  contenteditable: "false",
                },
                "×",
              ],
            ],
            ["span", { class: "prompt-tag-label" }, node.attrs.label],
          ];
        },
        parseDOM: [
          {
            tag: "span.prompt-tag",
            getAttrs(dom: any) {
              return {
                id: dom.getAttribute("data-tag-id") || "",
                label: dom.getAttribute("data-label") || "",
                icon: dom.querySelector(".prompt-tag-icon")?.textContent || "",
              };
            },
          },
        ],
      },
    },
    marks: {},
  });
}

/**
 * 从纯文本创建文档
 */
function createDocFromText(schema: Schema, content: string): ProseMirrorNode {
  const nodes: ProseMirrorNode[] = [];
  const docType = schema.nodes.doc;
  const hardBreakType = schema.nodes.hard_break;

  if (!docType) {
    throw new Error("doc node type not found in schema");
  }

  if (!content) {
    return docType.create(null, []);
  }

  // 处理换行符，将 \n 转换为 hard_break 节点
  const normalized = content.replace(/\r\n?/g, "\n");
  const parts = normalized.split("\n");

  parts.forEach((part, index) => {
    if (part.length > 0) {
      nodes.push(schema.text(part));
    }
    // 在每部分之间插入 hard_break（除了最后一部分）
    if (index < parts.length - 1 && hardBreakType) {
      nodes.push(hardBreakType.create());
    }
  });

  return docType.create(null, nodes);
}

/**
 * 创建占位符插件
 */
function createPlaceholderPlugin(placeholder: string): Plugin {
  return new Plugin({
    key: new PluginKey("placeholder"),
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr) {
        const doc = tr.doc;

        // 检查文档是否有实际内容：有文本内容或标签
        let hasContent = false;
        doc.descendants((node: ProseMirrorNode) => {
          if (node.isText && node.textContent.trim().length > 0) {
            hasContent = true;
            return false; // 停止遍历
          }
          if (node.type.name === "tag") {
            hasContent = true;
            return false; // 停止遍历
          }
        });

        // 只有在没有任何内容（文本或标签）时才显示占位符
        if (!hasContent) {
          const placeholderDecoration = Decoration.widget(1, () => {
            const span = document.createElement("span");
            span.className = "prosemirror-placeholder";
            span.textContent = placeholder;
            span.style.cssText = "pointer-events: none; color: hsl(var(--muted-foreground)); position: absolute;";
            return span;
          });
          return DecorationSet.create(doc, [placeholderDecoration]);
        }
        return DecorationSet.empty;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

/**
 * 创建编辑器状态
 */
export function createEditorState(
  schema: Schema,
  initialContent: string = "",
  options?: {
    placeholder?: string;
    onTagDelete?: (tagId: string, position: number) => void;
  }
): EditorState {
  const doc = createDocFromText(schema, initialContent);

  const hardBreakType = schema.nodes.hard_break;

  const keyBindings: { [key: string]: any } = {
    ...baseKeymap,
    "Mod-z": undo,
    "Mod-y": redo,
    "Mod-Shift-z": redo,
    // Ctrl+Enter 或 Cmd+Enter 插入换行
    "Mod-Enter": (state: EditorState, dispatch?: (tr: Transaction) => void) => {
      if (!dispatch || !hardBreakType) return false;
      const tr = state.tr
        .replaceSelectionWith(hardBreakType.create())
        .scrollIntoView();
      dispatch(tr);
      return true;
    },
    // Enter 键在单行模式下不换行，但允许在标签之间插入
    Enter: () => {
      // 在单行编辑器中，Enter 键用于提交，不在这里处理
      return false;
    },
  };

  const plugins = [
    history(),
    keymap(keyBindings),
    // 标签删除插件
    createTagDeletePlugin(options?.onTagDelete),
  ];

  // 如果提供了占位符，添加占位符插件
  if (options?.placeholder) {
    plugins.push(createPlaceholderPlugin(options.placeholder));
  }

  return EditorState.create({
    doc,
    plugins,
  });
}

/**
 * 创建标签删除插件
 */
function createTagDeletePlugin(
  onTagDelete?: (tagId: string, position: number) => void
): Plugin {
  return new Plugin({
    key: new PluginKey("tagDelete"),
    props: {
      handleDOMEvents: {
        click(view, event) {
          const target = event.target as HTMLElement;
          if (target.classList.contains("prompt-tag-delete")) {
            event.preventDefault();
            event.stopPropagation();

            const tagElement = target.closest(".prompt-tag") as HTMLElement;
            if (!tagElement) return false;

            const tagId = tagElement.getAttribute("data-tag-id");
            if (!tagId) return false;

            const { state, dispatch } = view;
            const pos = view.posAtDOM(tagElement, 0);
            if (pos === null || pos === undefined) return false;

            // 找到标签节点的位置
            const $pos = state.doc.resolve(pos);
            const node = $pos.nodeAfter || $pos.nodeBefore;
            if (node && node.type.name === "tag" && node.attrs.id === tagId) {
              const deletePos = $pos.pos - ($pos.nodeBefore ? $pos.nodeBefore.nodeSize : 0);
              const tr = state.tr.delete(deletePos, deletePos + node.nodeSize);
              dispatch(tr);

              if (onTagDelete) {
                onTagDelete(tagId, deletePos);
              }
              return true;
            }
          }
          return false;
        },
      },
    },
  });
}

/**
 * 创建标签拖拽插件
 */
export function createTagDragPlugin(): Plugin {
  let dragTag: { node: ProseMirrorNode; startPos: number } | null = null;

  return new Plugin({
    key: new PluginKey("tagDrag"),
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          const target = event.target as HTMLElement;
          const tagElement = target.closest(".prompt-tag") as HTMLElement;
          if (!tagElement || target.classList.contains("prompt-tag-delete")) {
            return false;
          }

          const { state } = view;
          const pos = view.posAtDOM(tagElement, 0);
          if (pos === null || pos === undefined) return false;

          const $pos = state.doc.resolve(pos);
          const node = $pos.nodeAfter || $pos.nodeBefore;
          if (node && node.type.name === "tag") {
            dragTag = {
              node,
              startPos: $pos.pos - ($pos.nodeBefore ? $pos.nodeBefore.nodeSize : 0),
            };
            tagElement.draggable = true;
            return false;
          }
          return false;
        },
        dragstart(_view, event) {
          if (!dragTag) return false;

          const target = event.target as HTMLElement;
          const tagElement = target.closest(".prompt-tag") as HTMLElement;
          if (tagElement) {
            event.dataTransfer!.effectAllowed = "move";
            event.dataTransfer!.setData("text/plain", "");
            // 设置拖拽预览
            const clone = tagElement.cloneNode(true) as HTMLElement;
            clone.style.opacity = "0.5";
            document.body.appendChild(clone);
            event.dataTransfer!.setDragImage(clone, 0, 0);
            setTimeout(() => document.body.removeChild(clone), 0);
          }
          return false;
        },
        dragover(view, event) {
          if (!dragTag) return false;
          event.preventDefault();
          event.dataTransfer!.dropEffect = "move";

          const coords = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!coords) return false;

          const { state } = view;
          const $pos = state.doc.resolve(coords.pos);
          const pos = $pos.pos;

          // 不允许拖到自己位置
          if (pos === dragTag.startPos || pos === dragTag.startPos + 1) {
            return false;
          }

          return false;
        },
        drop(view, event) {
          if (!dragTag) return false;
          event.preventDefault();

          const { state, dispatch } = view;
          const coords = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!coords) {
            dragTag = null;
            return false;
          }

          const $pos = state.doc.resolve(coords.pos);
          let insertPos = $pos.pos;

          // 确保插入位置正确
          if ($pos.nodeBefore && $pos.nodeBefore.type.name === "tag") {
            insertPos = $pos.pos;
          }

          // 计算实际插入位置（考虑删除原节点后位置的变化）
          let deletePos = dragTag.startPos;
          if (insertPos > deletePos) {
            insertPos -= dragTag.node.nodeSize;
          }

          const tr = state.tr
            .delete(deletePos, deletePos + dragTag.node.nodeSize)
            .insert(insertPos, dragTag.node);

          dispatch(tr);
          dragTag = null;
          return true;
        },
        dragend() {
          dragTag = null;
          return false;
        },
      },
    },
  });
}

/**
 * 获取编辑器的纯文本内容（不包含标签）
 */
export function getEditorTextContent(state: EditorState): string {
  let content = "";
  state.doc.descendants((node: ProseMirrorNode) => {
    if (node.isText) {
      content += node.text || "";
    } else if (node.type.name === "hard_break") {
      content += "\n";
    } else if (node.type.name === "tag") {
      // 标签可以用特殊标记表示，或者跳过
      // 这里我们跳过标签，只返回文本
    }
  });
  return content;
}

/**
 * 获取编辑器内容（包含标签的 JSON 表示）
 */
export function getEditorContent(state: EditorState): {
  text: string;
  tags: Array<{ id: string; label: string; icon?: string; position: number }>;
} {
  const text: string[] = [];
  const tags: Array<{ id: string; label: string; icon?: string; position: number }> = [];

  state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      text.push(node.text || "");
    } else if (node.type.name === "tag") {
      tags.push({
        id: node.attrs.id,
        label: node.attrs.label,
        icon: node.attrs.icon,
        position: pos,
      });
    }
  });

  return {
    text: text.join(""),
    tags,
  };
}

/**
 * 设置编辑器内容
 */
export function setEditorContent(
  state: EditorState,
  schema: Schema,
  content: string
): EditorState {
  const doc = createDocFromText(schema, content);
  return state.apply(state.tr.replaceWith(0, state.doc.content.size, doc.content));
}

/**
 * 插入标签节点
 */
export function insertTag(
  state: EditorState,
  schema: Schema,
  attrs: TagNodeAttributes,
  position?: number
): Transaction {
  const tagType = schema.nodes.tag;
  if (!tagType) {
    throw new Error("tag node type not found in schema");
  }
  const tagNode = tagType.create(attrs);

  let tr: Transaction;
  let insertPos: number;

  if (position !== undefined) {
    tr = state.tr;
    insertPos = position;
  } else {
    // 在当前位置插入
    const { from, to } = state.selection;

    // 如果有选中的文本，先删除选中的文本
    if (from !== to) {
      tr = state.tr.delete(from, to);
      insertPos = tr.selection.from;
    } else {
      tr = state.tr;
      insertPos = from;
    }
  }

  // 插入标签
  tr = tr.insert(insertPos, tagNode);

  // 将光标移动到标签后面
  // 标签节点的大小是固定的（atom节点），所以直接计算位置
  const newPos = insertPos + tagNode.nodeSize;

  // 解析位置，确保光标在标签后面
  const $pos = tr.doc.resolve(newPos);

  // 尝试创建精确的选择位置
  // 如果标签后面有文本，光标放在文本开始
  // 如果标签后面没有文本，光标应该仍然可以放在标签后面（在同一个段落中）
  try {
    tr = tr.setSelection(TextSelection.create(tr.doc, newPos));
  } catch {
    // 如果创建失败，使用 near 并确保向前查找（正数表示向前）
    // 这样可以确保光标在标签后面而不是前面
    tr = tr.setSelection(TextSelection.near($pos, 1));
  }

  // 确保光标滚动到视图中
  tr = tr.scrollIntoView();

  return tr;
}

