import type { ConversationMode, Conversation } from "@/views/LlmDashboard/Chat/types";

/**
 * 对话相关事件类型定义
 */
export type ConversationEvents = {
  /** 对话创建事件 */
  "conversation:created": { id: string };
  /** 对话选择事件 */
  "conversation:selected": { id: string };
  /** 对话删除事件 */
  "conversation:deleted": { id: string };
  /** 对话加载完成事件 */
  "conversation:loaded": {
    id: string;
    conversation: Conversation;
  };
  /** 对话清空事件 */
  "conversation:cleared": void;
  /** 消息发送事件 */
  "message:sent": { conversationId: string; content: string };
  /** 消息流式更新事件 */
  "message:streaming": {
    conversationId: string;
    requestId: string;
    chunk: string;
  };
  /** 消息完成事件 */
  "message:complete": {
    conversationId: string;
    requestId: string;
  };
  /** 模式切换事件 */
  "mode:changed": { conversationId: string; mode: ConversationMode };
  /** Canvas 代码变化事件 */
  "canvas:code-changed": { conversationId: string; code: string };
  /** Canvas 代码增量事件 */
  "canvas:code_delta": {
    conversationId: string;
    code: string;
  };
  /** Canvas diff 检测事件 */
  "canvas:diff_detected": {
    conversationId: string;
    diff: string;
    recordId: string;
    originalCode?: string;
  };
  /** Canvas 显示编辑器事件 */
  "canvas:show_editor": {
    conversationId: string;
  };
  /** Canvas 代码完成事件 */
  "canvas:code_complete": {
    conversationId: string;
    recordId: string;
    codeType: "full" | "diff";
    code?: string;
  };
  /** Canvas 记录创建事件 */
  "canvas:record_created": {
    conversationId: string;
    recordId: string;
  };
  /** Canvas 代码历史变化事件 */
  "canvas:history-changed": {
    conversationId: string;
    history: unknown; // CodeHistory type
  };
}

