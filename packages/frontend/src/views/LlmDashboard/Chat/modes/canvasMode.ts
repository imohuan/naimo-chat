import type { ChatMessage, ChatMessageContentPart } from "@/interface";
import type { ConversationModeHandler, ModeContext } from "./types";
import { getCanvasModeSystemPrompt } from "@/prompts/modes/canvasMode";
import { extractHtmlCodeIncremental, extractDiffBlocks, hasDiffFormat } from "./utils/streamParser";

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
    // 优先从编辑器引用获取当前代码（实时），如果无法获取则使用 editorCode（构建时的快照）
    const currentEditorCode = context.editorCode || "";

    if (currentEditorCode && currentEditorCode.trim()) {
      messages.push({
        role: "user",
        content: `文件 index.html 的代码：\n\`\`\`html\n${currentEditorCode}\n\`\`\``,
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
    // 检查是否包含 diff 格式，如果是则不在流式阶段处理（等待完整响应）
    if (hasDiffFormat(chunk)) {
      console.log("🔄 [Canvas Mode] Detected diff format in stream, will process after completion");
      // 检测到 diff 格式后，显示编辑器
      if (context.onShowCanvasChange) {
        context.onShowCanvasChange(true);
      }
      // 如果已经开始流式写入，停止它（因为我们将使用 diff 模式）
      if (context.immersiveCodeRef?.endStreaming) {
        try {
          context.immersiveCodeRef.endStreaming();
          console.log("🔄 [Canvas Mode] Stopped streaming due to diff format detection");
        } catch (error) {
          console.error("Canvas mode: Failed to stop streaming:", error);
        }
      }
      // 返回 chunk 用于消息显示，但不执行流式写入
      return chunk;
    }

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

  async onAfterSubmit(context: ModeContext, fullResponse: string): Promise<void> {
    // 检查完整响应中是否包含 diff 格式
    const diffContent = extractDiffBlocks(fullResponse);

    if (diffContent && context.immersiveCodeRef) {
      // 如果包含 diff 格式，执行 diff 操作
      try {
        console.log("🔄 [Canvas Mode] Applying diff blocks:", {
          diffLength: diffContent.length,
          preview: diffContent.substring(0, 200),
        });

        // 结束流式写入模式（如果之前有开始）
        if (context.immersiveCodeRef.endStreaming) {
          context.immersiveCodeRef.endStreaming();
        }

        // 执行 diff 操作
        if (context.immersiveCodeRef.diff) {
          const result = context.immersiveCodeRef.diff(diffContent);
          if (result.success) {
            console.log("✅ [Canvas Mode] Diff applied successfully");
          } else {
            console.warn("⚠️ [Canvas Mode] Diff application failed:", result.message);
          }
        } else {
          console.warn("⚠️ [Canvas Mode] diff method is not available on immersiveCodeRef");
        }
      } catch (error) {
        console.error("Canvas mode: Failed to apply diff:", error);
      }
    } else {
      // 如果没有 diff 格式，正常结束流式写入模式
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

