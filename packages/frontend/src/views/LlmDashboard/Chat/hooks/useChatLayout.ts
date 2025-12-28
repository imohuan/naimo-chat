import { computed, type Ref } from "vue";
import { useElementSize } from "@vueuse/core";

/**
 * 聊天佈局配置類型
 */
export type ChatLayoutConfig = {
  isSmallScreen: boolean;
  messageMaxWidth: string;
  messageLayout: string;
  avatarSize: string;
  iconSize: string;
  messageBranchPadding: string;
  messageToolbarMargin: string;
  containerMaxWidth: string;
};

/**
 * 聊天佈局響應式 hooks
 * 提供統一的響應式寬度和佈局計算邏輯
 */
export function useChatLayout(containerRef: Ref<HTMLElement | null>) {
  const { width: containerWidth } = useElementSize(containerRef);

  // 判斷是否為小屏幕（< 640px）
  const isSmallScreen = computed(() => containerWidth.value < 640);

  // 統一的佈局配置對象
  const layoutConfig = computed<ChatLayoutConfig>(() => ({
    isSmallScreen: isSmallScreen.value,
    messageMaxWidth: isSmallScreen.value ? "max-w-full" : "max-w-[80%]",
    messageLayout: isSmallScreen.value ? "flex-col items-center" : "flex-row",
    avatarSize: isSmallScreen.value ? "size-8" : "size-11",
    iconSize: isSmallScreen.value ? "w-4 h-4" : "w-5 h-5",
    messageBranchPadding: isSmallScreen.value
      ? "px-2 pb-4 pt-2"
      : "px-4 pb-6 pt-2 md:px-6",
    messageToolbarMargin: isSmallScreen.value
      ? "sticky left-0 z-10 backdrop-blur-md -mx-2 px-2"
      : "sticky left-0 z-10 backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6",
    containerMaxWidth: isSmallScreen.value
      ? "max-w-full"
      : "max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl",
  }));

  return {
    layoutConfig,
  };
}

