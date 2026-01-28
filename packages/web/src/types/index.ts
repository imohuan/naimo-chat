// ============ Chat Types ============

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'tool' | 'permission_request' | 'subagent' | 'todo_list';
  rawText?: string;
  html?: string;
  time: string;
  name?: string;
  input?: any;
  result?: string;
  tool_use_id?: string;
  isError?: boolean;
  diffLines?: DiffLine[];
  toolName?: string;
  toolInput?: any;
  payload?: any;
  requestId?: string;
  subagentMessages?: ChatMessage[];
  agentId?: string | null;
  todos?: TodoItem[];
}

export interface DiffLine {
  type: 'add' | 'rem' | 'normal';
  content: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'completed' | 'in_progress' | 'pending';
  activeForm: string | null;
}

export interface MessageGroup {
  id: string;
  role: 'user' | 'assistant';
  html?: string;
  time: string;
  items?: ChatMessage[];
}

export interface ChatHistory {
  id: string | number;
  title: string;
  isRemote?: boolean;
  projectId?: string;
  sessionId?: string;
  messages?: ChatMessage[];
  createdAt?: string;
  modifiedAt?: string;
}

export interface ModelOption {
  name: string;
  desc: string;
}

export interface EventItem {
  name: string;
}

export interface IntervalOption {
  value: number;
  label: string;
}

export interface IconInfo {
  name: string;
  component: any;
}

// ============ Event Types ============

export type Events = {
  'chat:message-added': ChatMessage;
  'chat:session-started': string;
  'chat:session-ended': void;
};
