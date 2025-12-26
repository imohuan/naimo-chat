/** Transformer 配置项 */
export type TransformerConfigItem = string | [string, Record<string, any>];

/** Transformer 配置 */
export interface TransformerConfig {
  use?: TransformerConfigItem[];
  [modelName: string]:
  | {
    use?: TransformerConfigItem[];
  }
  | TransformerConfigItem[]
  | undefined;
}

/** LLM Provider 配置 */
export interface LlmProvider {
  id?: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  apiKeys?: string[];
  models: string[];
  limit?: number;
  enabled?: boolean;
  type?: string;
  sort?: number;
  transformer?: TransformerConfig;
}

/** 聊天消息内容片段（支持文本 + 图片） */
export type ChatMessageContentPart =
  | {
    type: "text";
    text: string;
  }
  | {
    type: "image_url";
    image_url: {
      url: string;
      detail?: "low" | "high" | "auto";
    };
    mediaType?: string;
  };

/** 聊天消息 */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string | ChatMessageContentPart[];
  /** 可选的消息类型标记，如 "system" 等，用于区分用途（例如标题生成） */
  type?: string;
}

export interface HealthStatus {
  ok: boolean;
  msg: string;
}

export interface ClipboardWatchStatus {
  running: boolean;
  pid: number | null;
}

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

/** MCP 服务器配置 */
export interface McpServerConfig {
  command?: string;
  args?: string[];
  url?: string;
  type?: "stdio" | "sse" | "streamable-http";
  env?: Record<string, string>;
  headers?: Record<string, string>;
  enabled?: boolean;
}

/** MCP 服务器（包含名称） */
export interface McpServer {
  name: string;
  config: McpServerConfig;
}

/** MCP 工具 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  annotations?: {
    properties?: Record<string, any>;
    required?: string[];
  };
}

/** MCP 工具列表响应 */
export interface McpToolsResponse {
  tools: McpTool[];
}