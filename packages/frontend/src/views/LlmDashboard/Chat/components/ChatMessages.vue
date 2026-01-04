<script setup lang="ts">
import { ref, watch, computed } from "vue";
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
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { MessageType } from "@/views/LlmDashboard/Chat/types";
import type { ChatLayoutConfig } from "@/views/LlmDashboard/Chat/hooks/useChatLayout";

const props = defineProps<{
  messages: MessageType[];
  layoutConfig: ChatLayoutConfig;
}>();

const emit = defineEmits<{
  retry: [messageKey: string];
  copy: [messageKey: string];
  branchChange: [messageKey: string, branchIndex: number];
}>();

// 從 props 中解構佈局配置，保持響應式
const isSmallScreen = computed(() => props.layoutConfig.isSmallScreen);
const messageMaxWidth = computed(() => props.layoutConfig.messageMaxWidth);
const messageLayout = computed(() => props.layoutConfig.messageLayout);
const avatarSize = computed(() => props.layoutConfig.avatarSize);
const iconSize = computed(() => props.layoutConfig.iconSize);
const messageBranchPadding = computed(() => props.layoutConfig.messageBranchPadding);
const messageToolbarMargin = computed(() => props.layoutConfig.messageToolbarMargin);
const containerMaxWidth = computed(() => props.layoutConfig.containerMaxWidth);

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
  // 检查是否有内容块，且至少有一个文字块有内容
  if (!latest?.contentBlocks || latest.contentBlocks.length === 0) return false;
  return latest.contentBlocks.some(
    (block) => block.type === "text" && block.content.trim().length > 0
  );
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

  // 从内容块中提取文字内容
  const textBlocks = version?.contentBlocks?.filter((b) => b.type === "text") || [];
  const content = textBlocks.map((b) => b.content).join("\n");

  if (!content) return;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(content).catch(() => {
      /* ignore copy failures */
    });
  }
  emit("copy", messageKey);
}

const copied = ref<Record<string, boolean>>({});

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

                    <!-- 按顺序渲染内容块 -->
                    <div v-if="version.contentBlocks?.length" class="space-y-2">
                      <template v-for="block in version.contentBlocks" :key="block.id">
                        <!-- 文字块 -->
                        <!-- 用户消息不进行 markdown 转换，直接显示纯文本 -->
                        <div
                          v-if="block.type === 'text' && message.from === 'user'"
                          class="whitespace-pre-wrap break-words"
                        >
                          {{ block.content }}
                        </div>
                        <MessageResponse
                          v-else-if="block.type === 'text'"
                          :content="block.content"
                        />

                        <!-- 工具块 -->
                        <Tool v-else-if="block.type === 'tool'">
                          <ToolHeader
                            :type="block.toolCall.type"
                            :state="block.toolCall.state"
                            :title="block.toolCall.type.split('-').slice(1).join(' ')"
                          />
                          <ToolContent>
                            <ToolInput :input="block.toolCall.input" />
                            <ToolOutput
                              v-if="
                                block.toolCall.output !== undefined ||
                                block.toolCall.errorText
                              "
                              :output="block.toolCall.output"
                              :error-text="block.toolCall.errorText"
                            />
                          </ToolContent>
                        </Tool>
                      </template>
                    </div>

                    <!-- 如果没有内容块，显示加载状态 -->
                    <div
                      v-else-if="
                        message.from === 'assistant' &&
                        version.contentBlocks?.length === 0
                      "
                      class="flex items-center justify-start px-1 py-1 size-full"
                    >
                      <Shimmer>正在生成回复…</Shimmer>
                    </div>
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
