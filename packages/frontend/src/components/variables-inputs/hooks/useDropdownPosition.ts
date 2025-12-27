import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from "vue";

export interface DropdownPosition {
  top: string;
  left: string;
  width?: string;
}

/**
 * 下拉位置管理 Hook
 * 用于管理下拉面板的位置计算和更新
 */
export function useDropdownPosition(
  triggerRef: Ref<HTMLElement | null>,
  dropdownRef: Ref<HTMLElement | null>,
  isVisible: Ref<boolean>,
  options?: {
    /** 偏移量，默认 4px */
    offset?: number;
    /** 是否跟随宽度 */
    matchWidth?: boolean;
  }
) {
  const position = ref<DropdownPosition>({
    top: "0px",
    left: "0px",
    width: "0px",
  });

  let resizeObserver: ResizeObserver | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 更新下拉面板位置
   */
  function updatePosition() {
    if (!triggerRef.value || !dropdownRef.value || !isVisible.value) {
      return;
    }

    const trigger = triggerRef.value.getBoundingClientRect();
    const offset = options?.offset ?? 4;

    // 计算位置：在触发器下方，左对齐
    const top = trigger.bottom + offset;
    const left = trigger.left;
    const width = options?.matchWidth ? trigger.width : undefined;

    position.value = {
      top: `${top}px`,
      left: `${left}px`,
      ...(width !== undefined && { width: `${width}px` }),
    };
  }

  /**
   * 处理滚动事件
   */
  function handleScroll() {
    if (isVisible.value) {
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  }

  /**
   * 设置 ResizeObserver（使用防抖优化，避免 ResizeObserver 循环警告）
   */
  function setupResizeObserver() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (triggerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        if (isVisible.value) {
          // 使用防抖，避免频繁触发导致 ResizeObserver 循环警告
          if (resizeTimer) {
            clearTimeout(resizeTimer);
          }
          resizeTimer = setTimeout(() => {
            requestAnimationFrame(() => {
              updatePosition();
            });
          }, 16); // 约 60fps 的间隔
        }
      });
      resizeObserver.observe(triggerRef.value);
    }
  }

  // 监听可见性变化
  watch(isVisible, (visible) => {
    if (visible) {
      nextTick(() => {
        updatePosition();
        setupResizeObserver();
      });
    }
  });

  // 监听 triggerRef 变化
  watch(triggerRef, () => {
    nextTick(() => {
      setupResizeObserver();
    });
  });

  onMounted(() => {
    nextTick(() => {
      setupResizeObserver();
    });

    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("scroll", handleScroll, true);
  });

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }

    window.removeEventListener("scroll", handleScroll, true);
    document.removeEventListener("scroll", handleScroll, true);
  });

  return {
    position,
    updatePosition,
  };
}

