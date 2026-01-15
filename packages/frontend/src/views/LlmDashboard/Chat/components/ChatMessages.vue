<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import { PersonRound, SmartToyRound } from "@vicons/material";
import { RefreshCcwIcon, CopyIcon, CheckIcon, Loader2Icon } from "lucide-vue-next";
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
import type { MessageType, ContentBlock, MessageVersionStatus } from "@/views/LlmDashboard/Chat/types";
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

// ========== 渐进式加载逻辑 ==========
// 每次加载的对话数（一组对话 = user + assistant）
const CONVERSATIONS_PER_LOAD = 3;
const MESSAGES_PER_LOAD = CONVERSATIONS_PER_LOAD * 2;

// 当前显示的消息数量（从末尾开始计算）
const visibleCount = ref(MESSAGES_PER_LOAD);
const isLoadingMore = ref(false);
const scrollContainerRef = ref<HTMLElement | null>(null);

// 将消息分组为对话（user + assistant 为一组）
const conversationGroups = computed(() => {
  const groups: MessageType[][] = [];
  let currentGroup: MessageType[] = [];
  
  for (const msg of props.messages) {
    currentGroup.push(msg);
    // 当遇到 assistant 消息时，结束当前组
    if (msg.from === 'assistant') {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }
  // 处理未完成的对话（只有 user 消息）
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  return groups;
});

// 计算可见的对话组数量
const visibleGroupCount = computed(() => {
  return Math.ceil(visibleCount.value / 2);
});

// 计算实际显示的消息
const visibleMessages = computed(() => {
  const groups = conversationGroups.value;
  const totalGroups = groups.length;
  const showGroups = Math.min(visibleGroupCount.value, totalGroups);
  
  // 从末尾取 showGroups 组
  const startGroupIndex = Math.max(0, totalGroups - showGroups);
  const visibleGroups = groups.slice(startGroupIndex);
  
  // 展平为消息数组
  return visibleGroups.flat();
});

// 是否还有更多消息可加载
const hasMoreMessages = computed(() => {
  return visibleGroupCount.value < conversationGroups.value.length;
});

// 加载更多消息
function loadMoreMessages() {
  if (!hasMoreMessages.value || isLoadingMore.value) return;
  
  isLoadingMore.value = true;
  
  const container = scrollContainerRef.value;
  if (!container) {
    visibleCount.value += MESSAGES_PER_LOAD;
    isLoadingMore.value = false;
    return;
  }
  
  // 找到当前第一个可见消息元素，用于定位
  const firstMessageEl = container.querySelector('[data-message-branch]') as HTMLElement;
  const firstMessageKey = firstMessageEl?.dataset.messageBranch;
  
  console.log('[loadMore] 当前第一条消息 key:', firstMessageKey);
  console.log('[loadMore] visibleCount before:', visibleCount.value);
  
  // 增加显示数量
  visibleCount.value += MESSAGES_PER_LOAD;
  
  console.log('[loadMore] visibleCount after:', visibleCount.value);
  
  // 等待 DOM 更新后滚动到之前的第一条消息
  nextTick(() => {
    requestAnimationFrame(() => {
      if (firstMessageKey) {
        const targetEl = container.querySelector(`[data-message-branch="${firstMessageKey}"]`) as HTMLElement;
        if (targetEl) {
          console.log('[loadMore] 滚动到元素:', targetEl);
          targetEl.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
        }
      }
      isLoadingMore.value = false;
    });
  });
}

// 监听滚动事件
function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  // 当滚动到顶部附近时加载更多
  if (target.scrollTop < 100 && hasMoreMessages.value && !isLoadingMore.value) {
    loadMoreMessages();
  }
}

// 当消息列表变化时，如果是新消息，保持显示最新的
watch(
  () => props.messages.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      // 新消息到来，确保能看到最新消息
      // 如果当前显示的是最后几条，自动扩展显示范围
      const newMessages = newLen - oldLen;
      if (visibleCount.value < newLen) {
        visibleCount.value = Math.min(visibleCount.value + newMessages, newLen);
      }
    } else if (newLen < oldLen) {
      // 消息被删除，重置显示数量
      visibleCount.value = Math.min(MESSAGES_PER_LOAD, newLen);
    }
  }
);

// 当切换会话时重置
watch(
  () => props.messages[0]?.key,
  () => {
    visibleCount.value = MESSAGES_PER_LOAD;
  }
);

// 获取滚动容器引用
onMounted(() => {
  nextTick(() => {
    // vue-stick-to-bottom 的滚动容器结构
    const conversationEl = document.querySelector('.conversation-content');
    if (conversationEl) {
      // StickToBottom 组件内部的滚动容器通常是第一个有 overflow 的子元素
      const scrollEl = conversationEl.querySelector('[style*="overflow"]') 
        || conversationEl.querySelector('.overflow-y-auto')
        || conversationEl.querySelector('[data-stick-to-bottom-scroll]')
        || conversationEl;
      
      console.log('[mount] 找到滚动容器:', scrollEl);
      console.log('[mount] scrollEl scrollHeight:', (scrollEl as HTMLElement).scrollHeight);
      console.log('[mount] scrollEl clientHeight:', (scrollEl as HTMLElement).clientHeight);
      
      scrollContainerRef.value = scrollEl as HTMLElement;
      scrollEl.addEventListener('scroll', handleScroll);
    }
  });
});

onUnmounted(() => {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.removeEventListener('scroll', handleScroll);
  }
});

// 生成消息的稳定 key
function getMessageKey(message: MessageType, index: number): string {
  return `${message.key}-${index}`;
}

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
    (block) => block.type === "text" && (block as { type: "text"; id: string; content: string }).content.trim().length > 0
  );
};

// 判断是否应该显示 Shimmer（加载状态）
// 当消息是 assistant 且内容块为空或所有文字块都没有实际内容时显示
// 但如果消息状态是 completed、aborted 或 error，则不显示
const shouldShowShimmer = (message: MessageType, contentBlocks: ContentBlock[] | undefined, status?: MessageVersionStatus) => {
  if (message.from !== "assistant") return false;
  
  // 如果消息已完成、已取消或出错，不显示 shimmer
  if (status && status !== "streaming") return false;
  
  // 没有内容块，显示 shimmer
  if (!contentBlocks || contentBlocks.length === 0) return true;
  
  // 检查是否有任何文字块有实际内容
  const hasTextContent = contentBlocks.some(
    (block) => block.type === "text" && (block as { type: "text"; id: string; content: string }).content.trim().length > 0
  );
  
  // 如果没有文字内容，但有工具调用，不显示 shimmer（工具正在执行）
  const hasToolBlocks = contentBlocks.some((block) => block.type === "tool");
  if (hasToolBlocks && !hasTextContent) return false;
  
  // 没有任何实际文字内容，显示 shimmer
  return !hasTextContent;
};

// 获取消息状态显示文本和样式
const getStatusInfo = (status?: MessageVersionStatus, errorMessage?: string): { text: string; icon: string; class: string } | null => {
  switch (status) {
    case "aborted":
      return {
        text: "请求已中断",
        icon: "⚠",
        class: "text-red-600 bg-red-50 border border-red-200"
      };
    case "error":
      return {
        text: errorMessage || "生成失败",
        icon: "⚠",
        class: "text-red-600 bg-red-50 border border-red-200"
      };
    default:
      return null;
  }
};

// 跟踪每个消息的当前选中版本索引
const currentVersionIndex = ref<Record<string, number>>({});

// 跟踪每个消息的版本数量（用于检测新版本）
const versionCounts = ref<Record<string, number>>({});

// 初始化消息的默认版本索引，并在新版本添加时自动切换
watch(
  () => props.messages,
  (newMessages) => {
    newMessages.forEach((message) => {
      if (
        message.from === "assistant" &&
        message.versions &&
        message.versions.length > 0
      ) {
        const currentCount = versionCounts.value[message.key] || 0;
        const newCount = message.versions.length;
        
        // 如果是新消息或版本数量增加，切换到最新版本
        if (!(message.key in currentVersionIndex.value) || newCount > currentCount) {
          currentVersionIndex.value[message.key] = newCount - 1;
        }
        
        // 更新版本数量记录
        versionCounts.value[message.key] = newCount;
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
  const textBlocks = version?.contentBlocks?.filter((b): b is { type: "text"; id: string; content: string } => b.type === "text") || [];
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
          <!-- 加载更多提示 -->
          <div
            v-if="hasMoreMessages"
            class="flex items-center justify-center py-4 text-sm text-slate-400"
          >
            <template v-if="isLoadingMore">
              <Loader2Icon class="size-4 mr-2 animate-spin" />
              加载中...
            </template>
            <button
              v-else
              class="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600"
              @click="loadMoreMessages"
            >
              加载更早的消息
            </button>
          </div>

          <MessageBranch
            v-for="(message, index) in visibleMessages"
            :key="getMessageKey(message, index)"
            :data-message-branch="message.key"
            :default-branch="Math.max(0, (message.versions?.length || 1) - 1)"
            :class="messageBranchPadding"
            @branch-change="(branchIndex) => handleBranchChange(message.key, branchIndex)"
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
                    <div v-if="version.contentBlocks && version.contentBlocks.length > 0" class="space-y-2">

                      <!-- 内容块存在但没有实际文字内容时显示 shimmer 或状态提示 -->
                      <div
                        v-if="shouldShowShimmer(message, version.contentBlocks, version.status)"
                        class="flex items-center justify-start px-1 py-1 size-full"
                      >
                        <Shimmer>正在生成回复…</Shimmer>
                      </div>

                      <template v-else>
                        <!-- 渲染内容块 -->
                        <template v-for="block in version.contentBlocks" :key="block.id">
                          <!-- 文字块 -->
                          <!-- 用户消息不进行 markdown 转换，直接显示纯文本 -->
                          <div
                            v-if="block.type === 'text' && message.from === 'user' && block.content?.trim()"
                            class="whitespace-pre-wrap break-words"
                          >
                            {{ block.content }}
                          </div>

                          <MessageResponse
                            v-else-if="block.type === 'text' && block.content"
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

                        <!-- 在内容后显示取消或错误状态 -->
                        <div
                          v-if="getStatusInfo(version.status, version.errorMessage)"
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs mt-2"
                          :class="getStatusInfo(version.status, version.errorMessage)?.class"
                        >
                          <span>{{ getStatusInfo(version.status, version.errorMessage)?.icon }}</span>
                          <span>{{ getStatusInfo(version.status, version.errorMessage)?.text }}</span>
                        </div>
                      </template>
                      
                    </div>

                    <!-- 如果没有内容块或内容块为空数组，根据状态显示不同内容 -->
                    <div
                      v-else-if="message.from === 'assistant'"
                      class="flex items-center justify-start px-1 py-1 size-full"
                    >
                      <!-- 取消或错误状态 -->
                      <div
                        v-if="getStatusInfo(version.status, version.errorMessage)"
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
                        :class="getStatusInfo(version.status, version.errorMessage)?.class"
                      >
                        <span>{{ getStatusInfo(version.status, version.errorMessage)?.icon }}</span>
                        <span>{{ getStatusInfo(version.status, version.errorMessage)?.text }}</span>
                      </div>
                      <!-- 正在加载 -->
                      <Shimmer v-else>正在生成回复…</Shimmer>
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
