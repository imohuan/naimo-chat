import { computed, type Ref } from "vue";
import type { PreviewVariables } from "../hooks/usePreviewHistory";

/**
 * 为 StatusLine 创建变量上下文
 * 将简单的变量格式转换为 VariableTextInput 需要的 contextMap 格式
 */
export function useStatusLineVariableContext(
  previewVariables: Ref<PreviewVariables>
) {
  // 创建 contextMap，将 previewVariables 映射为 statusLine 节点
  const contextMap = computed(() => {
    const vars = previewVariables.value;
    const map = new Map<string, unknown>();

    // 创建 statusLine 节点对象
    const statusLineNode = {
      workDirName: vars.workDirName || "",
      gitBranch: vars.gitBranch || "",
      model: vars.model || "",
      inputTokens: vars.inputTokens || "",
      outputTokens: vars.outputTokens || "",
      totalInputTokens: vars.totalInputTokens || "",
      totalOutputTokens: vars.totalOutputTokens || "",
      contextWindowSize: vars.contextWindowSize || "",
      totalCost: vars.totalCost || "",
      totalDuration: vars.totalDuration || "",
      totalApiDuration: vars.totalApiDuration || "",
      totalLinesAdded: vars.totalLinesAdded || "",
      totalLinesRemoved: vars.totalLinesRemoved || "",
    };

    map.set("statusLine", statusLineNode);
    return map;
  });

  // 创建变量树结构（用于变量面板）
  const variableTree = computed(() => ({
    name: "statusLine",
    label: "StatusLine",
    children: [
      { name: "workDirName", label: "工作目录名", path: "statusLine.workDirName" },
      { name: "gitBranch", label: "Git 分支", path: "statusLine.gitBranch" },
      { name: "model", label: "模型名称", path: "statusLine.model" },
      { name: "inputTokens", label: "输入 Tokens", path: "statusLine.inputTokens" },
      { name: "outputTokens", label: "输出 Tokens", path: "statusLine.outputTokens" },
      { name: "totalInputTokens", label: "总输入 Tokens", path: "statusLine.totalInputTokens" },
      { name: "totalOutputTokens", label: "总输出 Tokens", path: "statusLine.totalOutputTokens" },
      { name: "contextWindowSize", label: "上下文窗口大小", path: "statusLine.contextWindowSize" },
      { name: "totalCost", label: "总成本 (USD)", path: "statusLine.totalCost" },
      { name: "totalDuration", label: "总耗时", path: "statusLine.totalDuration" },
      { name: "totalApiDuration", label: "API 总耗时", path: "statusLine.totalApiDuration" },
      { name: "totalLinesAdded", label: "总新增行数", path: "statusLine.totalLinesAdded" },
      { name: "totalLinesRemoved", label: "总删除行数", path: "statusLine.totalLinesRemoved" },
    ],
  }));

  return {
    contextMap,
    variableTree,
  };
}

