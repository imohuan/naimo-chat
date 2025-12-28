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
 * @returns {Promise<Object>} 返回请求结果 { requestId, fullResponse, events }
 */
const canvasModePrompt = require("../prompts/canvasMode");
const { replaceVariablesInMessages } = require("../utils/variableReplacer");
const { requestLLM } = require("../utils/llmRequest");
const { addFilesToLastUserMessage } = require("../utils/messageHelper");

async function processCanvasMode(context) {
  const { editorCode, currentInput, files, model, apiKey, onStreamEvent } = context;

  // 1. 构建消息数组
  const messages = [];

  // 加载系统提示词（包含格式选择提示），替换变量
  const systemPrompts = replaceVariablesInMessages(canvasModePrompt, {
    userInput: currentInput || "",
  });
  messages.push(...systemPrompts);

  // Canvas 模式不包含历史消息，只添加编辑器代码
  if (editorCode && editorCode.trim()) {
    messages.push({
      role: "user",
      content: `当前编辑器中的代码：\n\`\`\`\n${editorCode}\n\`\`\``,
    });
  }

  // 2. 添加文件/图片（如果有）
  // 注意：格式选择提示消息已经标记了 _noInsertFiles，所以文件会被添加到新的 user 消息中
  // addFilesToLastUserMessage 函数会自动检测 _noInsertFiles 标记并创建新消息
  if (files && files.length > 0) {
    const messagesWithFiles = addFilesToLastUserMessage(messages, files, "");
    messages.length = 0;
    messages.push(...messagesWithFiles);
  }

  // 3. 调用通用请求函数执行 /v1/messages 请求
  const result = await requestLLM({
    messages,
    model,
    apiKey,
    onStreamEvent,
  });

  // 4. 返回结果
  return result;
}

module.exports = processCanvasMode;

