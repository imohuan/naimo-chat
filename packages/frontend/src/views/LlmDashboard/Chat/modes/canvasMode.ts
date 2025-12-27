import type { ChatMessage, ChatMessageContentPart } from "@/interface";
import type { ConversationModeHandler, ModeContext } from "./types";
import { getCanvasModeSystemPrompt } from "@/prompts/modes/canvasMode";
import { extractHtmlCodeIncremental } from "./utils/streamParser";

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
    // 使用增量提取方法，支持不完整的代码块（流式写入）
    const htmlCode = extractHtmlCodeIncremental(chunk);

    if (htmlCode) {
      console.log("🌊 [Canvas Mode] Extracted HTML code:", {
        length: htmlCode.length,
        preview: htmlCode.substring(0, 100),
        hasImmersiveCodeRef: !!context.immersiveCodeRef,
      });

      if (context.immersiveCodeRef) {
        try {
          context.immersiveCodeRef.streamWrite(htmlCode);
          // 检测到 HTML 代码后，显示编辑器
          if (context.onShowCanvasChange) {
            context.onShowCanvasChange(true);
          }
        } catch (error) {
          console.error("Canvas mode: Failed to stream write code:", error);
        }
      } else {
        console.warn("⚠️ [Canvas Mode] immersiveCodeRef is not available");
      }
    }

    // 返回 chunk 用于消息显示
    return chunk;
  },

  async onBeforeSubmit(context: ModeContext): Promise<void> {
    // 设置编辑器为只读模式
    if (context.onReadonlyChange) {
      context.onReadonlyChange(true);
    }

    // 开始流式写入模式
    if (context.immersiveCodeRef) {
      try {
        // 获取当前代码，作为起始点
        const currentCode = context.immersiveCodeRef.getCurrentCode() || "";

        // 添加一个空白版本作为起始点（如果代码为空，使用空字符串；否则使用当前代码）
        if (context.immersiveCodeRef.addMajorVersion) {
          const timestamp = new Date().toLocaleTimeString();
          context.immersiveCodeRef.addMajorVersion(
            currentCode,
            `Canvas Start ${timestamp}`
          );
        }

        // 开始流式写入模式
        context.immersiveCodeRef.startStreaming();
      } catch (error) {
        console.error("Canvas mode: Failed to start streaming:", error);
      }
    }
  },

  async onAfterSubmit(context: ModeContext, _fullResponse: string): Promise<void> {
    // 结束流式写入模式
    // endStreaming() 会自动调用 record() 将最终状态记录到历史记录中
    if (context.immersiveCodeRef) {
      try {
        context.immersiveCodeRef.endStreaming();
        // endStreaming() 已经自动调用了 record()，所以不需要手动添加 major version
        // 流式写入的最终状态会自动记录到当前 major version 的 records 中
        console.log("🌊 [Canvas Mode] Streaming ended, final state recorded automatically");
      } catch (error) {
        console.error("Canvas mode: Failed to end streaming:", error);
      }
    }

    // 恢复编辑器为可编辑模式
    if (context.onReadonlyChange) {
      context.onReadonlyChange(false);
    }
  },

  shouldShowCanvas(): boolean {
    return true;
  },
};

