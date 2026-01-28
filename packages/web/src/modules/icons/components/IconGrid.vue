<script setup lang="ts">
// 1. 外部依赖
import { computed } from "vue";

// 2. 内部导入
import type { IconInfo } from "@/types";

// 3. Props/Emits
const props = defineProps<{
  icons: IconInfo[];
  selectedIcon: IconInfo | null;
}>();

const emit = defineEmits<{
  select: [icon: IconInfo];
}>();

// 6. 计算属性
const hasIcons = computed(() => props.icons.length > 0);

// 7. 方法
function handleSelect(icon: IconInfo) {
  emit("select", icon);
}

function isSelected(icon: IconInfo) {
  return props.selectedIcon?.name === icon.name;
}
</script>

<template>
  <div class="grid gap-2 p-4" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))">
    <template v-if="hasIcons">
      <button
        v-for="icon in icons"
        :key="icon.name"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border bg-white p-3 transition-all duration-200"
        :class="
          isSelected(icon)
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 hover:border-blue-400 hover:shadow-sm'
        "
        :title="icon.name"
        @click="handleSelect(icon)"
      >
        <component :is="icon.component" class="size-8" />
        <span class="w-full truncate text-center text-xs text-gray-600">{{ icon.name }}</span>
      </button>
    </template>
    <div v-else class="col-span-full py-12 text-center text-gray-500">没有找到匹配的图标</div>
  </div>
</template>
