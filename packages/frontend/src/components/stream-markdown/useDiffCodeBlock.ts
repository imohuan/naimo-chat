import { computed, type Ref } from "vue";
import { hasDiffFormat } from "@/lib/diffUtils";

/**
 * 针对自定义 diff 文本的通用解析逻辑：
 * - 判定是否为 diff 代码块
 * - 从内容中提取 oldText / newText
 *
 * 预期格式示例：
 * ------- SEARCH
 * ...old...
 * =======
 * ...new...
 * >>>>>>> REPLACE
 */
export function useDiffCodeBlock(code: Ref<string | undefined>) {
  // 是否为 diff 代码块
  const isDiffBlock = computed(() => hasDiffFormat(code.value || ""));

  const diffResult = computed(() => {
    if (!isDiffBlock.value) {
      return { oldText: "", newText: "" };
    }
    return parseDiff(code.value);
  });

  const diffOldText = computed(() => diffResult.value.oldText);
  const diffNewText = computed(() => diffResult.value.newText);

  return {
    isDiffBlock,
    diffOldText,
    diffNewText,
  };
}

/**
 * 解析后端自定义 diff 文本，提取 old / new 内容
 */
function parseDiff(content: string | undefined): { oldText: string; newText: string } {
  const safeContent = content ?? "";
  const lines = safeContent.split("\n");
  let searchIndex = -1;
  let separatorIndex = -1;
  let replaceIndex = -1;

  const isSearchLine = (line: string | undefined) => /SEARCH/i.test(line || "");
  const isSeparatorLine = (line: string | undefined) => /[=]{3,}/.test(line || "");
  const isReplaceLine = (line: string | undefined) => /REPLACE/i.test(line || "");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (searchIndex === -1 && isSearchLine(line)) {
      searchIndex = i;
      continue;
    }
    if (searchIndex !== -1 && separatorIndex === -1 && isSeparatorLine(line)) {
      separatorIndex = i;
      continue;
    }
    if (separatorIndex !== -1 && replaceIndex === -1 && isReplaceLine(line)) {
      replaceIndex = i;
      break;
    }
  }

  // 没找到关键标记，直接返回整体作为 newText
  if (searchIndex === -1 || separatorIndex === -1) {
    return { oldText: "", newText: safeContent };
  }

  const oldStart = searchIndex + 1;
  const oldEnd = separatorIndex;
  const newStart = separatorIndex + 1;
  const newEnd = replaceIndex === -1 ? lines.length : replaceIndex;

  const oldText = lines.slice(oldStart, oldEnd).join("\n").trimEnd();
  const newText = lines.slice(newStart, newEnd).join("\n").trimEnd();

  return { oldText, newText };
}


