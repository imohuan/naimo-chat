import { computed } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { useConversationStore } from "@/stores/conversation";
import { useChatApi } from "../../../../hooks/useChatApi";
import { useSSEStream } from "./useSSEStream";
import { getContext } from "@/core/context";
import type {
  CreateConversationParams,
  SendMessageParams,
  ConversationMode,
} from "@/views/LlmDashboard/Chat/types";

/**
 * 对话业务逻辑 Hook
 * 封装对话相关的业务逻辑，结合 store 和 API hooks
 */
export function useConversation() {
  const store = useConversationStore();
  const chatApi = useChatApi();
  const sseStream = useSSEStream();
  const { eventBus } = getContext();

  /**
   * 加载对话列表
   */
  async function loadConversations() {
    store.setLoading(true);
    store.setError(null);

    try {
      const conversations = await chatApi.fetchConversations();
      store.setConversations(conversations);

      // 如果有活跃对话，加载其详情（确保消息数据完整）
      if (store.activeConversationId) {
        const activeId = store.activeConversationId;
        // 检查活跃对话是否在列表中
        const existsInList = conversations.some((c) => c.id === activeId);
        if (existsInList) {
          // 加载对话详情，确保消息数据完整
          await loadConversation(activeId);
        }
      } else if (conversations.length > 0) {
        // 如果没有活跃对话且有对话列表，选择第一个并加载详情
        const firstConversation = conversations[0];
        if (firstConversation) {
          store.setActiveConversationId(firstConversation.id);
          // 加载对话详情，确保消息数据完整
          await loadConversation(firstConversation.id);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载对话列表失败";
      store.setError(message);
      console.error("加载对话列表失败:", error);
    } finally {
      store.setLoading(false);
    }
  }

  /**
   * 加载单个对话详情
   * 
loadConversation()
  ↓
store.upsertConversation() 
  ↓
conversations.value[index] = newConversationObject  // 新对象引用
  ↓
activeConversation computed 返回新对象引用
  ↓
ChatPanel.vue 的 watch([activeConversationId, activeConversation]) 触发
  ↓
ChatPanel.vue 的 watch([codeVersion, codeHistory]) 触发
  ↓
CanvasPanel.vue 的 watch([codeVersion, codeHistory]) 触发（deep: true）
  ↓
immersiveCodeRef.value.setHistory(codeHistory)  // 重新加载整个历史
  ↓
Canvas 被强制刷新 ❌
   */
  async function loadConversation(id: string) {
    store.setLoading(true);
    store.setError(null);

    try {
      const apiConversation = await chatApi.fetchConversation(id);
      store.upsertConversation(apiConversation);

      // 如果对话不在列表中，设置为活跃对话
      if (!store.conversations.some((c) => c.id === id)) {
        store.setActiveConversationId(id);
      }

      // 从 store 中获取已转换的 conversation（确保类型正确）
      const conversation = store.conversations.find((c) => c.id === id);
      if (conversation) {
        // 发送对话加载完成事件
        eventBus.emit("conversation:loaded", {
          id,
          conversation,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载对话失败";
      store.setError(message);
      console.error("加载对话失败:", error);
    } finally {
      store.setLoading(false);
    }
  }

  /**
   * 创建新对话
   */
  async function createConversation(params: CreateConversationParams): Promise<string> {
    store.setLoading(true);
    store.setError(null);

    try {
      // 先创建本地 pending 对话
      const pendingConversation = store.createPendingConversation();

      // 调用 API 创建对话
      const result = await chatApi.createConversation({
        ...params,
        initialInput: params.initialInput || "",
      });

      // 更新对话 ID（从临时 ID 切换到真实 ID）
      const oldId = pendingConversation.id;
      store.removeConversation(oldId);

      // 加载新创建的对话
      await loadConversation(result.id);
      store.setActiveConversationId(result.id);

      // 连接 SSE 流
      if (result.streamUrl) {
        connectToStream(result.id, result.requestId);
      }

      // 发送事件
      eventBus.emit("conversation:created", { id: result.id });

      return result.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建对话失败";
      store.setError(message);
      console.error("创建对话失败:", error);
      throw error;
    } finally {
      store.setLoading(false);
    }
  }

  /**
   * 发送消息
   */
  async function sendMessage(
    conversationId: string,
    params: SendMessageParams
  ): Promise<void> {
    if (!conversationId) {
      throw new Error("对话 ID 不能为空");
    }

    store.setLoading(true);
    store.setError(null);

    try {
      // 添加用户消息到 store
      store.addUserMessage(conversationId, params.content, params.files);

      // 发送事件
      eventBus.emit("message:sent", {
        conversationId,
        content: params.content,
      });

      // 调用 API 发送消息
      const result = await chatApi.sendMessage(conversationId, params);

      // 添加 assistant 占位消息
      store.addAssistantPlaceholder(conversationId, result.requestId);

      // 连接 SSE 流
      connectToStream(conversationId, result.requestId);

      // 如果模式发生变化，更新 store
      if (params.mode && params.mode !== store.activeConversation?.mode) {
        store.updateConversationMode(conversationId, params.mode);
        eventBus.emit("mode:changed", {
          conversationId,
          mode: params.mode,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "发送消息失败";
      store.setError(message);
      console.error("发送消息失败:", error);
      throw error;
    } finally {
      store.setLoading(false);
    }
  }

  /**
   * 连接到 SSE 流
   */
  function connectToStream(conversationId: string, requestId: string) {
    let accumulatedContent = "";
    let finalRequestId = requestId;

    sseStream.connectToStream(conversationId, requestId, {
      onChunk: (chunk: string) => {
        accumulatedContent = chunk;
        store.updateConversationMessage(
          conversationId,
          finalRequestId,
          accumulatedContent,
          true
        );

        // 发送流式更新事件
        eventBus.emit("message:streaming", {
          conversationId,
          requestId: finalRequestId,
          chunk,
        });
      },

      onRequestId: (newRequestId: string) => {
        // 更新 requestId（从临时 ID 切换到真实 ID）
        if (newRequestId !== finalRequestId) {
          // 需要迁移消息内容到新的 requestId
          const oldContent = accumulatedContent;
          // 删除旧的消息
          const conversation = store.conversations.find((c) => c.id === conversationId);
          if (conversation) {
            conversation.messages = conversation.messages.filter(
              (msg) => !msg.versions.some((v) => v.id === finalRequestId)
            );
          }
          finalRequestId = newRequestId;
          // 创建新消息
          store.addAssistantPlaceholder(conversationId, finalRequestId);
          if (oldContent) {
            store.updateConversationMessage(
              conversationId,
              finalRequestId,
              oldContent,
              true
            );
          }
        }
      },

      onComplete: () => {
        store.updateConversationMessage(
          conversationId,
          finalRequestId,
          accumulatedContent,
          false
        );

        // 重新加载对话以获取最新状态
        // loadConversation(conversationId).catch((error) => {
        //   console.error("重新加载对话失败:", error);
        // });

        // 发送完成事件
        eventBus.emit("message:complete", {
          conversationId,
          requestId: finalRequestId,
        });
      },

      onError: (errorMessage: string) => {
        store.updateConversationMessage(
          conversationId,
          finalRequestId,
          `错误: ${errorMessage}`,
          false
        );
        store.setError(errorMessage);
      },

      // Canvas 事件处理
      onCanvasCodeDelta: (code: string) => {
        eventBus.emit("canvas:code_delta", {
          conversationId,
          code,
        });
      },

      onCanvasDiffDetected: (data: {
        diff: string;
        recordId: string;
        originalCode?: string;
      }) => {
        eventBus.emit("canvas:diff_detected", {
          conversationId,
          ...data,
        });
      },

      onCanvasShowEditor: () => {
        eventBus.emit("canvas:show_editor", {
          conversationId,
        });
      },

      onCanvasCodeComplete: (data: {
        recordId: string;
        codeType: "full" | "diff";
        code?: string;
      }) => {
        eventBus.emit("canvas:code_complete", {
          conversationId,
          ...data,
        });
      },

      onCanvasRecordCreated: (recordId: string) => {
        eventBus.emit("canvas:record_created", {
          conversationId,
          recordId,
        });
      },
    });
  }

  /**
   * 选择对话
   */
  async function selectConversation(id: string) {
    if (store.activeConversationId === id) return;

    store.setActiveConversationId(id);

    // 始终加载对话详情，确保消息数据完整
    // 因为对话列表接口可能不包含 messages 字段（为了性能考虑）
    await loadConversation(id);

    // 发送事件
    eventBus.emit("conversation:selected", { id });
  }

  /**
   * 删除对话
   */
  async function deleteConversation(id: string) {
    try {
      await chatApi.deleteConversation(id);
      store.removeConversation(id);

      // 发送事件
      eventBus.emit("conversation:deleted", { id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除对话失败";
      store.setError(message);
      console.error("删除对话失败:", error);
      throw error;
    }
  }

  /**
   * 更新对话模式（防抖处理）
   */
  const updateMode = useDebounceFn(
    async (conversationId: string, mode: ConversationMode) => {
      store.updateConversationMode(conversationId, mode);

      // 发送事件
      eventBus.emit("mode:changed", { conversationId, mode });
    },
    300
  );

  /**
   * 更新代码历史（防抖处理）
   */
  const updateCodeHistory = useDebounceFn(
    async (
      conversationId: string,
      codeHistory: Parameters<typeof store.updateConversationCodeHistory>[1]
    ) => {
      store.updateConversationCodeHistory(conversationId, codeHistory);

      // 发送事件
      eventBus.emit("canvas:history-changed", {
        conversationId,
        history: codeHistory,
      });
    },
    500
  );

  // 初始化时加载对话列表
  if (store.conversations.length === 0) {
    loadConversations();
  }

  /**
   * 清空活跃对话（用于新建对话时）
   */
  function clearActiveConversation() {
    store.setActiveConversationId(undefined);
    eventBus.emit("conversation:cleared");
  }

  return {
    // Store state
    conversations: computed(() => store.conversations),
    activeConversation: computed(() => store.activeConversation),
    activeMessages: computed(() => store.activeMessages),
    sidebarConversations: computed(() => store.sidebarConversations),
    activeConversationId: computed(() => store.activeConversationId),
    sidebarCollapsed: computed(() => store.sidebarCollapsed),
    loading: computed(() => store.loading),
    error: computed(() => store.error),

    // Actions
    loadConversations,
    loadConversation,
    createConversation,
    sendMessage,
    selectConversation,
    deleteConversation,
    updateMode,
    updateCodeHistory,
    toggleSidebar: () => store.toggleSidebar(),
    clearActiveConversationMessages: () => store.clearActiveConversationMessages(),
    clearActiveConversation,
    updateConversationTitle: (id: string, title: string) =>
      store.updateConversationTitle(id, title),
  };
}
