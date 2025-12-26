<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { LlmProvider } from "../../interface";
import { SearchOutlined, RefreshOutlined } from "@vicons/material";
import Dropdown from "./Dropdown.vue";

const props = defineProps<{
  modelValue: string;
  providers: LlmProvider[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const searchQuery = ref("");
const isOpen = ref(false);

const options = computed(() =>
  (props.providers || []).flatMap((p) =>
    (p.models || []).map((model) => ({
      label: `${p.name} / ${model}`,
      value: `${p.name},${model}`,
    })),
  ),
);

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return options.value;
  return options.value.filter((opt) => opt.label.toLowerCase().includes(q));
});

function select(value: string) {
  emit("update:modelValue", value);
  searchQuery.value = value.replace(",", " / ");
  isOpen.value = false;
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) searchQuery.value = val.replace(",", " / ");
  },
  { immediate: true },
);
</script>

<template>
  <Dropdown :show="isOpen" @update:show="isOpen = $event">
    <template #trigger>
      <div class="input-base flex items-center gap-2 min-h-[44px] cursor-text bg-white">
        <SearchOutlined class="w-4 h-4 text-slate-400" />
        <input
          v-model="searchQuery"
          type="text"
          class="flex-1 border-none outline-none text-sm bg-transparent"
          placeholder="选择或搜索模型..."
          @focus="isOpen = true"
          @input="isOpen = true"
        />
        <button
          class="text-slate-400 hover:text-slate-600 transition"
          type="button"
          @click.stop="searchQuery = ''"
        >
          <RefreshOutlined class="w-4 h-4" />
        </button>
      </div>
    </template>

    <div class="max-h-72 overflow-y-auto">
      <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 text-xs text-slate-500">
        <span>{{ filtered.length }} 个可用模型</span>
      </div>

      <div v-if="filtered.length" class="divide-y divide-slate-100">
        <button
          v-for="item in filtered"
          :key="item.value"
          type="button"
          class="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between"
          @mousedown.prevent
          @click="select(item.value)"
        >
          <span class="truncate">{{ item.label }}</span>
        </button>
      </div>
      <div v-else class="px-3 py-3 text-xs text-slate-400 text-center">无匹配模型</div>
    </div>
  </Dropdown>
</template>

<style scoped>
.input-base {
  padding: 0.55rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}
</style>

