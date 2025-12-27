import type { ChatMessage, ChatMessageContentPart } from "@/interface";
import type { ConversationModeHandler, ModeContext } from "./types";
import { getCanvasModeSystemPrompt } from "@/prompts/modes/canvasMode";
import { extractHtmlCode } from "./utils/streamParser";

/**
 * Canvas 模式处理器
 * Canvas 模式用于创建和编辑可视化内容，支持 HTML/CSS/JavaScript 代码生成
 */
export const canvasModeHandler: ConversationModeHandler = {
  mode: "canvas",

  getSystemPrompt(context: ModeContext): ChatMessage[] {
    return getCanvasModeSystemPrompt();
  },

  buildMessages(context: ModeContext): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 添加系统提示词
    const systemPrompt = this.getSystemPrompt(context);
    messages.push(...systemPrompt);

    // 如果有编辑器代码，作为上下文添加到消息中
    if (context.editorCode && context.editorCode.trim()) {
      messages.push({
        role: "user",
        content: `当前编辑器中的代码：\n\`\`\`html\n${context.editorCode}\n\`\`\``,
      });
    }

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
    // 解析 HTML 代码块并更新编辑器
    const htmlCode = extractHtmlCode(chunk);
    if (htmlCode && context.immersiveCodeRef) {
      try {
        context.immersiveCodeRef.streamWrite(htmlCode);
      } catch (error) {
        console.error("Canvas mode: Failed to stream write code:", error);
      }
    }

    // 返回 chunk 用于消息显示
    return chunk;
  },

  async onBeforeSubmit(context: ModeContext): Promise<void> {
    // 确保画布显示
    context.uiState.showCanvas = true;

    // 开始流式写入模式
    if (context.immersiveCodeRef) {
      try {
        context.immersiveCodeRef.startStreaming();
      } catch (error) {
        console.error("Canvas mode: Failed to start streaming:", error);
      }
    }
  },

  async onAfterSubmit(context: ModeContext, fullResponse: string): Promise<void> {
    // 结束流式写入模式
    if (context.immersiveCodeRef) {
      try {
        context.immersiveCodeRef.endStreaming();
      } catch (error) {
        console.error("Canvas mode: Failed to end streaming:", error);
      }
    }
  },

  shouldShowCanvas(): boolean {
    return true;
  },
};

