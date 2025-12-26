export interface StatusLineModuleConfig {
  type: string;
  icon?: string;
  text: string;
  color?: string;
  background?: string;
  scriptPath?: string;
  style?: string | string[]; // ANSI 样式：bold, dim, normal, underline, noUnderline, reverse, noReverse
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
