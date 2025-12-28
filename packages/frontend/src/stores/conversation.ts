import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useLocalStorage } from "@vueuse/core";
import { nanoid } from "nanoid";
import type { FileUIPart } from "ai";
import type {
  Conversation,
  MessageType,
  ApiConversation,
  ApiMessage,
  ConversationMode,
  CodeHistory,
} from "@/views/LlmDashboard/Chat/types";

/**
 * 本地存储键名
 */
const ACTIVE_CONVERSATION_KEY = "llm_active_conversation_id";
const SIDEBAR_COLLAPSED_KEY = "llm_sidebar_collapsed";

/**
 * 将 API 消息格式转换为 UI 消息格式
 */
function apiMessageToMessageType(apiMessage: ApiMessage, index: number): MessageType {
  return {
    key: apiMessage.messageKey,
    from: apiMessage.role,
    versions: apiMessage.versions.map((v) => ({
      id: v.id,
      content: v.content || "",
    })),
  };
}

/**
 * 将 API 对话格式转换为 UI 对话格式
 */
function apiConversationToConversation(apiConversation: ApiConversation): Conversation {
  return {
    id: apiConversation.id,
    title: apiConversation.title,
    createdAt: apiConversation.createdAt,
    updatedAt: apiConversation.updatedAt,
    mode: apiConversation.mode,
    // 对话列表接口可能不包含 messages，需要处理这种情况
    messages: (apiConversation.messages || []).map((msg, index) =>
      apiMessageToMessageType(msg, index)
    ),
    codeHistory: apiConversation.codeHistory,
  };
}

/**
 * 对话状态管理 Store
 */
export const useConversationStore = defineStore("conversation", () => {
  // 对话列表
  const conversations = ref<Conversation[]>([]);

  // 当前活跃对话 ID（使用 localStorage 持久化）
  const activeConversationId = useLocalStorage<string | undefined>(
    ACTIVE_CONVERSATION_KEY,
    undefined
  );

  // 侧边栏折叠状态（使用 localStorage 持久化）
  const sidebarCollapsed = useLocalStorage<boolean>(SIDEBAR_COLLAPSED_KEY, false);

  // 加载状态
  const loading = ref<boolean>(false);

  // 错误信息
  const error = ref<string | null>(null);

  // 计算属性：当前活跃对话
  const activeConversation = computed<Conversation | undefined>(() =>
    conversations.value.find((c) => c.id === activeConversationId.value)
  );

  // 计算属性：当前活跃对话的消息
  const activeMessages = computed<MessageType[]>(() => {
    return activeConversation.value?.messages || [];
  });

  // 计算属性：侧边栏对话列表（过滤掉 pending 状态的对话）
  const sidebarConversations = computed<Conversation[]>(() =>
    conversations.value.filter((c) => !c.pending)
  );

  /**
   * 设置对话列表
   */
  function setConversations(newConversations: ApiConversation[]) {
    conversations.value = newConversations.map(apiConversationToConversation);
  }

  /**
   * 添加或更新对话
   */
  function upsertConversation(apiConversation: ApiConversation) {
    const conversation = apiConversationToConversation(apiConversation);
    const index = conversations.value.findIndex((c) => c.id === conversation.id);

    if (index >= 0) {
      conversations.value[index] = conversation;
    } else {
      conversations.value.unshift(conversation);
    }
  }

  /**
   * 更新对话消息
   */
  function updateConversationMessage(
    conversationId: string,
    requestId: string,
    content: string,
    _isRequesting: boolean = false
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    // 查找或创建对应的消息
    let message = conversation.messages.find((msg) =>
      msg.versions.some((v) => v.id === requestId)
    );

    if (!message) {
      // 创建新的 assistant 消息
      message = {
        key: requestId,
        from: "assistant",
        versions: [
          {
            id: requestId,
            content: "",
          },
        ],
      };
      conversation.messages.push(message);
    }

    // 更新消息内容
    const version = message.versions.find((v) => v.id === requestId);
    if (version) {
      version.content = content;
    } else {
      message.versions.push({
        id: requestId,
        content,
      });
    }

    // 更新对话的更新时间
    conversation.updatedAt = Date.now();
  }

  /**
   * 添加用户消息
   */
  function addUserMessage(
    conversationId: string,
    content: string,
    files?: Array<{ url?: string; filename?: string; mediaType?: string }>
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    const messageId = `user-${Date.now()}`;
    const userMessage: MessageType = {
      key: messageId,
      from: "user",
      versions: [
        {
          id: messageId,
          content,
          files: files
            ?.filter((f) => f.url || f.filename)
            .map((f) => ({
              type: "file" as const,
              url: f.url || "",
              filename: f.filename || "",
              mediaType: f.mediaType || "application/octet-stream",
            })) as FileUIPart[] | undefined,
        },
      ],
    };

    conversation.messages.push(userMessage);
    conversation.updatedAt = Date.now();
  }

  /**
   * 添加 assistant 占位消息（用于流式响应）
   */
  function addAssistantPlaceholder(conversationId: string, requestId: string) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    const assistantMessage: MessageType = {
      key: requestId,
      from: "assistant",
      versions: [
        {
          id: requestId,
          content: "",
        },
      ],
    };

    conversation.messages.push(assistantMessage);
    conversation.updatedAt = Date.now();
  }

  /**
   * 更新对话标题
   */
  function updateConversationTitle(conversationId: string, title: string) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = Date.now();
    }
  }

  /**
   * 更新对话模式
   */
  function updateConversationMode(conversationId: string, mode: ConversationMode) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.mode = mode;
      conversation.updatedAt = Date.now();
    }
  }

  /**
   * 更新对话代码历史
   */
  function updateConversationCodeHistory(
    conversationId: string,
    codeHistory: CodeHistory | undefined
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.codeHistory = codeHistory;
      conversation.updatedAt = Date.now();
    }
  }

  /**
   * 删除对话
   */
  function removeConversation(conversationId: string) {
    conversations.value = conversations.value.filter((c) => c.id !== conversationId);

    // 如果删除的是当前活跃对话，切换到第一个对话
    if (activeConversationId.value === conversationId) {
      const firstConversation = conversations.value[0];
      if (firstConversation) {
        activeConversationId.value = firstConversation.id;
      } else {
        activeConversationId.value = undefined;
      }
    }
  }

  /**
   * 设置活跃对话
   */
  function setActiveConversationId(id: string | undefined) {
    activeConversationId.value = id;
  }

  /**
   * 切换侧边栏折叠状态
   */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  /**
   * 设置加载状态
   */
  function setLoading(value: boolean) {
    loading.value = value;
  }

  /**
   * 设置错误信息
   */
  function setError(message: string | null) {
    error.value = message;
  }

  /**
   * 清空当前对话的消息
   */
  function clearActiveConversationMessages() {
    if (activeConversation.value) {
      activeConversation.value.messages = [];
      activeConversation.value.updatedAt = Date.now();
    }
  }

  /**
   * 创建本地 pending 对话（在服务器创建之前）
   */
  function createPendingConversation(): Conversation {
    const id = nanoid();
    const conversation: Conversation = {
      id,
      title: "新对话",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      pending: true,
      mode: "chat",
    };

    conversations.value.unshift(conversation);
    activeConversationId.value = id;

    return conversation;
  }

  return {
    // State
    conversations,
    activeConversationId,
    sidebarCollapsed,
    loading,
    error,

    // Computed
    activeConversation,
    activeMessages,
    sidebarConversations,

    // Actions
    setConversations,
    upsertConversation,
    updateConversationMessage,
    addUserMessage,
    addAssistantPlaceholder,
    updateConversationTitle,
    updateConversationMode,
    updateConversationCodeHistory,
    removeConversation,
    setActiveConversationId,
    toggleSidebar,
    setLoading,
    setError,
    clearActiveConversationMessages,
    createPendingConversation,
  };
});
