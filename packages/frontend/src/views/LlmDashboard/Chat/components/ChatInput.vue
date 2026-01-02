<script setup lang="ts">
import { ref, computed, defineComponent, h, watch } from "vue";
import type { ChatStatus } from "ai";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputEditor,
  PromptInputTools,
  usePromptInput,
} from "@/components/ai-elements/prompt-input";
import { MicRound } from "@vicons/material";
import { Globe, ImageIcon } from "lucide-vue-next";
import ModeSelector from "./ModeSelector.vue";
import ModelConfigPanel from "./ModelConfigPanel.vue";
import type { ConversationMode } from "@/views/LlmDashboard/Chat/types";
import type { LlmProvider } from "@/interface";
import type { ChatModelConfig } from "../types";
import { useModelSelection } from "@/views/LlmDashboard/Chat/hooks/useModelSelection";

const props = defineProps<{
  mode: ConversationMode;
  modelId: string;
  status: ChatStatus;
  useWebSearch: boolean;
  useMicrophone: boolean;
  providers?: LlmProvider[];
  hasMessages: boolean;
  modelConfig?: ChatModelConfig;
}>();

const emit = defineEmits<{
  submit: [message: PromptInputMessage];
  "update:mode": [mode: ConversationMode];
  "update:modelId": [modelId: string];
  "update:useWebSearch": [value: boolean];
  "update:useMicrophone": [value: boolean];
  "update:modelConfig": [config: ChatModelConfig];
  "tag-click": [
    data: {
      id: string;
      label: string;
      icon?: string;
      data?: Record<string, any>;
    }
  ];
}>();

// 收集所有可用的模型選項（格式：provider,model）
const allModelOptions = computed(() => {
  const options: string[] = [];
  (props.providers || []).forEach((provider) => {
    if (provider.enabled !== false && provider.models) {
      provider.models.forEach((model) => {
        options.push(`${provider.name},${model}`);
      });
    }
  });
  return options.sort();
});

// 使用模型選擇 hooks
const modelIdRef = computed(() => props.modelId);
const { selectModel } = useModelSelection(allModelOptions, modelIdRef, (modelId) =>
  emit("update:modelId", modelId)
);

// 模型 + MCP 统一配置（从 props 初始化，或使用默认值）
const modelConfig = ref<ChatModelConfig>(
  props.modelConfig || {
    modelId: props.modelId,
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 4096,
    selectedMcpTools: {},
  }
);

// 监听 props.modelConfig 的变化，同步到本地 ref
watch(
  () => props.modelConfig,
  (newConfig) => {
    if (newConfig) {
      modelConfig.value = { ...newConfig };
    }
  },
  { deep: true }
);

// PromptInputEditor ref
const promptInputEditorRef = ref<typeof PromptInputEditor | null>(null);

// 文件上传按钮组件
const FileUploadButton = defineComponent({
  setup() {
    const { openFileDialog } = usePromptInput();
    return () =>
      h(
        PromptInputButton,
        {
          onClick: openFileDialog,
        },
        {
          default: () => [
            h(ImageIcon, { class: "w-4 h-4" }),
            h("span", { class: "sr-only" }, "上传文件"),
          ],
        }
      );
  },
});

function handleSubmit(message: PromptInputMessage) {
  emit("submit", message);
}

function handleModelConfigChange(config: ChatModelConfig) {
  modelConfig.value = config;
  // 通过 emit 更新父组件的 modelConfig
  emit("update:modelConfig", config);
  // 同步模型选择到上层
  if (config.modelId && config.modelId !== props.modelId) {
    selectModel(config.modelId);
  }
}

function toggleMicrophone() {
  emit("update:useMicrophone", !props.useMicrophone);
}

function handleTagClick(data: {
  id: string;
  label: string;
  icon?: string;
  data?: Record<string, any>;
}) {
  emit("tag-click", data);
}

// 暴露 ref 供父组件使用
defineExpose({
  promptInputEditorRef,
});
</script>

<template>
  <div class="w-full px-4" :class="hasMessages ? 'md:px-6' : 'pb-0'">
    <PromptInput class="w-full" multiple global-drop @submit="handleSubmit">
      <PromptInputHeader>
        <PromptInputAttachments>
          <template #default="{ file }">
            <PromptInputAttachment :file="file" />
          </template>
        </PromptInputAttachments>
      </PromptInputHeader>

      <PromptInputBody>
        <PromptInputEditor ref="promptInputEditorRef" @tag-click="handleTagClick" />
      </PromptInputBody>

      <PromptInputFooter>
        <PromptInputTools>
          <ModeSelector :mode="mode" @update:mode="emit('update:mode', $event)" />
          <div class="flex-1 min-w-[200px] max-w-[400px]">
            <ModelConfigPanel
              :model-id="modelId"
              :model-options="allModelOptions"
              :model-config="modelConfig"
              @update:model-config="handleModelConfigChange"
            />
          </div>
        </PromptInputTools>

        <div class="flex items-center gap-2">
          <FileUploadButton />

          <PromptInputButton
            :variant="useMicrophone ? 'default' : 'ghost'"
            @click="toggleMicrophone"
          >
            <MicRound class="w-4 h-4" />
            <span class="sr-only">Microphone</span>
          </PromptInputButton>

          <PromptInputButton
            :variant="useWebSearch ? 'default' : 'ghost'"
            @click="emit('update:useWebSearch', !useWebSearch)"
          >
            <Globe class="w-4 h-4" />
          </PromptInputButton>

          <PromptInputSubmit :disabled="status === 'streaming'" :status="status" />
        </div>
      </PromptInputFooter>
    </PromptInput>
  </div>
</template>
