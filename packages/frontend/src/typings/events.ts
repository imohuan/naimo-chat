import type { ConversationEvents } from "@/events/conversationEvents";

/**
 * 事件总线类型定义
 */
export type Events = ConversationEvents & {
  // 可以在这里定义其他事件类型
  [key: string]: unknown;
};
