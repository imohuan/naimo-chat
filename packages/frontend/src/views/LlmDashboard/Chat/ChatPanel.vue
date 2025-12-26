<script setup lang="ts">
import { nanoid } from "nanoid";

import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { ChatStatus } from "ai";
import type { LlmProvider } from "@/interface";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageAttachment,
  MessageAttachments,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
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
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { MicRound, CheckCircleRound, PersonRound, SmartToyRound, SearchRound } from "@vicons/material";
import { CheckIcon, CopyIcon, RefreshCcwIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useLlmApi } from "@/hooks/useLlmApi";
import ChatHeaderActions from "./components/ChatHeaderActions.vue";
import ChatSidebar from "./components/ChatSidebar.vue";
import { useChatConversations, type MessageType } from "./useChatConversations";

const props = defineProps<{
  providers?: LlmProvider[];
  currentTab?: string;
}>();

const emit = defineEmits<{
  clear: [];
}>();

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

const suggestions: string[] = [];

const modelId = ref<string>("");
const modelSelectorOpen = ref(false);
const useWebSearch = ref(false);
const useMicrophone = ref(false);
const status = ref<ChatStatus>("ready");
const liked = ref<Record<string, boolean>>({});
const disliked = ref<Record<string, boolean>>({});
const copied = ref<Record<string, boolean>>({});
const copyTimers = new Map<string, number>();

const initialMessages: MessageType[] = [
  {
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content: "Can you explain how to use the Vue 3 Composition API effectively?",
      },
    ],
  },
  {
    key: nanoid(),
    from: "assistant",
    sources: [
      {
        href: "https://vuejs.org/guide/introduction.html",
        title: "Vue 3 Documentation - Introduction",
      },
      {
        href: "https://vuejs.org/guide/essentials/reactivity-fundamentals.html",
        title: "Vue 3 Reactivity Fundamentals",
      },
    ],
    tools: [
      {
        name: "mcp",
        description: "Searching Vue 3 documentation",
        status: "input-available",
        parameters: {
          query: "Vue 3 Composition API best practices",
          source: "vuejs.org",
        },
        result: `{
    "query": "Vue 3 Composition API best practices",
    "results": [
      {
        "title": "Reactivity Fundamentals",
        "url": "https://vuejs.org/guide/essentials/reactivity-fundamentals.html",
        "snippet": "Vue's reactivity system is based on tracking reactive state and automatically updating the DOM when that state changes. The core primitives are ref() and reactive()."
      },
      {
        "title": "Composition API: setup()",
        "url": "https://vuejs.org/guide/essentials/composition-api-setup.html",
        "snippet": "The setup() hook is the entry point for using the Composition API in components. It runs before the component is created and is where you declare reactive state and logic."
      },
      {
        "title": "Reactivity Core API",
        "url": "https://vuejs.org/api/reactivity-core.html",
        "snippet": "The reactivity core APIs provide low-level building blocks like ref(), reactive(), computed(), and watch() for creating and working with reactive state."
      }
    ]
  }`,
        error: undefined,
      },
    ],
    versions: [
      {
        id: nanoid(),
        content: `# Vue 3 Composition API Overview

  The Vue 3 Composition API is a powerful way to organize component logic using plain functions and reactive primitives.

  ## Core Concepts

  1. **setup()** is the entry point for using the Composition API in a component.
  2. **ref()** creates a reactive reference for primitive values.
  3. **reactive()** creates a deeply reactive object for structured state.
  4. **computed()** derives values from other reactive state.
  5. **watch() / watchEffect()** run side effects in response to reactive changes.

  ## Basic Example with ref() and computed()

  \`\`\`ts
  import { ref, computed } from 'vue'

  export default {
    setup() {
      const count = ref(0)
      const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2)

      function increment() {
        count.value++
      }

      return {
        count,
        doubled,
        increment,
      }
    },
  }
  export default {
    setup() {
      const count = ref(0)
      const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2)

      function increment() {
        count.value++
      }

      return {
        count,
        doubled,
        increment,
      }
    },
  }
  export default {
    setup() {
      const count = ref(0)
      const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2)

      function increment() {
        count.value++
      }

      return {
        count,
        doubled,
        increment,
      }
    },
  }
  export default {
    setup() {
      const count = ref(0)
      const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2)

      function increment() {
        count.value++
      }

      return {
        count,
        doubled,
        increment,
      }
    },
  }
  export default {
    setup() {
      const count = ref(0)
      const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2)

      function increment() {
        count.value++
      }

      return {
        count,
        doubled,
        increment,
      }
    },
  }
  export default {
    setup() {
      const count = ref(0)
      const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2) const doubled = computed(() => count.value * 2)

      function increment() {
        count.value++
      }

      return {
        count,
        doubled,
        increment,
      }
    },
  }
  \`\`\`

  This component uses the Composition API to declare reactive state and derived values in a single place. Would you like me to dive deeper into a specific function like \`ref\` or \`reactive\`?`,
      },
    ],
  },
];
const { sendMessageStream, tempApiKey, endpoint } = useLlmApi();

const {
  conversations,
  activeConversationId,
  messages,
  sidebarCollapsed,
  createConversation,
  selectConversation,
  deleteConversation,
  toggleSidebar,
  renameConversation,
  markConversationReady,
  updateMessageContent,
  addUserMessage,
  addAssistantPlaceholder,
  clearActiveConversation,
  buildHistory,
} = useChatConversations(initialMessages, endpoint.value);

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
  availableModels.value.find((m) => m.id === modelId.value)
);

const hasMessages = computed(() => messages.value.length > 0);

const sidebarConversations = computed(() =>
  conversations.value.filter((c) => !c.pending)
);

const roleStyles: Record<
  MessageType["from"],
  { label: string; bg: string; ring: string }
> = {
  user: {
    label: "USER",
    bg: "bg-indigo-500",
    ring: "ring-indigo-100",
  },
  assistant: {
    label: "ASSISTANT",
    bg: "bg-emerald-500",
    ring: "ring-emerald-100",
  },
};

const isAssistantMessageReady = (message: MessageType) => {
  if (message.from !== "assistant") return false;
  const latest = message.versions?.[message.versions.length - 1];
  return Boolean(latest?.content?.trim()?.length);
};

watch(
  availableModels,
  (list) => {
    if (!list.length) {
      modelId.value = "";
      return;
    }
    const [firstModel] = list;
    if (!modelId.value || !list.some((m) => m.id === modelId.value)) {
      modelId.value = firstModel?.id ?? "";
    }
  },
  { immediate: true }
);

function formatErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;

  if (err && typeof err === "object") {
    const maybeMsg =
      (err as { message?: unknown; msg?: unknown; error?: unknown }).message ||
      (err as { message?: unknown; msg?: unknown; error?: unknown }).msg ||
      (err as { message?: unknown; msg?: unknown; error?: unknown }).error;
    if (typeof maybeMsg === "string") return maybeMsg;
    if (maybeMsg) return JSON.stringify(maybeMsg);
    try {
      return JSON.stringify(err);
    } catch {
      /* ignore json error */
    }
  }
  return "请求失败";
}

async function requestAssistantReply(
  existingAssistantId?: string,
  presetHistory?: ReturnType<typeof buildHistory>
) {
  const assistantVersionId = existingAssistantId ?? addAssistantPlaceholder();
  const historyBeforeAssistant = presetHistory ?? buildHistory();

  if (!selectedModelData.value) {
    updateMessageContent(assistantVersionId, "未选择模型，无法发送请求");
    status.value = "ready";
    return;
  }

  try {
    status.value = "streaming";
    await sendMessageStream(
      historyBeforeAssistant,
      selectedModelData.value.id,
      tempApiKey.value || undefined,
      (chunk: string) => {
        updateMessageContent(assistantVersionId, chunk || "");
      }
    );
    // 流式完成后，确保最终内容已更新
    const finalMessage = messages.value
      .find((msg) => msg.versions.some((v) => v.id === assistantVersionId))
      ?.versions.find((v) => v.id === assistantVersionId);
    if (!finalMessage?.content) {
      updateMessageContent(assistantVersionId, "（空响应）");
    }
  } catch (err) {
    updateMessageContent(assistantVersionId, formatErrorMessage(err));
  } finally {
    status.value = "ready";
  }
}

function addAssistantVersion(messageKey: string) {
  const target = messages.value.find((msg) => msg.key === messageKey);
  if (!target) return "";
  const newId = `assistant-${Date.now()}`;
  const nextVersion = {
    id: newId,
    content: "",
  };
  target.versions = [...target.versions, nextVersion];
  messages.value = [...messages.value];
  return newId;
}

function handleRetry(messageKey: string) {
  if (!messageKey) return;
  const historyBeforeAssistant = buildHistory();
  const assistantVersionId = addAssistantVersion(messageKey);
  if (!assistantVersionId) return;
  status.value = "submitted";
  requestAssistantReply(assistantVersionId, historyBeforeAssistant);
}

function toggleLike(key: string) {
  liked.value = {
    ...liked.value,
    [key]: !liked.value[key],
  };
}

function toggleDislike(key: string) {
  disliked.value = {
    ...disliked.value,
    [key]: !disliked.value[key],
  };
}

function resetCopied(key: string) {
  copied.value = {
    ...copied.value,
    [key]: false,
  };
  const timerId = copyTimers.get(key);
  if (timerId) {
    clearTimeout(timerId);
    copyTimers.delete(key);
  }
}

function handleCopy(key: string, content: string) {
  if (!content) return;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(content).catch(() => {
      /* ignore copy failures */
    });
  }
  copied.value = {
    ...copied.value,
    [key]: true,
  };
  const timerId = window.setTimeout(() => resetCopied(key), 2500);
  const previous = copyTimers.get(key);
  if (previous) clearTimeout(previous);
  copyTimers.set(key, timerId);
}

async function requestConversationTitleIfFirstMessage(firstUserContent: string) {
  const activeId = activeConversationId.value;
  if (!activeId) return;

  const currentConversation = conversations.value.find((c) => c.id === activeId);
  if (!currentConversation) return;
  if (currentConversation.messages.length > 0 && currentConversation.title !== "新对话") {
    return;
  }

  if (!selectedModelData.value) return;

  let titleDraft = "";
  const titleHistory = [
    {
      role: "system" as const,
      type: "system",
      content: `
你是标题助手。请根据【素材内容】生成 1 个中文概括标题，最多 10 个字。
只输出标题本身一行，不要引号、书名号、序号、前缀或任何说明文字。`,
    },
    {
      role: "user" as const,
      content: `【素材内容】：\n\`\`\`text\n${firstUserContent}\n\`\`\`\n请生成 1 个中文概括标题，直接输出标题本身。`,
    },
  ];

  try {
    await sendMessageStream(
      titleHistory,
      selectedModelData.value.id,
      tempApiKey.value || undefined,
      (chunk: string) => {
        if (chunk) titleDraft += chunk;
      }
    );
    // 基础清洗：去掉换行与首尾空白
    let normalized = titleDraft.replace(/\r?\n/g, "").trim();

    // 额外防御：处理模型偶尔输出的“前两个字重复”情况，例如“一则一则笑话”
    // 只在字符串开头检测，避免误伤正常句子
    const maxUnitLen = 4;
    for (let len = 1; len <= maxUnitLen && len * 2 <= normalized.length; len++) {
      const unit = normalized.slice(0, len);
      if (normalized.startsWith(unit.repeat(2))) {
        normalized = unit + normalized.slice(len * 2);
        break;
      }
    }

    const finalTitle = normalized.slice(0, 10);
    if (finalTitle) {
      renameConversation(activeId, finalTitle);
    }
  } catch {
    // 忽略标题生成错误，不影响正常聊天
  } finally {
    markConversationReady(activeId);
  }
}

async function handleSubmit(message: PromptInputMessage) {
  const text = message.text.trim();
  const hasText = text.length > 0;
  const hasAttachments = message.files.length > 0;

  if (!hasText && !hasAttachments) return;

  const isFirstMessage = messages.value.length === 0;
  const content = hasText ? text : "Sent with attachments";
  if (isFirstMessage) {
    status.value = "submitted";
    await addUserMessage(content, message.files);
    const historyBeforeAssistant = buildHistory();
    const assistantPlaceholderId = addAssistantPlaceholder();
    await requestConversationTitleIfFirstMessage(content);
    await requestAssistantReply(assistantPlaceholderId, historyBeforeAssistant);
  } else {
    status.value = "submitted";
    await addUserMessage(content, message.files);
    const historyBeforeAssistant = buildHistory();
    const assistantPlaceholderId = addAssistantPlaceholder();
    requestAssistantReply(assistantPlaceholderId, historyBeforeAssistant);
  }
}

async function handleSuggestionClick(suggestion: string) {
  status.value = "submitted";
  await addUserMessage(suggestion);
  const historyBeforeAssistant = buildHistory();
  const assistantPlaceholderId = addAssistantPlaceholder();
  requestAssistantReply(assistantPlaceholderId, historyBeforeAssistant);
}

function handleModelSelect(id: string) {
  modelId.value = id;
  modelSelectorOpen.value = false;
}

function toggleMicrophone() {
  useMicrophone.value = !useMicrophone.value;
}

function toggleWebSearch() {
  useWebSearch.value = !useWebSearch.value;
}

function handleClear() {
  clearActiveConversation();
  emit("clear");
}
</script>

<template>
  <div class="h-full w-full overflow-hidden flex flex-col">
    <ChatHeaderActions
      :current-tab="currentTab || 'chat'"
      :has-messages="hasMessages"
      @clear="handleClear"
    />

    <div class="flex h-full w-full">
      <!-- 左侧对话列表侧边栏（两种状态切换） -->
      <ChatSidebar
        :sidebar-collapsed="sidebarCollapsed"
        :conversations="sidebarConversations"
        :active-conversation-id="activeConversationId"
        @toggle:sidebar="toggleSidebar"
        @conversation:create="createConversation"
        @conversation:select="selectConversation"
        @conversation:delete="deleteConversation"
      />

      <!-- 右侧主对话区域 -->
      <div
        class="flex h-full w-full py-4 md:py-6"
        :class="hasMessages ? 'flex-col' : 'items-center justify-center'"
      >
        <div
          class="relative flex h-full w-full overflow-hidden"
          :class="hasMessages ? 'flex-col divide-y' : 'items-center justify-center'"
        >
          <Conversation v-if="hasMessages" class="conversation-content border-none">
            <ConversationContent
              class="mx-auto w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl px-4 select-text"
            >
              <MessageBranch
                v-for="message in messages"
                :key="`${message.key}-${message.versions.length}`"
                :default-branch="Math.max(0, message.versions.length - 1)"
                class="px-4 pb-6 pt-2 md:px-6"
              >
                <MessageBranchContent class="overflow-hidden">
                  <Message
                    v-for="version in message.versions"
                    :key="`${message.key}-${version.id}`"
                    :from="message.from"
                    class="items-start gap-3"
                  >
                    <div
                      class="flex flex-col items-center gap-1.5 shrink-0"
                      :class="
                        message.from === 'user' ? 'order-last pl-1' : 'order-first pr-1'
                      "
                    >
                      <div
                        class="size-11 rounded-full flex items-center justify-center text-white shadow-sm ring-2"
                        :class="[
                          roleStyles[message.from].bg,
                          roleStyles[message.from].ring,
                        ]"
                      >
                        <PersonRound v-if="message.from === 'user'" class="w-5 h-5" />
                        <SmartToyRound v-else class="w-5 h-5" />
                      </div>
                    </div>

                    <div class="flex-1 min-w-0 flex flex-col gap-1">
                      <span
                        class="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase leading-tight"
                        :class="
                          message.from === 'user' ? 'text-right pr-1' : 'text-left pl-1'
                        "
                      >
                        {{ roleStyles[message.from].label }}
                      </span>

                      <Sources v-if="message.sources?.length">
                        <SourcesTrigger :count="message.sources.length" />
                        <SourcesContent>
                          <Source
                            v-for="source in message.sources"
                            :key="source.href"
                            :href="source.href"
                            :title="source.title"
                          />
                        </SourcesContent>
                      </Sources>

                      <Reasoning
                        v-if="message.reasoning"
                        :duration="message.reasoning.duration"
                      >
                        <ReasoningTrigger />
                        <ReasoningContent :content="message.reasoning.content" />
                      </Reasoning>

                      <MessageContent class="max-w-full">
                        <MessageAttachments v-if="version.files?.length" class="mb-2">
                          <MessageAttachment
                            v-for="(file, fileIndex) in version.files"
                            :key="file.url || file.filename || fileIndex"
                            :data="file"
                            class="pointer-events-none"
                          />
                        </MessageAttachments>
                        <div
                          v-if="
                            message.from === 'assistant' &&
                            version?.content?.trim()?.length < 1
                          "
                          class="flex items-center justify-center px-2 py-1 size-full"
                        >
                          <Shimmer>正在生成回复…</Shimmer>
                        </div>

                        <MessageResponse v-else :content="version.content" />
                      </MessageContent>
                    </div>
                  </Message>
                </MessageBranchContent>

                <MessageToolbar
                  v-if="
                    message.from === 'assistant' &&
                    message.versions.length > 1 &&
                    isAssistantMessageReady(message)
                  "
                  class="sticky bottom-0 z-10 backdrop-blur-md"
                >
                  <MessageBranchSelector :from="message.from">
                    <MessageBranchPrevious />
                    <MessageBranchPage />
                    <MessageBranchNext />
                  </MessageBranchSelector>

                  <MessageActions>
                    <MessageAction
                      label="Retry"
                      tooltip="重新生成回复"
                      @click="handleRetry(message.key)"
                    >
                      <RefreshCcwIcon class="size-4" />
                    </MessageAction>
                    <!-- <MessageAction
                      label="Like"
                      tooltip="点赞"
                      @click="toggleLike(message.key)"
                    >
                      <ThumbsUpIcon
                        class="size-4"
                        :fill="liked[message.key] ? 'currentColor' : 'none'"
                      />
                    </MessageAction>
                    <MessageAction
                      label="Dislike"
                      tooltip="点踩"
                      @click="toggleDislike(message.key)"
                    >
                      <ThumbsDownIcon
                        class="size-4"
                        :fill="disliked[message.key] ? 'currentColor' : 'none'"
                      />
                    </MessageAction> -->
                    <MessageAction
                      label="Copy"
                      tooltip="复制内容"
                      @click="
                        handleCopy(
                          message.key,
                          message.versions?.find((v) => v.id)?.content || ''
                        )
                      "
                    >
                      <CheckIcon
                        v-if="copied[message.key]"
                        class="size-4 text-emerald-500"
                      />
                      <CopyIcon v-else class="size-4" />
                    </MessageAction>
                  </MessageActions>
                </MessageToolbar>

                <MessageBranchSelector
                  v-else-if="message.versions.length > 1"
                  :from="message.from"
                >
                  <MessageBranchPrevious />
                  <MessageBranchPage />
                  <MessageBranchNext />
                </MessageBranchSelector>
                <MessageActions
                  v-else-if="
                    message.from === 'assistant' && isAssistantMessageReady(message)
                  "
                  class="pt-2"
                >
                  <MessageAction
                    label="Retry"
                    tooltip="重新生成回复"
                    @click="handleRetry(message.key)"
                  >
                    <RefreshCcwIcon class="size-4" />
                  </MessageAction>
                  <MessageAction
                    label="Like"
                    tooltip="点赞"
                    @click="toggleLike(message.key)"
                  >
                    <ThumbsUpIcon
                      class="size-4"
                      :fill="liked[message.key] ? 'currentColor' : 'none'"
                    />
                  </MessageAction>
                  <MessageAction
                    label="Dislike"
                    tooltip="点踩"
                    @click="toggleDislike(message.key)"
                  >
                    <ThumbsDownIcon
                      class="size-4"
                      :fill="disliked[message.key] ? 'currentColor' : 'none'"
                    />
                  </MessageAction>
                  <MessageAction
                    label="Copy"
                    tooltip="复制内容"
                    @click="
                      handleCopy(
                        message.key,
                        message.versions?.[message.versions.length - 1]?.content || ''
                      )
                    "
                  >
                    <CheckIcon
                      v-if="copied[message.key]"
                      class="size-4 text-emerald-500"
                    />
                    <CopyIcon v-else class="size-4" />
                  </MessageAction>
                </MessageActions>
              </MessageBranch>
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          <div
            class="mx-auto w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl"
            :class="
              hasMessages
                ? 'grid shrink-0 gap-4'
                : 'flex flex-col items-center justify-center'
            "
          >
            <Suggestions v-if="hasMessages" class="px-4 md:px-6">
              <Suggestion
                v-for="suggestion in suggestions"
                :key="suggestion"
                :suggestion="suggestion"
                @click="handleSuggestionClick"
              />
            </Suggestions>

            <div
              class="w-full px-4"
              :class="hasMessages ? 'pb-4 md:px-6 md:pb-6' : 'pb-0'"
            >
              <PromptInput class="w-full" multiple global-drop @submit="handleSubmit">
                <PromptInputHeader>
                  <PromptInputAttachments>
                    <template #default="{ file }">
                      <PromptInputAttachment :file="file" />
                    </template>
                  </PromptInputAttachments>
                </PromptInputHeader>

                <PromptInputBody>
                  <PromptInputTextarea />
                </PromptInputBody>

                <PromptInputFooter>
                  <PromptInputTools>
                    <PromptInputActionMenu>
                      <PromptInputActionMenuTrigger />
                      <PromptInputActionMenuContent>
                        <PromptInputActionAddAttachments />
                      </PromptInputActionMenuContent>
                    </PromptInputActionMenu>

                    <PromptInputButton
                      :variant="useMicrophone ? 'default' : 'ghost'"
                      @click="toggleMicrophone"
                    >
                      <MicRound class="w-4 h-4" />
                      <span class="sr-only">Microphone</span>
                    </PromptInputButton>

                    <PromptInputButton
                      :variant="useWebSearch ? 'default' : 'ghost'"
                      @click="toggleWebSearch"
                    >
                      <SearchRound class="w-4 h-4" />
                      <span>Search</span>
                    </PromptInputButton>

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
                              <ModelSelectorLogo
                                v-if="m.chefSlug"
                                :provider="m.chefSlug"
                              />
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

                  <PromptInputSubmit
                    :disabled="status === 'streaming'"
                    :status="status"
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conversation-content :deep(> div > div) {
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

/* 防止长内容撑出屏幕 */
.conversation-content :deep(p) {
  overflow-wrap: anywhere;
}
</style>
