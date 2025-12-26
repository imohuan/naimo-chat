import { Schema, Node as ProseMirrorNode } from "prosemirror-model";
import { EditorState, Plugin, PluginKey, Transaction } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";

/**
 * 创建 ProseMirror Schema
 * 支持纯文本和变量标记
 */
export function createSchema(): Schema {
  return new Schema({
    nodes: {
      doc: {
        content: "inline*",
      },
      text: {
        inline: true,
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
    },
    marks: {
      variable: {
        attrs: {
          reference: { default: "" },
        },
        parseDOM: [
          {
            tag: "span.variable-token",
            getAttrs(dom: any) {
              return {
                reference: dom.getAttribute("data-reference") || "",
              };
            },
          },
        ],
        toDOM() {
          return [
            "span",
            {
              class: "variable-token",
              style:
                "color: #10b981; background-color: #ecfdf5; padding: 0 2px; border-radius: 2px;",
            },
          ];
        },
      },
    },
  });
}

function createDocFromText(schema: Schema, content: string): ProseMirrorNode {
  const hardBreakType = schema.nodes.hard_break;
  const normalized = content.replace(/\r\n?/g, "\n");
  const nodes: ProseMirrorNode[] = [];

  if (normalized.length > 0) {
    const parts = normalized.split("\n");
    parts.forEach((part, index) => {
      if (part.length > 0) {
        nodes.push(schema.text(part));
      }
      if (index < parts.length - 1 && hardBreakType) {
        nodes.push(hardBreakType.create());
      }
    });
  }

  return schema.node("doc", undefined, nodes);
}

/**
 * 创建变量高亮 Plugin
 * 自动识别 {{ ... }} 模式并应用装饰
 */
/**
 * 辅助函数：计算装饰
 */
function calculateDecorations(doc: any): Decoration[] {
  const decorations: Decoration[] = [];
  const VARIABLE_PATTERN = /\{\{\s*[^{}]+?\s*\}\}/g;

  doc.nodesBetween(0, doc.content.size, (node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      const text = node.text || "";
      let match: RegExpExecArray | null;
      VARIABLE_PATTERN.lastIndex = 0;

      while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;
        decorations.push(
          Decoration.inline(from, to, {
            class: "variable-token",
          })
        );
      }
    }
  });

  return decorations;
}

export function createVariableHighlightPlugin(): Plugin {
  const pluginKey = new PluginKey("variableHighlight");

  return new Plugin({
    key: pluginKey,
    state: {
      init(config) {
        // 初始化时也计算装饰
        const decorations = calculateDecorations(config.doc!);
        return DecorationSet.create(config.doc!, decorations);
      },
      apply(
        _tr: Transaction,
        _value: DecorationSet,
        _oldState: EditorState,
        newState: EditorState
      ) {
        // 在文档变化时重新计算装饰
        const decorations = calculateDecorations(newState.doc);
        return DecorationSet.create(newState.doc, decorations);
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
 * 创建变量自动完成触发 Plugin
 * 监听输入指定字符并触发自动完成
 */
export function createVariableAutocompletePlugin(
  onTrigger: (position: number, triggerChar: string) => void,
  triggerChars: string[] = ["{", "["]
): Plugin {
  // 创建字符集合，用于快速查找
  const triggerCharSet = new Set(triggerChars);

  return new Plugin({
    key: new PluginKey("variableAutocomplete"),
    props: {
      handleTextInput(_view, from, _to, text) {
        // 检测是否输入了触发字符
        // text 可能是单个字符或多个字符（输入法输入时）
        // 检查 text 中是否包含任何触发字符
        for (const char of text) {
          if (triggerCharSet.has(char)) {
            // 找到触发字符，计算其在 text 中的位置
            const charIndex = text.indexOf(char);
            // 字符已经插入，from + charIndex 是触发字符的位置
            setTimeout(() => {
              onTrigger(from + charIndex, char);
            }, 10);
            break; // 只处理第一个匹配的触发字符
          }
        }
        return false; // 不阻止默认行为
      },
      handleKeyDown(view, event) {
        // 也监听键盘输入（某些输入法可能不会触发 handleTextInput）
        // 对于中文字符，event.key 可能不匹配，所以主要依赖 handleTextInput
        if (
          triggerCharSet.has(event.key) &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          const { state } = view;
          const { from } = state.selection;
          // 延迟触发，确保字符已经插入
          setTimeout(() => {
            onTrigger(from - 1, event.key); // from - 1 是字符的位置（因为光标在字符之后）
          }, 10);
        }
        return false; // 不阻止默认行为
      },
    },
  });
}

/**
 * 创建变量删除 Plugin
 * 当删除变量时，将整个变量作为一个单位删除
 */
export function createVariableDeletionPlugin(): Plugin {
  const VARIABLE_PATTERN = /\{\{\s*[^{}]+?\s*\}\}/g;

  function findVariableRanges(doc: ProseMirrorNode): Array<{ from: number; to: number }> {
    const ranges: Array<{ from: number; to: number }> = [];

    doc.nodesBetween(0, doc.content.size, (node: ProseMirrorNode, pos: number) => {
      if (!node.isText) {
        return;
      }

      const text = node.text || "";
      let match: RegExpExecArray | null;

      VARIABLE_PATTERN.lastIndex = 0;
      while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
        const from = pos + match.index;
        const to = from + match[0].length;
        ranges.push({ from, to });
      }
    });

    return ranges;
  }

  return new Plugin({
    key: new PluginKey("variableDeletion"),
    props: {
      handleKeyDown(view, event) {
        if (event.key !== "Backspace" && event.key !== "Delete") {
          return false;
        }

        const { state, dispatch } = view;
        const { from, to, empty } = state.selection;
        const doc = state.doc;
        const ranges = findVariableRanges(doc);

        // 如果有选区，使用默认删除
        if (!empty) {
          let deleteFrom = from;
          let deleteTo = to;

          for (const range of ranges) {
            if (range.from < deleteTo && range.to > deleteFrom) {
              if (range.from < deleteFrom) {
                deleteFrom = range.from;
              }
              if (range.to > deleteTo) {
                deleteTo = range.to;
              }
            }
          }

          if (deleteFrom !== from || deleteTo !== to) {
            event.preventDefault();
            dispatch(state.tr.delete(deleteFrom, deleteTo).scrollIntoView());
            return true;
          }

          return false;
        }

        const pos = from;

        let targetRange: { from: number; to: number } | null = null;

        for (const range of ranges) {
          const isWithinBackward =
            event.key === "Backspace" && pos > range.from && pos <= range.to;
          const isWithinForward =
            event.key === "Delete" && pos >= range.from && pos < range.to;

          if (isWithinBackward || isWithinForward) {
            targetRange = range;
            break;
          }
        }

        if (!targetRange) {
          return false;
        }

        event.preventDefault();
        dispatch(state.tr.delete(targetRange.from, targetRange.to).scrollIntoView());
        return true;
      },
    },
  });
}

/**
 * 创建编辑状态
 */
export function createEditorState(
  schema: Schema,
  initialContent: string = "",
  options?: {
    multiline?: boolean;
    onAutocompleteTrigger?: (position: number, triggerChar: string) => void;
    autocompleteTriggerChars?: string[];
  }
): EditorState {
  const doc = createDocFromText(schema, initialContent);

  const hardBreakType = schema.nodes.hard_break;

  const keyBindings: { [key: string]: any } = {
    ...baseKeymap,
    "Mod-z": undo,
    "Mod-y": redo,
    "Mod-Shift-z": redo,
    ...(options?.multiline
      ? {
        Enter: (state: EditorState, dispatch?: (tr: Transaction) => void) => {
          if (!dispatch) return false;
          if (!hardBreakType) return false;
          const tr = state.tr
            .replaceSelectionWith(hardBreakType.create())
            .scrollIntoView();
          dispatch(tr);
          return true;
        },
      }
      : {
        // 单行模式下禁止换行
        Enter: () => true,
      }),
  };

  const plugins = [
    history(),
    createVariableHighlightPlugin(),
    createVariableDeletionPlugin(),
    keymap(keyBindings),
  ];

  // 如果提供了自动完成回调，添加自动完成插件
  if (options?.onAutocompleteTrigger) {
    plugins.push(
      createVariableAutocompletePlugin(
        options.onAutocompleteTrigger,
        options.autocompleteTriggerChars
      )
    );
  }

  return EditorState.create({
    doc,
    plugins,
  });
}

/**
 * 获取编辑器的纯文本内容
 */
export function getEditorContent(state: EditorState): string {
  let content = "";
  state.doc.descendants((node: ProseMirrorNode) => {
    if (node.isText) {
      content += node.text || "";
    } else if (node.type.name === "hard_break") {
      content += "\n";
    }
  });
  return content;
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
