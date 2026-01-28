// ============ Icon Types ============

// 图标信息
export interface IconInfo {
  name: string; // 图标名称
  component: unknown; // 图标组件
}

// ============ Event Types ============

export type Events = {
  "icon:selected": IconInfo;
};
