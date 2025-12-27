import type { ChatMessage, ChatMessageContentPart } from "@/interface";
import type { ConversationModeHandler, ModeContext } from "./types";
import { getVideoModeSystemPrompt } from "@/prompts/modes/videoMode";

/**
 * 视频生成模式处理器
 * 视频生成模式用于视频分析、编辑和处理
 */
export const videoModeHandler: ConversationModeHandler = {
  mode: "视频",

  getSystemPrompt(context: ModeContext): ChatMessage[] {
    return getVideoModeSystemPrompt();
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
    // 视频模式直接返回 chunk 用于显示
    return chunk;
  },

  async onBeforeSubmit(context: ModeContext): Promise<void> {
    // 视频模式不需要特殊处理
  },

  async onAfterSubmit(context: ModeContext, fullResponse: string): Promise<void> {
    // 视频模式不需要特殊处理
  },

  shouldShowCanvas(): boolean {
    return false;
  },
};

