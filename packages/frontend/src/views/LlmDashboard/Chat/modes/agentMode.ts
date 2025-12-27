import type { ChatMessage, ChatMessageContentPart } from "@/interface";
import type { ConversationModeHandler, ModeContext } from "./types";
import { getAgentModeSystemPrompt } from "@/prompts/modes/agentMode";

/**
 * Agent 模式处理器
 * Agent 模式支持在执行任务前进行规划，适用于深度研究、复杂任务或协作工作
 */
export const agentModeHandler: ConversationModeHandler = {
  mode: "agent",

  getSystemPrompt(context: ModeContext): ChatMessage[] {
    return getAgentModeSystemPrompt();
  },

  buildMessages(context: ModeContext): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 添加系统提示词
    const systemPrompt = this.getSystemPrompt(context);
    messages.push(...systemPrompt);

    // 添加历史消息
    context.messages.forEach((msg) => {
      const latestVersion = msg.versions[msg.versions.length - 1];
      if (!latestVersion) return;

      const hasFiles = latestVersion.files && latestVersion.files.length > 0;

      if (!hasFiles) {
        if (!latestVersion.content) return;
        messages.push({
          role: msg.from,
          content: latestVersion.content,
        });
      } else {
        const contentParts: ChatMessageContentPart[] = [];

        if (latestVersion.content) {
          contentParts.push({ type: "text", text: latestVersion.content });
        }

        latestVersion.files?.forEach((file) => {
          if (file.mediaType?.startsWith("image/") && file.url) {
            contentParts.push({
              type: "image_url",
              image_url: { url: file.url },
            });
          } else if (file.url) {
            contentParts.push({
              type: "text",
              text: `附件：${file.filename || file.url}`,
            });
          }
        });

        if (contentParts.length === 0) return;

        messages.push({
          role: msg.from,
          content: contentParts,
        });
      }
    });

    return messages;
  },

  handleStreamResponse(chunk: string, context: ModeContext): string {
    // Agent 模式直接返回 chunk 用于显示
    return chunk;
  },

  async onBeforeSubmit(context: ModeContext): Promise<void> {
    // Agent 模式不需要特殊处理
  },

  async onAfterSubmit(context: ModeContext, fullResponse: string): Promise<void> {
    // Agent 模式不需要特殊处理
  },

  shouldShowCanvas(): boolean {
    return false;
  },
};

