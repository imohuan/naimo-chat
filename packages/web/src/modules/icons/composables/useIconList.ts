import { ref, computed, shallowRef } from "vue";
import { useDebounceFn } from "@vueuse/core";
import type { IconInfo } from "@/types";

// 图标列表 composable
export function useIconList() {
  const allIcons = shallowRef<IconInfo[]>([]);
  const searchKeyword = ref("");
  const loading = ref(true);

  // 过滤后的图标列表
  const filteredIcons = computed(() => {
    const keyword = searchKeyword.value.toLowerCase().trim();
    if (!keyword) return allIcons.value;
    return allIcons.value.filter((icon) => icon.name.toLowerCase().includes(keyword));
  });

  // 防抖搜索
  const debouncedSearch = useDebounceFn((value: string) => {
    searchKeyword.value = value;
  }, 300);

  // 加载所有图标
  async function loadIcons() {
    loading.value = true;
    try {
      // 动态导入所有图标
      const iconModule = await import("@vicons/material");
      const icons: IconInfo[] = [];

      for (const [name, component] of Object.entries(iconModule)) {
        // 过滤掉非组件的导出
        if (typeof component === "object" && component !== null) {
          icons.push({ name, component });
        }
      }

      allIcons.value = icons;
    } finally {
      loading.value = false;
    }
  }

  return {
    allIcons,
    filteredIcons,
    searchKeyword,
    loading,
    loadIcons,
    debouncedSearch,
  };
}
