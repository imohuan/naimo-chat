import { watch, onMounted, type Ref } from "vue";
import { useLocalStorage } from "@vueuse/core";

/**
 * 模型選擇 hooks
 * 處理模型選擇、驗證、本地存儲等功能
 */
export function useModelSelection(
  modelOptions: Ref<string[]>,
  initialModelId: Ref<string>,
  onModelChange: (modelId: string) => void,
  storageKey: string = "chat-selected-model-id"
) {
  // 使用本地存儲保存模型選擇
  const storedModelId = useLocalStorage<string>(storageKey, "", {
    writeDefaults: false,
  });

  // 驗證模型是否在可用列表中
  const isValidModel = (modelId: string): boolean => {
    if (!modelId) return false;
    return modelOptions.value.includes(modelId);
  };

  // 獲取第一個可用的模型
  const getFirstAvailableModel = (): string => {
    if (modelOptions.value.length > 0) {
      const first = modelOptions.value[0];
      return first || "";
    }
    return "";
  };

  // 選擇模型（帶驗證和自動回退）
  const selectModel = (modelId: string) => {
    if (isValidModel(modelId)) {
      // 模型有效，保存並使用
      storedModelId.value = modelId;
      onModelChange(modelId);
    } else {
      // 模型無效，選擇第一個可用模型
      const firstModel = getFirstAvailableModel();
      if (firstModel) {
        storedModelId.value = firstModel;
        onModelChange(firstModel);
      }
    }
  };

  // 初始化模型選擇：優先使用本地存儲的模型
  onMounted(() => {
    // 如果 modelOptions 已經有值，立即處理
    if (modelOptions.value.length > 0) {
      initializeModelSelection();
    }
  });

  // 初始化模型選擇的邏輯
  const initializeModelSelection = () => {
    // 優先使用本地存儲的模型
    const storedModel = storedModelId.value?.trim();
    const currentModel = initialModelId.value?.trim();

    if (storedModel && isValidModel(storedModel)) {
      // 本地存儲的模型有效，使用它
      if (storedModel !== currentModel) {
        selectModel(storedModel);
      }
    } else if (currentModel && isValidModel(currentModel)) {
      // 當前模型有效，使用它並保存到本地存儲
      storedModelId.value = currentModel;
    } else {
      // 都沒有有效模型，選擇第一個可用模型
      const firstModel = getFirstAvailableModel();
      if (firstModel) {
        selectModel(firstModel);
      }
    }
  };

  // 監聽模型選項變化
  watch(
    modelOptions,
    (newOptions) => {
      // 如果選項列表為空，不處理
      if (newOptions.length === 0) return;

      // 直接執行初始化邏輯，它會處理所有情況
      initializeModelSelection();
    },
    { immediate: true }
  );

  return {
    selectModel,
    isValidModel,
    getFirstAvailableModel,
  };
}

