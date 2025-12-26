import { computed, ref, watch } from "vue";
import { nanoid } from "nanoid";
import type { FileUIPart } from "ai";
import type { ChatMessage, ChatMessageContentPart } from "@/interface";

export interface MessageVersion {
  id: string;
  content: string;
  files?: FileUIPart[];
}

export interface MessageSource {
  href: string;
  title: string;
}

export interface MessageReasoning {
  content: string;
  duration: number;
}

export interface MessageTool {
  name: string;
  description: string;
  status: string;
  parameters: Record<string, unknown>;
  result?: string;
  error?: string;
}

export interface MessageType {
  key: string;
  from: "user" | "assistant";
  sources?: MessageSource[];
  versions: MessageVersion[];
  reasoning?: MessageReasoning;
  tools?: MessageTool[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  messages: MessageType[];
  pending?: boolean;
}

// 本地存储的 UI 状态（不存储在服务器）
const ACTIVE_CONVERSATION_KEY = "llm_active_conversation_id";
const SIDEBAR_COLLAPSED_KEY = "llm_sidebar_collapsed";

/**
 * API 调用函数
 */
async function apiCall<T>(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const headers: Record<string, string> = {};
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  const data = (await res.json()) as T;
  if (!res.ok) {
    const message =
      ((data as unknown) as { message?: string; error?: string })?.error ||
      ((data as unknown) as { message?: string; error?: string })?.message ||
      "请求失败";
    throw new Error(message);
  }
  return data;
}

/**
 * 获取所有对话列表
 */
async function fetchConversations(baseUrl: string): Promise<Conversation[]> {
  return apiCall<Conversation[]>(baseUrl, "/api/projects");
}

/**
 * 获取单个对话
 */
async function fetchConversation(
  baseUrl: string,
  id: string
): Promise<Conversation> {
  return apiCall<Conversation>(baseUrl, `/api/projects/${id}`);
}

/**
 * 创建新对话
 */
async function createConversationApi(
  baseUrl: string,
  conversation: Conversation
): Promise<Conversation> {
  return apiCall<Conversation>(baseUrl, "/api/projects", {
    method: "POST",
    body: JSON.stringify(conversation),
  });
}

/**
 * 更新对话
 */
async function updateConversationApi(
  baseUrl: string,
  id: string,
  updates: Partial<Conversation>
): Promise<Conversation> {
  return apiCall<Conversation>(baseUrl, `/api/projects/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

/**
 * 删除对话
 */
async function deleteConversationApi(baseUrl: string, id: string): Promise<void> {
  await apiCall<{ success: boolean }>(baseUrl, `/api/projects/${id}`, {
    method: "DELETE",
  });
}

export function useChatConversations(
  initialMessages: MessageType[],
  baseUrl: string = "http://127.0.0.1:3457"
) {
  const conversations = ref<Conversation[]>([]);
  const activeConversationId = ref<string | undefined>(
    localStorage.getItem(ACTIVE_CONVERSATION_KEY) || undefined
  );
  const sidebarCollapsed = ref<boolean>(
    localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
  );
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const activeConversation = computed<Conversation | undefined>(() =>
    conversations.value.find((c) => c.id === activeConversationId.value)
  );

  const messages = computed<MessageType[]>({
    get() {
      return activeConversation.value?.messages ?? [];
    },
    set(next) {
      // 如果没有活跃对话 ID，无法保存
      if (!activeConversationId.value) return;

      const id = activeConversationId.value;

      // 更新本地对话数据（如果存在）
      const existingIndex = conversations.value.findIndex((c) => c.id === id);
      if (existingIndex >= 0) {
        conversations.value = conversations.value.map((c) =>
          c.id === id
            ? {
              ...c,
              messages: next,
            }
            : c
        );
      } else {
        // 如果本地不存在，创建一个临时对象（PUT 接口会自动创建文件）
        const tempConversation: Conversation = {
          id,
          title: "新对话",
          createdAt: Date.now(),
          messages: next,
          pending: false,
        };
        conversations.value = [tempConversation, ...conversations.value];
      }

      // 异步保存到服务器（PUT 接口会自动创建文件如果不存在）
      saveConversation(id).catch((err) => {
        console.error("保存对话失败:", err);
        error.value = err instanceof Error ? err.message : "保存对话失败";
      });
    },
  });

  /**
   * 保存对话到服务器
   * 如果对话不存在，PUT 接口会自动创建
   */
  async function saveConversation(id: string) {
    const conversation = conversations.value.find((c) => c.id === id);

    // 如果本地没有对话数据，使用默认值（PUT 接口会自动创建）
    const conversationData = conversation || {
      title: "新对话",
      messages: [],
      createdAt: Date.now(),
      pending: false,
    };

    try {
      const saved = await updateConversationApi(baseUrl, id, {
        title: conversationData.title,
        messages: conversationData.messages,
        createdAt: conversationData.createdAt,
        pending: conversationData.pending,
      });

      // 如果本地没有这个对话，添加到列表中
      if (!conversation) {
        conversations.value = [saved, ...conversations.value];
      }
    } catch (err) {
      console.error("保存对话失败:", err);
      throw err;
    }
  }

  /**
   * 加载对话列表
   */
  async function loadConversations() {
    loading.value = true;
    error.value = null;
    try {
      const list = await fetchConversations(baseUrl);
      conversations.value = list;

      // 如果没有活跃对话，且有对话列表，选择第一个
      if (!activeConversationId.value && list.length > 0 && list[0]) {
        activeConversationId.value = list[0].id;
        localStorage.setItem(ACTIVE_CONVERSATION_KEY, list[0].id);
      }

      // 如果活跃对话不在列表中，尝试加载它
      if (
        activeConversationId.value &&
        !list.some((c) => c.id === activeConversationId.value)
      ) {
        try {
          const conv = await fetchConversation(baseUrl, activeConversationId.value);
          conversations.value = [conv, ...conversations.value];
        } catch {
          // 如果加载失败，清除活跃对话ID
          activeConversationId.value = list[0]?.id;
          if (activeConversationId.value) {
            localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId.value);
          } else {
            localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
          }
        }
      }

      // 如果没有任何对话，创建一个默认对话
      if (conversations.value.length === 0) {
        const defaultId = nanoid();
        const defaultConversation: Conversation = {
          id: defaultId,
          title: "新对话",
          createdAt: Date.now(),
          messages: [...initialMessages],
          pending: false,
        };
        try {
          await createConversationApi(baseUrl, defaultConversation);
          conversations.value = [defaultConversation];
          activeConversationId.value = defaultId;
          localStorage.setItem(ACTIVE_CONVERSATION_KEY, defaultId);
        } catch (err) {
          console.error("创建默认对话失败:", err);
          error.value = "创建默认对话失败";
        }
      }
    } catch (err) {
      console.error("加载对话列表失败:", err);
      error.value = err instanceof Error ? err.message : "加载对话列表失败";
    } finally {
      loading.value = false;
    }
  }

  // 初始化时加载对话列表
  loadConversations();

  // 监听 sidebarCollapsed 变化，保存到 localStorage
  watch(sidebarCollapsed, (value) => {
    if (value) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    } else {
      localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
    }
  });

  async function createConversation() {
    const id = nanoid();
    const convo: Conversation = {
      id,
      title: "新对话",
      createdAt: Date.now(),
      messages: [],
      pending: true,
    };
    try {
      await createConversationApi(baseUrl, convo);
      conversations.value = [convo, ...conversations.value];
      activeConversationId.value = id;
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    } catch (err) {
      console.error("创建对话失败:", err);
      error.value = err instanceof Error ? err.message : "创建对话失败";
      throw err;
    }
  }

  async function selectConversation(id: string) {
    if (activeConversationId.value === id) return;
    activeConversationId.value = id;
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);

    // 如果对话不在列表中，尝试加载它
    if (!conversations.value.some((c) => c.id === id)) {
      try {
        const conv = await fetchConversation(baseUrl, id);
        conversations.value = [conv, ...conversations.value];
      } catch (err) {
        console.error("加载对话失败:", err);
        error.value = err instanceof Error ? err.message : "加载对话失败";
      }
    }
  }

  async function deleteConversation(id: string) {
    try {
      await deleteConversationApi(baseUrl, id);
      const next = conversations.value.filter((c) => c.id !== id);
      conversations.value = next;

      if (!next.length) {
        // 创建一个空的对话
        const newId = nanoid();
        const newConversation: Conversation = {
          id: newId,
          title: "新对话",
          createdAt: Date.now(),
          messages: [],
        };
        try {
          await createConversationApi(baseUrl, newConversation);
          conversations.value = [newConversation];
          activeConversationId.value = newId;
          localStorage.setItem(ACTIVE_CONVERSATION_KEY, newId);
        } catch (err) {
          console.error("创建默认对话失败:", err);
          error.value = err instanceof Error ? err.message : "创建默认对话失败";
        }
      } else if (!next.some((c) => c.id === activeConversationId.value)) {
        const firstConversation = next[0];
        if (firstConversation) {
          activeConversationId.value = firstConversation.id;
          localStorage.setItem(ACTIVE_CONVERSATION_KEY, firstConversation.id);
        }
      }
    } catch (err) {
      console.error("删除对话失败:", err);
      error.value = err instanceof Error ? err.message : "删除对话失败";
      throw err;
    }
  }

  async function renameConversation(id: string, title: string) {
    const newTitle = title.trim() || "新对话";
    conversations.value = conversations.value.map((c) =>
      c.id === id
        ? {
          ...c,
          title: newTitle,
        }
        : c
    );
    try {
      await updateConversationApi(baseUrl, id, { title: newTitle });
    } catch (err) {
      console.error("重命名对话失败:", err);
      error.value = err instanceof Error ? err.message : "重命名对话失败";
      // 回滚更改
      await loadConversations();
    }
  }

  async function markConversationReady(id: string) {
    conversations.value = conversations.value.map((c) =>
      c.id === id
        ? {
          ...c,
          pending: false,
        }
        : c
    );
    try {
      await updateConversationApi(baseUrl, id, { pending: false });
    } catch (err) {
      console.error("标记对话就绪失败:", err);
      error.value = err instanceof Error ? err.message : "标记对话就绪失败";
    }
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function updateMessageContent(versionId: string, content: string) {
    const currentMessages = messages.value.slice();
    const target = currentMessages.find((msg) =>
      msg.versions.some((version) => version.id === versionId)
    );
    if (!target) return;
    const version = target.versions.find((v) => v.id === versionId);
    if (!version) return;
    version.content = content;
    messages.value = [...currentMessages];
  }

  async function addUserMessage(content: string, files?: FileUIPart[]) {
    // 如果没有活跃对话，先创建一个
    if (!activeConversationId.value) {
      await createConversation();
    }

    const timestamp = Date.now();
    const userMessage: MessageType = {
      key: `user-${timestamp}`,
      from: "user",
      versions: [
        {
          id: `user-${timestamp}`,
          content,
          files: files?.length ? files.map((f) => ({ ...f })) : undefined,
        },
      ],
    };
    messages.value = [...messages.value, userMessage];
  }

  function addAssistantPlaceholder(files?: FileUIPart[]) {
    const id = `assistant-${Date.now()}`;
    const assistantMessage: MessageType = {
      key: id,
      from: "assistant",
      versions: [
        {
          id,
          content: "",
          files: files?.length ? files.map((f) => ({ ...f })) : undefined,
        },
      ],
    };
    messages.value = [...messages.value, assistantMessage];
    return id;
  }

  async function clearActiveConversation() {
    if (!activeConversation.value) return;
    const id = activeConversation.value.id;
    conversations.value = conversations.value.map((c) =>
      c.id === id
        ? {
          ...c,
          messages: [],
        }
        : c
    );
    try {
      await updateConversationApi(baseUrl, id, { messages: [] });
    } catch (err) {
      console.error("清空对话失败:", err);
      error.value = err instanceof Error ? err.message : "清空对话失败";
    }
  }

  function buildHistory(): ChatMessage[] {
    return messages.value.flatMap<ChatMessage>((msg) => {
      const latest = msg.versions[msg.versions.length - 1];
      if (!latest) return [];

      const hasFiles = latest.files && latest.files.length > 0;

      if (!hasFiles) {
        if (!latest.content) return [];
        return [
          {
            role: msg.from,
            content: latest.content,
          },
        ];
      }

      const contentParts: ChatMessageContentPart[] = [];

      if (latest.content) {
        contentParts.push({ type: "text", text: latest.content });
      }

      latest.files?.forEach((file) => {
        if (file.mediaType?.startsWith("image/") && file.url) {
          contentParts.push({
            type: "image_url",
            image_url: { url: file.url }, // , detail: "auto"
            // mediaType: file.mediaType,
          });
        } else if (file.url) {
          contentParts.push({
            type: "text",
            text: `附件：${file.filename || file.url}`,
          });
        }
      });

      if (contentParts.length === 0) return [];

      return [
        {
          role: msg.from,
          content: contentParts,
        },
      ];
    });
  }

  return {
    conversations,
    activeConversationId,
    activeConversation,
    messages,
    sidebarCollapsed,
    loading,
    error,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    markConversationReady,
    toggleSidebar,
    updateMessageContent,
    addUserMessage,
    addAssistantPlaceholder,
    clearActiveConversation,
    buildHistory,
    loadConversations,
    saveConversation,
  };
}


