import type { ConversationMode } from "@/views/LlmDashboard/Chat/types";

/**
 * 对话相关事件类型定义
 */
export interface ConversationEvents {
  /** 对话创建事件 */
  "conversation:created": { id: string };
  /** 对话选择事件 */
  "conversation:selected": { id: string };
  /** 对话删除事件 */
  "conversation:deleted": { id: string };
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
  /** Canvas 代码历史变化事件 */
  "canvas:history-changed": {
    conversationId: string;
    history: unknown; // CodeHistory type
  };
}

