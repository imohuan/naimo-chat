<script setup lang="ts">
// 1. 外部依赖
import { ref, onMounted } from "vue";

// 2. 内部导入
import { SearchOutlined } from "@vicons/material";
import IconGrid from "../components/IconGrid.vue";
import IconPreview from "../components/IconPreview.vue";
import { useIconList } from "../composables/useIconList";
import type { IconInfo } from "@/types";

// 4. 响应式状态
const selectedIcon = ref<IconInfo | null>(null);

// 5. Composables
const { filteredIcons, loading, loadIcons, debouncedSearch } = useIconList();

// 7. 方法
function handleSearch(event: Event) {
  const target = event.target as HTMLInputElement;
  debouncedSearch(target.value);
}

function handleSelect(icon: IconInfo) {
  selectedIcon.value = icon;
}

// 8. 生命周期
onMounted(() => {
  loadIcons();
});
</script>

<template>
  <div class="flex h-screen">
    <!-- 左侧：图标列表 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- 搜索栏 -->
      <div class="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <SearchOutlined class="size-5 text-gray-400" />
        <input type="text" placeholder="搜索图标..." class="flex-1 text-sm outline-none" @input="handleSearch" />
        <span class="text-sm text-gray-400">{{ filteredIcons.length }} 个图标</span>
      </div>

      <!-- 图标网格 -->
      <div class="flex-1 overflow-y-auto bg-gray-50">
        <div v-if="loading" class="flex h-full items-center justify-center text-gray-500">加载中...</div>
        <IconGrid v-else :icons="filteredIcons" :selected-icon="selectedIcon" @select="handleSelect" />
      </div>
    </div>

    <!-- 右侧：预览面板 -->
    <div class="w-80 flex-shrink-0">
      <IconPreview :icon="selectedIcon" />
    </div>
  </div>
</template>
