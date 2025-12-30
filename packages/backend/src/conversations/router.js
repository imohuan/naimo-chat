/**
 * AI Chat API 路由
 * 支持创建对话、获取对话列表、获取对话详情，以及流式消息发送
 */

const fs = require("fs").promises;
const path = require("path");
const { randomUUID } = require("crypto");
const { PROJECT_DIR } = require("../config/constants");
const { ensureDir } = require("../utils/paths");
const { requestLLMSync } = require("./utils/llmRequest");
const titleGenerationPrompt = require("./prompts/titleGeneration");
const { replaceVariablesInMessages } = require("./utils/variableReplacer");
const {
  sendEvent,
  closeSession,
  createSession,
  getSession,
  hasSession,
} = require("./sessionService");
const {
  readConversationFile,
  writeConversationFile,
  updateMessageByRequestId,
  deleteConversationFile,
} = require("./utils/conversationFileLock");

// 模式处理函数
const processChatMode = require("./mode/chatMode");
const processCanvasMode = require("./mode/canvasMode");
const processAgentMode = require("./mode/agentMode");
const processImageMode = require("./mode/imageMode");
const processVideoMode = require("./mode/videoMode");

/**
 * 获取模式处理函数
 */
function getModeProcessor(mode) {
  const modeMap = {
    chat: processChatMode,
    canvas: processCanvasMode,
    agent: processAgentMode,
    图片: processImageMode,
    image: processImageMode,
    视频: processVideoMode,
    video: processVideoMode,
  };
  return modeMap[mode] || processChatMode;
}

/**
 * 生成对话ID（时间+短UUID格式）
 * @returns {string} 对话ID，例如 "20241228-abc123"
 */
function generateConversationId() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
  const shortUuid = randomUUID().split("-")[0];
  return `${dateStr}-${shortUuid}`;
}

/**
 * 生成消息键（messageKey）
 * @param {string} role - 消息角色
 * @param {string} [requestId] - 可选的请求ID
 * @returns {string} 消息键
 */
function generateMessageKey(role, requestId) {
  if (role === "user") {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  } else if (role === "assistant") {
    // 对于 assistant 消息，可以使用 requestId 作为 messageKey 的一部分
    return requestId
      ? `assistant-${requestId}`
      : `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  return `${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 从请求体中提取模型扩展配置参数
 * 优先从 config 对象中读取，如果没有则从 req.body 中读取（向后兼容）
 * @param {Object} config - config 对象（可选）
 * @param {Object} body - 请求体对象
 * @returns {Object} 配置参数对象 { temperature, topP, maxTokens, mcpIds, tools }
 */
function extractModelConfig(config, body) {
  return {
    temperature: config?.temperature ?? body.temperature,
    topP: config?.topP ?? body.topP,
    maxTokens: config?.maxTokens ?? body.maxTokens,
    mcpIds: config?.mcpIds ?? body.mcpIds,
    tools: config?.tools ?? body.tools,
  };
}

/**
 * 处理流式响应（通用函数）
 * @param {Object} options - 配置选项
 * @param {string} options.conversationId - 对话ID
 * @param {string} options.requestId - SSE 请求ID（也是版本ID）
 * @param {Function} options.processMode - 模式处理函数
 * @param {Object} options.processModeOptions - 传递给 processMode 的选项
 * @param {Promise<string>} [options.titlePromise] - 标题生成 Promise（可选，仅用于新对话）
 * @returns {Promise<void>}
 */
async function handleStreamResponse({
  conversationId,
  requestId,
  processMode,
  processModeOptions,
  titlePromise,
}) {
  try {
    // 更新标题（如果提供了 titlePromise，仅用于新对话）- 异步后台运行
    if (titlePromise) {
      (async () => {
        try {
          const title = await titlePromise;
          const finalConversation = await readConversationFile(conversationId);
          if (finalConversation) {
            finalConversation.title = title;
            finalConversation.updatedAt = Date.now();
            await writeConversationFile(conversationId, finalConversation);

            // 发送标题更新事件到前端
            sendEvent(requestId, {
              type: "conversation:title_updated",
              conversationId,
              title,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("更新标题失败:", error);
        }
      })();
    }

    // 构建流式事件处理回调
    let accumulatedContent = "";

    const onStreamEvent = (event) => {
      // 发送事件到 SSE 客户端
      sendEvent(requestId, event);

      // 提取文本内容（仅用于累积，不实时写入文件）
      if (event.type === "content_block_delta" && event.delta?.text) {
        accumulatedContent += event.delta.text;
      } else if (event.type === "message_delta" && event.delta?.text) {
        accumulatedContent += event.delta.text;
      }
    };

    // 调用模式处理函数
    const result = await processMode({
      ...processModeOptions,
      onStreamEvent,
      sseRequestId: requestId, // 传递 SSE 请求ID，用于发送 canvas 事件
      requestId, // 传递请求ID，用于在请求头中设置
    });

    // 更新消息版本内容（使用 requestId 查找）
    await updateMessageByRequestId(
      conversationId,
      requestId,
      (version, _message) => {
        version.content = result.fullResponse || accumulatedContent;
        version.isRequesting = false;
        return true;
      }
    );

    // 发送完成事件
    sendEvent(requestId, {
      type: "message_complete",
      requestId: requestId,
      timestamp: new Date().toISOString(),
    });

    // 关闭会话
    setTimeout(() => closeSession(requestId), 1000);
  } catch (error) {
    console.error("处理流式响应失败:", error);
    sendEvent(requestId, {
      type: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    closeSession(requestId);
  }
}

/**
 * 生成对话标题
 * @param {string} firstUserContent - 用户的第一条消息内容
 * @param {string} model - 模型ID
 * @param {string} apiKey - API Key（可选）
 * @returns {Promise<string>} 生成的标题
 */
async function generateConversationTitle(firstUserContent, model, apiKey) {
  try {
    const titlePrompt = replaceVariablesInMessages(titleGenerationPrompt, {
      firstUserContent: firstUserContent || "",
    });
    let titleDraft = await requestLLMSync({
      messages: titlePrompt,
      model,
      apiKey,
    });

    // 清洗标题
    let normalized = titleDraft.replace(/\r?\n/g, "").trim();

    // 处理重复字符（如"一则一则笑话"）
    const maxUnitLen = 4;
    for (let len = 1; len <= maxUnitLen && len * 2 <= normalized.length; len++) {
      const unit = normalized.slice(0, len);
      if (normalized.startsWith(unit.repeat(2))) {
        normalized = unit + normalized.slice(len * 2);
        break;
      }
    }

    // 限制长度（最多10个字符）
    // const finalTitle = normalized.slice(0, 10);
    const finalTitle = normalized
    return finalTitle || "新对话";
  } catch (error) {
    console.error("生成标题失败:", error);
    return "新对话";
  }
}

/**
 * 注册 AI Chat 路由
 */
function registerAiChatRoutes(server) {
  const app = server.app;

  // 确保项目目录存在
  ensureDir(PROJECT_DIR);

  /**
   * GET /api/ai_chat/conversations
   * 获取所有对话列表
   */
  app.get("/api/ai_chat/conversations", async (_req, reply) => {
    try {
      const files = await fs.readdir(PROJECT_DIR);
      const aiChatFiles = files.filter(
        (file) => file.startsWith("chat_") && file.endsWith(".json")
      );

      const conversations = await Promise.all(
        aiChatFiles.map(async (file) => {
          try {
            const filePath = path.join(PROJECT_DIR, file);
            const content = await fs.readFile(filePath, "utf-8");
            const data = JSON.parse(content);
            // 从文件名提取 ID（去掉 ai_chat_ 前缀和 .json 后缀）
            const id = file.replace(/^chat_/, "").replace(/\.json$/, "");
            return {
              id,
              title: data.title || "新对话",
              mode: data.mode || "chat",
              createdAt: data.createdAt || 0,
              updatedAt: data.updatedAt || 0,
            };
          } catch (error) {
            console.error(`读取对话文件 ${file} 失败:`, error);
            return null;
          }
        })
      );

      // 过滤掉读取失败的文件，并按更新时间倒序排序
      const validConversations = conversations
        .filter((c) => c !== null)
        .sort((a, b) => {
          const timeA = a.updatedAt || a.createdAt || 0;
          const timeB = b.updatedAt || b.createdAt || 0;
          return timeB - timeA;
        });

      return validConversations;
    } catch (error) {
      console.error("获取对话列表失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/ai_chat/conversations/:id
   * 获取单个对话详情
   */
  app.get("/api/ai_chat/conversations/:id", async (req, reply) => {
    try {
      const { id } = req.params;
      const conversation = await readConversationFile(id);
      if (!conversation) {
        reply.code(404).send({ error: "对话未找到" });
        return;
      }
      return { id, ...conversation };
    } catch (error) {
      console.error("获取对话失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/ai_chat/conversations
   * 创建新对话并发送第一条消息
   */
  app.post("/api/ai_chat/conversations", async (req, reply) => {
    try {
      const {
        initialInput,
        mode = "chat",
        messages: customMessages,
        model,
        apiKey,
        files = [],
        editorCode,
        config,
      } = req.body;

      // 从 config 对象中提取配置参数（向后兼容：也支持直接传递这些字段）
      const { temperature, topP, maxTokens, mcpIds, tools } = extractModelConfig(
        config,
        req.body
      );

      if (!initialInput && (!customMessages || customMessages.length === 0)) {
        reply.code(400).send({ error: "initialInput 必填" });
        return;
      }

      // 生成请求ID
      const requestId = randomUUID();
      const conversationId = generateConversationId();

      // 创建 SSE 会话
      createSession(requestId);

      // 生成对话标题（异步，不阻塞）
      const titlePromise = generateConversationTitle(initialInput || "", model, apiKey);

      // 构建对话对象
      const conversation = {
        id: conversationId,
        title: "新对话",
        mode,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 添加用户消息（新格式：messageKey + versions）
      if (initialInput) {
        const userMessageKey = generateMessageKey("user");
        conversation.messages.push({
          messageKey: userMessageKey,
          role: "user",
          versions: [
            {
              id: userMessageKey,
              content: initialInput,
              createdAt: Date.now(),
            },
          ],
          createdAt: Date.now(),
        });
      } else if (customMessages) {
        // 转换自定义消息为新格式
        for (const msg of customMessages) {
          const msgKey = generateMessageKey(msg.role);
          conversation.messages.push({
            messageKey: msgKey,
            role: msg.role,
            versions: [
              {
                id: msgKey,
                content: msg.content || "",
                createdAt: Date.now(),
              },
            ],
            createdAt: Date.now(),
          });
        }
      }

      const assistantMessageKey = generateMessageKey("assistant", requestId);

      // 添加初始 assistant 消息（正在请求中，新格式）
      conversation.messages.push({
        messageKey: assistantMessageKey,
        role: "assistant",
        versions: [
          {
            id: requestId, // 直接使用 requestId
            content: "",
            isRequesting: true,
            createdAt: Date.now(),
          },
        ],
        createdAt: Date.now(),
      });

      // 保存对话文件
      await writeConversationFile(conversationId, conversation);

      // 异步处理流式响应
      (async () => {
        const processMode = getModeProcessor(mode);
        await handleStreamResponse({
          conversationId,
          requestId,
          processMode,
          processModeOptions: {
            conversation: null, // 新对话，没有历史
            currentInput: initialInput || "",
            mode,
            files,
            editorCode,
            model,
            apiKey,
            conversationId, // 传递对话ID，用于保存 canvas 文件
            temperature,
            topP,
            maxTokens,
            mcpIds,
            tools,
          },
          titlePromise,
        });
      })();

      // 立即返回
      return {
        id: conversationId,
        requestId,
        streamUrl: `/api/ai_chat/conversations/${conversationId}/stream/${requestId}`,
      };
    } catch (error) {
      console.error("创建对话失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/ai_chat/conversations/:id/messages
   * 向现有对话发送消息
   */
  app.post("/api/ai_chat/conversations/:id/messages", async (req, reply) => {
    try {
      const { id } = req.params;
      const {
        content,
        mode: newMode,
        model,
        apiKey,
        files = [],
        editorCode,
        config,
      } = req.body;

      // 从 config 对象中提取配置参数（向后兼容：也支持直接传递这些字段）
      const { temperature, topP, maxTokens, mcpIds, tools } = extractModelConfig(
        config,
        req.body
      );

      if (!content) {
        reply.code(400).send({ error: "content 必填" });
        return;
      }

      // 读取对话数据
      const conversation = await readConversationFile(id);
      if (!conversation) {
        reply.code(404).send({ error: "对话未找到" });
        return;
      }

      // 检查最后一条 assistant 消息是否正在请求中
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      if (lastMessage && lastMessage.isRequesting) {
        reply.code(409).send({ error: "对话正在请求中，请稍候" });
        return;
      }

      // 确定使用的模式
      const mode = newMode || conversation.mode || "chat";
      if (newMode) {
        conversation.mode = newMode;
      }

      // 生成新的请求ID
      const requestId = randomUUID();
      createSession(requestId);

      // 检查是否有重试请求（通过 messageKey 参数判断）
      const { messageKey: retryMessageKey } = req.body;

      // 如果是重试，不创建新的用户消息，使用之前的用户消息内容
      if (!retryMessageKey) {
        // 添加用户消息（messageKey + versions）- 仅非重试时
        const userMessageKey = generateMessageKey("user");
        conversation.messages.push({
          messageKey: userMessageKey,
          role: "user",
          versions: [
            {
              id: userMessageKey,
              content,
              createdAt: Date.now(),
            },
          ],
          createdAt: Date.now(),
        });
      }

      const assistantMessageKey = generateMessageKey("assistant", requestId);

      // 如果是重试，在同一消息下添加新版本
      if (retryMessageKey) {
        const existingMessage = conversation.messages.find(
          (msg) => msg.messageKey === retryMessageKey && msg.role === "assistant"
        );
        if (existingMessage) {
          // 在同一消息下添加新版本
          existingMessage.versions.push({
            id: requestId, // 直接使用 requestId
            content: "",
            isRequesting: true,
            createdAt: Date.now(),
          });
          existingMessage.updatedAt = Date.now();
        } else {
          // 如果找不到原消息，创建新消息
          conversation.messages.push({
            messageKey: assistantMessageKey,
            role: "assistant",
            versions: [
              {
                id: requestId, // 直接使用 requestId
                content: "",
                isRequesting: true,
                createdAt: Date.now(),
              },
            ],
            createdAt: Date.now(),
          });
        }
      } else {
        // 添加新的 assistant 消息（正在请求中，新格式）
        conversation.messages.push({
          messageKey: assistantMessageKey,
          role: "assistant",
          versions: [
            {
              id: requestId, // 直接使用 requestId
              content: "",
              isRequesting: true,
              createdAt: Date.now(),
            },
          ],
          createdAt: Date.now(),
        });
      }

      conversation.updatedAt = Date.now();
      await writeConversationFile(id, conversation);

      // 异步处理流式响应
      (async () => {
        const processMode = getModeProcessor(mode);
        await handleStreamResponse({
          conversationId: id,
          requestId,
          processMode,
          processModeOptions: {
            conversation,
            currentInput: content,
            mode,
            files,
            editorCode,
            model,
            apiKey,
            conversationId: id, // 传递对话ID，用于保存 canvas 文件
            temperature,
            topP,
            maxTokens,
            mcpIds,
            tools,
          },
        });
      })();

      return {
        requestId,
        streamUrl: `/api/ai_chat/conversations/${id}/stream/${requestId}`,
      };
    } catch (error) {
      console.error("发送消息失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/ai_chat/conversations/:id/stream/:requestId
   * SSE 流式响应端点
   */
  app.get("/api/ai_chat/conversations/:id/stream/:requestId", async (req, reply) => {
    const { requestId } = req.params;

    if (!hasSession(requestId)) {
      reply.code(404).send("stream not found");
      return;
    }

    const session = getSession(requestId);

    // 设置 CORS 头（SSE 流式响应需要手动设置）
    const origin = req.headers.origin || "*";
    const allowCredentials = origin && origin !== "*" ? "true" : "false";
    const reqHeaders =
      req.headers["access-control-request-headers"] ||
      "Content-Type,Authorization,Accept,Cache-Control,Last-Event-ID";

    // 设置 SSE 响应头（包含 CORS 头）
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": reqHeaders,
      "Access-Control-Allow-Credentials": allowCredentials,
      "Access-Control-Expose-Headers": "*",
      Vary: "Origin",
    });
    reply.raw.write("\n");

    session.clients.add(reply.raw);

    // 回放已有事件
    for (const evt of session.events) {
      reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    }

    // 如果会话已结束，直接结束响应
    if (session.closed) {
      reply.raw.end();
      return;
    }

    // 监听连接关闭
    req.raw.on("close", () => {
      session.clients.delete(reply.raw);
    });

    // 保持连接
    return new Promise(() => { });
  });

  /**
   * DELETE /api/ai_chat/conversations/:id
   * 删除对话
   */
  app.delete("/api/ai_chat/conversations/:id", async (req, reply) => {
    try {
      const { id } = req.params;

      const existing = await readConversationFile(id);
      if (!existing) {
        reply.code(404).send({ error: "对话未找到" });
        return;
      }

      await deleteConversationFile(id);
      return { success: true };
    } catch (error) {
      console.error("删除对话失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/ai_chat/conversations/:id/canvas
   * 获取 Canvas 代码历史
   */
  app.get("/api/ai_chat/conversations/:id/canvas", async (req, reply) => {
    try {
      const { id } = req.params;
      const { readCanvasFile } = require("./utils/canvasFileManager");

      const canvasData = await readCanvasFile(id);
      if (!canvasData) {
        // 如果文件不存在，返回空结构
        return {
          conversationId: id,
          codeHistory: {
            versions: [],
            currentVersionIndex: 0,
          },
          updatedAt: Date.now(),
        };
      }

      return canvasData;
    } catch (error) {
      console.error("获取 Canvas 数据失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * PUT /api/ai_chat/conversations/:id/canvas
   * 更新整个 Canvas 代码历史
   */
  app.put("/api/ai_chat/conversations/:id/canvas", async (req, reply) => {
    try {
      const { id } = req.params;
      const { writeCanvasFile } = require("./utils/canvasFileManager");

      const canvasData = req.body;
      if (!canvasData || !canvasData.conversationId) {
        reply.code(400).send({ error: "无效的 Canvas 数据" });
        return;
      }

      // 确保 conversationId 匹配
      if (canvasData.conversationId !== id) {
        canvasData.conversationId = id;
      }

      await writeCanvasFile(id, canvasData);
      return { success: true };
    } catch (error) {
      console.error("更新 Canvas 数据失败:", error);
      reply.code(500).send({ error: error.message });
    }
  });

  /**
   * POST /api/ai_chat/conversations/:id/canvas/records/:recordId/apply
   * 应用 diff 并保存最终代码
   */
  app.post(
    "/api/ai_chat/conversations/:id/canvas/records/:recordId/apply",
    async (req, reply) => {
      try {
        const { id, recordId } = req.params;
        const { code } = req.body;
        const { updateCodeRecord } = require("./utils/canvasFileManager");

        if (!code) {
          reply.code(400).send({ error: "code 必填" });
          return;
        }

        const updated = await updateCodeRecord(id, recordId, code);
        if (!updated) {
          reply.code(404).send({ error: "记录未找到" });
          return;
        }

        return { success: true, recordId };
      } catch (error) {
        console.error("应用 diff 失败:", error);
        reply.code(500).send({ error: error.message });
      }
    }
  );
}

module.exports = { registerAiChatRoutes };
