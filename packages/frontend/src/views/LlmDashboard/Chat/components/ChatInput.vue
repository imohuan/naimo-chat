<script setup lang="ts">
import { ref, computed, defineComponent, h } from "vue";
import type { InstanceType } from "vue";
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
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { MicRound, CheckCircleRound } from "@vicons/material";
import { Globe, ImageIcon } from "lucide-vue-next";
import ModeSelector from "./ModeSelector.vue";
import type { ConversationMode } from "@/views/LlmDashboard/Chat/types";
import type { LlmProvider } from "@/interface";

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

// 模型选择器状态
const modelSelectorOpen = ref(false);

// 可用模型计算
type SelectableModel = {
  id: string;
  name: string;
  chef: string;
  chefSlug?: string;
  providers?: string[];
};

const fallbackModels: SelectableModel[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    chef: "OpenAI",
    chefSlug: "openai",
    providers: ["openai", "azure"],
  },
];

const availableModels = computed<SelectableModel[]>(() => {
  const activeProviders = (props.providers || []).filter(
    (provider) => provider.enabled !== false
  );

  if (activeProviders.length > 0) {
    return activeProviders.flatMap((provider) => {
      const slug =
        provider.name
          ?.toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "provider";

      return (provider.models || []).map((model) => ({
        id: `${provider.name},${model}`,
        name: model,
        chef: provider.name,
        chefSlug: slug,
        providers: [slug],
      }));
    });
  }
  return fallbackModels;
});

const modelGroups = computed(() => {
  const groups = new Map<string, { heading: string; models: SelectableModel[] }>();
  availableModels.value.forEach((m) => {
    if (!groups.has(m.chef)) {
      groups.set(m.chef, { heading: m.chef, models: [] });
    }
    groups.get(m.chef)!.models.push(m);
  });
  return Array.from(groups.values());
});

const selectedModelData = computed(() =>
  availableModels.value.find((m) => m.id === props.modelId)
);

// PromptInputEditor ref
const promptInputEditorRef = ref<InstanceType<typeof PromptInputEditor> | null>(null);

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

function handleModelSelect(id: string) {
  emit("update:modelId", id);
  modelSelectorOpen.value = false;
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

          <ModelSelector v-model:open="modelSelectorOpen">
            <ModelSelectorTrigger as-child>
              <PromptInputButton>
                <ModelSelectorLogo
                  v-if="selectedModelData?.chefSlug"
                  :provider="selectedModelData.chefSlug"
                />
                <ModelSelectorName v-if="selectedModelData?.name">
                  {{ selectedModelData.name }}
                </ModelSelectorName>
              </PromptInputButton>
            </ModelSelectorTrigger>

            <ModelSelectorContent>
              <ModelSelectorInput placeholder="Search models..." />
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>

                <ModelSelectorGroup
                  v-for="group in modelGroups"
                  :key="group.heading"
                  :heading="group.heading"
                >
                  <ModelSelectorItem
                    v-for="m in group.models"
                    :key="m.id"
                    :value="m.id"
                    @select="() => handleModelSelect(m.id)"
                  >
                    <ModelSelectorLogo v-if="m.chefSlug" :provider="m.chefSlug" />
                    <ModelSelectorName>{{ m.name }}</ModelSelectorName>
                    <ModelSelectorLogoGroup v-if="m.providers?.length">
                      <ModelSelectorLogo
                        v-for="provider in m.providers"
                        :key="provider"
                        :provider="provider"
                      />
                    </ModelSelectorLogoGroup>
                    <CheckCircleRound
                      v-if="modelId === m.id"
                      class="ml-auto w-4 h-4 text-emerald-500"
                    />
                    <div v-else class="ml-auto size-4" />
                  </ModelSelectorItem>
                </ModelSelectorGroup>
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelector>
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
