/** 日志文件信息 */
export interface LogFile {
  name: string;
  path: string;
  lastModified: string;
}

/** 日志条目 */
export interface LogEntry {
  level: number;
  time: number;
  pid?: number;
  hostname?: string;
  reqId?: string;
  req?: {
    method: string;
    url: string;
    host?: string;
    remoteAddress?: string;
    remotePort?: number;
  };
  res?: {
    statusCode: number;
  };
  responseTime?: number;
  data?: any;
  request?: any;
  response?: any;
  result?: any;
  err?: any;
  msg?: string;
  type?: string;
}

/** 请求对象 */
export interface LogRequest {
  id: string;
  startTime: number;
  logs: LogEntry[];
  method: string;
  url: string;
  status: number | null;
  duration?: number;
  model: string;
  fullResponse: string;
  hasError: boolean;
  error: any;
  /** 用于搜索的聚合文本，包含请求/响应/错误等关键信息 */
  searchText?: string;
  /** 完整的流式响应事件列表 */
  responseFull?: StreamEvent[];
}

/** 聊天消息（用于预览） */
export interface LogChatMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text: string }>;
}

/** 对话列表项 */
export interface MessageListItem {
  requestId: string;
  hasRequest: boolean;
  hasResponse: boolean;
  hasStreamResponse: boolean;
  timestamp: string | null;
  model: string | null;
  lastModified: string | null;
}

/** JSONL 流式响应事件类型 */
export type StreamEventType =
  | "message_start"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "message_delta"
  | "message_stop";

/** JSONL 流式响应事件 */
export interface StreamEvent {
  type: StreamEventType;
  message?: any;
  content_block?: any;
  delta?: any;
  index?: number;
  usage?: any;
}

/** 对话详情 */
export interface MessageDetail {
  requestId: string;
  request: any;
  response: {
    content: string | null; // Markdown 格式的响应内容
    full: StreamEvent[] | null; // 完整的响应数据（JSONL 格式，流式响应）
    isStream: boolean;
  };
}

/** 时间范围 */
export interface TimeRange {
  start: Date | null;
  end: Date | null;
}

