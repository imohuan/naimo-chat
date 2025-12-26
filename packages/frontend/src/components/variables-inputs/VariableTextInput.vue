<template>
  <div v-bind="$attrs" class="space-y-2">
    <!-- 顶部预览 -->
    <div
      v-if="previewMode === 'top' && isFocused && resolvedPreview"
      class="p-3 bg-white/90 border border-slate-200 rounded-md shadow-sm"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-semibold tracking-wide text-slate-500"
          >实时预览</span
        >
      </div>
      <div
        class="text-xs text-slate-700 whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto variable-scroll"
        style="
          font-family: 'Fira Code', 'Courier New', 'Microsoft YaHei', 'SimHei', monospace;
        "
        v-html="resolvedPreview"
      ></div>
    </div>

    <!-- 编辑器容器 - 下拉模式 -->
    <div v-if="previewMode === 'dropdown'" class="relative">
      <div
        ref="triggerContainerRef"
        :class="[
          'variable-text-input',
          'relative flex items-stretch h-full rounded-md border transition-all duration-200',
          showBorder
            ? 'border-dashed border-red-600'
            : isFocused
            ? 'border-slate-400 ring-2 ring-slate-200'
            : 'border-slate-200',
        ]"
      >
        <!-- FX 图标 -->
        <div
          v-if="showLeftIcon"
          class="pointer-events-none flex items-center justify-center w-7 text-gray-600 rounded-l-md shrink-0 border-r border-gray-200"
          style="background-color: #f1f3f9"
        >
          <Code2 class="w-4 h-4" />
        </div>

        <!-- 编辑器包裹容器 -->
        <div class="relative flex-1 min-w-0">
          <!-- Placeholder -->
          <span
            v-if="showPlaceholder"
            :class="[
              'pointer-events-none absolute select-none text-slate-400 z-10',
              density === 'compact' ? 'left-2 top-1 text-xs' : 'left-2 top-2 text-sm',
            ]"
          >
            {{ placeholder }}
          </span>

          <!-- ProseMirror 编辑器 -->
          <VariableEditor
            ref="editorRef"
            :model-value="internalValue"
            :multiline="multiline"
            :density="density"
            :autocomplete-trigger-chars="autocompleteTriggerChars"
            class="w-full"
            @update:model-value="handleEditorUpdate"
            @focus="handleFocus"
            @blur="handleBlur"
            @variable-drop="handleVariableDrop"
            @autocomplete-trigger="handleAutocompleteTrigger"
          />
        </div>

        <!-- 打开变量编辑器按钮 -->
        <div class="absolute right-0 bottom-0 w-5 h-8 pt-3 hidden">
          <button
            type="button"
            class="flex items-center justify-center w-full h-full border-l rounded-tl-md border-t border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 hover:bg-slate-100 rounded-r-md shrink-0"
            @click.stop="openVariableEditor"
            title="打开变量编辑器"
          >
            <ExternalLink class="h-3 w-3" />
          </button>
        </div>
      </div>

      <!-- 下拉预览面板 -->
      <PreviewDropdown
        ref="previewDropdownRef"
        :visible="showDropdown"
        :items="previewItems"
        :current-index="currentPreviewIndex"
        :position-style="dropdownPosition"
        :show-tip="showTip"
        @update:current-index="currentPreviewIndex = $event"
      />
    </div>

    <!-- 非下拉模式时，直接显示输入框 -->
    <div
      v-else
      :class="[
        'variable-text-input',
        'relative flex items-stretch h-full rounded-md border transition-all duration-200',
        showBorder
          ? 'border-dashed border-red-600'
          : isFocused
          ? 'border-slate-400 ring-2 ring-slate-200'
          : 'border-slate-200',
      ]"
    >
      <!-- FX 图标 -->
      <div
        v-if="showLeftIcon"
        class="pointer-events-none items-center justify-center w-7 text-gray-600 rounded-l-md shrink-0 border-r border-gray-200"
        style="background-color: #f1f3f9"
      >
        <Code2 class="w-4 h-4" />
      </div>

      <!-- 编辑器包裹容器 -->
      <div class="relative flex-1 min-w-0">
        <!-- Placeholder -->
        <span
          v-if="showPlaceholder"
          :class="[
            'pointer-events-none absolute select-none text-slate-400 z-10',
            density === 'compact' ? 'left-2 top-1 text-xs' : 'left-2 top-2 text-sm',
          ]"
        >
          {{ placeholder }}
        </span>

        <!-- ProseMirror 编辑器 -->
        <VariableEditor
          ref="editorRef"
          :model-value="internalValue"
          :multiline="multiline"
          :density="density"
          :autocomplete-trigger-chars="autocompleteTriggerChars"
          class="w-full"
          @update:model-value="handleEditorUpdate"
          @focus="handleFocus"
          @blur="handleBlur"
          @variable-drop="handleVariableDrop"
          @autocomplete-trigger="handleAutocompleteTrigger"
        />
      </div>

      <!-- 打开变量编辑器按钮 -->
      <div class="absolute right-0 bottom-0 w-5 h-8 pt-3 hidden">
        <button
          type="button"
          class="flex items-center justify-center w-full h-full border-l rounded-tl-md border-t border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700 hover:bg-slate-100 rounded-r-md shrink-0"
          @click.stop="openVariableEditor"
          title="打开变量编辑器"
        >
          <ExternalLink class="h-3 w-3" />
        </button>
      </div>
    </div>

    <!-- 底部预览 -->
    <div
      v-if="previewMode === 'bottom' && isFocused && resolvedPreview"
      class="p-3 bg-white/90 border border-slate-200 rounded-md shadow-sm"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-semibold tracking-wide text-slate-500"
          >实时预览</span
        >
      </div>
      <div
        class="text-xs text-slate-700 whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto variable-scroll"
        style="
          font-family: 'Fira Code', 'Courier New', 'Microsoft YaHei', 'SimHei', monospace;
        "
        v-html="resolvedPreview"
      ></div>
    </div>

    <!-- 提示文本 -->
    <p
      v-if="previewMode !== 'dropdown' && isFocused && showTip"
      class="text-[10px] leading-tight text-slate-400 px-1"
    >
      Tip: 支持拖拽变量插入，变量以
      <span class="font-mono text-emerald-600"
        >&#123;&#123; 节点名.字段 &#125;&#125;</span
      >
      形式表示
    </p>

    <!-- 变量自动完成下拉框 -->
    <AutocompleteDropdown
      ref="autocompleteDropdownRef"
      :visible="autocomplete.isVisible.value"
      :items="autocomplete.filteredVariables.value"
      :selected-index="autocomplete.selectedIndex.value"
      :position-style="autocomplete.position.value"
      @select="handleAutocompleteSelect"
      @update:selected-index="autocomplete.selectedIndex.value = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { ExternalLink, Code2 } from "lucide-vue-next";
import VariableEditor from "./editor/VariableEditor.vue";
import PreviewDropdown from "./components/PreviewDropdown.vue";
import AutocompleteDropdown from "./components/AutocompleteDropdown.vue";
import { useDropdownPosition } from "./hooks/useDropdownPosition";
import { useAutocomplete, type VariableItem } from "./hooks/useAutocomplete";

defineOptions({
  inheritAttrs: false,
});

interface Props {
  modelValue?: string | number;
  placeholder?: string;
  rows?: number;
  multiline?: boolean;
  /** 预览模式: top=顶部, bottom=底部, dropdown=下拉菜单, none=不显示 */
  previewMode?: "top" | "bottom" | "dropdown" | "none";
  /** 密度 */
  density?: "default" | "compact";
  /** 是否显示边框 */
  showBorder?: boolean;
  /** 是否显示提示信息 */
  showTip?: boolean;
  /** 是否显示左侧图标 */
  showLeftIcon?: boolean;
  /** 变量解析函数，接收字符串，返回解析后的值或值数组 */
  resolveVariable?: (value: string) => unknown | unknown[];
  /** 可用的变量列表，用于自动完成 */
  availableVariables?: VariableItem[];
  /** 触发自动完成的字符列表，默认为 ["{", "["] */
  autocompleteTriggerChars?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "",
  rows: 1,
  multiline: false,
  previewMode: "bottom",
  density: "default",
  showBorder: false,
  showTip: true,
  showLeftIcon: true,
  resolveVariable: undefined,
  availableVariables: () => [],
  autocompleteTriggerChars: () => ["{", "["],
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "open-variable-editor", value: string, callback: (value: string) => void): void;
}>();

const editorRef = ref<InstanceType<typeof VariableEditor> | null>(null);
const triggerContainerRef = ref<HTMLElement | null>(null);
const autocompleteDropdownRef = ref<InstanceType<typeof AutocompleteDropdown> | null>(null);
const previewDropdownRef = ref<InstanceType<typeof PreviewDropdown> | null>(null);
const internalValue = ref(normalizeValue(props.modelValue));
const showDropdown = ref(false);
const currentPreviewIndex = ref(0);
const isFocused = ref(false);
let blurTimer: number | null = null;

// 下拉位置管理 - 从 PreviewDropdown 组件实例获取 dropdownRef
const dropdownRef = ref<HTMLElement | null>(null);
// 监听 previewDropdownRef 变化，同步 dropdownRef
watch(
  () => previewDropdownRef.value?.dropdownRef,
  (newRef) => {
    dropdownRef.value = newRef || null;
  },
  { immediate: true }
);
const { position: dropdownPosition } = useDropdownPosition(
  triggerContainerRef,
  dropdownRef,
  showDropdown,
  {
    offset: 4,
    matchWidth: true,
  }
);

// 自动完成管理
const autocomplete = useAutocomplete(
  computed(() => props.availableVariables || []),
  computed(() => props.autocompleteTriggerChars || ["{", "["]),
  editorRef as any,
  internalValue,
  handleAutocompleteSelectVariable
);

const showPlaceholder = computed(() => !internalValue.value && props.placeholder);

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  (value) => {
    const newValue = normalizeValue(value);
    if (newValue !== internalValue.value) {
      internalValue.value = newValue;
    }
  }
);

// 监听 showDropdown 变化
watch(showDropdown, (value) => {
  if (!value && props.previewMode === "dropdown") {
    isFocused.value = false;
  }
});

// 检查是否包含变量
const hasVariable = computed(() => {
  const value = internalValue.value;
  if (!value || typeof value !== "string") return false;
  return /\{\{\s*[^{}]+?\s*\}\}/.test(value);
});

// 计算预览项（用于分页）
const previewItems = computed(() => {
  const value = internalValue.value;
  if (!value) return [];

  if (!hasVariable.value || !props.resolveVariable) {
    return [escapeHtml(formatPreviewValue(value))];
  }

  try {
    const resolved = props.resolveVariable(value);
    if (Array.isArray(resolved)) {
      // 对于数组，每个项目都需要高亮变量
      return resolved.map(() => highlightVariablesInPreview(value));
    }
    return [highlightVariablesInPreview(value)];
  } catch (error) {
    return [`解析错误: ${error}`];
  }
});


// 解析后的预览值（用于 top/bottom 模式）
const resolvedPreview = computed(() => {
  const value = internalValue.value;
  if (!value) return "";

  if (!hasVariable.value || !props.resolveVariable) {
    return escapeHtml(String(value));
  }

  try {
    // 在原始文本中逐个替换变量并高亮
    return highlightVariablesInPreview(value);
  } catch (error) {
    return `解析错误: ${error}`;
  }
});

/**
 * 根据变量名生成颜色
 */
function getVariableColor(varName: string): { bg: string; text: string } {
  // 预定义的颜色列表（浅色背景 + 深色文字）
  const colorPalette = [
    { bg: "#ecfdf5", text: "#10b981" }, // 绿色
    { bg: "#eff6ff", text: "#3b82f6" }, // 蓝色
    { bg: "#fef3c7", text: "#f59e0b" }, // 黄色/橙色
    { bg: "#fce7f3", text: "#ec4899" }, // 粉色
    { bg: "#e0e7ff", text: "#6366f1" }, // 靛蓝色
    { bg: "#d1fae5", text: "#059669" }, // 深绿色
    { bg: "#dbeafe", text: "#2563eb" }, // 深蓝色
    { bg: "#fde68a", text: "#d97706" }, // 深黄色
    { bg: "#fbcfe8", text: "#db2777" }, // 深粉色
    { bg: "#c7d2fe", text: "#4f46e5" }, // 深靛蓝色
    { bg: "#a7f3d0", text: "#047857" }, // 更深绿色
    { bg: "#bfdbfe", text: "#1d4ed8" }, // 更深蓝色
  ];

  // 使用简单的哈希函数根据变量名选择颜色
  let hash = 0;
  for (let i = 0; i < varName.length; i++) {
    hash = varName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index]!;
}

/**
 * 在预览中高亮显示变量
 * 通过解析原始文本，逐个替换变量为高亮的解析值
 */
function highlightVariablesInPreview(originalText: string): string {
  if (!props.resolveVariable) {
    return escapeHtml(originalText);
  }

  // 匹配所有变量 {{variableName}}
  const variableRegex = /\{\{([^}]+)\}\}/g;
  const matches: Array<{ match: string; index: number; varName: string }> = [];
  let match: RegExpExecArray | null;

  // 收集所有变量匹配
  while ((match = variableRegex.exec(originalText)) !== null) {
    if (match[1]) {
      matches.push({
        match: match[0],
        index: match.index,
        varName: match[1].trim(),
      });
    }
  }

  if (matches.length === 0) {
    return escapeHtml(originalText);
  }

  // 重新构建：先转义整个文本，然后替换变量部分
  let finalResult = "";
  let lastIndex = 0;

  for (const variableMatch of matches) {
    // 添加变量之前的普通文本（转义）
    finalResult += escapeHtml(originalText.substring(lastIndex, variableMatch.index));

    // 添加高亮的变量值
    try {
      // 只解析这个变量
      if (!props.resolveVariable) {
        finalResult += escapeHtml(variableMatch.match);
        lastIndex = variableMatch.index + variableMatch.match.length;
        continue;
      }
      const resolved = props.resolveVariable(variableMatch.match);
      const resolvedValue = Array.isArray(resolved)
        ? formatPreviewValue(resolved[0])
        : formatPreviewValue(resolved);

      // 确保值不为空
      if (resolvedValue) {
        // 根据变量名获取颜色
        const color = getVariableColor(variableMatch.varName);
        finalResult += `<span style="background-color: ${color.bg}; border-radius: 3px; color: ${color.text};">${escapeHtml(String(resolvedValue))}</span>`;
      } else {
        finalResult += escapeHtml(variableMatch.match);
      }
    } catch (error) {
      // 如果解析失败，保持原样
      finalResult += escapeHtml(variableMatch.match);
    }

    lastIndex = variableMatch.index + variableMatch.match.length;
  }

  // 添加最后剩余的普通文本
  finalResult += escapeHtml(originalText.substring(lastIndex));

  return finalResult;
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}


// 监听预览项变化，同步索引
watch(
  previewItems,
  (items) => {
    if (!items.length) {
      currentPreviewIndex.value = 0;
      return;
    }

    if (currentPreviewIndex.value > items.length - 1) {
      currentPreviewIndex.value = items.length - 1;
    }
  },
  { immediate: true }
);

function normalizeValue(value: string | number | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}


/**
 * 处理焦点事件
 */
function handleFocus() {
  isFocused.value = true;
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }

  if (props.previewMode === "dropdown") {
    currentPreviewIndex.value = 0;
    showDropdown.value = true;
  }
}

/**
 * 处理失焦事件
 */
function handleBlur() {
  blurTimer = window.setTimeout(() => {
    isFocused.value = false;
    if (props.previewMode === "dropdown") {
      showDropdown.value = false;
    }
    // 关闭自动完成
    autocomplete.close();
    blurTimer = null;
  }, 200);
}

/**
 * 处理点击外部事件
 */
function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  const trigger = triggerContainerRef.value;

  // 处理预览下拉框
  if (props.previewMode === "dropdown" && showDropdown.value) {
    if (trigger && trigger.contains(target)) {
      return;
    }

    // 检查点击目标是否在下拉预览面板内
    if (dropdownRef.value && dropdownRef.value.contains(target)) {
      return;
    }

    isFocused.value = false;
    showDropdown.value = false;
  }

  // 处理自动完成下拉框
  if (autocomplete.isVisible.value) {
    if (trigger && trigger.contains(target)) {
      return;
    }

    // 检查点击目标是否在自动完成下拉框内
    if (
      autocompleteDropdownRef.value?.listRef &&
      autocompleteDropdownRef.value.listRef.contains(target)
    ) {
      return;
    }

    autocomplete.close();
  }
}

/**
 * 处理编辑器更新
 */
function handleEditorUpdate(value: string) {
  internalValue.value = value;
  emit("update:modelValue", value);
}


/**
 * 处理拖放事件
 */
function handleVariableDrop(event: CustomEvent) {
  const dragData = event.detail;
  if (!dragData?.reference) return;

  const reference = dragData.reference.trim();
  if (!reference) return;

  const newValue = dragData.isReplace ? reference : internalValue.value + reference;
  handleEditorUpdate(newValue);
}

  /**
   * 处理自动完成触发
   */
  function handleAutocompleteTrigger(position: number, triggerChar: string) {
    autocomplete.handleTrigger(position, triggerChar);
    // 同步 refs 并滚动
    nextTick(() => {
      if (autocompleteDropdownRef.value) {
        autocomplete.setRefs(
          autocompleteDropdownRef.value.listRef,
          autocompleteDropdownRef.value.itemRefs
        );
        autocompleteDropdownRef.value.scrollToSelected(autocomplete.selectedIndex.value);
      }
    });
  }

/**
 * 处理自动完成选择变量
 */
function handleAutocompleteSelectVariable(item: VariableItem, triggerPos: number) {
  if (!editorRef.value) return;

  const variableName = item.value;
  const currentContent = internalValue.value;
  let triggerPosition = triggerPos;

  // 验证触发字符是否还在预期位置
  const triggerChars = props.autocompleteTriggerChars || ["{", "["];
  const currentChar =
    triggerPosition < currentContent.length ? currentContent[triggerPosition] : null;

  if (
    triggerPosition >= currentContent.length ||
    !currentChar ||
    !triggerChars.includes(currentChar)
  ) {
    // 如果触发字符不在预期位置，尝试查找最近的触发字符
    let actualPos = -1;

    for (const char of triggerChars) {
      const pos = currentContent.lastIndexOf(char, triggerPosition + 2);
      if (pos > actualPos) {
        actualPos = pos;
      }
    }

    if (actualPos === -1) {
      // 找不到触发字符，关闭自动完成
      autocomplete.close();
      return;
    }
    triggerPosition = actualPos;
  }

  // 计算连续的触发字符的数量（{ 或 [）
  let openCharsCount = 0;
  let checkPos = triggerPosition;
  const charToCheck = currentContent[triggerPosition];
  while (checkPos < currentContent.length && currentContent[checkPos] === charToCheck) {
    openCharsCount++;
    checkPos++;
  }

  // 确定插入位置：在第二个触发字符之后（或第一个之后如果只有1个）
  const insertPos = triggerPosition + Math.min(openCharsCount, 2);

  // 检查插入位置之后是否已经有 } 或 ]，计算需要补全的 }
  let closeBracesNeeded = 2; // 默认需要2个 }（因为变量格式是 {{ }}）
  let afterInsertPos = insertPos;

  // 检查插入位置之后的内容，看是否已经有 } 或 ]
  while (afterInsertPos < currentContent.length) {
    const char = currentContent[afterInsertPos];
    if (char === "}" || char === "]") {
      closeBracesNeeded--;
      afterInsertPos++;
      if (closeBracesNeeded <= 0) break;
    } else {
      break;
    }
  }

  // 确保至少需要2个 }（因为变量格式是 {{ }}）
  closeBracesNeeded = Math.max(closeBracesNeeded, 2);

  // 设置标志，防止内容变化时重新打开下拉菜单
  autocomplete.setIsSelecting(true);

  // 立即关闭下拉菜单
  autocomplete.close();

  // 计算需要替换的字符数量（最多2个）
  const charsToReplace = Math.min(openCharsCount, 2);

  // 构建要插入的完整文本：{{变量名}}
  const fullVariableText = "{{" + variableName + "}".repeat(closeBracesNeeded);

  // 使用 setContent 来替换（更可靠）
  if (editorRef.value && editorRef.value.getContent && editorRef.value.setContent) {
    const currentDoc = editorRef.value.getContent();
    // 构建新内容：删除触发字符，插入 {{变量名}}
    const beforeTrigger = currentDoc.substring(0, triggerPosition);
    const afterTrigger = currentDoc.substring(triggerPosition + charsToReplace);
    const newContent = beforeTrigger + fullVariableText + afterTrigger;
    editorRef.value.setContent(newContent);

    // 移动光标到插入的变量之后
    const newCursorPos = triggerPosition + fullVariableText.length;
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.insertTextAtPosition("", newCursorPos);
      }
    });
  } else {
    // 备用方案：直接插入（如果编辑器不支持 setContent）
    editorRef.value.insertTextAtPosition(fullVariableText, triggerPosition);
  }

  // 延迟重置标志，确保内容变化监听器不会重新打开下拉菜单
  nextTick(() => {
    setTimeout(() => {
      autocomplete.setIsSelecting(false);
    }, 100);
  });
}

/**
 * 处理自动完成选择（从组件触发）
 */
function handleAutocompleteSelect(item: VariableItem) {
  const triggerPos = autocomplete.triggerPosition();
  handleAutocompleteSelectVariable(item, triggerPos);
}

/**
 * 打开变量编辑器
 */
function openVariableEditor() {
  emit("open-variable-editor", internalValue.value, (value: string) => {
    handleEditorUpdate(value);
  });
}

// 生命周期钩子
onMounted(() => {
  if (props.previewMode === "dropdown") {
    document.addEventListener("mousedown", handleClickOutside, true);
  }
});

// 监听 previewMode 变化
watch(
  () => props.previewMode,
  (newMode, oldMode) => {
    if (newMode === "dropdown" && oldMode !== "dropdown") {
      document.addEventListener("mousedown", handleClickOutside, true);
    } else if (newMode !== "dropdown" && oldMode === "dropdown") {
      document.removeEventListener("mousedown", handleClickOutside, true);
    }
  }
);

onUnmounted(() => {
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }

  document.removeEventListener("mousedown", handleClickOutside, true);
});
</script>

<style scoped>
:deep(.variable-token) {
  color: #10b981;
  background-color: #ecfdf5;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 500;
}

:deep(.ProseMirror) {
  outline: none;
}

:deep(.ProseMirror p) {
  margin: 0;
  padding: 0;
}

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
