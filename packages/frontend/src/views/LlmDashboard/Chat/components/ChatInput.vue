<script setup lang="ts">
import { ref, computed, defineComponent, h } from "vue";
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
import RouterModelSelect from "@/components/llm/RouterModelSelect.vue";
import { Globe, ImageIcon, Sparkles } from "lucide-vue-next";
import ModeSelector from "./ModeSelector.vue";
import type { ConversationMode } from "@/views/LlmDashboard/Chat/types";
import type { LlmProvider } from "@/interface";
import { useModelSelection } from "@/views/LlmDashboard/Chat/hooks/useModelSelection";

const props = defineProps<{
  mode: ConversationMode;
  modelId: string;
  status: ChatStatus;
  useWebSearch: boolean;
  useMicrophone: boolean;
  providers?: LlmProvider[];
  hasMessages: boolean;
}>();

const emit = defineEmits<{
  submit: [message: PromptInputMessage];
  "update:mode": [mode: ConversationMode];
  "update:modelId": [modelId: string];
  "update:useWebSearch": [value: boolean];
  "update:useMicrophone": [value: boolean];
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

function handleModelSelect(value: string) {
  selectModel(value);
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
            <RouterModelSelect
              :model-value="modelId"
              :options="allModelOptions"
              placeholder="选择或搜索模型..."
              @update:model-value="handleModelSelect"
            >
              <template #icon>
                <Sparkles class="w-4 h-4 text-slate-400" />
              </template>
            </RouterModelSelect>
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
