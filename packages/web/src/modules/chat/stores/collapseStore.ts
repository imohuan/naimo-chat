import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useCollapseStore = defineStore('collapse', () => {
  // 存储每个消息/代码块的折叠状态
  // key: messageId 或 codeBlockId, value: 是否折叠
  const collapseStates = ref(new Map<string, boolean>());

  // 全局折叠状态
  const allCollapsed = ref(false);

  /**
   * 设置单个项目的折叠状态
   */
  const setCollapsed = (id: string, collapsed: boolean) => {
    collapseStates.value.set(id, collapsed);
  };

  /**
   * 获取单个项目的折叠状态
   */
  const isCollapsed = (id: string): boolean => {
    return collapseStates.value.get(id) ?? false;
  };

  /**
   * 切换单个项目的折叠状态
   */
  const toggleCollapse = (id: string) => {
    const current = isCollapsed(id);
    setCollapsed(id, !current);
  };

  /**
   * 全部折叠/展开
   */
  const toggleAllCollapse = () => {
    allCollapsed.value = !allCollapsed.value;

    // 更新所有已存在的项目状态
    collapseStates.value.forEach((_, key) => {
      collapseStates.value.set(key, allCollapsed.value);
    });
  };

  /**
   * 设置全部折叠状态（外部调用）
   */
  const setAllCollapsed = (collapsed: boolean) => {
    allCollapsed.value = collapsed;

    // 更新所有已存在的项目状态
    collapseStates.value.forEach((_, key) => {
      collapseStates.value.set(key, collapsed);
    });
  };

  /**
   * 清空所有折叠状态
   */
  const clearAll = () => {
    collapseStates.value.clear();
    allCollapsed.value = false;
  };

  /**
   * 注册新项目（当新消息或代码块出现时）
   */
  const registerItem = (id: string) => {
    if (!collapseStates.value.has(id)) {
      // 新项目使用当前的全局折叠状态
      collapseStates.value.set(id, allCollapsed.value);
    }
  };

  return {
    collapseStates,
    allCollapsed,
    setCollapsed,
    isCollapsed,
    toggleCollapse,
    toggleAllCollapse,
    setAllCollapsed,
    clearAll,
    registerItem
  };
});
