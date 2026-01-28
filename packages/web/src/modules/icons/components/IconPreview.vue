<script setup lang="ts">
// 1. 外部依赖
import { computed, ref } from "vue";
import { useClipboard } from "@vueuse/core";

// 2. 内部导入
import { ContentCopyOutlined, CheckOutlined } from "@vicons/material";
import type { IconInfo } from "@/types";

// 3. Props
const props = defineProps<{
  icon: IconInfo | null;
}>();

// 4. 响应式状态
const copied = ref(false);

// 5. Composables
const { copy } = useClipboard();

// 6. 计算属性
const importCode = computed(() => {
  if (!props.icon) return "";
  return `import { ${props.icon.name} } from "@vicons/material";`;
});

const usageCode = computed(() => {
  if (!props.icon) return "";
  return `<${props.icon.name} class="size-5" />`;
});

// 7. 方法
async function copyCode(code: string) {
  await copy(code);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
}
</script>

<template>
  <div class="flex h-full flex-col border-l border-gray-200 bg-white p-6">
    <!-- 未选择状态 -->
    <div v-if="!icon" class="flex flex-1 items-center justify-center">
      <p class="text-gray-400">点击左侧图标进行预览</p>
    </div>

    <!-- 预览内容 -->
    <template v-else>
      <!-- 图标预览 -->
      <div class="mb-6 flex justify-center rounded-lg bg-gray-50 py-8">
        <component :is="icon.component" class="size-24 text-gray-700" />
      </div>

      <!-- 图标名称 -->
      <div class="mb-6 flex items-center justify-center gap-2">
        <h3 class="font-mono text-lg font-medium text-gray-800">{{ icon.name }}</h3>
        <button class="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100" @click="copyCode(icon.name)">
          <CheckOutlined v-if="copied" class="size-4 text-green-500" />
          <ContentCopyOutlined v-else class="size-4" />
        </button>
      </div>

      <!-- 代码块：导入方式 -->
      <div class="mb-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm text-gray-500">导入方式</span>
          <button class="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100" @click="copyCode(importCode)">
            <CheckOutlined v-if="copied" class="size-4 text-green-500" />
            <ContentCopyOutlined v-else class="size-4" />
          </button>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-gray-900 p-3 text-sm text-gray-100">{{ importCode }}</pre>
      </div>

      <!-- 代码块：使用示例 -->
      <div class="mb-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm text-gray-500">使用示例</span>
          <button class="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100" @click="copyCode(usageCode)">
            <CheckOutlined v-if="copied" class="size-4 text-green-500" />
            <ContentCopyOutlined v-else class="size-4" />
          </button>
        </div>
        <pre class="overflow-x-auto rounded-lg bg-gray-900 p-3 text-sm text-gray-100">{{ usageCode }}</pre>
      </div>

      <!-- 不同尺寸预览 -->
      <div class="mt-6">
        <span class="text-sm text-gray-500">尺寸预览</span>
        <div class="mt-3 flex items-end gap-6 rounded-lg bg-gray-50 p-4">
          <div
            v-for="size in ['size-4', 'size-5', 'size-6', 'size-8']"
            :key="size"
            class="flex flex-col items-center gap-2"
          >
            <component :is="icon.component" :class="size" />
            <span class="text-xs text-gray-500">{{ size }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
