import { ref, computed, watch, onMounted, onUnmounted, nextTick, type Ref } from "vue";

export interface VariableItem {
  label: string;
  value: string;
  description?: string;
}

export interface CursorPosition {
  top: number;
  left: number;
}

/**
 * 自动完成 Hook
 * 用于管理自动完成下拉框的显示、位置和选择逻辑
 */
export function useAutocomplete(
  availableVariables: Ref<VariableItem[]>,
  triggerChars: Ref<string[]>,
  editorRef: Ref<{ getCursorPosition: () => CursorPosition | null } | null>,
  content: Ref<string>,
  onSelect: (item: VariableItem, triggerPos: number) => void
) {
  const isVisible = ref(false);
  const position = ref({ top: "0px", left: "0px" });
  const selectedIndex = ref(0);
  const listRef = ref<HTMLElement | null>(null);
  const itemRefs = ref<(HTMLElement | null)[]>([]);

  let triggerPosition = 0;
  let triggerChar: string = "{";
  let isSelecting = false;

  const filteredVariables = computed(() => {
    if (!availableVariables.value || availableVariables.value.length === 0) {
      return [];
    }
    return availableVariables.value;
  });

  /**
   * 更新自动完成下拉框位置
   */
  function updatePosition() {
    if (!editorRef.value) return;

    const cursorPos = editorRef.value.getCursorPosition();
    if (!cursorPos) {
      isVisible.value = false;
      return;
    }

    position.value = {
      top: `${cursorPos.top + 20}px`,
      left: `${cursorPos.left}px`,
    };
  }

  /**
   * 设置列表和项目 refs（由组件调用）
   */
  function setRefs(list: HTMLElement | null, items: (HTMLElement | null)[]) {
    listRef.value = list;
    itemRefs.value = items;
  }

  /**
   * 滚动到选中的项
   */
  function scrollToSelectedItem() {
    if (!listRef.value) return;

    const selectedItem = itemRefs.value[selectedIndex.value];
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

  /**
   * 处理自动完成触发
   */
  function handleTrigger(pos: number, char: string) {
    if (!availableVariables.value || availableVariables.value.length === 0) {
      return;
    }

    triggerPosition = pos;
    triggerChar = char;
    isVisible.value = true;
    selectedIndex.value = 0;

    nextTick(() => {
      updatePosition();
      // 滚动由组件内部处理
    });
  }

  /**
   * 选择变量
   */
  function selectVariable(item: VariableItem) {
    onSelect(item, triggerPosition);
  }

  /**
   * 处理键盘导航
   */
  function handleKeydown(event: KeyboardEvent): boolean {
    if (!isVisible.value || filteredVariables.value.length === 0) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        filteredVariables.value.length - 1
      );
      // 滚动由组件内部处理
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
      // 滚动由组件内部处理
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const selectedItem = filteredVariables.value[selectedIndex.value];
      if (selectedItem) {
        selectVariable(selectedItem);
      }
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return true;
    }

    return false;
  }

  /**
   * 关闭自动完成
   */
  function close() {
    isVisible.value = false;
  }

  /**
   * 检查并关闭自动完成（当内容变化时）
   */
  function checkAndClose(newValue: string, oldValue: string) {
    if (isSelecting) {
      return;
    }

    if (!isVisible.value) {
      return;
    }

    const pos = triggerPosition;
    const triggerCharsList = triggerChars.value;
    const currentChar = pos < newValue.length ? newValue[pos] : null;

    // 检查触发字符是否还在
    if (!currentChar || !triggerCharsList.includes(currentChar)) {
      close();
      return;
    }

    // 检查是否输入了对应的闭合字符
    const afterTrigger = newValue.substring(pos + 1, pos + 10);
    const closingChars = ["}", "]", ")", ">"];
    if (closingChars.some((char) => afterTrigger.includes(char))) {
      close();
      return;
    }

    // 如果内容长度减少（可能是删除了字符），检查是否需要关闭
    if (newValue.length < oldValue.length) {
      const checkRange = newValue.substring(
        Math.max(0, pos - 1),
        Math.min(newValue.length, pos + 2)
      );
      const hasTriggerChar = triggerCharsList.some((char) => checkRange.includes(char));
      if (!hasTriggerChar) {
        close();
      }
    }
  }

  // 监听可见性变化，更新位置
  watch(isVisible, (show) => {
    if (show) {
      nextTick(() => {
        updatePosition();
      });
    }
  });

  // 监听内容变化
  watch(content, (newValue, oldValue) => {
    checkAndClose(newValue, oldValue);
  });

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown, true);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown, true);
  });

  return {
    isVisible,
    position,
    selectedIndex,
    filteredVariables,
    listRef,
    itemRefs,
    triggerPosition: () => triggerPosition,
    triggerChar: () => triggerChar,
    setIsSelecting: (value: boolean) => {
      isSelecting = value;
    },
    setRefs,
    handleTrigger,
    selectVariable,
    close,
    updatePosition,
    scrollToSelectedItem,
  };
}

