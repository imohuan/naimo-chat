/**
 * Diff 格式配置（与后端保持一致）
 */
export interface DiffFormatConfig {
  /** SEARCH 标记的正则模式（支持多种格式） */
  searchPatterns: RegExp[];
  /** 分隔符的正则模式（支持多种格式） */
  separatorPatterns: RegExp[];
  /** REPLACE 标记的正则模式（支持多种格式） */
  replacePatterns: RegExp[];
}

/**
 * 默认的 diff 格式配置（支持多种变体）
 */
export const DEFAULT_DIFF_FORMAT_CONFIG: DiffFormatConfig = {
  // SEARCH 标记：支持多种格式
  // 1. ------- SEARCH (标准格式，减号和 SEARCH 在同一行)
  // 2. -------\nSEARCH (减号和 SEARCH 换行，允许中间有空白)
  // 3. <<<<< SEARCH (变体格式，可能换行)
  // 4. <<<<<\nSEARCH (变体格式换行)
  searchPatterns: [
    /[-]{3,}\s*SEARCH/i, // ------- SEARCH (同一行，允许0个或多个空白)
    /[-]{3,}\s*\n\s*SEARCH/i, // -------\nSEARCH (换行，允许前后空白)
    /<<<<<+\s*SEARCH/i, // <<<<< SEARCH (变体，同一行，允许0个或多个空白)
    /<<<<<+\s*\n\s*SEARCH/i, // <<<<<\nSEARCH (变体，换行，允许前后空白)
  ],

  // 分隔符：支持多种长度
  // 1. ======= (标准格式，至少3个等号)
  // 2. === (简短格式)
  separatorPatterns: [
    /[=]{3,}/, // ======= (3个或更多等号)
  ],

  // REPLACE 标记：支持多种格式
  // 1. >>>>>>> REPLACE (标准格式，加号和 REPLACE 在同一行)
  // 2. >>>>>>>\nREPLACE (加号和 REPLACE 换行)
  // 3. +++++++ REPLACE (变体格式，同一行)
  // 4. +++++++\nREPLACE (变体格式换行)
  replacePatterns: [
    />>>>>+\s*REPLACE/i, // >>>>>>> REPLACE (标准，同一行，允许0个或多个空白)
    />>>>>+\s*\n\s*REPLACE/i, // >>>>>>>\nREPLACE (标准，换行，允许前后空白)
    /[+]{3,}\s*REPLACE/i, // +++++++ REPLACE (变体，同一行，允许0个或多个空白)
    /[+]{3,}\s*\n\s*REPLACE/i, // +++++++\nREPLACE (变体，换行，允许前后空白)
  ],
};

/**
 * 检查内容是否包含 diff 代码块格式（使用配置的模式）
 * @param content 代码内容
 * @param config diff 格式配置（可选，默认使用 DEFAULT_DIFF_FORMAT_CONFIG）
 * @returns 是否包含 diff 格式（包含 SEARCH 和分隔符，或完整的 diff 格式）
 */
export function hasDiffFormat(
  content: string,
  config: DiffFormatConfig = DEFAULT_DIFF_FORMAT_CONFIG
): boolean {
  // 检查是否包含 SEARCH 标记
  const hasSearch = config.searchPatterns.some((pattern) => pattern.test(content));

  // 检查是否包含分隔符
  const hasSeparator = config.separatorPatterns.some((pattern) => pattern.test(content));

  // 检查是否包含 REPLACE 标记
  const hasReplace = config.replacePatterns.some((pattern) => pattern.test(content));

  // 如果有 SEARCH 和分隔符，或者完整的 diff 格式，都认为是 diff
  return (hasSearch && hasSeparator) || (hasSearch && hasReplace);
}

