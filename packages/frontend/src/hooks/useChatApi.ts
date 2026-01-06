import { computed } from "vue";
import { useLlmApi } from "./useLlmApi";
import type {
  ApiConversation,
  CreateConversationParams,
  SendMessageParams,
} from "@/views/LlmDashboard/Chat/types";

/**
 * API 调用响应类型
 */
interface CreateConversationResponse {
  id: string;
  requestId: string;
  streamUrl: string;
}

interface SendMessageResponse {
  requestId: string;
  streamUrl: string;
}

/**
 * Chat API Hook
 * 封装所有对话相关的 API 调用
 */
export function useChatApi() {
  const { endpoint } = useLlmApi();

  /**
   * 通用 API 调用函数
   */
  async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${endpoint.value}${path}`;
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
      const error = new Error(message) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    return data;
  }

  /**
   * 获取所有对话列表
   */
  async function fetchConversations(): Promise<ApiConversation[]> {
    return apiCall<ApiConversation[]>("/api/ai_chat/conversations");
  }

  /**
   * 获取单个对话详情
   */
  async function fetchConversation(id: string): Promise<ApiConversation> {
    return apiCall<ApiConversation>(`/api/ai_chat/conversations/${id}`);
  }

  /**
   * 创建新对话
   */
  async function createConversation(
    params: CreateConversationParams
  ): Promise<CreateConversationResponse> {
    const body: Record<string, unknown> = {
      mode: params.mode || "chat",
    };

    if (params.initialInput) {
      body.initialInput = params.initialInput;
    }

    if (params.messages && params.messages.length > 0) {
      body.messages = params.messages;
    }

    if (params.model) {
      body.model = params.model;
    }

    // 不自动传输 apikey，只在明确传递时才传输
    if (params.apiKey) {
      body.apiKey = params.apiKey;
    }

    if (params.files && params.files.length > 0) {
      body.files = params.files;
    }

    if (params.editorCode) {
      body.editorCode = params.editorCode;
    }

    if (params.config) {
      body.config = params.config;
    }

    const result = await apiCall<CreateConversationResponse>(
      "/api/ai_chat/conversations",
      {
        method: "POST",
        body: JSON.stringify(body),
        signal: params.abortSignal,
      }
    );

    return result;
  }

  /**
   * 向现有对话发送消息
   */
  async function sendMessage(
    conversationId: string,
    params: SendMessageParams
  ): Promise<SendMessageResponse> {
    const body: Record<string, unknown> = {
      content: params.content,
    };

    if (params.mode) {
      body.mode = params.mode;
    }

    if (params.model) {
      body.model = params.model;
    }

    // 不自动传输 apikey，只在明确传递时才传输
    if (params.apiKey) {
      body.apiKey = params.apiKey;
    }

    if (params.files && params.files.length > 0) {
      body.files = params.files;
    }

    if (params.editorCode) {
      body.editorCode = params.editorCode;
    }

    if (params.config) {
      body.config = params.config;
    }

    // 重试时传递 messageKey，用于在同一消息下创建新版本
    if (params.messageKey) {
      body.messageKey = params.messageKey;
    }

    const result = await apiCall<SendMessageResponse>(
      `/api/ai_chat/conversations/${conversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify(body),
        signal: params.abortSignal,
      }
    );

    return result;
  }

  /**
   * 删除对话
   */
  async function deleteConversation(id: string): Promise<void> {
    await apiCall<{ success: boolean }>(`/api/ai_chat/conversations/${id}`, {
      method: "DELETE",
    });
  }

  /**
   * 获取 Canvas 代码历史
   */
  async function fetchCanvas(conversationId: string) {
    return apiCall<{
      conversationId: string;
      codeHistory: {
        versions: Array<{
          id: string;
          timestamp: number;
          label: string;
          records: Array<{
            id: string;
            code: string;
            diff: string;
            originalCode: string;
            timestamp: number;
          }>;
          currentIndex: number;
        }>;
        currentVersionIndex: number;
      };
      updatedAt: number;
    }>(`/api/ai_chat/conversations/${conversationId}/canvas`);
  }

  /**
   * 更新 Canvas 代码历史
   */
  async function updateCanvas(
    conversationId: string,
    canvasData: {
      conversationId: string;
      codeHistory: unknown;
      updatedAt: number;
    }
  ): Promise<{ success: boolean }> {
    return apiCall<{ success: boolean }>(
      `/api/ai_chat/conversations/${conversationId}/canvas`,
      {
        method: "PUT",
        body: JSON.stringify(canvasData),
      }
    );
  }

  /**
   * 应用 diff 并保存最终代码
   */
  async function applyCanvasDiff(
    conversationId: string,
    recordId: string,
    code: string
  ): Promise<{ success: boolean; recordId: string }> {
    return apiCall<{ success: boolean; recordId: string }>(
      `/api/ai_chat/conversations/${conversationId}/canvas/records/${recordId}/apply`,
      {
        method: "POST",
        body: JSON.stringify({ code }),
      }
    );
  }

  return {
    endpoint: computed(() => endpoint.value),
    fetchConversations,
    fetchConversation,
    createConversation,
    sendMessage,
    deleteConversation,
    fetchCanvas,
    updateCanvas,
    applyCanvasDiff,
  };
}
