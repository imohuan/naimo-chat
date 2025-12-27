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

  getSystemPrompt(_context: ModeContext): ChatMessage[] {
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
        content: `文件 index.html 的代码：\n\`\`\`html\n${context.editorCode}\n\`\`\``,
      });
    }

    // 添加当前用户消息（不包含历史消息）
    if (context.currentUserInput || context.files?.length) {
      const hasFiles = context.files && context.files.length > 0;

      if (!hasFiles) {
        if (context.currentUserInput) {
          messages.push({
            role: "user",
            content: context.currentUserInput,
          });
        }
      } else {
        const contentParts: ChatMessageContentPart[] = [];

        if (context.currentUserInput) {
          contentParts.push({ type: "text", text: context.currentUserInput });
        }

        context.files?.forEach((file) => {
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

        if (contentParts.length > 0) {
          messages.push({
            role: "user",
            content: contentParts,
          });
        }
      }
    }

    return messages;
  },

  handleStreamResponse(chunk: string, context: ModeContext): string {
    // 解析 HTML 代码块并更新编辑器
    const htmlCode = extractHtmlCode(chunk);
    if (htmlCode && context.immersiveCodeRef) {
      try {
        context.immersiveCodeRef.streamWrite(htmlCode);
        // 检测到 HTML 代码后，显示编辑器
        if (context.onShowCanvasChange) {
          context.onShowCanvasChange(true);
        }
      } catch (error) {
        console.error("Canvas mode: Failed to stream write code:", error);
      }
    }

    // 返回 chunk 用于消息显示
    return chunk;
  },

  async onBeforeSubmit(context: ModeContext): Promise<void> {
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

        // 检查流式写入是否包含 HTML 代码
        const htmlCode = extractHtmlCode(fullResponse);
        if (htmlCode && context.immersiveCodeRef.addMajorVersion) {
          const currentCode = context.immersiveCodeRef.getCurrentCode();
          if (currentCode && currentCode.trim()) {
            // 获取上一个版本的代码
            const previousVersionCode = context.immersiveCodeRef.getPreviousVersionCode
              ? context.immersiveCodeRef.getPreviousVersionCode()
              : "";

            // 比较当前代码和之前版本的代码是否一致
            // 去除首尾空白后比较
            const currentCodeTrimmed = currentCode.trim();
            const previousCodeTrimmed = previousVersionCode.trim();

            // 如果不一致，才添加主要版本
            if (currentCodeTrimmed !== previousCodeTrimmed) {
              const timestamp = new Date().toLocaleTimeString();
              context.immersiveCodeRef.addMajorVersion(
                currentCode,
                `Canvas Version ${timestamp}`
              );
            } else {
              console.log("Canvas mode: Code unchanged, skipping major version creation");
            }
          }
        }
      } catch (error) {
        console.error("Canvas mode: Failed to end streaming or add version:", error);
      }
    }
  },

  shouldShowCanvas(): boolean {
    return true;
  },
};

