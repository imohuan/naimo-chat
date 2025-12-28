/**
 * Parser 模块：用于从 markdown 流式内容中提取代码块和 diff
 */

/**
 * 从 markdown 内容中解析代码块
 * @param {string} content markdown 内容
 * @param {string} [language] 目标语言（如 'html', 'javascript', 'css'），如果不指定则返回所有代码块
 * @returns {Array<{language: string, code: string}>} 匹配的代码块数组，每个元素包含 language 和 code
 */
function parseCodeBlocks(content, language) {
  // 匹配 ```language 或 ``` 开头的代码块
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

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
 * @param {string} content markdown 内容
 * @returns {string|null} HTML 代码字符串，如果找到多个 HTML 代码块，返回最后一个（即使不完整）
 */
function extractHtmlCodeIncremental(content) {
  // 首先尝试提取完整的代码块
  const htmlBlocks = parseCodeBlocks(content, "html");
  if (htmlBlocks.length > 0) {
    // 返回最后一个完整的 HTML 代码块
    return htmlBlocks[htmlBlocks.length - 1]?.code || null;
  }

  // 如果没有完整的代码块，尝试提取不完整的代码块
  // 匹配 ```html 或 ``` 开头的代码块
  const codeBlockStartRegex = /```(?:html)?\s*\n/g;
  let match;
  let lastMatch = null;

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
 * @param {string} content markdown 内容
 * @returns {string|null} HTML 代码字符串，如果找到多个 HTML 代码块，返回最后一个（通常是最新的/完整的）
 */
function extractHtmlCode(content) {
  const htmlBlocks = parseCodeBlocks(content, "html");
  if (htmlBlocks.length === 0) {
    return null;
  }
  // 返回最后一个 HTML 代码块（通常是最新的/完整的）
  return htmlBlocks[htmlBlocks.length - 1]?.code || null;
}

/**
 * 默认的 diff 格式配置（支持多种变体）
 * @typedef {Object} DiffFormatConfig
 * @property {RegExp[]} searchPatterns SEARCH 标记的正则模式（支持多种格式）
 * @property {RegExp[]} separatorPatterns 分隔符的正则模式（支持多种格式）
 * @property {RegExp[]} replacePatterns REPLACE 标记的正则模式（支持多种格式）
 */
const DEFAULT_DIFF_FORMAT_CONFIG = {
  // SEARCH 标记：支持多种格式
  // 1. ------- SEARCH (标准格式，减号和 SEARCH 在同一行)
  // 2. -------\nSEARCH (减号和 SEARCH 换行，允许中间有空白)
  // 3. <<<<< SEARCH (变体格式，可能换行)
  // 4. <<<<<\nSEARCH (变体格式换行)
  searchPatterns: [
    /[-]{3,}\s*SEARCH/i,           // ------- SEARCH (同一行，允许0个或多个空白)
    /[-]{3,}\s*\n\s*SEARCH/i,      // -------\nSEARCH (换行，允许前后空白)
    /<<<<<+\s*SEARCH/i,            // <<<<< SEARCH (变体，同一行，允许0个或多个空白)
    /<<<<<+\s*\n\s*SEARCH/i,       // <<<<<\nSEARCH (变体，换行，允许前后空白)
  ],
  
  // 分隔符：支持多种长度
  // 1. ======= (标准格式，至少3个等号)
  // 2. === (简短格式)
  separatorPatterns: [
    /[=]{3,}/,                     // ======= (3个或更多等号)
  ],
  
  // REPLACE 标记：支持多种格式
  // 1. >>>>>>> REPLACE (标准格式，加号和 REPLACE 在同一行)
  // 2. >>>>>>>\nREPLACE (加号和 REPLACE 换行)
  // 3. +++++++ REPLACE (变体格式，同一行)
  // 4. +++++++\nREPLACE (变体格式换行)
  replacePatterns: [
    />>>>>+\s*REPLACE/i,           // >>>>>>> REPLACE (标准，同一行，允许0个或多个空白)
    />>>>>+\s*\n\s*REPLACE/i,      // >>>>>>>\nREPLACE (标准，换行，允许前后空白)
    /[+]{3,}\s*REPLACE/i,          // +++++++ REPLACE (变体，同一行，允许0个或多个空白)
    /[+]{3,}\s*\n\s*REPLACE/i,     // +++++++\nREPLACE (变体，换行，允许前后空白)
  ],
};

/**
 * 检查内容是否包含 diff 代码块格式（使用配置的模式）
 * @param {string} content 代码内容
 * @param {DiffFormatConfig} [config] diff 格式配置（可选，默认使用 DEFAULT_DIFF_FORMAT_CONFIG）
 * @returns {boolean} 是否包含 diff 格式（包含 SEARCH 和分隔符，或完整的 diff 格式）
 */
function hasDiffFormat(content, config = DEFAULT_DIFF_FORMAT_CONFIG) {
  // 检查是否包含 SEARCH 标记
  const hasSearch = config.searchPatterns.some(pattern => pattern.test(content));
  
  // 检查是否包含分隔符
  const hasSeparator = config.separatorPatterns.some(pattern => pattern.test(content));
  
  // 检查是否包含 REPLACE 标记
  const hasReplace = config.replacePatterns.some(pattern => pattern.test(content));
  
  // 如果有 SEARCH 和分隔符，或者完整的 diff 格式，都认为是 diff
  return (hasSearch && hasSeparator) || (hasSearch && hasReplace);
}

/**
 * 查找第一个匹配的 SEARCH 标记位置
 * @param {string} content 内容
 * @param {DiffFormatConfig} config diff 格式配置
 * @returns {{index: number, match: string, pattern: RegExp}|null} 匹配结果，包含索引、匹配的文本和使用的模式，如果未找到则返回 null
 */
function findSearchMarker(content, config) {
  let earliestMatch = null;

  for (const pattern of config.searchPatterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      if (!earliestMatch || match.index < earliestMatch.index) {
        earliestMatch = {
          index: match.index,
          match: match[0],
          pattern,
        };
      }
    }
  }

  return earliestMatch;
}

/**
 * 查找分隔符位置
 * @param {string} content 内容
 * @param {DiffFormatConfig} config diff 格式配置
 * @returns {{index: number, match: string}|null} 匹配结果，包含索引和匹配的文本，如果未找到则返回 null
 */
function findSeparator(content, config) {
  for (const pattern of config.separatorPatterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      return {
        index: match.index,
        match: match[0],
      };
    }
  }
  return null;
}

/**
 * 查找 REPLACE 标记位置
 * @param {string} content 内容
 * @param {DiffFormatConfig} config diff 格式配置
 * @returns {{index: number, match: string}|null} 匹配结果，包含索引和匹配的文本，如果未找到则返回 null
 */
function findReplaceMarker(content, config) {
  for (const pattern of config.replacePatterns) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      return {
        index: match.index,
        match: match[0],
      };
    }
  }
  return null;
}

/**
 * 从 markdown 内容中提取所有 diff 代码块（SEARCH/REPLACE 格式）
 * 支持多种格式变体，包括换行的情况
 * 
 * @param {string} content markdown 内容
 * @param {DiffFormatConfig} [config] diff 格式配置（可选，默认使用 DEFAULT_DIFF_FORMAT_CONFIG）
 * @returns {string|null} 所有 diff 代码块的内容，合并为一个字符串（多个 diff 块之间用换行分隔）
 */
function extractDiffBlocks(content, config = DEFAULT_DIFF_FORMAT_CONFIG) {
  // 首先检查整个内容是否包含 diff 格式（可能不在代码块中）
  if (!hasDiffFormat(content, config)) {
    return null;
  }

  // 获取所有代码块（包括没有语言标识符的）
  const allBlocks = parseCodeBlocks(content);

  // 筛选出包含 diff 格式的代码块
  const diffBlocks = [];

  for (const block of allBlocks) {
    // 检查代码块内容是否包含 diff 格式（SEARCH/REPLACE）
    // 注意：即使是 html 代码块，如果包含 diff 格式，也应该提取
    if (hasDiffFormat(block.code, config)) {
      diffBlocks.push(block.code);
    }
  }

  // 如果从代码块中找到了 diff，返回合并后的内容
  if (diffBlocks.length > 0) {
    return diffBlocks.join('\n');
  }

  // 如果没有在代码块中找到，尝试直接从整个内容中提取 diff 部分
  const searchMatch = findSearchMarker(content, config);
  if (!searchMatch) {
    return null;
  }

  const searchStartIndex = searchMatch.index;
  const remainingContent = content.substring(searchStartIndex);

  // 尝试找到 REPLACE 标记，如果找到，提取到 REPLACE 行结束
  const replaceMatch = findReplaceMarker(remainingContent, config);
  if (replaceMatch) {
    // 找到 REPLACE 后，提取从 SEARCH 到 REPLACE 行结束的内容
    // REPLACE 标记通常在最后一行，所以提取到 REPLACE 行结束即可
    const replaceLineEnd = remainingContent.indexOf('\n', replaceMatch.index + replaceMatch.match.length);
    const endIndex = replaceLineEnd !== -1 ? replaceLineEnd : remainingContent.length;
    // 提取内容，保留 REPLACE 行（不 trim，因为 REPLACE 行是必需的）
    let extracted = remainingContent.substring(0, endIndex);
    // 只移除末尾的空白行，但保留 REPLACE 行本身
    extracted = extracted.replace(/\s+$/, '');
    console.log("🔍 [extractDiffBlocks] Extracted diff from non-code-block:", {
      length: extracted.length,
      preview: extracted.substring(0, 200),
    });
    return extracted;
  }

  // 如果没有找到 REPLACE，查找分隔符后的内容
  const separatorMatch = findSeparator(remainingContent, config);
  if (separatorMatch) {
    // 提取从 SEARCH 到分隔符后的内容，直到下一个代码块开始、双换行或字符串末尾
    const afterSeparator = remainingContent.substring(separatorMatch.index + separatorMatch.match.length);
    const endMatch = afterSeparator.match(/[\s\S]*?(?=\n\n|\n```|$)/);
    if (endMatch) {
      const endIndex = separatorMatch.index + separatorMatch.match.length + endMatch[0].length;
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

module.exports = {
  parseCodeBlocks,
  extractHtmlCode,
  extractHtmlCodeIncremental,
  extractDiffBlocks,
  hasDiffFormat,
  DEFAULT_DIFF_FORMAT_CONFIG,
};

