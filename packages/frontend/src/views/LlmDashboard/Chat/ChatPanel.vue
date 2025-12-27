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
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  MicRound,
  CheckCircleRound,
  PersonRound,
  SmartToyRound,
} from "@vicons/material";
import {
  CheckIcon,
  CopyIcon,
  RefreshCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  ChevronDown,
  Globe,
  ImageIcon,
  Infinity as InfinityIcon,
  X,
} from "lucide-vue-next";
import {
  computed,
  ref,
  watch,
  defineComponent,
  h,
  onBeforeUnmount,
  nextTick,
} from "vue";
import { useElementSize } from "@vueuse/core";
import { useLlmApi } from "@/hooks/useLlmApi";
import ChatHeaderActions from "./components/ChatHeaderActions.vue";
import ChatSidebar from "./components/ChatSidebar.vue";
import { useChatConversations, type MessageType } from "./useChatConversations";
import { createTitleGenerationPrompt } from "@/prompts/titleGeneration";
import { ImmersiveCode } from "@/components/immersive-code";
import { useToasts } from "@/hooks/useToasts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getModeHandler } from "./modes";
import type { ModeContext, ImmersiveCodeRef } from "./modes/types";

// SVG图标字符串
const browserIconSvg = `<svg t="1766773646500" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15057"><path d="M693.302681 34.952265c68.210189-34.105094 170.11621-57.637609 242.07796 0 71.961749 57.637609 46.723979 186.350235 30.762795 204.630566 9.071955-27.897967 27.352286-128.576206-41.471795-181.711943-63.162635-48.702075-176.459758-27.284075-247.466564 29.193961a409.329342 409.329342 0 0 1 283.276913 459.532041L666.018606 546.52868l0.06821-0.682102a34.241515 34.241515 0 0 1-6.821019 0.682102h-238.73566v13.642037A122.77834 122.77834 0 0 0 653.19509 614.738868h289.552251a409.397552 409.397552 0 0 1-472.833027 263.632379c-72.3028 76.668252-302.580397 199.173751-376.997713 25.30598-24.964929-58.387921-13.573828-209.337069 54.636361-323.043453 30.421744-50.68017 70.392915-103.543066 115.002378-155.51923 55.045622-74.553736 115.88911-137.37532 182.598675-188.532962 9.344796-8.730904 18.689592-17.257178 27.829757-25.64703L488.808536 205.477736c-129.735779 43.24526-259.403347 132.327766-336.958332 214.793884a409.261132 409.261132 0 0 1 481.495722-344.120401C661.380313 54.73322 682.525472 40.40908 693.302681 34.952265zM188.069814 655.869612l-1.773465 2.933038c-33.150152 56.205195-62.821584 182.121204-38.675177 244.874577 44.200202 114.797747 227.139928 38.879808 314.31255-27.284075A409.943234 409.943234 0 0 1 188.001604 655.937822zM543.240266 273.687925a122.77834 122.77834 0 0 0-122.369078 112.683232l-0.409261 10.095108V410.108302h238.73566c2.387357 0 4.706503 0.272841 6.889229 0.682102V396.466265a122.77834 122.77834 0 0 0-112.751442-122.369079L543.240266 273.687925z" fill="currentColor" p-id="15058"></path></svg>`;
const htmlIconSvg = `<svg t="1766772789014"  viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5023"><path d="M89.088 59.392l62.464 803.84c1.024 12.288 9.216 22.528 20.48 25.6L502.784 993.28c6.144 2.048 12.288 2.048 18.432 0l330.752-104.448c11.264-4.096 19.456-14.336 20.48-25.6l62.464-803.84c1.024-17.408-12.288-31.744-29.696-31.744H118.784c-17.408 0-31.744 14.336-29.696 31.744z" fill="#FC490B" p-id="5024"></path><path d="M774.144 309.248h-409.6l12.288 113.664h388.096l-25.6 325.632-227.328 71.68-227.328-71.68-13.312-169.984h118.784v82.944l124.928 33.792 123.904-33.792 10.24-132.096H267.264L241.664 204.8h540.672z" fill="#FFFFFF" p-id="5025"></path></svg>`;

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
const selectedMode = ref<string>("chat");
const status = ref<ChatStatus>("ready");
const showCanvas = ref(true);
const isCanvasReadonly = ref(false);
const liked = ref<Record<string, boolean>>({});
const disliked = ref<Record<string, boolean>>({});
const copied = ref<Record<string, boolean>>({});
const copyTimers = new Map<string, number>();
// 跟踪每个消息的当前选中版本索引
const currentVersionIndex = ref<Record<string, number>>({});

// 当前模式处理器
const currentModeHandler = computed(() => getModeHandler(selectedMode.value));

// ImmersiveCode ref (保留用于将来可能的 API 调用，如 diff、streamWrite 等)
// 在模板中使用，但 TypeScript 可能无法识别
const immersiveCodeRef = ref<InstanceType<typeof ImmersiveCode> | null>(null);
// PromptInputEditor ref (用于插入标签)
const promptInputEditorRef = ref<InstanceType<typeof PromptInputEditor> | null>(
  null
);
const { pushToast } = useToasts();

// 用于动态判断宽度的 ref（参考外层容器）
const conversationContainerRef = ref<HTMLElement | null>(null);
const { width: conversationContainerWidth } = useElementSize(
  conversationContainerRef
);

// 根据宽度判断是否是小屏幕（小于 640px 视为小屏幕）
const isSmallScreen = computed(() => conversationContainerWidth.value < 640);

// 根据宽度动态计算 Message 的最大宽度
const messageMaxWidth = computed(() => {
  return isSmallScreen.value ? "max-w-full" : "max-w-[80%]";
});

// 根据宽度动态计算 Message 的布局方向和对齐方式
const messageLayout = computed(() => {
  if (isSmallScreen.value) {
    // 小屏幕：纵向布局，居中对齐
    return "flex-col items-center";
  }
  // 大屏幕：横向布局，保持原有对齐
  return "flex-row";
});

// 根据宽度和消息来源动态计算头像容器的样式
const getAvatarContainerClass = (from: MessageType["from"]) => {
  if (isSmallScreen.value) {
    // 小屏幕：头像和名称横向布局，在顶部
    // 用户消息：标题在左，头像在右（倒转）
    // 助手消息：头像在左，标题在右（正常）
    const flexDirection = from === "user" ? "flex-row-reverse" : "flex-row";
    return `flex ${flexDirection} items-center gap-2 shrink-0 order-first w-full pb-1`;
  }
  // 大屏幕：头像在左侧或右侧
  return "flex flex-col items-center gap-1.5 shrink-0";
};

// 根据宽度动态计算头像尺寸
const avatarSize = computed(() => {
  return isSmallScreen.value ? "size-8" : "size-11";
});

// 根据宽度动态计算图标尺寸
const iconSize = computed(() => {
  return isSmallScreen.value ? "w-4 h-4" : "w-5 h-5";
});

// 根据宽度动态计算 MessageBranch 的 padding
const messageBranchPadding = computed(() => {
  return isSmallScreen.value ? "px-2 pb-4 pt-2" : "px-4 pb-6 pt-2 md:px-6";
});

// 根据宽度动态计算 MessageToolbar 的负边距和 padding
const messageToolbarMargin = computed(() => {
  const baseClasses = "sticky left-0 z-10 backdrop-blur-md";
  if (isSmallScreen.value) {
    return `${baseClasses} -mx-2 px-2`;
  }
  return `${baseClasses} -mx-4 md:-mx-6 px-4 md:px-6`;
});

// 根据宽度动态计算容器的最大宽度
const containerMaxWidth = computed(() => {
  if (isSmallScreen.value) {
    return "max-w-full";
  }
  return "max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl";
});

const initialMessages: MessageType[] = [
  {
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content:
          "Can you explain how to use the Vue 3 Composition API effectively?",
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
const { sendMessage, sendMessageStream, tempApiKey, endpoint } = useLlmApi();

const {
  conversations,
  activeConversationId,
  activeConversation,
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
  updateConversationMode,
  updateConversationCodeHistory,
  ensureConversationCreated,
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
  const groups = new Map<
    string,
    { heading: string; models: SelectableModel[] }
  >();
  availableModels.value.forEach((m) => {
    if (!groups.has(m.chef)) {
      groups.set(m.chef, { heading: m.chef, models: [] });
    }
    groups.get(m.chef)!.models.push(m);
  });
  return Array.from(groups.values());
});

const conversationModes = [
  {
    value: "agent",
    label: "智能",
    description:
      "Agent 可以在执行任务前进行规划。适用于深度研究、复杂任务或协作工作",
  },
  {
    value: "chat",
    label: "对话",
    description: "直接对话模式。适用于简单问题和快速响应",
  },
  {
    value: "canvas",
    label: "画布",
    description: "可视化工作区模式。用于创建和编辑视觉内容",
  },
  {
    value: "图片",
    label: "图片生成",
    description: "图片处理模式。用于图片分析、编辑和生成",
  },
  {
    value: "视频",
    label: "视频生成",
    description: "视频处理模式。用于视频分析、编辑和处理",
  },
] as const;

const selectedModeLabel = computed(() => {
  const mode = conversationModes.find((m) => m.value === selectedMode.value);
  return mode?.label || "Chat";
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

// 监听模式变化，自动应用 UI 状态并保存到对话
watch(
  selectedMode,
  async (newMode) => {
    const handler = getModeHandler(newMode);
    // 根据模式决定是否显示画布
    if (handler.shouldShowCanvas()) {
      // Canvas 模式：只有当 codeHistory 有 versions 时才显示编辑器
      if (newMode === "canvas") {
        const conversation = activeConversation.value;
        const hasCodeHistory =
          conversation?.codeHistory?.versions &&
          conversation.codeHistory.versions.length > 0;
        showCanvas.value = hasCodeHistory || false;
      } else {
        showCanvas.value = true;
      }
    } else {
      // showCanvas.value = false;
    }

    // 保存模式到当前对话
    if (activeConversationId.value) {
      updateConversationMode(activeConversationId.value, newMode).catch(
        (err) => {
          console.error("保存对话模式失败:", err);
        }
      );
    }
  },
  { immediate: true }
);

// 保存上一次的对话 ID，用于判断是否真的切换了对话
const previousConversationId = ref<string | undefined>(undefined);

// 监听对话切换，恢复模式和代码历史
watch(
  [activeConversationId, () => activeConversation.value],
  async ([newId, conversation]) => {
    if (!newId) return;
    if (!conversation) {
      // 如果对话数据还没加载，等待一下再重试
      await nextTick();
      const retryConversation = activeConversation.value;
      if (!retryConversation) return;
      conversation = retryConversation;
    }

    // 判断是否真的切换了对话（对话 ID 变化）
    const isConversationSwitched = newId !== previousConversationId.value;
    previousConversationId.value = newId;

    // 恢复模式（先设置模式，让组件开始创建）
    if (conversation.mode && conversation.mode !== selectedMode.value) {
      selectedMode.value = conversation.mode;
      // 等待 Vue 完成响应式更新和组件创建
      await nextTick();
      await nextTick();
    }

    // 恢复代码历史（仅在 canvas 模式下，且只有在切换对话时才恢复）
    // 关键：如果只是同一个对话内更新消息（如 addUserMessage），不应该恢复代码历史

    // 检查 codeHistory 是否有 versions
    const hasCodeHistory =
      conversation.codeHistory?.versions &&
      conversation.codeHistory.versions.length > 0;

    if (hasCodeHistory && isConversationSwitched) {
      // 只有当有代码历史时才显示编辑器
      showCanvas.value = true;

      // 等待组件挂载（使用轮询确保组件完全挂载）
      let attempts = 0;
      const maxAttempts = 50; // 最多尝试 50 次，每次 50ms，总共 2.5 秒
      while (attempts < maxAttempts && !immersiveCodeRef.value) {
        await nextTick();
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }

      // 组件挂载后，恢复代码历史（只在切换对话时）
      if (immersiveCodeRef.value && conversation.codeHistory) {
        try {
          immersiveCodeRef.value.setHistory(conversation.codeHistory);
          await nextTick();
        } catch (error) {
          console.error("恢复代码历史失败:", error);
        }
      }
    } else if (!hasCodeHistory) {
      // 如果不是 canvas 模式，清空代码历史显示状态
      showCanvas.value = false;
    }
  },
  { immediate: true }
);

// 监听 ImmersiveCode 组件挂载，如果当前对话是 canvas 模式且有代码历史，自动恢复
watch(
  immersiveCodeRef,
  async (newRef, oldRef) => {
    // 只在组件从 null 变为非 null 时执行（组件刚挂载）
    if (!newRef || oldRef !== null) return;
    if (selectedMode.value !== "canvas") return;
    if (!activeConversationId.value) return;

    const conversation = activeConversation.value;
    if (!conversation || !conversation.codeHistory) return;

    // 检查 codeHistory 是否有 versions
    const hasCodeHistory =
      conversation.codeHistory.versions &&
      conversation.codeHistory.versions.length > 0;
    if (!hasCodeHistory) {
      // 没有代码历史，不显示编辑器
      showCanvas.value = false;
      return;
    }

    // 组件挂载后，恢复代码历史
    try {
      await nextTick();
      newRef.setHistory(conversation.codeHistory);
      await nextTick();
      // 确保显示编辑器
      showCanvas.value = true;
    } catch (error) {
      console.error("恢复代码历史失败:", error);
    }
  },
  { immediate: false }
);

// 保存代码历史到对话（只保存流式写入产生的记录）
function saveCodeHistory() {
  if (!activeConversationId.value || selectedMode.value !== "canvas") return;
  if (!immersiveCodeRef.value) return;

  try {
    const history = immersiveCodeRef.value.getHistory();
    if (history && history.versions.length > 0) {
      // 过滤历史记录：只保留每个版本中最后一个由流式写入产生的记录
      const filteredVersions = history.versions
        .map((version) => {
          // 找到所有流式写入的记录
          const streamingRecords = version.records.filter(
            (r) => r.isStreamingRecord === true
          );

          // 只保留有流式写入记录的版本，且只保留最后一个流式写入记录
          if (streamingRecords.length > 0) {
            const lastStreamingRecord =
              streamingRecords[streamingRecords.length - 1];
            if (lastStreamingRecord) {
              return {
                id: version.id,
                timestamp: version.timestamp,
                label: version.label,
                records: [
                  {
                    id: lastStreamingRecord.id,
                    code: lastStreamingRecord.code,
                    diffTarget: lastStreamingRecord.diffTarget,
                    timestamp: lastStreamingRecord.timestamp,
                  },
                ],
                currentIndex: 0, // 因为只保留一个记录，索引总是 0
              };
            }
          }
          // 如果没有流式写入记录，返回 null（会被 filter 过滤掉）
          return null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null); // 过滤掉没有流式写入记录的版本

      const filteredHistory = {
        versions: filteredVersions,
        currentVersionIndex: history.currentVersionIndex,
      };

      // 只保存有流式写入记录的版本
      if (filteredHistory.versions.length > 0) {
        updateConversationCodeHistory(
          activeConversationId.value!,
          filteredHistory
        ).catch((err) => {
          console.error("保存代码历史失败:", err);
        });
      }
    }
  } catch (error) {
    console.error("获取代码历史失败:", error);
  }
}

// 组件卸载时保存代码历史
onBeforeUnmount(() => {
  saveCodeHistory();
});

// 对话切换时保存当前对话的代码历史
watch(activeConversationId, (_newId, oldId) => {
  // 切换对话前，保存旧对话的代码历史
  if (oldId && selectedMode.value === "canvas") {
    saveCodeHistory();
  }
});

// 初始化消息的默认版本索引
watch(
  messages,
  (newMessages) => {
    newMessages.forEach((message) => {
      if (
        message.from === "assistant" &&
        message.versions.length > 0 &&
        !(message.key in currentVersionIndex.value)
      ) {
        // 初始化默认版本索引为最后一个版本
        currentVersionIndex.value[message.key] = message.versions.length - 1;
      }
    });
  },
  { immediate: true, deep: true }
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

/**
 * 构建模式上下文
 */
function buildModeContext(
  currentUserInput: string,
  userFiles?: Array<{ url?: string; filename?: string; mediaType?: string }>
): ModeContext {
  // 获取当前编辑器代码
  const editorCode = immersiveCodeRef.value?.getCurrentCode() || undefined;

  // 构建 ImmersiveCodeRef 接口
  const immersiveCodeRefAdapter: ImmersiveCodeRef | null =
    immersiveCodeRef.value
      ? {
          getCurrentCode: () => immersiveCodeRef.value!.getCurrentCode(),
          getPreviousVersionCode:
            typeof immersiveCodeRef.value.getPreviousVersionCode === "function"
              ? () => immersiveCodeRef.value!.getPreviousVersionCode!()
              : undefined,
          startStreaming: () => immersiveCodeRef.value!.startStreaming(),
          streamWrite: (code: string) =>
            immersiveCodeRef.value!.streamWrite(code),
          endStreaming: () => immersiveCodeRef.value!.endStreaming(),
          setCodeAndSelectLines:
            typeof immersiveCodeRef.value.setCodeAndSelectLines === "function"
              ? (code: string, startLine: number, endLine: number) =>
                  immersiveCodeRef.value!.setCodeAndSelectLines!(
                    code,
                    startLine,
                    endLine
                  )
              : undefined,
          selectElementInPreview:
            typeof immersiveCodeRef.value.selectElementInPreview === "function"
              ? (selector: string) =>
                  immersiveCodeRef.value!.selectElementInPreview!(selector)
              : undefined,
          addMajorVersion:
            typeof immersiveCodeRef.value.addMajorVersion === "function"
              ? (code?: string, label?: string) =>
                  immersiveCodeRef.value!.addMajorVersion!(code, label)
              : undefined,
        }
      : null;

  return {
    messages: messages.value,
    currentUserInput,
    editorCode,
    uiState: {
      showCanvas: showCanvas.value,
      useWebSearch: useWebSearch.value,
      useMicrophone: useMicrophone.value,
    },
    immersiveCodeRef: immersiveCodeRefAdapter,
    files: userFiles,
    onShowCanvasChange: (show: boolean) => {
      showCanvas.value = show;
    },
    onReadonlyChange: (readonly: boolean) => {
      isCanvasReadonly.value = readonly;
    },
  };
}

async function requestAssistantReply(
  existingAssistantId?: string,
  currentUserInput?: string,
  userFiles?: Array<{ url?: string; filename?: string; mediaType?: string }>
) {
  const assistantVersionId = existingAssistantId ?? addAssistantPlaceholder();
  const handler = currentModeHandler.value;

  // 构建模式上下文
  const modeContext = buildModeContext(currentUserInput || "", userFiles);

  if (!selectedModelData.value) {
    updateMessageContent(assistantVersionId, "未选择模型，无法发送请求");
    status.value = "ready";
    return;
  }

  try {
    // 调用 onBeforeSubmit 钩子
    await handler.onBeforeSubmit(modeContext);

    // 更新 UI 状态（例如 showCanvas）
    if (handler.shouldShowCanvas()) {
      // Canvas 模式：默认显示编辑器（即使代码为空）
      if (selectedMode.value === "canvas") {
        showCanvas.value = true;
      } else {
        showCanvas.value = true;
      }
    }

    // 使用模式处理器构建消息
    const messagesToSend = handler.buildMessages(modeContext);

    status.value = "streaming";
    let fullResponse = "";

    await sendMessageStream(
      messagesToSend,
      selectedModelData.value.id,
      tempApiKey.value || undefined,
      (chunk: string) => {
        fullResponse = chunk;
        // 使用模式处理器处理流式响应
        const displayContent = handler.handleStreamResponse(chunk, modeContext);
        updateMessageContent(assistantVersionId, displayContent || "");
      }
    );

    // 流式完成后，确保最终内容已更新
    const finalMessage = messages.value
      .find((msg) => msg.versions.some((v) => v.id === assistantVersionId))
      ?.versions.find((v) => v.id === assistantVersionId);
    if (!finalMessage?.content) {
      updateMessageContent(assistantVersionId, "（空响应）");
    }

    // 调用 onAfterSubmit 钩子
    await handler.onAfterSubmit(modeContext, fullResponse);

    // 如果是 canvas 模式，检查是否有代码历史，有则显示编辑器并保存代码历史
    if (handler.shouldShowCanvas() && selectedMode.value === "canvas") {
      const currentCode = immersiveCodeRef.value?.getCurrentCode();
      // 如果有代码，保存代码历史
      if (currentCode && currentCode.trim()) {
        // 先检查 ImmersiveCode 组件中的代码历史是否有 versions
        const history = immersiveCodeRef.value?.getHistory();
        const hasCodeHistory = history?.versions && history.versions.length > 0;

        if (hasCodeHistory) {
          // 有代码历史，保存并显示编辑器
          saveCodeHistory();
          showCanvas.value = true;
        } else {
          // 没有代码历史版本，不显示编辑器
          showCanvas.value = false;
        }
      } else {
        // 没有代码，不显示编辑器
        showCanvas.value = false;
      }
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
  // 更新当前版本索引到最新版本，确保复制等功能使用最新版本
  currentVersionIndex.value[messageKey] = target.versions.length - 1;
  return newId;
}

function handleRetry(messageKey: string) {
  if (!messageKey) return;
  // 找到要重试的用户消息
  const targetMessage = messages.value.find((msg) => msg.key === messageKey);
  if (!targetMessage) return;
  const latestVersion =
    targetMessage.versions[targetMessage.versions.length - 1];
  if (!latestVersion) return;

  const assistantVersionId = addAssistantVersion(messageKey);
  if (!assistantVersionId) return;
  status.value = "submitted";

  // 获取用户消息的内容和文件
  const userFiles = latestVersion.files?.map((f) => ({
    url: f.url,
    filename: f.filename,
    mediaType: f.mediaType,
  }));

  requestAssistantReply(assistantVersionId, latestVersion.content, userFiles);
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

function handleBranchChange(messageKey: string, branchIndex: number) {
  const message = messages.value.find((msg) => msg.key === messageKey);
  if (!message || message.versions.length === 0) return;

  // 确保索引在有效范围内
  const validIndex = Math.max(
    0,
    Math.min(branchIndex, message.versions.length - 1)
  );
  currentVersionIndex.value[messageKey] = validIndex;
}

function handleCopy(messageKey: string) {
  const message = messages.value.find((msg) => msg.key === messageKey);
  if (!message || message.versions.length === 0) return;

  // 获取当前选中的版本索引，如果没有则使用最后一个版本
  let selectedIndex =
    currentVersionIndex.value[messageKey] ?? message.versions.length - 1;
  // 确保索引在有效范围内
  selectedIndex = Math.max(
    0,
    Math.min(selectedIndex, message.versions.length - 1)
  );
  const version = message.versions[selectedIndex];
  const content = version?.content || "";

  if (!content) return;
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(content).catch(() => {
      /* ignore copy failures */
    });
  }
  copied.value = {
    ...copied.value,
    [messageKey]: true,
  };
  const timerId = window.setTimeout(() => resetCopied(messageKey), 2500);
  const previous = copyTimers.get(messageKey);
  if (previous) clearTimeout(previous);
  copyTimers.set(messageKey, timerId);
}

async function requestConversationTitleIfFirstMessage(
  firstUserContent: string
) {
  const activeId = activeConversationId.value;
  if (!activeId) return;

  const currentConversation = conversations.value.find(
    (c) => c.id === activeId
  );
  if (!currentConversation) return;
  if (
    currentConversation.messages.length > 0 &&
    currentConversation.title !== "新对话"
  ) {
    return;
  }

  // 如果对话是 pending 状态，先确保在服务器上创建对话
  if (currentConversation.pending) {
    try {
      await ensureConversationCreated(activeId);
    } catch (err) {
      console.error("创建对话失败:", err);
      // 即使创建失败，也继续尝试生成标题
    }
  }

  if (!selectedModelData.value) return;

  let titleDraft = "";
  const titleHistory = createTitleGenerationPrompt(firstUserContent);

  try {
    const response = await sendMessage(
      titleHistory,
      selectedModelData.value.id,
      tempApiKey.value || undefined
    );
    titleDraft = typeof response.content === "string" ? response.content : "";
    // 基础清洗：去掉换行与首尾空白
    let normalized = titleDraft.replace(/\r?\n/g, "").trim();

    // 额外防御：处理模型偶尔输出的"前两个字重复"情况，例如"一则一则笑话"
    // 只在字符串开头检测，避免误伤正常句子
    const maxUnitLen = 4;
    for (
      let len = 1;
      len <= maxUnitLen && len * 2 <= normalized.length;
      len++
    ) {
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

  // 转换文件格式
  const userFiles = message.files.map((f) => ({
    url: f.url,
    filename: f.filename,
    mediaType: f.mediaType,
  }));

  if (isFirstMessage) {
    status.value = "submitted";
    await addUserMessage(content, message.files);
    const assistantPlaceholderId = addAssistantPlaceholder();
    await requestConversationTitleIfFirstMessage(content);
    await requestAssistantReply(assistantPlaceholderId, content, userFiles);
  } else {
    status.value = "submitted";
    await addUserMessage(content, message.files);
    const assistantPlaceholderId = addAssistantPlaceholder();
    await requestAssistantReply(assistantPlaceholderId, content, userFiles);
  }
}

async function handleSuggestionClick(suggestion: string) {
  status.value = "submitted";
  await addUserMessage(suggestion);
  const assistantPlaceholderId = addAssistantPlaceholder();
  requestAssistantReply(assistantPlaceholderId, suggestion);
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

function handleImmersiveError(message: string) {
  pushToast(`错误: ${message}`, "error");
}

function handleElementSelected(selector: string, data?: any) {
  console.log("=== 选中元素信息 ===");
  console.log("选择器 (Selector):", selector);
  if (data) {
    console.log("标签名 (Tag):", data.tagName);
    console.log("ID:", data.id || "(无)");
    console.log(
      "类名 (Classes):",
      data.classList.length > 0 ? data.classList : "(无)"
    );
    console.log("文本内容 (Text):", data.textContent || "(无)");
    console.log("位置信息 (Position):", data.position);
    console.log("样式信息 (Styles):", data.styles);
    console.log("属性 (Attributes):", data.attributes);
    console.log("完整数据对象:", data);
  }
  console.log("===================");

  // 插入元素选择器标签到输入框
  if (promptInputEditorRef.value?.insertTag) {
    promptInputEditorRef.value.insertTag({
      id: `element-ref-${Date.now()}`,
      label: data?.tagName || "Element",
      icon: browserIconSvg,
      tagType: "browser", // 浏览器选择的标签类型
      data: {
        text: selector,
        selector: selector,
        tagName: data?.tagName,
        id: data?.id,
        classList: data?.classList,
        textContent: data?.textContent,
        position: data?.position,
        styles: data?.styles,
        attributes: data?.attributes,
      },
    });
  }

  // 访问 ref 以确保 TypeScript 识别其使用
  if (immersiveCodeRef.value) {
    // ref 已挂载，可用于将来的 API 调用
  }
}

function handleCtrlIPressed(data: {
  code: string;
  startLine: number;
  endLine: number;
  fileName?: string;
}) {
  console.log("=== Ctrl+I 按下 ===");
  console.log("开始行 (Start Line):", data.startLine);
  console.log("结束行 (End Line):", data.endLine);
  console.log("代码内容长度:", data.code.length, "字符");
  console.log("===================");

  // 插入代码引用标签到输入框
  if (promptInputEditorRef.value?.insertTag) {
    const fileName = data.fileName || "index.html";
    // 生成标签文本: @文件名(开始行-结束行) 或 @文件名(行号)
    const lineInfo =
      data.startLine === data.endLine
        ? `${data.startLine}`
        : `${data.startLine}-${data.endLine}`;
    const tagText = `@${fileName}(${lineInfo})`;

    promptInputEditorRef.value.insertTag({
      id: `code-ref-${Date.now()}`,
      label: tagText.slice(1),
      icon: htmlIconSvg,
      data: {
        text: tagText,
        code: data.code,
        startLine: data.startLine,
        endLine: data.endLine,
        fileName: fileName,
      },
    });
  }
}

function handleTagClick(data: {
  id: string;
  label: string;
  icon?: string;
  data?: Record<string, any>;
}) {
  console.log("=== 标签点击信息 ===");
  console.log("标签 ID:", data.id);
  console.log("标签文本:", data.label);
  console.log("标签图标:", data.icon || "(无)");
  console.log("标签数据:", data.data || "(无)");
  console.log("完整标签对象:", data);
  console.log("===================");

  // 如果是代码标签，处理代码跳转
  if (data.data?.code && data.data?.startLine && data.data?.endLine) {
    const { code, startLine, endLine } = data.data;

    // 确保 ImmersiveCode 组件可见
    if (!showCanvas.value) {
      showCanvas.value = true;
    }

    // 调用 ImmersiveCode 的方法来设置代码、选中行并滚动
    if (immersiveCodeRef.value?.setCodeAndSelectLines) {
      immersiveCodeRef.value.setCodeAndSelectLines(code, startLine, endLine);
    } else {
      console.warn(
        "⚠️ [ChatPanel] ImmersiveCode ref not ready or method not available"
      );
    }
  }

  // 如果是浏览器标签（元素选择器标签），处理预览跳转
  // 检测条件：有 selector 字段，或者 icon 包含浏览器相关的标识
  if (
    data.data?.selector ||
    (data.icon &&
      typeof data.icon === "string" &&
      data.icon.includes("browser"))
  ) {
    const selector = data.data?.selector || data.data?.text || data.label;

    if (!selector) {
      console.warn("⚠️ [ChatPanel] No selector found in browser tag data");
      return;
    }

    // 确保 ImmersiveCode 组件可见
    if (!showCanvas.value) {
      showCanvas.value = true;
    }

    // 调用 ImmersiveCode 的方法来切换到预览模式并选中元素
    if (immersiveCodeRef.value?.selectElementInPreview) {
      immersiveCodeRef.value.selectElementInPreview(selector);
    } else {
      console.warn(
        "⚠️ [ChatPanel] ImmersiveCode ref not ready or method not available"
      );
    }
  }
}

// 文件上传按钮组件（必须在 PromptInput 内部使用）
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
      <div class="flex h-full w-full flex-1 overflow-hidden">
        <!-- 左侧对话区域 -->
        <div
          ref="conversationContainerRef"
          class="flex h-full w-full py-4 md:py-6 overflow-hidden"
          :class="[
            hasMessages ? 'flex-col' : 'items-center justify-center',
            `model-${selectedMode}`,
          ]"
        >
          <div
            class="relative flex h-full w-full overflow-hidden"
            :class="
              hasMessages ? 'flex-col divide-y' : 'items-center justify-center'
            "
          >
            <Conversation
              v-if="hasMessages"
              class="conversation-content border-none"
            >
              <ConversationContent
                :class="['mx-auto w-full px-4 select-text', containerMaxWidth]"
              >
                <MessageBranch
                  v-for="message in messages"
                  :key="`${message.key}-${message.versions.length}`"
                  :default-branch="Math.max(0, message.versions.length - 1)"
                  :class="messageBranchPadding"
                  @branch-change="
                    (index) => handleBranchChange(message.key, index)
                  "
                >
                  <!-- 允许 Grid 子元素缩小到比内容更小的尺寸 Message 的 max-w-[80%] 限制才能生效 -->
                  <MessageBranchContent class="min-w-0">
                    <Message
                      v-for="version in message.versions"
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
                            (message.from === 'user'
                              ? 'order-last pl-1'
                              : 'order-first pr-1'),
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
                          <PersonRound
                            v-if="message.from === 'user'"
                            :class="iconSize"
                          />
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
                            message.from === 'user'
                              ? 'text-right pr-1'
                              : 'text-left pl-1'
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
                          <ReasoningContent
                            :content="message.reasoning.content"
                          />
                        </Reasoning>

                        <MessageContent class="max-w-full">
                          <MessageAttachments
                            v-if="version.files?.length"
                            class="mb-2"
                          >
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

                  <!-- 统一的工具栏：多个版本时显示完整工具栏（包含分支选择器和操作按钮） -->
                  <MessageToolbar
                    v-if="message.from === 'assistant'"
                    :class="messageToolbarMargin"
                  >
                    <MessageBranchSelector
                      v-if="
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
                        message.versions.length > 1 &&
                        !(
                          message.from === 'assistant' &&
                          isAssistantMessageReady(message)
                        )
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
                        @click="handleCopy(message.key)"
                      >
                        <CheckIcon
                          v-if="copied[message.key]"
                          class="size-4 text-emerald-500"
                        />
                        <CopyIcon v-else class="size-4" />
                      </MessageAction>
                    </MessageActions>
                  </MessageToolbar>
                </MessageBranch>
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>

            <div
              :class="[
                'mx-auto w-full ',
                containerMaxWidth,
                hasMessages
                  ? 'grid shrink-0 gap-4'
                  : 'flex flex-col items-center justify-center',
              ]"
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
                :class="hasMessages ? 'md:px-6' : 'pb-0'"
              >
                <PromptInput
                  class="w-full"
                  multiple
                  global-drop
                  @submit="handleSubmit"
                >
                  <PromptInputHeader>
                    <PromptInputAttachments>
                      <template #default="{ file }">
                        <PromptInputAttachment :file="file" />
                      </template>
                    </PromptInputAttachments>
                  </PromptInputHeader>

                  <PromptInputBody>
                    <PromptInputEditor
                      ref="promptInputEditorRef"
                      @tag-click="handleTagClick"
                    />
                  </PromptInputBody>

                  <PromptInputFooter>
                    <PromptInputTools>
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <PromptInputButton
                            class="gap-1.5 bg-gray-200 hover:bg-gray-300"
                          >
                            <InfinityIcon class="w-4 h-4" />
                            <span class="font-medium">{{
                              selectedModeLabel
                            }}</span>
                            <ChevronDown class="w-3.5 h-3.5 opacity-50" />
                          </PromptInputButton>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="start"
                          class="min-w-[320px] w-[320px] p-2"
                        >
                          <DropdownMenuLabel
                            class="px-3 py-2 text-sm font-semibold text-foreground"
                          >
                            对话模式
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator class="my-1" />
                          <DropdownMenuRadioGroup
                            v-model="selectedMode"
                            class="flex flex-col gap-1"
                          >
                            <DropdownMenuRadioItem
                              v-for="mode in conversationModes"
                              :key="mode.value"
                              :value="mode.value"
                              :class="[
                                'flex! flex-col! items-start! gap-1! py-3! px-3! pl-3! rounded-sm! [&>span.absolute]:hidden',
                                selectedMode === mode.value ? 'bg-accent' : '',
                              ]"
                            >
                              <div class="flex flex-col gap-1 w-full">
                                <span class="font-medium text-sm">{{
                                  mode.label
                                }}</span>
                                <span
                                  class="text-xs text-muted-foreground leading-relaxed"
                                >
                                  {{ mode.description }}
                                </span>
                              </div>
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>

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
                            <ModelSelectorEmpty
                              >No models found.</ModelSelectorEmpty
                            >

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
                                <ModelSelectorName>{{
                                  m.name
                                }}</ModelSelectorName>
                                <ModelSelectorLogoGroup
                                  v-if="m.providers?.length"
                                >
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
                        @click="toggleWebSearch"
                      >
                        <Globe class="w-4 h-4" />
                      </PromptInputButton>

                      <PromptInputSubmit
                        :disabled="status === 'streaming'"
                        :status="status"
                      />
                    </div>
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </div>
        </div>

        <template v-if="selectedMode === 'canvas'">
          <!-- 右侧 ImmersiveCode 区域 -->
          <div
            v-show="showCanvas"
            class="shrink-0 w-2/3 h-full flex flex-col overflow-hidden p-2"
          >
            <div class="h-full w-full">
              <ImmersiveCode
                ref="immersiveCodeRef"
                :enable-share="false"
                :readonly="isCanvasReadonly"
                @error="handleImmersiveError"
                @element-selected="handleElementSelected"
                @ctrl-i-pressed="handleCtrlIPressed"
                class="immersive-code-full-height"
              >
                <template #right-actions>
                  <button
                    @click="showCanvas = false"
                    class="p-1.5 text-slate-400 hover:text-slate-600 transition rounded"
                    title="关闭画布"
                  >
                    <X class="w-4 h-4" />
                  </button>
                </template>
              </ImmersiveCode>
            </div>
          </div>
        </template>
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

.model-canvas :deep(.custom-code-block__body) {
  max-height: 100px;
  overflow-y: auto;
  padding: 10px;
  padding-bottom: 0;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.model-canvas :deep(.custom-code-block__body pre) {
  padding: 0;
  border: none;
  padding-bottom: 10px;
}
</style>
