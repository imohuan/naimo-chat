import type { FileUIPart } from "ai";

/**
 * 对话模式类型
 */
export type ConversationMode =
  | "chat"
  | "canvas"
  | "agent"
  | "image"
  | "video"
  | "图片"
  | "视频";

/**
 * 后端 API 消息版本格式（与服务器交互使用）
 */
export interface ApiMessageVersion {
  id: string;
  content: string;
  isRequesting?: boolean;
  createdAt?: number;
}

/**
 * 后端 API 消息格式（与服务器交互使用）
 */
export interface ApiMessage {
  messageKey: string; // 消息唯一标识
  role: "user" | "assistant";
  versions: ApiMessageVersion[]; // 版本数组
  createdAt: number;
  updatedAt?: number;
}

/**
 * 后端 API 对话格式（与服务器交互使用）
 * 注意：对话列表接口可能不包含 messages 字段（为了性能考虑）
 */
export interface ApiConversation {
  id: string;
  title: string;
  mode: ConversationMode;
  messages?: ApiMessage[]; // 列表接口可能不包含此字段
  createdAt: number;
  updatedAt: number;
  codeHistory?: CodeHistory;
}

/**
 * 代码历史记录
 */
export interface CodeHistory {
  versions: Array<{
    id: string;
    timestamp: number;
    label: string;
    records: Array<{
      id: string;
      code?: string; // 可選，如果沒有則使用 originalCode
      diffTarget?: string; // 前端格式
      diff?: string; // 後端格式（與 diffTarget 等價）
      originalCode?: string; // 後端格式，當沒有 code 時使用此作為 code
      timestamp: number;
    }>;
    currentIndex: number;
  }>;
  currentVersionIndex: number;
}

/**
 * 消息版本（前端 UI 使用）
 */
export interface MessageVersion {
  id: string;
  content: string;
  files?: FileUIPart[];
}

/**
 * 消息来源
 */
export interface MessageSource {
  href: string;
  title: string;
}

/**
 * 消息推理信息
 */
export interface MessageReasoning {
  content: string;
  duration: number;
}

/**
 * 消息工具调用
 */
export interface MessageTool {
  name: string;
  description: string;
  status: string;
  parameters: Record<string, unknown>;
  result?: string;
  error?: string;
}

/**
 * 前端 UI 消息格式
 */
export interface MessageType {
  key: string;
  from: "user" | "assistant";
  sources?: MessageSource[];
  versions: MessageVersion[];
  reasoning?: MessageReasoning;
  tools?: MessageTool[];
}

/**
 * 前端 UI 对话格式
 */
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: MessageType[];
  pending?: boolean;
  mode?: ConversationMode;
  codeHistory?: CodeHistory;
  codeVersion?: number; // codeHistory 的版本号，用于判断 codeHistory 是否已加载
}

/**
 * 创建对话参数
 */
export interface CreateConversationParams {
  initialInput?: string;
  mode?: ConversationMode;
  model?: string;
  apiKey?: string;
  files?: Array<{ url?: string; filename?: string; mediaType?: string }>;
  editorCode?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * 发送消息参数
 */
export interface SendMessageParams {
  content: string;
  mode?: ConversationMode;
  model?: string;
  apiKey?: string;
  files?: Array<{ url?: string; filename?: string; mediaType?: string }>;
  editorCode?: string;
  messageKey?: string; // 重试时传递的 messageKey，用于在同一消息下创建新版本
}

/**
 * SSE 流式事件类型
 */
export type SSEEventType =
  | "content_block_delta"
  | "message_delta"
  | "message_complete"
  | "session_end"
  | "error"
  | "request_id"
  | "canvas:code_delta"
  | "canvas:diff_detected"
  | "canvas:show_editor"
  | "canvas:code_complete"
  | "canvas:record_created";

/**
 * SSE 事件数据
 */
export interface SSEEvent {
  type: SSEEventType;
  requestId?: string;
  delta?: {
    text?: string;
  };
  error?: string;
  timestamp?: string;
  // Canvas 事件相关字段
  code?: string;
  diff?: string;
  originalCode?: string;
  recordId?: string;
  codeType?: "full" | "diff";
}

/**
 * 流式响应回调
 */
export interface StreamCallbacks {
  onChunk?: (text: string) => void;
  onRequestId?: (requestId: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  // Canvas 事件回调
  onCanvasCodeDelta?: (code: string) => void;
  onCanvasDiffDetected?: (data: {
    diff: string;
    recordId: string;
    originalCode?: string;
  }) => void;
  onCanvasShowEditor?: () => void;
  onCanvasCodeComplete?: (data: {
    recordId: string;
    codeType: "full" | "diff";
    code?: string;
  }) => void;
  onCanvasRecordCreated?: (recordId: string) => void;
}

