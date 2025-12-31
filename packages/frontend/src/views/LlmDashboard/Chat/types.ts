import type { FileUIPart, ToolUIPart } from "ai";
import type { McpTool } from "@/interface";

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
  content?: string; // 兼容旧格式，新格式使用 contentBlocks
  contentBlocks?: ContentBlock[]; // 新格式：按块保存的内容
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
 * 内容块类型
 */
export type ContentBlock =
  | { type: "text"; id: string; content: string }
  | { type: "tool"; id: string; toolCall: ToolUIPart };

/**
 * 消息版本（前端 UI 使用）
 */
export interface MessageVersion {
  id: string;
  contentBlocks: ContentBlock[]; // 按顺序的内容块数组
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
 * 聊天模型与 MCP 配置
 */
export interface ChatModelConfig {
  modelId: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  selectedMcpIds: string[];
  reasoningEffort?: "low" | "medium" | "high" | "minimal" | "xhigh" | undefined;
}

/**
 * 聊天模型扩展配置
 */
export interface ChatModelExtensionConfig {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  mcpIds?: string[];
  tools?: McpTool[];
  reasoningEffort?: "low" | "medium" | "high" | "minimal" | "xhigh" | undefined;
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
  config?: ChatModelExtensionConfig;
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
  config?: ChatModelExtensionConfig;
}

/**
 * SSE 流式事件类型
 */
export type SSEEventType =
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_complete"
  | "session_end"
  | "error"
  | "request_id"
  | "tool:start"
  | "tool:result"
  | "tool:error"
  | "tool:continue_error"
  | "tool:continue_complete"
  | "conversation:updated"
  | "conversation:title_updated"
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
  index?: number;
  delta?: {
    text?: string;
    type?: string;
    partial_json?: string;
  };
  content_block?: {
    type?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  error?: string;
  timestamp?: string;
  // 工具相关字段
  tool_id?: string;
  tool_name?: string;
  input?: Record<string, unknown>; // 工具输入参数
  result?: unknown;
  // 对话更新事件相关字段
  conversationId?: string;
  messages?: ApiMessage[];
  title?: string;
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
  // 内容块回调
  onContentBlockStart?: (data: {
    index: number;
    blockId?: string;
    blockType?: string;
    toolName?: string;
  }) => void;
  onContentBlockDelta?: (data: {
    index: number;
    text?: string;
    partialJson?: string;
  }) => void;
  onContentBlockStop?: (data: { index: number }) => void;
  // 工具回调
  onToolStart?: (data: {
    toolId: string;
    toolName: string;
    timestamp?: string;
  }) => void;
  onToolResult?: (data: {
    toolId: string;
    toolName: string;
    input?: Record<string, unknown>; // 工具输入参数
    result: unknown;
    timestamp?: string;
  }) => void;
  onToolError?: (data: {
    toolId: string;
    toolName: string;
    error: string;
    timestamp?: string;
  }) => void;
  onToolContinueError?: (data: {
    error: string;
    timestamp?: string;
  }) => void;
  onToolContinueComplete?: (data: {
    timestamp?: string;
  }) => void;
  // 对话更新事件回调
  onConversationUpdated?: (data: {
    conversationId: string;
    messages: ApiMessage[];
    requestId: string;
  }) => void;
  onConversationTitleUpdated?: (data: {
    conversationId: string;
    title: string;
  }) => void;
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

