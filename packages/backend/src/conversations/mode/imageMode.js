/**
 * 图片模式处理函数：构建消息并执行请求
 * @param {Object} context - 上下文对象
 * @param {Object} context.conversation - 对话对象
 * @param {string} context.currentInput - 当前用户输入
 * @param {Array} context.files - 附件列表
 * @param {string} context.model - 模型ID
 * @param {string} context.apiKey - API Key（可选）
 * @param {Function} context.onStreamEvent - 流式事件回调函数 (event) => void
 * @param {AbortSignal} [context.abortSignal] - 中断信号（可选）
 * @returns {Promise<Object>} 返回请求结果 { requestId, fullResponse, events }
 */
const imageModePrompt = require("../prompts/imageMode");
const { replaceVariablesInMessages } = require("../utils/variableReplacer");
const { requestLLM } = require("../utils/llmRequest");
const { addFilesToLastUserMessage } = require("../utils/messageHelper");

async function processImageMode(context) {
  const {
    conversation,
    currentInput,
    files,
    model,
    apiKey,
    onStreamEvent,
    requestId,
    conversationId,
    temperature,
    topP,
    maxTokens,
    tools,
    reasoning,
    abortSignal,
  } = context;

  // 1. 构建消息数组
  const messages = [];

  // 加载系统提示词并替换变量
  const systemPrompts = replaceVariablesInMessages(imageModePrompt, {});
  messages.push(...systemPrompts);

  // 添加历史消息（限制最近 10 条）
  if (conversation && conversation.messages) {
    const historyMessages = conversation.messages
      .filter((msg) => msg.role !== "system" && !msg.isRequesting)
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));
    messages.push(...historyMessages);
  }

  // 构建用户消息内容（图片模式通常需要图片附件）
  // 添加当前用户输入
  if (currentInput) {
    messages.push({
      role: "user",
      content: currentInput,
    });
  }

  // 添加文件/图片（如果有）
  if (files && files.length > 0) {
    const messagesWithFiles = addFilesToLastUserMessage(messages, files, currentInput);
    messages.length = 0;
    messages.push(...messagesWithFiles);
  }

  // 2. 调用通用请求函数执行 /v1/messages 请求
  const result = await requestLLM({
    messages,
    model,
    apiKey,
    onStreamEvent,
    requestId, // 传递自定义请求ID
    sessionId: conversationId, // 传递 conversationId 作为 sessionId，用于用量缓存
    temperature,
    topP,
    maxTokens,
    tools,
    reasoning,
    abortSignal,
  });

  // 3. 返回结果
  return result;
}

module.exports = processImageMode;

