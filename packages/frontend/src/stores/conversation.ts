import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useLocalStorage } from "@vueuse/core";
import type { FileUIPart, ToolUIPart } from "ai";
import type {
  Conversation,
  MessageType,
  ApiConversation,
  ApiMessage,
  ConversationMode,
  CodeHistory,
  ContentBlock,
  MessageVersionStatus,
} from "@/views/LlmDashboard/Chat/types";
import { nanoid } from "nanoid";

/**
 * 本地存储键名
 */
const ACTIVE_CONVERSATION_KEY = "llm_active_conversation_id";
const SIDEBAR_COLLAPSED_KEY = "llm_sidebar_collapsed";

/**
 * 将 API 消息格式转换为 UI 消息格式
 */
function apiMessageToMessageType(apiMessage: ApiMessage, _index: number): MessageType {
  return {
    key: apiMessage.messageKey,
    from: apiMessage.role,
    versions: apiMessage.versions.map((v) => ({
      id: v.id,
      // 优先使用 contentBlocks（新格式），如果没有则从 content 转换（兼容旧格式）
      contentBlocks: v.contentBlocks
        ? (v.contentBlocks as ContentBlock[])
        : v.content
          ? [{ type: "text" as const, id: `${v.id}-text`, content: v.content }]
          : [],
      // 转换状态：优先使用 status，其次根据 isRequesting 推断
      status: v.status
        ? v.status
        : v.isRequesting
          ? "streaming"
          : "completed",
      errorMessage: v.errorMessage,
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
   * 更新对话消息（使用内容块）
   */
  function updateConversationMessage(
    conversationId: string,
    requestId: string,
    contentBlocks: ContentBlock[],
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
            contentBlocks: [],
          },
        ],
      };
      conversation.messages.push(message);
    }

    // 更新消息内容块
    const version = message.versions.find((v) => v.id === requestId);
    if (version) {
      version.contentBlocks = contentBlocks;
    } else {
      message.versions.push({
        id: requestId,
        contentBlocks,
      });
    }

    // 更新对话的更新时间
    conversation.updatedAt = Date.now();
  }

  /**
   * 添加或更新内容块
   */
  function upsertContentBlock(
    conversationId: string,
    requestId: string,
    block: ContentBlock
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    // 查找或创建对应的消息
    let message = conversation.messages.find((msg) =>
      msg.versions.some((v) => v.id === requestId)
    );

    if (!message) {
      message = {
        key: requestId,
        from: "assistant",
        versions: [
          {
            id: requestId,
            contentBlocks: [],
          },
        ],
      };
      conversation.messages.push(message);
    }

    const version = message.versions.find((v) => v.id === requestId);
    if (!version) {
      message.versions.push({
        id: requestId,
        contentBlocks: [block],
      });
    } else {
      // 查找是否已存在该内容块
      const existingIndex = version.contentBlocks.findIndex((b) => b.id === block.id);
      if (existingIndex >= 0) {
        // 更新现有块
        version.contentBlocks[existingIndex] = block;
      } else {
        // 添加新块
        version.contentBlocks.push(block);
      }
    }

    conversation.updatedAt = Date.now();
  }

  /**
   * 更新文字内容块
   */
  function updateTextBlock(
    conversationId: string,
    requestId: string,
    blockId: string,
    text: string
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    const message = conversation.messages.find((msg) =>
      msg.versions.some((v) => v.id === requestId)
    );
    if (!message) return;

    const version = message.versions.find((v) => v.id === requestId);
    if (!version) return;

    const blockIndex = version.contentBlocks.findIndex((b) => b.id === blockId);
    const existingBlock = blockIndex >= 0 ? version.contentBlocks[blockIndex] : null;

    if (existingBlock && existingBlock.type === "text") {
      version.contentBlocks[blockIndex] = {
        type: "text",
        id: blockId,
        content: text,
      };
    } else if (blockIndex < 0) {
      // 如果不存在，创建新的文字块
      version.contentBlocks.push({
        type: "text",
        id: blockId,
        content: text,
      });
    }

    conversation.updatedAt = Date.now();
  }

  /**
   * 更新工具调用块
   */
  function updateToolBlock(
    conversationId: string,
    requestId: string,
    toolId: string,
    updates: Partial<ToolUIPart>
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    const message = conversation.messages.find((msg) =>
      msg.versions.some((v) => v.id === requestId)
    );
    if (!message) return;

    const version = message.versions.find((v) => v.id === requestId);
    if (!version) return;

    // 查找工具块：优先通过 toolCallId 匹配，其次通过 block id 匹配
    const blockIndex = version.contentBlocks.findIndex(
      (b) =>
        b.type === "tool" &&
        (b.toolCall.toolCallId === toolId || b.id === toolId)
    );

    const existingBlock = blockIndex >= 0 ? version.contentBlocks[blockIndex] : null;

    if (existingBlock && existingBlock.type === "tool") {
      // 更新现有工具块
      version.contentBlocks[blockIndex] = {
        type: "tool",
        id: existingBlock.id,
        toolCall: {
          ...existingBlock.toolCall,
          ...updates,
        } as ToolUIPart,
      };
    } else {
      // 如果不存在，创建新的工具块（用于 tool:start 事件）
      // 从 type 中提取工具名称（格式：tool-{name}）
      const toolName = updates.type
        ? updates.type.replace(/^tool-/, "")
        : "unknown";

      // 使用类型断言，因为 ToolUIPart 是复杂的联合类型
      const newToolCall = {
        toolCallId: toolId,
        type: updates.type || `tool-${toolName}`,
        state: updates.state || "input-available",
        input: updates.input || {},
        ...updates,
      } as ToolUIPart;

      version.contentBlocks.push({
        type: "tool",
        id: toolId,
        toolCall: newToolCall,
      });
    }

    conversation.updatedAt = Date.now();
  }

  /**
   * 根据后端返回的消息列表更新对话消息
   * 用于同步后端的最新消息状态（包括更新后的 requestId）
   */
  function updateConversationMessages(
    conversationId: string,
    apiMessages: ApiMessage[]
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    // 将 API 消息格式转换为 UI 消息格式
    conversation.messages = apiMessages.map((msg, index) =>
      apiMessageToMessageType(msg, index)
    );
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
          contentBlocks: [
            {
              type: "text",
              id: `${messageId}-text`,
              content,
            },
          ],
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
          contentBlocks: [],
          status: "streaming", // 初始状态为流式生成中
        },
      ],
    };

    conversation.messages.push(assistantMessage);
    conversation.updatedAt = Date.now();
  }

  /**
   * 在现有的 assistant 消息下添加新版本占位符（用于重试）
   */
  function addAssistantVersionPlaceholder(
    conversationId: string,
    messageKey: string,
    requestId: string
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    const assistantMessage = conversation.messages.find(
      (msg) => msg.key === messageKey && msg.from === "assistant"
    );
    if (assistantMessage) {
      assistantMessage.versions.push({
        id: requestId,
        contentBlocks: [],
        status: "streaming", // 初始状态为流式生成中
      });
      conversation.updatedAt = Date.now();
    }
  }

  /**
   * 更新消息版本状态
   */
  function updateMessageVersionStatus(
    conversationId: string,
    requestId: string,
    status: MessageVersionStatus,
    errorMessage?: string
  ) {
    const conversation = conversations.value.find((c) => c.id === conversationId);
    if (!conversation) return;

    const message = conversation.messages.find((msg) =>
      msg.versions.some((v) => v.id === requestId)
    );
    if (!message) return;

    const version = message.versions.find((v) => v.id === requestId);
    if (version) {
      version.status = status;
      if (errorMessage) {
        version.errorMessage = errorMessage;
      }
    }

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
      // 判断 codeHistory 是否发生变化
      const oldCodeHistory = conversation.codeHistory;
      const codeHistoryChanged =
        !oldCodeHistory !== !codeHistory ||
        (oldCodeHistory &&
          codeHistory &&
          JSON.stringify(oldCodeHistory) !== JSON.stringify(codeHistory));

      conversation.codeHistory = codeHistory;
      conversation.updatedAt = Date.now();

      // 如果 codeVersion 未设置或 codeHistory 发生变化，更新版本号
      // 这样即使 codeHistory 为空，也能标记为已加载
      if (conversation.codeVersion === undefined || codeHistoryChanged) {
        conversation.codeVersion = (conversation.codeVersion || 0) + 1;
      }
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
    upsertContentBlock,
    updateTextBlock,
    updateToolBlock,
    updateConversationMessages,
    addUserMessage,
    addAssistantPlaceholder,
    addAssistantVersionPlaceholder,
    updateMessageVersionStatus,
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
