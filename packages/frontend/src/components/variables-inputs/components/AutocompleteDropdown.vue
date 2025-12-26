<template>
  <Teleport to="body">
    <div
      v-if="visible && items.length > 0"
      ref="listRef"
      class="fixed z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl max-h-64 overflow-y-auto min-w-[200px]"
      :style="positionStyle"
      @mousedown.prevent
    >
      <div
        v-for="(item, index) in items"
        :key="index"
        :ref="(el) => setItemRef(index, el as HTMLElement)"
        :class="[
          'px-3 py-2 cursor-pointer transition-colors',
          index === selectedIndex
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-700 hover:bg-slate-50',
        ]"
        @click="handleSelect(item)"
        @mouseenter="handleMouseEnter(index)"
      >
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm text-emerald-600">{{ item.value }}</span>
          <span v-if="item.label !== item.value" class="text-xs text-slate-500">{{
            item.label
          }}</span>
        </div>
        <div v-if="item.description" class="text-xs text-slate-400 mt-1">
          {{ item.description }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Teleport } from "vue";
import type { VariableItem } from "../hooks/useAutocomplete";

interface Props {
  visible: boolean;
  items: VariableItem[];
  selectedIndex: number;
  positionStyle: {
    top: string;
    left: string;
  };
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "select", item: VariableItem): void;
  (e: "update:selectedIndex", index: number): void;
}>();

const listRef = ref<HTMLElement | null>(null);
const itemRefs = ref<(HTMLElement | null)[]>([]);

function setItemRef(index: number, el: HTMLElement | null) {
  itemRefs.value[index] = el;
}

function handleSelect(item: VariableItem) {
  emit("select", item);
}

function handleMouseEnter(index: number) {
  emit("update:selectedIndex", index);
}

/**
 * 滚动到选中的项
 */
function scrollToSelected(selectedIndex: number) {
  if (!listRef.value) return;

  const selectedItem = itemRefs.value[selectedIndex];
  if (!selectedItem) return;

  const list = listRef.value;
  const itemTop = selectedItem.offsetTop;
  const itemBottom = itemTop + selectedItem.offsetHeight;
  const listTop = list.scrollTop;
  const listBottom = listTop + list.clientHeight;

  if (itemTop < listTop) {
    list.scrollTop = itemTop;
  } else if (itemBottom > listBottom) {
    list.scrollTop = itemBottom - list.clientHeight;
  }
}

// 监听 selectedIndex 变化，自动滚动
watch(
  () => props.selectedIndex,
  (index) => {
    scrollToSelected(index);
  }
);

defineExpose({
  listRef,
  itemRefs,
  scrollToSelected,
});
</script>
