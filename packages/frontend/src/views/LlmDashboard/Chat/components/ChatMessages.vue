<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useElementSize } from "@vueuse/core";
import { PersonRound, SmartToyRound } from "@vicons/material";
import { RefreshCcwIcon, CopyIcon, CheckIcon } from "lucide-vue-next";
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
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { MessageType } from "@/views/LlmDashboard/Chat/types";

const props = defineProps<{
  messages: MessageType[];
}>();

const emit = defineEmits<{
  retry: [messageKey: string];
  copy: [messageKey: string];
  branchChange: [messageKey: string, branchIndex: number];
}>();

// 容器引用，用于响应式布局
const conversationContainerRef = ref<HTMLElement | null>(null);
const { width: conversationContainerWidth } = useElementSize(conversationContainerRef);

// 响应式布局计算
const isSmallScreen = computed(() => conversationContainerWidth.value < 640);
const messageMaxWidth = computed(() =>
  isSmallScreen.value ? "max-w-full" : "max-w-[80%]"
);
const messageLayout = computed(() =>
  isSmallScreen.value ? "flex-col items-center" : "flex-row"
);
const avatarSize = computed(() => (isSmallScreen.value ? "size-8" : "size-11"));
const iconSize = computed(() => (isSmallScreen.value ? "w-4 h-4" : "w-5 h-5"));
const messageBranchPadding = computed(() =>
  isSmallScreen.value ? "px-2 pb-4 pt-2" : "px-4 pb-6 pt-2 md:px-6"
);
const messageToolbarMargin = computed(() => {
  const baseClasses = "sticky left-0 z-10 backdrop-blur-md";
  return isSmallScreen.value
    ? `${baseClasses} -mx-2 px-2`
    : `${baseClasses} -mx-4 md:-mx-6 px-4 md:px-6`;
});
const containerMaxWidth = computed(() =>
  isSmallScreen.value
    ? "max-w-full"
    : "max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl"
);

// 角色样式
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

// 获取头像容器类
const getAvatarContainerClass = (from: MessageType["from"]) => {
  if (isSmallScreen.value) {
    const flexDirection = from === "user" ? "flex-row-reverse" : "flex-row";
    return `flex ${flexDirection} items-center gap-2 shrink-0 order-first w-full pb-1`;
  }
  return "flex flex-col items-center gap-1.5 shrink-0";
};

// 判断助手消息是否就绪
const isAssistantMessageReady = (message: MessageType) => {
  if (message.from !== "assistant") return false;
  if (!message.versions || message.versions.length === 0) return false;
  const latest = message.versions[message.versions.length - 1];
  return Boolean(latest?.content?.trim()?.length);
};

// 跟踪每个消息的当前选中版本索引
const currentVersionIndex = ref<Record<string, number>>({});

// 初始化消息的默认版本索引
watch(
  () => props.messages,
  (newMessages) => {
    newMessages.forEach((message) => {
      if (
        message.from === "assistant" &&
        message.versions &&
        message.versions.length > 0 &&
        !(message.key in currentVersionIndex.value)
      ) {
        currentVersionIndex.value[message.key] = message.versions.length - 1;
      }
    });
  },
  { immediate: true, deep: true }
);

function handleBranchChange(messageKey: string, branchIndex: number) {
  const message = props.messages.find((msg) => msg.key === messageKey);
  if (!message || !message.versions || message.versions.length === 0) return;

  const validIndex = Math.max(0, Math.min(branchIndex, message.versions.length - 1));
  currentVersionIndex.value[messageKey] = validIndex;
  emit("branchChange", messageKey, validIndex);
}

function handleCopy(messageKey: string) {
  const message = props.messages.find((msg) => msg.key === messageKey);
  if (!message || !message.versions || message.versions.length === 0) return;

  let selectedIndex =
    currentVersionIndex.value[messageKey] ?? message.versions.length - 1;
  selectedIndex = Math.max(0, Math.min(selectedIndex, message.versions.length - 1));
  const version = message.versions[selectedIndex];
  const content = version?.content || "";

  if (!content) return;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(content).catch(() => {
      /* ignore copy failures */
    });
  }
  emit("copy", messageKey);
}

const copied = ref<Record<string, boolean>>({});
const copyTimers = new Map<string, number>();

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

// 监听 copy 事件，显示复制成功状态
watch(
  () => props.messages,
  () => {
    // 当消息变化时，重置复制状态
  },
  { deep: true }
);
</script>

<template>
  <div
    ref="conversationContainerRef"
    class="flex h-full w-full py-4 md:py-6 overflow-hidden"
    :class="[messages.length > 0 ? 'flex-col' : 'items-center justify-center']"
  >
    <div
      class="relative flex h-full w-full overflow-hidden"
      :class="messages.length > 0 ? 'flex-col divide-y' : 'items-center justify-center'"
    >
      <Conversation v-if="messages.length > 0" class="conversation-content border-none">
        <ConversationContent
          :class="['mx-auto w-full px-4 select-text', containerMaxWidth]"
        >
          <MessageBranch
            v-for="message in messages"
            :key="`${message.key}-${message.versions?.length || 0}`"
            :default-branch="Math.max(0, (message.versions?.length || 1) - 1)"
            :class="messageBranchPadding"
            @branch-change="(index) => handleBranchChange(message.key, index)"
          >
            <MessageBranchContent class="min-w-0">
              <Message
                v-for="version in message.versions || []"
                :key="`${message.key}-${version.id}`"
                :from="message.from"
                :max-width="messageMaxWidth"
                :class="[
                  'gap-3',
                  messageLayout,
                  isSmallScreen ? 'ml-0! justify-center!' : '',
                ]"
              >
                <div
                  :class="[
                    getAvatarContainerClass(message.from),
                    !isSmallScreen &&
                      (message.from === 'user' ? 'order-last pl-1' : 'order-first pr-1'),
                  ]"
                >
                  <div
                    :class="[
                      avatarSize,
                      'rounded-full flex items-center justify-center text-white shadow-sm ring-2',
                      roleStyles[message.from].bg,
                      roleStyles[message.from].ring,
                    ]"
                  >
                    <PersonRound v-if="message.from === 'user'" :class="iconSize" />
                    <SmartToyRound v-else :class="iconSize" />
                  </div>
                  <span
                    v-if="isSmallScreen"
                    class="text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase leading-tight"
                  >
                    {{ roleStyles[message.from].label }}
                  </span>
                </div>

                <div
                  :class="[
                    'flex flex-col gap-1',
                    isSmallScreen ? 'w-full min-w-0' : 'flex-1 min-w-0',
                  ]"
                >
                  <span
                    v-if="!isSmallScreen"
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
              v-if="message.from === 'assistant'"
              :class="messageToolbarMargin"
            >
              <MessageBranchSelector
                v-if="
                  message.versions &&
                  message.versions.length > 1 &&
                  isAssistantMessageReady(message)
                "
                :from="message.from"
              >
                <MessageBranchPrevious />
                <MessageBranchPage />
                <MessageBranchNext />
              </MessageBranchSelector>

              <MessageBranchSelector
                v-else-if="
                  message.versions &&
                  message.versions.length > 1 &&
                  !(message.from === 'assistant' && isAssistantMessageReady(message))
                "
                :from="message.from"
              >
                <MessageBranchPrevious />
                <MessageBranchPage />
                <MessageBranchNext />
              </MessageBranchSelector>

              <div v-else></div>

              <MessageActions>
                <MessageAction
                  label="Retry"
                  tooltip="重新生成回复"
                  @click="emit('retry', message.key)"
                >
                  <RefreshCcwIcon class="size-4" />
                </MessageAction>
                <MessageAction
                  label="Copy"
                  tooltip="复制内容"
                  @click="handleCopy(message.key)"
                >
                  <CheckIcon v-if="copied[message.key]" class="size-4 text-emerald-500" />
                  <CopyIcon v-else class="size-4" />
                </MessageAction>
              </MessageActions>
            </MessageToolbar>
          </MessageBranch>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  </div>
</template>

<style scoped>
.conversation-content :deep(> div > div) {
  overflow-x: hidden !important;
  overflow-y: auto !important;
}

.conversation-content :deep(p) {
  overflow-wrap: anywhere;
}
</style>
