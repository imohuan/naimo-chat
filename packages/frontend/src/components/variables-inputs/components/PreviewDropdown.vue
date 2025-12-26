<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="dropdownRef"
      class="fixed z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
      :style="positionStyle"
      @mousedown.prevent
    >
      <!-- 标题栏 -->
      <div
        class="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-2 py-1.5"
      >
        <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Result
        </div>
        <div
          v-if="items.length > 1"
          class="flex items-center gap-1 text-[10px] text-slate-500"
        >
          <span class="font-medium">Page</span>
          <input
            :value="pageInput"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            class="h-5 w-7 rounded bg-white px-1 text-center text-[10px] font-medium text-slate-600 shadow-inner ring-1 ring-inset ring-slate-200 transition focus:outline-none focus:ring-2 focus:ring-slate-300"
            @input="handlePageInputChange"
            @blur="handlePageInputCommit"
            @keydown="handlePageInputKeydown"
          />
          <span>/ {{ items.length }}</span>
          <button
            type="button"
            class="flex h-5 w-5 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
            :disabled="!canNavigatePrev"
            aria-label="上一页"
            @click.stop="goPrev"
          >
            <ChevronRight class="h-3 w-3 -rotate-180" />
          </button>
          <button
            type="button"
            class="flex h-5 w-5 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
            :disabled="!canNavigateNext"
            aria-label="下一页"
            @click.stop="goNext"
          >
            <ChevronRight class="h-3 w-3" />
          </button>
        </div>
      </div>

      <!-- 预览内容 -->
      <div class="max-h-56 overflow-y-auto variable-scroll px-2 py-2">
        <div
          v-if="currentText"
          class="text-xs text-slate-700 whitespace-pre-wrap wrap-break-word"
          style="
            font-family: 'Fira Code', 'Courier New', 'Microsoft YaHei', 'SimHei',
              monospace;
          "
          v-html="currentText"
        ></div>
        <p v-else class="text-xs text-slate-400">
          <span class="font-mono bg-gray-100">[empty]</span>
        </p>
      </div>

      <!-- 提示信息 -->
      <div v-if="showTip" class="border-t border-slate-100 bg-slate-50 px-2 py-1.5">
        <p class="text-[10px] leading-tight text-slate-400">
          Tip: 支持拖拽变量插入，变量以
          <span class="font-mono text-emerald-600"
            >&#123;&#123; 节点名.字段 &#125;&#125;</span
          >
          形式表示
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ChevronRight } from "lucide-vue-next";
import { Teleport } from "vue";

interface Props {
  visible: boolean;
  items: string[];
  currentIndex: number;
  positionStyle: {
    top: string;
    left: string;
    width?: string;
  };
  showTip?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showTip: true,
});

const emit = defineEmits<{
  (e: "update:currentIndex", index: number): void;
}>();

const dropdownRef = ref<HTMLElement | null>(null);
const pageInput = ref("1");

const currentText = computed(() => {
  if (!props.items.length) return "";
  const item = props.items[props.currentIndex];
  return item || "";
});

const canNavigatePrev = computed(
  () => props.items.length > 1 && props.currentIndex > 0
);

const canNavigateNext = computed(
  () => props.items.length > 1 && props.currentIndex < props.items.length - 1
);

function goPrev() {
  if (props.currentIndex <= 0) return;
  emit("update:currentIndex", props.currentIndex - 1);
}

function goNext() {
  if (props.currentIndex >= props.items.length - 1) return;
  emit("update:currentIndex", props.currentIndex + 1);
}

function handlePageInputChange(event: Event) {
  if (!props.items.length) {
    pageInput.value = "0";
    return;
  }

  const target = event.target as HTMLInputElement;
  const digits = target.value.replace(/[^0-9]/g, "");
  pageInput.value = digits;
}

function handlePageInputCommit() {
  if (!props.items.length) {
    pageInput.value = "0";
    return;
  }

  const trimmed = pageInput.value.trim();
  if (!trimmed) {
    pageInput.value = String(props.currentIndex + 1);
    return;
  }

  const total = props.items.length;
  const parsed = Number(trimmed);

  if (Number.isNaN(parsed)) {
    pageInput.value = String(props.currentIndex + 1);
    return;
  }

  const targetPage = Math.min(Math.max(Math.floor(parsed), 1), total);
  emit("update:currentIndex", targetPage - 1);
  pageInput.value = String(targetPage);
}

function handlePageInputKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    handlePageInputCommit();
  }
}

// 监听当前索引变化，同步页码
watch(
  () => props.currentIndex,
  (index) => {
    if (!props.items.length) {
      pageInput.value = "0";
      return;
    }
    pageInput.value = String(index + 1);
  },
  { immediate: true }
);

// 监听 items 变化，同步页码
watch(
  () => props.items,
  (items) => {
    if (!items.length) {
      pageInput.value = "0";
      return;
    }
    pageInput.value = String(props.currentIndex + 1);
  },
  { immediate: true }
);

defineExpose({
  dropdownRef,
});
</script>

<style scoped>
.variable-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.1) transparent;
}

.variable-scroll::-webkit-scrollbar {
  width: 6px;
}

.variable-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.variable-scroll::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.variable-scroll::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.2);
}

:deep(.variable-preview-highlight) {
  background-color: #ecfdf5;
  border-radius: 3px;
  color: #10b981;
}
</style>

