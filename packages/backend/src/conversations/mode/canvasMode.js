/**
 * Canvas 模式处理函数：构建消息并执行请求
 * Canvas 模式不包含历史消息，只使用当前编辑器代码和用户输入
 * @param {Object} context - 上下文对象
 * @param {Object} context.conversation - 对话对象
 * @param {string} context.currentInput - 当前用户输入
 * @param {string} context.editorCode - 编辑器代码（Canvas模式使用）
 * @param {Array} context.files - 附件列表
 * @param {string} context.model - 模型ID
 * @param {string} context.apiKey - API Key（可选）
 * @param {Function} context.onStreamEvent - 流式事件回调函数 (event) => void
 * @param {string} context.conversationId - 对话ID（用于保存 canvas 文件）
 * @returns {Promise<Object>} 返回请求结果 { requestId, fullResponse, events }
 */
const canvasModePrompt = require("../prompts/canvasMode");
const { replaceVariablesInMessages } = require("../utils/variableReplacer");
const { requestLLM } = require("../utils/llmRequest");
const { addFilesToLastUserMessage } = require("../utils/messageHelper");
const {
  extractHtmlCodeIncremental,
  extractHtmlCode,
  extractDiffBlocks,
  hasDiffFormat,
} = require("../parser");
const { addCodeVersion } = require("../utils/canvasFileManager");
const { sendEvent } = require("../sessionService");

async function processCanvasMode(context) {
  const {
    editorCode,
    currentInput,
    files,
    model,
    apiKey,
    onStreamEvent,
    conversationId,
    sseRequestId, // SSE 请求ID，用于发送 canvas 事件，同时也作为日志中的 requestId
    temperature,
    topP,
    maxTokens,
    mcpIds,
    tools,
  } = context;

  // 1. 构建消息数组
  const messages = [];

  // 加载系统提示词（包含格式选择提示），替换变量
  // 注意：editorCode 变量会被替换，如果为空则带有 _checkVariables: ["editorCode"] 的消息会被自动删除
  const systemPrompts = replaceVariablesInMessages(canvasModePrompt, {
    userInput: currentInput || "",
    editorCode: editorCode || "",
  });
  messages.push(...systemPrompts);

  // 2. 添加文件/图片（如果有）
  // 注意：格式选择提示消息已经标记了 _noInsertFiles，所以文件会被添加到新的 user 消息中
  // addFilesToLastUserMessage 函数会自动检测 _noInsertFiles 标记并创建新消息
  if (files && files.length > 0) {
    const messagesWithFiles = addFilesToLastUserMessage(messages, files, "");
    messages.length = 0;
    messages.push(...messagesWithFiles);
  }

  // 3. 包装 onStreamEvent，添加代码识别逻辑
  let accumulatedContent = "";
  let lastHtmlCode = null; // 用于增量更新
  let hasDetectedDiff = false; // 是否检测到 diff 格式
  let isStreamingCode = false; // 是否正在流式写入代码
  const requestId = sseRequestId; // 使用传递的 SSE 请求ID 作为本地 requestId

  const wrappedOnStreamEvent = (event) => {

    // 累积文本内容
    if (event.type === "content_block_delta" && event.delta?.text) {
      accumulatedContent += event.delta.text;

      // 检查是否包含 diff 格式的开始标记
      if (!hasDetectedDiff && hasDiffFormat(accumulatedContent)) {
        hasDetectedDiff = true;
        isStreamingCode = false; // 停止流式写入
        console.log("🔍 [Canvas Mode] Detected diff format in stream, will process after completion");
      }

      // 如果不是 diff 格式，尝试增量提取 HTML 代码
      // 注意：需要在流式写入过程中持续提取和发送代码增量
      if (!hasDetectedDiff) {
        const htmlCode = extractHtmlCodeIncremental(accumulatedContent);
        if (htmlCode && htmlCode !== lastHtmlCode) {
          // 检查是否以 diff 标记开头（避免误判）
          if (htmlCode.trim().startsWith("-")) {
            // 可能是 diff 格式，等待完整响应
            hasDetectedDiff = true;
            isStreamingCode = false;
          } else {
            // 发送代码增量更新事件
            // 首次检测到代码时，设置 isStreamingCode 并发送 show_editor 事件
            if (!isStreamingCode) {
              isStreamingCode = true;
              // 发送 canvas:show_editor 事件（首次检测到代码时）
              if (requestId) {
                sendEvent(requestId, {
                  type: "canvas:show_editor",
                  timestamp: new Date().toISOString(),
                });
              }
            }

            // 更新 lastHtmlCode 并发送代码增量
            lastHtmlCode = htmlCode;

            // 发送 canvas:code_delta 事件（每次代码更新都发送）
            if (requestId) {
              console.log("🌊 [Canvas Mode] Sending code delta:", {
                codeLength: htmlCode.length,
                codePreview: htmlCode.substring(0, 50),
              });
              sendEvent(requestId, {
                type: "canvas:code_delta",
                code: htmlCode,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      }
    } else if (event.type === "message_delta" && event.delta?.text) {
      accumulatedContent += event.delta.text;
    }

    // 调用原始的 onStreamEvent
    if (onStreamEvent) {
      onStreamEvent(event);
    }
  };

  // 4. 调用通用请求函数执行 /v1/messages 请求
  const result = await requestLLM({
    messages,
    model,
    apiKey,
    onStreamEvent: wrappedOnStreamEvent,
    requestId, // 传递自定义请求ID（与 SSE requestId 保持一致，用于日志记录）
    temperature,
    topP,
    maxTokens,
    mcpIds,
    tools,
  });

  // 5. 流式完成后，识别完整代码并保存
  const fullContent = result.fullResponse || accumulatedContent;

  if (fullContent && conversationId) {
    try {
      // 检查是否是 diff 格式
      const diffContent = extractDiffBlocks(fullContent);
      const htmlCode = extractHtmlCode(fullContent);

      if (diffContent) {
        // Diff 模式：保存 diff 和 originalCode
        console.log("📝 [Canvas Mode] Saving diff format code");

        const { recordId } = await addCodeVersion(conversationId, {
          code: "", // diff 模式下，code 为空，等待前端应用
          diff: diffContent,
          originalCode: editorCode || "", // 保存用户编辑的原始代码
        });

        // 发送 canvas:diff_detected 事件
        if (requestId) {
          sendEvent(requestId, {
            type: "canvas:diff_detected",
            diff: diffContent,
            recordId,
            originalCode: editorCode || "",
            timestamp: new Date().toISOString(),
          });

          // 发送 canvas:code_complete 事件
          sendEvent(requestId, {
            type: "canvas:code_complete",
            recordId,
            codeType: "diff",
            timestamp: new Date().toISOString(),
          });

          // 发送 canvas:record_created 事件
          sendEvent(requestId, {
            type: "canvas:record_created",
            recordId,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (htmlCode) {
        // 完整代码模式：保存完整代码
        console.log("📝 [Canvas Mode] Saving full HTML code");

        const { recordId } = await addCodeVersion(conversationId, {
          code: htmlCode,
          diff: "",
          originalCode: editorCode || "", // 如果用户编辑过，保存原始代码
        });

        // 发送 canvas:code_complete 事件
        if (requestId) {
          sendEvent(requestId, {
            type: "canvas:code_complete",
            recordId,
            codeType: "full",
            code: htmlCode,
            timestamp: new Date().toISOString(),
          });

          // 发送 canvas:record_created 事件
          sendEvent(requestId, {
            type: "canvas:record_created",
            recordId,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error("❌ [Canvas Mode] Failed to save code:", error);
    }
  }

  // 6. 返回结果
  return result;
}

module.exports = processCanvasMode;

