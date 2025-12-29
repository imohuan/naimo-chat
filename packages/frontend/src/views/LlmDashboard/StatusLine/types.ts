export interface StatusLineModuleConfig {
  type: string;
  icon?: string;
  text: string;
  color?: string;
  background?: string;
  scriptPath?: string;
  style?: string | string[]; // ANSI 样式：bold, dim, normal, underline, noUnderline, reverse, noReverse
  // 进度条相关配置
  progressInput?: string; // 输入变量名，如 "inputTokens" 或 "{{inputTokens}}"
  progressOutput?: string; // 输出变量名，如 "contextWindowSize" 或 "{{contextWindowSize}}"
  progressLength?: number; // 进度条长度，默认 20
  progressBgColor?: string; // 进度条背景颜色
  progressColor?: string; // 进度条颜色
  progressStyle?: string; // 进度条样式风格：block, thin, gradient 等
}

export interface StatusLineThemeConfig {
  modules: StatusLineModuleConfig[];
}

export interface StatusLineConfig {
  enabled: boolean;
  currentStyle: string;
  // 动态主题模板，key 为主题名称，value 为主题配置
  // 注意：由于 TypeScript 索引签名限制，需要包含 enabled 和 currentStyle 的类型
  // 实际使用时，除 enabled 和 currentStyle 外的所有键值对的值都应该是 StatusLineThemeConfig
  [themeName: string]: StatusLineThemeConfig | boolean | string;
}
