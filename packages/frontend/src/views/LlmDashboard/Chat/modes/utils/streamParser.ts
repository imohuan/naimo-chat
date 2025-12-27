/**
 * 从 markdown 内容中解析代码块
 * @param content markdown 内容
 * @param language 目标语言（如 'html', 'javascript', 'css'），如果不指定则返回所有代码块
 * @returns 匹配的代码块数组，每个元素包含 language 和 code
 */
export function parseCodeBlocks(
  content: string,
  language?: string
): Array<{ language: string; code: string }> {
  // 匹配 ```language 或 ``` 开头的代码块
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const blockLanguage = match[1]?.toLowerCase() || "";
    const code = match[2]?.trim() || "";

    // 如果指定了语言，只返回匹配的代码块
    if (language) {
      if (blockLanguage === language.toLowerCase()) {
        blocks.push({ language: blockLanguage, code });
      }
    } else {
      blocks.push({ language: blockLanguage, code });
    }
  }

  return blocks;
}

/**
 * 从 markdown 内容中提取 HTML 代码块（支持不完整的代码块，用于流式写入）
 * @param content markdown 内容
 * @returns HTML 代码字符串，如果找到多个 HTML 代码块，返回最后一个（即使不完整）
 */
export function extractHtmlCodeIncremental(content: string): string | null {
  // 首先尝试提取完整的代码块
  const htmlBlocks = parseCodeBlocks(content, "html");
  if (htmlBlocks.length > 0) {
    // 返回最后一个完整的 HTML 代码块
    return htmlBlocks[htmlBlocks.length - 1]?.code || null;
  }

  // 如果没有完整的代码块，尝试提取不完整的代码块
  // 查找所有 ```html 或 ``` 开头的代码块（包括未闭合的）
  // 使用全局匹配找到最后一个
  const allCodeBlockMatches: Array<{ start: number; code: string }> = [];

  // 匹配 ```html 或 ``` 开头的代码块
  const codeBlockStartRegex = /```(?:html)?\s*\n/g;
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;

  // 找到所有代码块开始位置
  while ((match = codeBlockStartRegex.exec(content)) !== null) {
    lastMatch = match;
  }

  if (lastMatch) {
    // 从最后一个代码块开始位置提取内容
    const startPos = lastMatch.index + lastMatch[0].length;
    const remainingContent = content.substring(startPos);

    // 查找下一个 ``` 或到字符串末尾
    const endMatch = remainingContent.match(/```/);
    const code = endMatch
      ? remainingContent.substring(0, endMatch.index).trim()
      : remainingContent.trim();

    // 如果代码看起来像 HTML（包含 HTML 标签），则返回
    if (code && (code.includes("<") || code.includes("<!DOCTYPE") || code.length > 10)) {
      return code;
    }
  }

  return null;
}

/**
 * 从 markdown 内容中提取 HTML 代码块
 * @param content markdown 内容
 * @returns HTML 代码字符串，如果找到多个 HTML 代码块，返回最后一个（通常是最新的/完整的）
 */
export function extractHtmlCode(content: string): string | null {
  const htmlBlocks = parseCodeBlocks(content, "html");
  if (htmlBlocks.length === 0) {
    return null;
  }
  // 返回最后一个 HTML 代码块（通常是最新的/完整的）
  return htmlBlocks[htmlBlocks.length - 1]?.code || null;
}

/**
 * 从 markdown 内容中提取 JavaScript 代码块
 * @param content markdown 内容
 * @returns JavaScript 代码字符串，如果找到多个 JS 代码块，返回最后一个
 */
export function extractJsCode(content: string): string | null {
  const jsBlocks = parseCodeBlocks(content, "javascript");
  if (jsBlocks.length === 0) {
    // 也尝试匹配 'js' 标签
    const jsBlocksAlt = parseCodeBlocks(content, "js");
    if (jsBlocksAlt.length === 0) {
      return null;
    }
    return jsBlocksAlt[jsBlocksAlt.length - 1]?.code || null;
  }
  return jsBlocks[jsBlocks.length - 1]?.code || null;
}

/**
 * 从 markdown 内容中提取 CSS 代码块
 * @param content markdown 内容
 * @returns CSS 代码字符串，如果找到多个 CSS 代码块，返回最后一个
 */
export function extractCssCode(content: string): string | null {
  const cssBlocks = parseCodeBlocks(content, "css");
  if (cssBlocks.length === 0) {
    return null;
  }
  return cssBlocks[cssBlocks.length - 1]?.code || null;
}

