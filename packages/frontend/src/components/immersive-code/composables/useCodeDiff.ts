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
      if (/-------\s*SEARCH/.test(line)) {
        currentSection = "search";
        continue;
      } else if (/=======/.test(line)) {
        currentSection = "replace";
        continue;
      } else if (/\+\+\+\+\+\+\+\s*REPLACE/.test(line)) {
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
    const blocks = content.split(/(?=-------\s*SEARCH)/);

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

    if (originalContent.includes(searchContent)) {
      modified = originalContent.replace(searchContent, replaceContent);
    } else {
      // Line-based matching fallback
      const originalLines = originalContent.split("\n");
      const searchLines = searchContent.split("\n");
      const replaceLines = replaceContent.split("\n");

      if (searchLines.length > 0) {
        // Try strict line matching
        for (
          let i = 0;
          i < originalLines.length - searchLines.length + 1;
          i++
        ) {
          const slice = originalLines.slice(i, i + searchLines.length);
          // Simple join comparison
          if (slice.join("\n") === searchLines.join("\n")) {
            originalLines.splice(i, searchLines.length, ...replaceLines);
            modified = originalLines.join("\n");
            break;
          }
          // Fallback: Trimmed comparison if exact match fails (optional robustness for trailing spaces)
          // For now keeping it strict as per original reference
        }
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
      /-------\s*SEARCH[\s\S]*?\+\+\+\+\+\+\+\s*REPLACE[\s\S]*?-------\s*SEARCH/;
    const isMultipleDiff =
      multipleDiffRegex.test(normalizedDiffInput) ||
      (normalizedDiffInput.match(/-------\s*SEARCH/g) || []).length > 1;

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
