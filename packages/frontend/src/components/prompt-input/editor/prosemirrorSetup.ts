import {
  Schema,
  Node as ProseMirrorNode,
  type DOMOutputSpec,
} from "prosemirror-model";
import {
  EditorState,
  Plugin,
  PluginKey,
  Transaction,
  TextSelection,
} from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { serializeLogicalTagToString } from "@/views/LlmDashboard/Chat/stringTags";

/**
 * 标签节点的属性定义
 */
export interface TagNodeAttributes {
  id: string;
  label: string;
  icon?: string;
  data?: Record<string, any>;
  tagType?: string; // 标签类型，用于自定义样式（如 'browser'）
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
          tagType: { default: "" },
        },
        selectable: false,
        atom: true, // 标签作为原子节点，不能被部分选中
        toDOM(node): DOMOutputSpec {
          const tagType = node.attrs.tagType || "";
          const className = tagType
            ? `prompt-tag tag-${tagType}`
            : "prompt-tag";
          return [
            "span",
            {
              class: className,
              "data-tag-id": node.attrs.id,
              "data-label": node.attrs.label,
            },
            [
              "span",
              { class: "prompt-tag-icon-wrapper" },
              ["span", { class: "prompt-tag-icon" }, node.attrs.icon || "🏷️"],
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
 * 创建粘贴处理插件
 */
export function createPastePlugin(options: {
  onPaste?: (view: EditorView, event: ClipboardEvent) => boolean;
}): Plugin {
  return new Plugin({
    key: new PluginKey("pasteHandler"),
    props: {
      handlePaste(view, event, slice) {
        if (options.onPaste) {
          const handled = options.onPaste(view, event);
          if (handled) {
            // 如果处理了粘贴，返回 true 阻止默认行为
            return true;
          }
        }
        // 否则让 ProseMirror 正常处理
        return false;
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
    onTagDelete?: (tagId: string, position: number) => void;
    onPaste?: (view: EditorView, event: ClipboardEvent) => boolean;
  }
): EditorState {
  const doc = createDocFromText(schema, initialContent);

  const hardBreakType = schema.nodes.hard_break;

  const keyBindings: { [key: string]: any } = {
    ...baseKeymap,
    "Mod-z": undo,
    "Mod-y": redo,
    "Mod-Shift-z": redo,
    // Shift+Enter 插入换行
    "Shift-Enter": (state: EditorState, dispatch?: (tr: Transaction) => void) => {
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
    // 添加选中样式插件
    createSelectionPlugin(),
    // 粘贴处理插件
    ...(options?.onPaste ? [createPastePlugin({ onPaste: options.onPaste })] : []),
  ];

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
              const deletePos =
                $pos.pos - ($pos.nodeBefore ? $pos.nodeBefore.nodeSize : 0);
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
 * 创建选中样式插件
 * 当标签在选区内时添加样式类
 */
function createSelectionPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey("selectionHighlight"),
    props: {
      decorations(state) {
        const { selection } = state;
        if (selection.empty) return DecorationSet.empty;

        const decorations: Decoration[] = [];
        state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
          if (node.type.name === "tag") {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "tag-selected",
              })
            );
          }
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

// 共享的拖拽状态，用于在 PluginView 和 handleDrop 之间通信
let sharedDragTag: { node: ProseMirrorNode; startPos: number } | null = null;
let sharedCursorPos: number | null = null;
let sharedCursorElement: HTMLElement | null = null;
let isDraggingTag = false;

export function createTagDragPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey("tagDrag"),
    view(editorView) {
      return new TagDragView(editorView);
    },
    props: {
      // 使用 handleDOMEvents 拦截 dragstart，阻止 ProseMirror 的默认拖拽行为
      handleDOMEvents: {
        dragstart(_view, event) {
          if (!isDraggingTag || !sharedDragTag) {
            return false; // 不是我们的标签拖拽，让 PM 处理
          }

          const target = event.target as HTMLElement;
          const tagElement = target.closest(".prompt-tag") as HTMLElement;
          if (!tagElement) {
            return false;
          }

          // 设置拖拽数据
          event.dataTransfer!.effectAllowed = "move";
          event.dataTransfer!.setData(
            "application/x-prosemirror-tag",
            sharedDragTag.node.attrs.id
          );

          // 设置拖拽预览
          const clone = tagElement.cloneNode(true) as HTMLElement;
          clone.style.opacity = "0.5";
          clone.style.position = "absolute";
          clone.style.left = "-9999px";
          document.body.appendChild(clone);
          event.dataTransfer!.setDragImage(clone, 0, 0);
          setTimeout(() => document.body.removeChild(clone), 0);

          // 返回 true 阻止 ProseMirror 的默认拖拽处理
          return true;
        },
      },
      // 使用 handleDrop 来完全控制拖放行为
      handleDrop(view, event, _slice, _moved) {
        // 检查是否是我们的标签拖拽
        if (
          !event.dataTransfer?.types.includes("application/x-prosemirror-tag")
        ) {
          return false;
        }

        if (!sharedDragTag) {
          isDraggingTag = false;
          return false;
        }

        event.preventDefault();

        const targetPos = sharedCursorPos;

        if (targetPos === null) {
          sharedDragTag = null;
          sharedCursorPos = null;
          isDraggingTag = false;
          return true;
        }

        // 保存节点信息（因为后面要清除 sharedDragTag）
        const nodeToMove = sharedDragTag.node;
        const deletePos = sharedDragTag.startPos;
        const nodeSize = nodeToMove.nodeSize;

        // 清除状态和隐藏光标元素
        sharedDragTag = null;
        sharedCursorPos = null;
        isDraggingTag = false;
        if (sharedCursorElement) {
          sharedCursorElement.style.opacity = "0";
        }

        // 计算位置调整
        let insertPos = targetPos;
        if (insertPos > deletePos) {
          insertPos -= nodeSize;
        }

        // 执行移动：先删除后插入
        const tr = view.state.tr
          .delete(deletePos, deletePos + nodeSize)
          .insert(insertPos, nodeToMove);

        view.dispatch(tr);
        return true;
      },
    },
  });
}

/**
 * 标签拖拽视图类 - 管理拖拽光标的DOM元素
 */
class TagDragView {
  editorView: EditorView;
  element: HTMLElement | null = null;
  handlers: { name: string; handler: (event: Event) => void }[];

  constructor(editorView: EditorView) {
    this.editorView = editorView;
    this.handlers = ["mousedown", "dragover", "dragend", "dragleave"].map(
      (name) => {
        const handler = (e: Event) => {
          (this as any)[name](e);
        };
        editorView.dom.addEventListener(name, handler);
        return { name, handler };
      }
    );
  }

  destroy() {
    this.handlers.forEach(({ name, handler }) =>
      this.editorView.dom.removeEventListener(name, handler)
    );
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }

  setCursor(pos: number | null) {
    if (pos === sharedCursorPos) return;
    sharedCursorPos = pos;
    if (pos === null) {
      // 使用透明度隐藏，而不是删除元素
      if (this.element) {
        this.element.style.opacity = "0";
      }
    } else {
      this.updateOverlay();
    }
  }

  updateOverlay() {
    if (sharedCursorPos === null) return;

    const coords = this.editorView.coordsAtPos(sharedCursorPos);
    const editorDOM = this.editorView.dom;
    const editorRect = editorDOM.getBoundingClientRect();

    // 计算缩放比例
    const scaleX = editorRect.width / editorDOM.offsetWidth;
    const scaleY = editorRect.height / editorDOM.offsetHeight;

    // 获取 offsetParent
    let parent = this.editorView.dom.offsetParent as HTMLElement;

    if (!this.element) {
      this.element = document.createElement("div");
      this.element.className = "prosemirror-drop-target";
      this.element.style.cssText =
        "position: absolute; z-index: 50; pointer-events: none; background-color: black;";

      if (parent) {
        parent.appendChild(this.element);
      } else {
        document.body.appendChild(this.element);
      }
      // 保存到共享变量，以便 handleDrop 可以清除
      sharedCursorElement = this.element;
    }

    // 计算相对于 offsetParent 的位置
    let parentLeft: number, parentTop: number;
    if (
      !parent ||
      (parent === document.body &&
        getComputedStyle(parent).position === "static")
    ) {
      parentLeft = -window.pageXOffset;
      parentTop = -window.pageYOffset;
    } else {
      const parentRect = parent.getBoundingClientRect();
      const parentScaleX = parentRect.width / parent.offsetWidth;
      const parentScaleY = parentRect.height / parent.offsetHeight;
      parentLeft = parentRect.left - parent.scrollLeft * parentScaleX;
      parentTop = parentRect.top - parent.scrollTop * parentScaleY;
    }

    const width = 2;
    const halfWidth = width / 2;

    this.element.style.left =
      (coords.left - halfWidth - parentLeft) / scaleX + "px";
    this.element.style.top = (coords.top - parentTop) / scaleY + "px";
    this.element.style.width = width / scaleX + "px";
    this.element.style.height = (coords.bottom - coords.top) / scaleY + "px";
    // 确保元素可见
    this.element.style.opacity = "1";
  }

  mousedown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const tagElement = target.closest(".prompt-tag") as HTMLElement;
    if (!tagElement || target.classList.contains("prompt-tag-delete")) {
      return;
    }

    // 获取标签的 ID
    const tagId = tagElement.getAttribute("data-tag-id");
    if (!tagId) return;

    const { state } = this.editorView;

    // 遍历文档查找标签位置（posAtDOM 在自定义 NodeView 中不可靠）
    let foundPos: number | null = null;
    let foundNode: ProseMirrorNode | null = null;

    state.doc.descendants((node, pos) => {
      if (node.type.name === "tag" && node.attrs.id === tagId) {
        foundPos = pos;
        foundNode = node;
        return false; // 停止遍历
      }
    });

    if (foundPos !== null && foundNode !== null) {
      sharedDragTag = {
        node: foundNode,
        startPos: foundPos,
      };
      isDraggingTag = true;
      tagElement.draggable = true;
    }
  }

  dragover(event: DragEvent) {
    if (!sharedDragTag) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = "move";

    const coords = this.editorView.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });

    if (!coords) {
      this.setCursor(null);
      return;
    }

    const pos = coords.pos;

    // 如果位置在被拖拽元素范围内，不显示光标
    const tagEndPos = sharedDragTag.startPos + sharedDragTag.node.nodeSize;
    if (pos >= sharedDragTag.startPos && pos <= tagEndPos) {
      this.setCursor(null);
      return;
    }

    this.setCursor(pos);
  }

  dragleave(event: DragEvent) {
    if (!this.editorView.dom.contains(event.relatedTarget as Node)) {
      this.setCursor(null);
    }
  }

  dragend() {
    this.setCursor(null);
    sharedDragTag = null;
    isDraggingTag = false;
  }
}

/**
 * 获取编辑器的纯文本内容
 * 标签节点会返回其 id 属性作为文本内容
 */
export function getEditorTextContent(state: EditorState): string {
  let content = "";
  state.doc.descendants((node: ProseMirrorNode) => {
    if (node.isText) {
      content += node.text || "";
    } else if (node.type.name === "hard_break") {
      content += "\n";
    } else if (node.type.name === "tag") {
      // 优先使用字符串协议（raw），否则退回到 data.text
      const data = node.attrs.data || {};
      if (data.raw) {
        content += String(data.raw);
      } else if (data.text) {
        content += String(data.text);
      }
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
  const tags: Array<{
    id: string;
    label: string;
    icon?: string;
    position: number;
  }> = [];

  state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      text.push(node.text || "");
    } else if (node.type.name === "hard_break") {
      text.push("\n");
    } else if (node.type.name === "tag") {
      tags.push({
        id: node.attrs.id,
        label: node.attrs.label,
        icon: node.attrs.icon,
        position: pos,
      });
      // 将标签的内容也添加到 text 中，与 getEditorTextContent 保持一致
      const data = node.attrs.data || {};
      if (data.raw) {
        text.push(String(data.raw));
      } else if (data.text) {
        text.push(String(data.text));
      }
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
  return state.apply(
    state.tr.replaceWith(0, state.doc.content.size, doc.content)
  );
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

  // 插入标签后，再插入一个空格，确保光标显示正常（并在标签后有文本节点）
  // 注意：需要显式指定空格的插入位置为标签之后，否则因为 selection 未更新，空格会插入到标签前面
  tr = tr
    .insert(insertPos, tagNode)
    .insertText(" ", insertPos + tagNode.nodeSize);

  // 将光标移动到空格后面
  const newPos = insertPos + tagNode.nodeSize + 1;

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
