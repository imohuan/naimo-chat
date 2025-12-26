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
}

/** 聊天消息（用于预览） */
export interface LogChatMessage {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text: string }>;
}

