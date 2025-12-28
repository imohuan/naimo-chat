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

  // 初始化模型選擇：如果存儲的模型無效，則選擇第一個可用模型
  onMounted(() => {
    const currentModel = (storedModelId.value || initialModelId.value || "").trim();

    if (currentModel && isValidModel(currentModel)) {
      // 如果當前模型有效，使用它
      if (currentModel !== initialModelId.value) {
        selectModel(currentModel);
      }
    } else {
      // 如果模型無效，選擇第一個可用模型
      const firstModel = getFirstAvailableModel();
      if (firstModel) {
        selectModel(firstModel);
      }
    }
  });

  // 監聽模型選項變化，如果當前模型不在列表中，則選擇第一個
  watch(
    modelOptions,
    (newOptions) => {
      if (newOptions.length === 0) return;

      const currentModel = initialModelId.value || storedModelId.value;

      if (currentModel && !isValidModel(currentModel)) {
        // 當前模型不在列表中，選擇第一個
        const firstModel = getFirstAvailableModel();
        if (firstModel) {
          selectModel(firstModel);
        }
      }
    },
    { immediate: true }
  );

  return {
    selectModel,
    isValidModel,
    getFirstAvailableModel,
  };
}

