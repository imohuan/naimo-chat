<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  useSlots,
  type CSSProperties,
  type Component,
} from "vue";
import { ChevronDown, X } from "lucide-vue-next";
import Dropdown from "./Dropdown.vue";
import Input from "./Input.vue";

export interface SelectOption {
  label: string;
  value: string | number;
  icon?: Component | string;
  disabled?: boolean;
  colorClass?: string;
  colorStyle?: CSSProperties;
}

const props = defineProps<{
  modelValue: string | number | null | undefined;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean; // 是否可清空
  searchable?: boolean; // 是否可搜索，默认 true
  dropdownMinWidth?: number; // 下拉最小宽度，默认 240
  dropdownMaxWidth?: number; // 下拉最大宽度，可选
  dropdownMaxHeight?: number; // 下拉最大高度，可选
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | number | null];
}>();

const searchQuery = ref("");
const isOpen = ref(false);
const isFocused = ref(false);
const isEditing = ref(false);
const inputCompRef = ref<InstanceType<typeof Input> | null>(null);
const inputRef = computed(() => inputCompRef.value?.el);
const dropdownRef = ref<InstanceType<typeof Dropdown> | null>(null);
const highlightedIndex = ref<number>(-1);
const optionRefs = ref<Map<number, HTMLElement>>(new Map());
let blurTimeout: ReturnType<typeof setTimeout> | null = null;

const slots = useSlots();
const hasSelectedSlot = computed(() => Boolean(slots.selectedLabel));
const shouldUseSelectedSlotDisplay = computed(
  () => hasSelectedSlot.value && selectedOption.value && !searchQuery.value
);

// 获取当前选中的选项
const selectedOption = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) {
    return null;
  }
  const foundOption = props.options.find(
    (opt) => opt.value === props.modelValue
  );
  if (foundOption) {
    return foundOption;
  }
  // 如果当前值不在选项中，创建一个虚拟选项
  return {
    label: String(props.modelValue),
    value: props.modelValue,
    colorClass: "",
  };
});

// 计算输入框显示的值
const inputValue = computed(() => {
  // 只有在聚焦且可搜索时才显示内容
  if (isFocused.value && props.searchable !== false) {
    return searchQuery.value;
  }
  // 其他情况都返回空字符串，完全隐藏输入框文本
  return "";
});

// 根据搜索关键词过滤选项
const filteredOptions = computed(() => {
  if (props.searchable === false) {
    return props.options;
  }

  const query = searchQuery.value.trim().toLowerCase();

  if (!query) {
    return props.options;
  }

  return props.options.filter((option) => {
    return option.label.toLowerCase().includes(query);
  });
});

function focusInput() {
  if (props.disabled || props.loading) return;
  inputRef.value?.focus();
  isOpen.value = true;
}

function select(value: string | number) {
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }

  emit("update:modelValue", value);
  searchQuery.value = "";
  highlightedIndex.value = -1;
  isFocused.value = false;
  isEditing.value = false;
  isOpen.value = false;

  nextTick(() => {
    inputRef.value?.blur();
    isFocused.value = false;
    isEditing.value = false;
  });
}

function clearValue(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  if (props.disabled || props.loading) return;

  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }

  emit("update:modelValue", null);
  searchQuery.value = "";
  highlightedIndex.value = -1;
  isFocused.value = false;
  isEditing.value = false;
  isOpen.value = false;

  nextTick(() => {
    inputRef.value?.blur();
  });
}

function clearSearch(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  searchQuery.value = "";
  highlightedIndex.value = -1;
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function handleInputFocus() {
  if (props.disabled || props.loading) return;
  isFocused.value = true;
  isEditing.value = true;
  isOpen.value = true;
  // 重置高亮索引
  highlightedIndex.value = -1;
}

function handleInputBlur() {
  blurTimeout = setTimeout(() => {
    isFocused.value = false;
    isEditing.value = false;
    isOpen.value = false;
    searchQuery.value = "";
    highlightedIndex.value = -1;
    blurTimeout = null;
  }, 200);
}

function handleInputChange(event: Event) {
  if (props.disabled || props.loading || props.searchable === false) return;
  const target = event.target as HTMLInputElement;
  if (document.activeElement === inputRef.value) {
    isFocused.value = true;
  }
  isEditing.value = true;
  searchQuery.value = target.value;
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    isFocused.value = false;
    isEditing.value = false;
    isOpen.value = false;
    searchQuery.value = "";
    highlightedIndex.value = -1;
    inputRef.value?.blur();
    return;
  }

  if (event.key === "Enter") {
    // 如果有高亮的选项，选择它
    if (
      highlightedIndex.value >= 0 &&
      highlightedIndex.value < filteredOptions.value.length
    ) {
      const option = filteredOptions.value[highlightedIndex.value];
      if (option && !option.disabled) {
        select(option.value);
        event.preventDefault();
        return;
      }
    }
    // 如果没有高亮但有匹配的选项，选择第一个
    if (filteredOptions.value.length > 0 && props.searchable !== false) {
      const firstOption = filteredOptions.value.find((opt) => !opt.disabled);
      if (firstOption) {
        select(firstOption.value);
        event.preventDefault();
        return;
      }
    }
    // 如果没有匹配选项但有搜索内容，使用搜索内容作为值
    if (searchQuery.value.trim() && props.searchable !== false) {
      select(searchQuery.value.trim());
      event.preventDefault();
    }
    return;
  }

  // 方向键导航
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (!isOpen.value) {
      isOpen.value = true;
      isFocused.value = true;
    }

    const enabledOptions = filteredOptions.value.filter((opt) => !opt.disabled);
    if (enabledOptions.length === 0) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    if (highlightedIndex.value === -1) {
      // 如果还没有高亮，找到当前选中项的索引
      const currentIndex = filteredOptions.value.findIndex(
        (opt) => opt.value === props.modelValue
      );
      highlightedIndex.value = currentIndex >= 0 ? currentIndex : 0;
    } else {
      // 根据方向键移动高亮
      if (event.key === "ArrowDown") {
        // 向下：找到下一个可用的选项
        let nextIndex = highlightedIndex.value + 1;
        while (nextIndex < filteredOptions.value.length) {
          const option = filteredOptions.value[nextIndex];
          if (option && !option.disabled) {
            break;
          }
          nextIndex++;
        }
        if (nextIndex < filteredOptions.value.length) {
          highlightedIndex.value = nextIndex;
        }
      } else {
        // 向上：找到上一个可用的选项
        let prevIndex = highlightedIndex.value - 1;
        while (prevIndex >= 0) {
          const option = filteredOptions.value[prevIndex];
          if (option && !option.disabled) {
            break;
          }
          prevIndex--;
        }
        if (prevIndex >= 0) {
          highlightedIndex.value = prevIndex;
        }
      }
    }

    // 滚动到可见区域
    nextTick(() => {
      const element = optionRefs.value.get(highlightedIndex.value);
      if (element) {
        element.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  }
}

watch(
  () => props.modelValue,
  () => {
    if (!isOpen.value && !isEditing.value) {
      searchQuery.value = "";
      highlightedIndex.value = -1;
    }
  }
);

// 当过滤选项变化时，重置高亮索引
watch(
  () => filteredOptions.value,
  () => {
    if (highlightedIndex.value >= filteredOptions.value.length) {
      highlightedIndex.value = -1;
    }
  }
);

onBeforeUnmount(() => {
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }
});
</script>

<template>
  <Dropdown
    ref="dropdownRef"
    :show="isOpen && !disabled && !loading"
    :min-width="dropdownMinWidth"
    :max-width="dropdownMaxWidth"
    :max-height="dropdownMaxHeight"
    @update:show="isOpen = $event"
  >
    <template #trigger>
      <div class="relative w-full">
        <Input
          ref="inputCompRef"
          :model-value="inputValue"
          type="text"
          :class="{
            'opacity-50 cursor-not-allowed': disabled || loading,
            'pr-20': clearable && selectedOption && !disabled && !loading,
          }"
          :placeholder="isFocused ? placeholder || '请选择或输入' : ''"
          :disabled="disabled || loading"
          :readonly="searchable === false || disabled || loading"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          @input="handleInputChange"
          @keydown="handleInputKeydown"
          @click.stop="focusInput"
        />
        <!-- 自定义已选标签 -->
        <div
          v-if="selectedOption && hasSelectedSlot && !isFocused"
          class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-sm text-slate-700"
        >
          <slot name="selectedLabel" :option="selectedOption" />
        </div>

        <!-- 无自定义标签时的默认显示 -->
        <div
          v-else-if="
            selectedOption && !hasSelectedSlot && !isFocused && !searchQuery
          "
          class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-sm text-slate-700"
        >
          {{ selectedOption.label }}
        </div>

        <!-- 无选中选项时的占位符 -->
        <div
          v-else-if="!selectedOption && !isFocused && !searchQuery"
          class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-sm text-slate-400"
        >
          {{ placeholder || "请选择" }}
        </div>
        <div
          class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
        >
          <!-- 搜索清除按钮（优先显示，当有搜索内容时） -->
          <button
            v-if="searchQuery && searchable !== false && !disabled && !loading"
            type="button"
            class="pointer-events-auto p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            @mousedown.prevent.stop="clearSearch"
          >
            <X class="w-3.5 h-3.5" />
          </button>

          <!-- 清空按钮（只在没有搜索内容时显示） -->
          <button
            v-else-if="clearable && selectedOption && !disabled && !loading"
            type="button"
            class="pointer-events-auto p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            @mousedown.prevent.stop="clearValue"
          >
            <X class="w-3.5 h-3.5" />
          </button>

          <ChevronDown
            class="w-4 h-4 text-slate-400 shrink-0 pointer-events-auto"
            :class="{ 'opacity-50': disabled || loading }"
          />
        </div>
      </div>
    </template>

    <!-- 选项列表 -->
    <div class="flex-1 overflow-y-auto p-1 flex flex-col gap-1">
      <template v-if="filteredOptions.length > 0">
        <div
          v-for="(option, index) in filteredOptions"
          :key="String(option.value)"
          :ref="(el) => {
            if (el) {
              optionRefs.set(index, el as HTMLElement);
            } else {
              optionRefs.delete(index);
            }
          }"
          class="px-2 py-1 text-sm rounded-md cursor-pointer transition-colors flex items-center gap-2 base-select__option"
          :class="{
            'bg-slate-200 ': option.value === modelValue,
            'bg-sky-100 text-sky-700':
              highlightedIndex === index && option.value !== modelValue,
            'hover:bg-slate-100 text-slate-700':
              highlightedIndex !== index && option.value !== modelValue,
            'opacity-50 cursor-not-allowed': option.disabled,
          }"
          @mousedown.prevent="option.disabled ? null : select(option.value)"
          @mouseenter="highlightedIndex = index"
        >
          <slot
            name="option"
            :option="option"
            :is-selected="option.value === modelValue"
          >
            <!-- 默认渲染：颜色块 + 图标 + 文本 -->
            <span
              v-if="option.colorClass || option.colorStyle"
              class="w-4 h-4 rounded-full border border-slate-200 shrink-0"
              :class="option.colorClass || 'bg-white'"
              :style="option.colorStyle"
            ></span>
            <component
              v-if="option.icon"
              :is="typeof option.icon === 'string' ? 'span' : option.icon"
              :class="
                typeof option.icon === 'string'
                  ? option.icon
                  : 'w-4 h-4 shrink-0'
              "
            />
            <span class="flex-1">{{ option.label }}</span>
          </slot>
        </div>
      </template>

      <div
        v-if="options.length === 0 && !loading"
        class="px-2 py-1.5 text-sm text-slate-400 text-center"
      >
        无可用选项
      </div>

      <div
        v-else-if="
          searchQuery && filteredOptions.length === 0 && searchable !== false
        "
        class="px-2 py-1.5 text-sm text-slate-400 text-center"
      >
        无匹配结果
      </div>

      <div
        v-if="loading"
        class="px-2 py-1.5 text-sm text-slate-400 text-center"
      >
        加载中...
      </div>
    </div>
  </Dropdown>
</template>

<style scoped>
.base-select__input {
  padding: 0.4rem 0.65rem;
  font-size: 0.875rem;
  min-height: 2.25rem;
  border-radius: 0.5rem;
  background-color: #fff;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.base-select__input:focus {
  outline: none;
  border-color: rgb(59 130 246);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.base-select__dropdown {
  border-radius: 0.75rem;
}

.base-select__option {
  min-height: 2.1rem;
}
</style>
