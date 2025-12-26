<script setup lang="ts">
defineProps<{
  value: string;
  label: string;
  description: string;
  isSelected: boolean;
}>();

defineEmits<{
  (e: "click", value: string): void;
}>();
</script>

<template>
  <button
    type="button"
    :class="[
      'flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border transition-all min-w-0',
      'hover:shadow-sm active:scale-[0.98]',
      isSelected
        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
    ]"
    :title="description"
    @click="$emit('click', value)"
  >
    <!-- SVG 图标 slot -->
    <slot name="icon" />
    <span class="flex-1 text-left truncate">{{ label }}</span>
    <!-- 选中状态的勾选图标 -->
    <svg
      v-if="isSelected"
      class="w-3.5 h-3.5 text-indigo-600 shrink-0"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fill-rule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
</template>
