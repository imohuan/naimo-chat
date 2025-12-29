import type { StatusLineConfig, StatusLineModuleConfig } from "./types";

// 默认模块配置列表（统一管理所有默认模块）
export const DEFAULT_MODULES: StatusLineModuleConfig[] = [
  { type: "workDir", icon: "📁", text: "{{workDirName}}", color: "rgb(147, 197, 253)" },
  { type: "gitBranch", icon: "🌿", text: "{{gitBranch}}", color: "rgb(74, 222, 128)" },
  { type: "model", icon: "🤖", text: "{{model}}", color: "rgb(253, 224, 71)" },
  {
    type: "usage",
    icon: "📊",
    text: "{{inputTokens}} → {{outputTokens}}",
    color: "rgb(244, 114, 182)",
  },
  {
    type: "progress",
    icon: "📈",
    text: "",
    color: "rgb(34, 211, 238)",
    progressInput: "{{totalInputTokens}}",
    progressOutput: "{{contextWindowSize}}",
    progressLength: 20,
    progressBgColor: "rgb(51, 65, 85)",
    progressColor: "rgb(34, 211, 238)",
    progressStyle: "block",
  },
  {
    type: "script",
    icon: "📜",
    text: "Script Module",
    color: "rgb(34, 211, 238)",
    scriptPath: "",
  },
];

// 分割线模块（使用 usage 类型，但 text 为 "|"）
const SEPARATOR_MODULE: StatusLineModuleConfig = {
  type: "usage",
  text: "|",
  color: "white",
};

// 按类型索引的默认模块映射（用于快速查找）
const DEFAULT_MODULES_BY_TYPE = new Map<string, StatusLineModuleConfig>(
  DEFAULT_MODULES.map((module) => [module.type, module])
);

// 默认单个模块（向后兼容，使用第一个默认模块）
export const DEFAULT_MODULE: StatusLineModuleConfig = DEFAULT_MODULES[0]!;

/**
 * 创建默认的StatusLine配置
 */
export function createDefaultStatusLineConfig(): StatusLineConfig {
  return {
    enabled: false,
    currentStyle: "默认主题",
    默认主题: {
      // 使用默认模块列表的前4个作为默认主题的默认模块
      modules: DEFAULT_MODULES.slice(0, 4),
    },
  };
}

/**
 * 替换变量
 */
export function replaceVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] || match;
  });
}

/**
 * 检查是否为十六进制颜色值
 */
export function isHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color);
}

/**
 * 根据模块类型创建默认模块
 */
export function createDefaultModuleByType(type: string): StatusLineModuleConfig {
  // 如果类型是 separator，返回分割线模块（使用 usage 类型）
  if (type === "separator") {
    return { ...SEPARATOR_MODULE };
  }
  const defaultModule = DEFAULT_MODULES_BY_TYPE.get(type);
  if (defaultModule) {
    // 返回新的对象，避免引用问题
    return { ...defaultModule };
  }
  // 如果类型不存在，返回第一个默认模块并覆盖type
  return { ...DEFAULT_MODULE, type: type };
}
