export interface DiffContent {
  search: string;
  replace: string;
}

export interface DiffResult {
  content: string;
  success: boolean;
  appliedCount: number;
  failedBlocks: DiffContent[];
  message?: string;
}

export function useCodeDiff() {
  /**
   * 标准化文本格式，确保 diff 匹配的准确性
   * - 统一换行符为 \n
   * - 去除行尾空白
   * - 去除文件开头的 BOM
   * - 保留行首空白（缩进）
   */
  const normalizeText = (text: string): string => {
    if (!text) return text;

    // 去除 BOM 字符
    let normalized = text.replace(/^\uFEFF/, '');

    // 统一换行符为 \n（处理 \r\n 和单独的 \r）
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 按行处理，去除每行的尾随空白，但保留行首空白
    const lines = normalized.split('\n');
    const normalizedLines = lines.map(line => {
      // 去除行尾空白（空格、制表符等），\s 已包含所有空白字符
      return line.replace(/\s+$/, '');
    });

    // 重新组合，但保留最后的换行符（如果原文本有）
    normalized = normalizedLines.join('\n');

    return normalized;
  };

  // Parse a single diff block
  const parseDiffContent = (content: string): DiffContent => {
    const lines = content.split("\n");
    let searchContent = "";
    let replaceContent = "";
    let currentSection: "search" | "replace" | null = null;

    for (const line of lines) {
      // 支持 3 个或更多减号 + SEARCH
      if (/[-]{3,}\s*SEARCH/i.test(line)) {
        currentSection = "search";
        continue;
      } else if (/[=]{3,}/.test(line)) {
        currentSection = "replace";
        continue;
      } else if (/[+]{3,}\s*REPLACE/i.test(line)) {
        break;
      } else if (currentSection) {
        if (currentSection === "search") {
          searchContent += line + "\n";
        } else if (currentSection === "replace") {
          replaceContent += line + "\n";
        }
      }
    }

    return {
      search: normalizeText(searchContent.trimEnd()),
      replace: normalizeText(replaceContent.trimEnd()),
    };
  };

  // Parse multiple diff blocks
  const parseMultipleDiffContent = (content: string): DiffContent[] => {
    const diffBlocks: DiffContent[] = [];
    // Split by the start of SEARCH block, keeping the delimiter if possible or just processing parts
    // The previous implementation used split with lookahead
    const blocks = content.split(/(?=[-]{3,}\s*SEARCH)/);

    for (const block of blocks) {
      if (block.trim()) {
        const parsed = parseDiffContent(block);
        if (parsed.search.trim()) {
          diffBlocks.push(parsed);
        }
      }
    }

    return diffBlocks;
  };

  // Find and replace logic
  const findAndReplace = (
    originalContent: string,
    searchContent: string,
    replaceContent: string
  ): string => {
    let modified = originalContent;

    // 1. Try exact string match first
    if (originalContent.includes(searchContent)) {
      modified = originalContent.replace(searchContent, replaceContent);
      return modified;
    }

    // 2. Line-based matching with multiple strategies
    const originalLines = originalContent.split("\n");
    const searchLines = searchContent.split("\n");
    const replaceLines = replaceContent.split("\n");

    if (searchLines.length === 0) {
      return modified;
    }

    // Strategy 1: Exact line matching (including indentation)
    for (
      let i = 0;
      i < originalLines.length - searchLines.length + 1;
      i++
    ) {
      const slice = originalLines.slice(i, i + searchLines.length);
      if (slice.join("\n") === searchLines.join("\n")) {
        originalLines.splice(i, searchLines.length, ...replaceLines);
        modified = originalLines.join("\n");
        return modified;
      }
    }

    // Strategy 2: Match ignoring leading whitespace (but preserve original indentation)
    // This handles cases where search content doesn't include indentation
    for (
      let i = 0;
      i < originalLines.length - searchLines.length + 1;
      i++
    ) {
      const slice = originalLines.slice(i, i + searchLines.length);

      // Compare lines ignoring leading whitespace
      let matches = true;
      let firstNonEmptyIndex = -1;
      let baseIndent = "";

      for (let j = 0; j < searchLines.length; j++) {
        const searchLine = searchLines[j];
        const originalLine = slice[j];

        // For empty lines, both must be empty (after trimming trailing whitespace)
        if (searchLine.trimEnd() === "" && originalLine.trimEnd() === "") {
          continue;
        }

        // For non-empty lines, compare content ignoring leading whitespace
        if (searchLine.trim() !== originalLine.trim()) {
          matches = false;
          break;
        }

        // Record the first non-empty line's indentation as base indent
        if (firstNonEmptyIndex === -1 && searchLine.trim() !== "") {
          firstNonEmptyIndex = j;
          baseIndent = originalLine.match(/^(\s*)/)?.[1] || "";
        }
      }

      if (matches && firstNonEmptyIndex >= 0) {
        // Found a match! Now we need to preserve the indentation from the original
        // and apply it to the replace content
        // Apply the base indentation to replace lines
        const indentedReplaceLines = replaceLines.map((line, idx) => {
          // For empty lines, preserve as-is
          if (line.trimEnd() === "") {
            return line;
          }

          // Get the indentation of the corresponding search line
          const searchLine = searchLines[idx];
          const searchIndent = searchLine.match(/^(\s*)/)?.[1] || "";

          // Calculate the relative indentation difference
          const replaceIndent = line.match(/^(\s*)/)?.[1] || "";
          const indentDiff = replaceIndent.length - searchIndent.length;

          // Apply the base indent plus the relative difference
          const newIndentLength = Math.max(0, baseIndent.length + indentDiff);
          return " ".repeat(newIndentLength) + line.trimStart();
        });

        originalLines.splice(i, searchLines.length, ...indentedReplaceLines);
        modified = originalLines.join("\n");
        return modified;
      }
    }

    return modified;
  };

  // Main diff application function
  const applyDiff = (currentCode: string, diffInput: string): DiffResult => {
    // 标准化当前代码和 diff 输入
    const normalizedCurrentCode = normalizeText(currentCode);
    const normalizedDiffInput = normalizeText(diffInput);

    // Check for multiple blocks
    const multipleDiffRegex =
      /[-]{3,}\s*SEARCH[\s\S]*?[+]{3,}\s*REPLACE[\s\S]*?[-]{3,}\s*SEARCH/;
    const isMultipleDiff =
      multipleDiffRegex.test(normalizedDiffInput) ||
      (normalizedDiffInput.match(/[-]{3,}\s*SEARCH/g) || []).length > 1;

    let modifiedContent = normalizedCurrentCode;
    let appliedCount = 0;
    const failedBlocks: DiffContent[] = [];

    if (isMultipleDiff) {
      const diffBlocks = parseMultipleDiffContent(normalizedDiffInput);
      if (diffBlocks.length === 0) {
        return {
          content: currentCode, // 返回原始代码，保持格式
          success: false,
          appliedCount: 0,
          failedBlocks: [],
          message: "No valid diff blocks found.",
        };
      }

      for (const block of diffBlocks) {
        const beforeContent = modifiedContent;
        modifiedContent = findAndReplace(
          modifiedContent,
          block.search,
          block.replace
        );

        if (modifiedContent !== beforeContent) {
          appliedCount++;
        } else {
          failedBlocks.push(block);
        }
      }

      return {
        content: modifiedContent, // 返回标准化后的内容
        success: appliedCount > 0,
        appliedCount,
        failedBlocks,
        message:
          appliedCount > 0
            ? `成功应用 ${appliedCount}/${diffBlocks.length} 处更改。`
            : "应用更改失败。",
      };
    } else {
      // Single diff block
      const { search, replace } = parseDiffContent(normalizedDiffInput);
      if (!search.trim()) {
        return {
          content: currentCode, // 返回原始代码
          success: false,
          appliedCount: 0,
          failedBlocks: [],
          message: "搜索内容为空。",
        };
      }

      modifiedContent = findAndReplace(modifiedContent, search, replace);

      if (modifiedContent !== normalizedCurrentCode) {
        return {
          content: modifiedContent, // 返回标准化后的内容
          success: true,
          appliedCount: 1,
          failedBlocks: [],
          message: "成功应用更改。",
        };
      } else {
        return {
          content: currentCode, // 返回原始代码
          success: false,
          appliedCount: 0,
          failedBlocks: [{ search, replace }],
          message: "未找到要替换的内容。",
        };
      }
    }
  };

  return {
    applyDiff,
  };
}
