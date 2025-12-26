<script setup lang="ts">
import {
  Teleport,
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type CSSProperties,
} from "vue";
import { CheckIcon } from "lucide-vue-next";

const props = defineProps<{
  modelValue: string[];
  baseUrl?: string;
  apiKey?: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void;
  (e: "change", value: string[]): void;
}>();

const query = ref("");
const options = ref<string[]>([]);
const isOpen = ref(false);
const loading = ref(false);
const error = ref("");
const triggerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLInputElement | null>(null);
const triggerRect = ref({
  left: 0,
  top: 0,
  bottom: 0,
  width: 0,
  height: 0,
});

const normalizedBaseUrl = computed(() => {
  let url = (props.baseUrl || "").trim();
  if (!url) return "";
  url = url.replace(/\/$/, "");
  // 去掉可能的 chat/completions 后缀，避免重复拼接
  url = url.replace(/\/v1\/chat\/completions$/i, "");
  return url;
});

const allOptions = computed(() =>
  Array.from(new Set([...(options.value || []), ...(props.modelValue || [])]))
);

const filteredOptions = computed(() => {
  const q = query.value.toLowerCase();
  return allOptions.value.filter((m) => !q || m.toLowerCase().includes(q));
});

const dropdownStyle = computed<CSSProperties>(() => ({
  position: "absolute",
  left: `${triggerRect.value.left}px`,
  top: `${triggerRect.value.bottom + 6}px`,
  width: `${triggerRect.value.width || 260}px`,
  zIndex: 9999,
}));

const updateRects = () => {
  const rect = triggerRef.value?.getBoundingClientRect();
  if (rect) {
    triggerRect.value = {
      left: rect.left,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }
};

const focusInputSafely = () => {
  // 延迟到菜单展开后再聚焦，避免被菜单内部焦点覆盖
  requestAnimationFrame(() => {
    inputEl.value?.focus();
  });
};

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as Node;
  if (
    !triggerRef.value?.contains(target) &&
    !dropdownRef.value?.contains(target)
  ) {
    isOpen.value = false;
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") isOpen.value = false;
};

function focusInput() {
  inputEl.value?.focus();
  openDropdown();
}

function openDropdown() {
  isOpen.value = true;
  nextTick(() => {
    updateRects();
  });
}

function selectModel(name: string) {
  const val = (name || "").trim();
  if (!val) return;
  const exists = (props.modelValue || []).includes(val);
  const next = exists
    ? (props.modelValue || []).filter((m) => m !== val)
    : Array.from(new Set([...(props.modelValue || []), val]));
  emit("update:modelValue", next);
  emit("change", next);
  query.value = "";
}

function removeModel(name: string) {
  const next = (props.modelValue || []).filter((m) => m !== name);
  emit("update:modelValue", next);
  emit("change", next);
}

function commitQuery() {
  selectModel(query.value);
}

async function fetchModels() {
  if (!normalizedBaseUrl.value) {
    error.value = "请先填写 Base URL";
    isOpen.value = true;
    return;
  }
  if (!props.apiKey?.trim()) {
    error.value = "请先填写 API Key";
    isOpen.value = true;
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    const res = await fetch(`${normalizedBaseUrl.value}/v1/models`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${props.apiKey.trim()}`,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
      ? data.models
      : [];
    const names = list
      .map((item: unknown) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return (
            (record.id as string) || (record.name as string) || (record.model as string)
          );
        }
        return "";
      })
      .filter(Boolean) as string[];
    options.value = Array.from(new Set(names));
    isOpen.value = true;
  } catch (err) {
    error.value = (err as Error).message || "获取模型失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  window.addEventListener("resize", updateRects);
  window.addEventListener("scroll", updateRects, true);
  document.addEventListener("mousedown", handleClickOutside, true);
  document.addEventListener("keydown", handleKeydown);
  nextTick(updateRects);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateRects);
  window.removeEventListener("scroll", updateRects, true);
  document.removeEventListener("mousedown", handleClickOutside, true);
  document.removeEventListener("keydown", handleKeydown);
});

watch(
  () => [props.baseUrl, props.apiKey],
  () => {
    options.value = [];
    error.value = "";
  }
);

watch(isOpen, (open) => {
  if (open) {
    nextTick(() => {
      updateRects();
      focusInputSafely();
    });
  }
});
</script>

<template>
  <div class="relative">
    <div
      ref="triggerRef"
      class="input-base flex items-center flex-wrap gap-2 min-h-[48px] cursor-text relative pr-10"
      @click="focusInput"
    >
      <span
        v-for="item in modelValue"
        :key="item"
        class="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs transition-colors"
      >
        <span class="truncate max-w-[140px]">{{ item }}</span>
        <button
          type="button"
          class="text-slate-400 hover:text-red-500 transition-colors"
          @click.stop="removeModel(item)"
        >
          ✕
        </button>
      </span>
      <div class="relative flex-1 min-w-[120px]">
        <input
          ref="inputEl"
          v-model="query"
          class="w-full border-none focus:ring-0 outline-none text-sm bg-transparent text-slate-700"
          :placeholder="placeholder || '输入或选择模型，回车添加'"
          @keydown.enter.prevent="commitQuery"
          @input="openDropdown"
        />
      </div>
      <button
        type="button"
        class="absolute right-0 bottom-0 border border-t border-l rounded-tl-md h-7 w-7 flex items-center justify-center text-primary hover:bg-gray-100 transition-colors"
        @click.stop="fetchModels"
        :title="loading ? '正在刷新模型' : '刷新模型'"
      >
        <span :class="loading ? 'animate-spin' : ''">⟳</span>
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        :style="dropdownStyle"
        class="p-0 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-auto"
      >
        <div
          class="flex items-center justify-between px-3 py-2 border-b border-slate-100 text-xs text-slate-500 bg-slate-50"
        >
          <span>{{ filteredOptions.length }} 个可用模型</span>
          <span v-if="error" class="text-red-500">{{ error }}</span>
          <span v-else-if="loading" class="text-slate-400">加载中...</span>
        </div>

        <div v-if="filteredOptions.length">
          <div class="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase">
            可用模型
          </div>
          <div class="divide-y divide-slate-100">
            <div
              v-for="item in filteredOptions"
              :key="item"
              class="px-3 py-2 text-sm text-slate-700 hover:bg-primary-50 cursor-pointer flex items-center justify-between hover:bg-gray-100"
              @mousedown.prevent="selectModel(item)"
            >
              <span class="truncate font-mono text-xs">{{ item }}</span>
              <CheckIcon
                v-if="modelValue.includes(item)"
                class="w-4 h-4 text-primary-600"
              />
            </div>
          </div>
        </div>

        <div v-else-if="query && !loading" class="px-3 py-3 text-sm text-slate-500">
          无匹配结果，按回车或点击下方添加自定义模型。
        </div>

        <div
          v-if="query && !loading && !filteredOptions.includes(query)"
          class="px-3 py-3 text-sm text-primary-600 hover:bg-primary-50 cursor-pointer border-t border-slate-100 flex items-center gap-2"
          @mousedown.prevent="selectModel(query)"
        >
          <span>使用自定义模型 "{{ query }}"</span>
        </div>

        <div
          v-if="!loading && !filteredOptions.length && !query"
          class="px-3 py-3 text-sm text-slate-400"
        >
          暂无模型，请点击“刷新模型”获取。
        </div>
      </div>
    </Teleport>
  </div>
</template>
