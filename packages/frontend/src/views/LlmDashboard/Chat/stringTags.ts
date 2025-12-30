export type LogicalTagType =
  | "code_ref"
  | "error_message"
  | "browser_selector"
  | "long_text"
  | "slash_command";

export interface BaseLogicalTag {
  type: LogicalTagType;
}

export interface CodeRefTag extends BaseLogicalTag {
  type: "code_ref";
  fileName: string;
  startLine: number;
  endLine?: number;
}

export interface ErrorMessageTag extends BaseLogicalTag {
  type: "error_message";
  message: string;
}

export interface BrowserSelectorTag extends BaseLogicalTag {
  type: "browser_selector";
  selector: string;
  label?: string;
}

export interface LongTextTag extends BaseLogicalTag {
  type: "long_text";
  text: string;
}

export interface SlashCommandTag extends BaseLogicalTag {
  type: "slash_command";
  text: string;
}

export type LogicalTag =
  | CodeRefTag
  | ErrorMessageTag
  | BrowserSelectorTag
  | LongTextTag
  | SlashCommandTag;

export interface ParsedSegment {
  type: "text" | "tag";
  text?: string;
  tag?: LogicalTag;
}

/**
 * 将逻辑 Tag 序列化为字符串协议
 */
export function serializeLogicalTagToString(tag: LogicalTag): string {
  switch (tag.type) {
    case "code_ref": {
      const { fileName, startLine, endLine } = tag;
      if (endLine && endLine !== startLine) {
        return `@${fileName}(${startLine},${endLine})`;
      }
      return `@${fileName}(${startLine})`;
    }
    case "error_message": {
      return `<error_message>${tag.message}</error_message>`;
    }
    case "browser_selector": {
      // 只保留 selector，展示时可结合 label
      return `<browser_selector>${tag.selector}</browser_selector>`;
    }
    case "long_text": {
      return `<long_text>${tag.text}</long_text>`;
    }
    case "slash_command": {
      return tag.text;
    }
    default:
      // 兜底返回空字符串，避免抛错
      return "";
  }
}

/**
 * 简单解析字符串为逻辑 Tag 片段
 *
 * 当前实现只覆盖既有协议格式，后续如需更复杂解析可以扩展。
 */
export function parseStringToLogicalTags(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  if (!text) return segments;

  // 目前大多数内容仍按纯文本处理，仅尝试识别少量模式
  const regex =
    /(@([^\s()]+)\((\d+)(?:,(\d+))?\))|(<error_message>[\s\S]*?<\/error_message>)|(<browser_selector>[\s\S]*?<\/browser_selector>)|(<long_text>[\s\S]*?<\/long_text>)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        text: text.slice(lastIndex, match.index),
      });
    }

    const [fullMatch] = match;

    if (match[1]) {
      // 代码引用 @file(10) / @file(10,20)
      const fileName = match[2];
      const startLine = parseInt(match[3], 10);
      const endLine = match[4] ? parseInt(match[4], 10) : undefined;
      segments.push({
        type: "tag",
        tag: {
          type: "code_ref",
          fileName,
          startLine,
          endLine,
        },
      });
    } else if (match[5]) {
      // 错误消息
      const inner = fullMatch.replace(
        /^<error_message>|<\/error_message>$/g,
        ""
      );
      segments.push({
        type: "tag",
        tag: {
          type: "error_message",
          message: inner,
        },
      });
    } else if (match[6]) {
      // 浏览器选择
      const inner = fullMatch.replace(
        /^<browser_selector>|<\/browser_selector>$/g,
        ""
      );
      segments.push({
        type: "tag",
        tag: {
          type: "browser_selector",
          selector: inner,
        },
      });
    } else if (match[7]) {
      // 长文本
      const inner = fullMatch.replace(/^<long_text>|<\/long_text>$/g, "");
      segments.push({
        type: "tag",
        tag: {
          type: "long_text",
          text: inner,
        },
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      text: text.slice(lastIndex),
    });
  }

  return segments;
}







