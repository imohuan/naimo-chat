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

/**
 * 检查内容是否包含 diff 代码块格式
 * @param content 代码内容
 * @returns 是否包含 diff 格式（包含 SEARCH/REPLACE 标记）
 */
export function hasDiffFormat(content: string): boolean {
  // 检查是否包含 diff 格式的标记
  // 在流式传输中，可能只有 SEARCH 和分隔符，还没有 REPLACE 部分
  // 所以只要检测到 SEARCH 和分隔符就认为是 diff 格式
  const hasSearch = /[-]{3,}\s*SEARCH/i.test(content);
  const hasSeparator = /[=]{3,}/i.test(content);
  const hasReplace = /[+]{3,}/i.test(content);
  // 如果有 SEARCH 和分隔符，或者完整的 diff 格式，都认为是 diff
  return (hasSearch && hasSeparator) || (hasSearch && hasReplace);
}

/**
 * 从 markdown 内容中提取所有 diff 代码块（SEARCH/REPLACE 格式）
 * @param content markdown 内容
 * @returns 所有 diff 代码块的内容，合并为一个字符串（多个 diff 块之间用换行分隔）
 */
export function extractDiffBlocks(content: string): string | null {
  // 首先检查整个内容是否包含 diff 格式（可能不在代码块中）
  if (!hasDiffFormat(content)) {
    return null;
  }

  // 获取所有代码块（包括没有语言标识符的）
  const allBlocks = parseCodeBlocks(content);

  // 筛选出包含 diff 格式的代码块
  const diffBlocks: string[] = [];

  for (const block of allBlocks) {
    // 检查代码块内容是否包含 diff 格式（SEARCH/REPLACE）
    // 注意：即使是 html 代码块，如果包含 diff 格式，也应该提取
    if (hasDiffFormat(block.code)) {
      diffBlocks.push(block.code);
    }
  }

  // 如果从代码块中找到了 diff，返回合并后的内容
  if (diffBlocks.length > 0) {
    return diffBlocks.join('\n');
  }

  // 如果没有在代码块中找到，尝试直接从整个内容中提取 diff 部分
  // 查找 SEARCH 标记的位置（支持 3 个或更多减号）
  const searchMatch = content.match(/[-]{3,}\s*SEARCH/i);
  if (!searchMatch) {
    return null;
  }

  const searchStartIndex = searchMatch.index!;
  const remainingContent = content.substring(searchStartIndex);

  // 尝试找到 REPLACE 标记（支持 3 个或更多加号），如果找到，提取到 REPLACE 行结束
  const replaceMatch = remainingContent.match(/[+]{3,}\s*REPLACE/i);
  if (replaceMatch) {
    // 找到 REPLACE 后，提取从 SEARCH 到 REPLACE 行结束的内容
    // REPLACE 标记通常在最后一行，所以提取到 REPLACE 行结束即可
    const replaceLineEnd = remainingContent.indexOf('\n', replaceMatch.index! + replaceMatch[0].length);
    const endIndex = replaceLineEnd !== -1 ? replaceLineEnd : remainingContent.length;
    // 提取内容，保留 REPLACE 行（不 trim，因为 REPLACE 行是必需的）
    let extracted = remainingContent.substring(0, endIndex);
    // 只移除末尾的空白行，但保留 REPLACE 行本身
    extracted = extracted.replace(/\s+$/, '');
    console.log("🔍 [extractDiffBlocks] Extracted diff from non-code-block:", {
      length: extracted.length,
      preview: extracted.substring(0, 200),
      fullContent: extracted,
    });
    return extracted;
  }

  // 如果没有找到 REPLACE，查找分隔符后的内容
  const separatorMatch = remainingContent.match(/[=]{3,}/);
  if (separatorMatch) {
    // 提取从 SEARCH 到分隔符后的内容，直到下一个代码块开始、双换行或字符串末尾
    const afterSeparator = remainingContent.substring(separatorMatch.index! + separatorMatch[0].length);
    const endMatch = afterSeparator.match(/[\s\S]*?(?=\n\n|\n```|$)/);
    if (endMatch) {
      const endIndex = separatorMatch.index! + separatorMatch[0].length + endMatch[0].length;
      const extracted = remainingContent.substring(0, endIndex).trim();
      console.log("🔍 [extractDiffBlocks] Extracted diff (no REPLACE marker):", {
        length: extracted.length,
        preview: extracted.substring(0, 200),
      });
      return extracted;
    }
    // 如果没有找到结束标记，返回从 SEARCH 到字符串末尾的内容
    const extracted = remainingContent.trim();
    console.log("🔍 [extractDiffBlocks] Extracted diff (to end):", {
      length: extracted.length,
      preview: extracted.substring(0, 200),
    });
    return extracted;
  }

  // 如果连分隔符都没找到，至少返回从 SEARCH 开始的内容（可能是不完整的 diff）
  const extracted = remainingContent.trim();
  console.log("🔍 [extractDiffBlocks] Extracted diff (incomplete):", {
    length: extracted.length,
    preview: extracted.substring(0, 200),
  });
  return extracted;
}

