<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ChevronDown, X, Search } from "lucide-vue-next";
import Dropdown from "./Dropdown.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: string[];
    placeholder?: string;
    showIcon?: boolean;
  }>(),
  {
    showIcon: true,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const searchQuery = ref("");
const isOpen = ref(false);
const isFocused = ref(false);
const isEditing = ref(false); // 标记是否正在编辑
const inputRef = ref<HTMLInputElement | null>(null);
let blurTimeout: ReturnType<typeof setTimeout> | null = null;

// 计算输入框显示的值
const inputValue = computed(() => {
  // 如果处于聚焦状态，始终显示搜索内容（即使是空字符串）
  // 这样在用户编辑时，删除到空也不会被替换为选中值
  if (isFocused.value) {
    return searchQuery.value;
  }
  // 失去焦点时，如果有选中值，显示选中的值
  if (props.modelValue) {
    return props.modelValue;
  }
  // 否则为空，显示 placeholder
  return "";
});

// 将选项按 provider 分组
const groupedOptions = computed(() => {
  const groups: Record<string, string[]> = {};

  props.options.forEach((option) => {
    const parts = option.split(",");
    const provider = parts[0] || "unknown";
    if (!groups[provider]) {
      groups[provider] = [];
    }
    groups[provider].push(option);
  });

  // 按 provider 名称排序
  const sortedGroups: Array<{ provider: string; options: string[] }> = Object.keys(groups)
    .sort()
    .map((provider) => ({
      provider,
      options: groups[provider]?.sort() || [],
    }));

  return sortedGroups;
});

// 根据搜索关键词过滤分组选项
const filteredGroupedOptions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  if (!query) {
    return groupedOptions.value;
  }

  const filtered: Array<{ provider: string; options: string[] }> = [];

  groupedOptions.value.forEach((group) => {
    // 检查 provider 名称是否匹配
    const providerMatches = group.provider.toLowerCase().includes(query);

    // 过滤匹配的选项
    const matchedOptions = group.options.filter((option) => {
      const lowerOption = option.toLowerCase();
      return lowerOption.includes(query);
    });

    // 如果 provider 匹配或有匹配的选项，则包含该分组
    if (providerMatches || matchedOptions.length > 0) {
      filtered.push({
        provider: group.provider,
        options: providerMatches ? group.options : matchedOptions,
      });
    }
  });

  return filtered;
});

function focusInput() {
  inputRef.value?.focus();
  openDropdown();
}

function openDropdown() {
  isOpen.value = true;
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function select(value: string) {
  // 清除延迟的 blur 定时器
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }

  emit("update:modelValue", value);
  searchQuery.value = "";
  isFocused.value = false;
  isEditing.value = false;
  isOpen.value = false;

  // 立即让输入框失去焦点，避免选择后仍可编辑
  nextTick(() => {
    inputRef.value?.blur();
    // 确保状态正确，即使 blur 事件没有触发
    isFocused.value = false;
    isEditing.value = false;
  });
}

function clearSearch(event: MouseEvent) {
  event.stopPropagation();
  event.preventDefault();
  searchQuery.value = "";
  isEditing.value = true;
  // 保持焦点
  nextTick(() => {
    inputRef.value?.focus();
  });
}

function handleInputFocus() {
  isFocused.value = true;
  isEditing.value = true;
  openDropdown();
  // 聚焦时，如果 searchQuery 为空，保持为空（不显示选中值）
  // 这样用户可以开始新的搜索
}

function handleInputBlur() {
  // 延迟关闭，以便点击选项时有时间触发
  blurTimeout = setTimeout(() => {
    isFocused.value = false;
    isEditing.value = false;
    isOpen.value = false;
    // 失去焦点时，清空搜索内容，恢复显示选中的值
    searchQuery.value = "";
    blurTimeout = null;
  }, 200);
}

function handleInputChange(event: Event) {
  const target = event.target as HTMLInputElement;
  // 如果输入框实际聚焦，确保状态正确
  if (document.activeElement === inputRef.value) {
    isFocused.value = true;
  }
  isEditing.value = true;
  searchQuery.value = target.value;
}

function handleInputKeydown(event: KeyboardEvent) {
  // ESC 键关闭下拉菜单
  if (event.key === "Escape") {
    isFocused.value = false;
    isEditing.value = false;
    isOpen.value = false;
    searchQuery.value = "";
    inputRef.value?.blur();
  }
  // Enter 键选择第一个匹配项（如果有）
  if (event.key === "Enter" && filteredGroupedOptions.value.length > 0) {
    const firstGroup = filteredGroupedOptions.value[0];
    if (firstGroup && firstGroup.options.length > 0) {
      const firstOption = firstGroup.options[0];
      if (firstOption) {
        select(firstOption);
        event.preventDefault();
      }
    }
  }
}

// 监听 modelValue 变化，清空搜索（仅在非编辑状态下）
watch(
  () => props.modelValue,
  () => {
    if (!isOpen.value && !isEditing.value) {
      searchQuery.value = "";
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
  <Dropdown :show="isOpen" @update:show="isOpen = $event">
    <template #trigger>
      <div class="relative w-full font-mono">
        <div
          v-if="showIcon"
          class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        >
          <slot name="icon">
            <Search class="w-4 h-4 text-slate-400" />
          </slot>
        </div>
        <input
          ref="inputRef"
          :value="inputValue"
          type="text"
          class="w-full input-base router-model-select__input pr-9 text-left transition-colors"
          :class="{
            'text-slate-400': !modelValue && !searchQuery,
            'pl-9': showIcon,
            'pl-3': !showIcon,
          }"
          :placeholder="placeholder || '-- 请选择模型 --'"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
          @input="handleInputChange"
          @keydown="handleInputKeydown"
          @click="focusInput"
        />
        <div
          class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none"
        >
          <button
            v-if="searchQuery"
            type="button"
            class="pointer-events-auto p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
            @mousedown.prevent.stop="clearSearch"
          >
            <X class="w-3.5 h-3.5" />
          </button>
          <ChevronDown class="w-4 h-4 text-slate-400 shrink-0 pointer-events-auto" />
        </div>
      </div>
    </template>

    <div class="font-mono">
      <!-- 选项列表 -->
      <div class="overflow-y-auto p-1 max-h-72">
        <template v-if="filteredGroupedOptions.length > 0">
          <template
            v-for="(group, groupIndex) in filteredGroupedOptions"
            :key="group.provider"
          >
            <div v-if="groupIndex > 0" class="h-px bg-slate-200 my-1" />
            <div class="px-2 py-1">
              <div
                class="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1"
              >
                {{ group.provider }}
              </div>
              <div class="space-y-0.5">
                <div
                  v-for="option in group.options"
                  :key="option"
                  class="px-2 py-1 text-xs font-mono rounded-md cursor-pointer transition-colors flex items-center router-model-select__option"
                  :class="{
                    'bg-primary-50 text-primary-700 font-medium': option === modelValue,
                    'hover:bg-slate-100 text-slate-700': option !== modelValue,
                  }"
                  @mousedown.prevent="select(option)"
                >
                  {{ option }}
                </div>
              </div>
            </div>
          </template>
        </template>

        <div
          v-if="options.length === 0"
          class="px-2 py-1.5 text-xs text-slate-400 text-center font-mono"
        >
          无可用模型
        </div>

        <div
          v-else-if="searchQuery && filteredGroupedOptions.length === 0"
          class="px-2 py-1.5 text-xs text-slate-400 text-center font-mono"
        >
          无匹配结果
        </div>
      </div>
    </div>
  </Dropdown>
</template>

<style scoped>
.router-model-select__input {
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  padding-right: 0.65rem;
  font-size: 0.85rem;
  min-height: 2.25rem;
}

.router-model-select__dropdown {
  border-radius: 0.75rem;
}

.router-model-select__option {
  min-height: 2.1rem;
}
</style>
