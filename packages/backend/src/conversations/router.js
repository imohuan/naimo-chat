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
 * 获取对话文件路径
 */
function getConversationFilePath(id) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(PROJECT_DIR, `ai_chat_${safeId}.json`);
}

/**
 * 读取对话文件
 * 添加重试机制以处理文件写入时的竞态条件
 */
async function readConversationFile(id, retries = 3) {
  const filePath = getConversationFilePath(id);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const content = await fs.readFile(filePath, "utf-8");

      // 检查内容是否为空或只有空白字符
      if (!content || !content.trim()) {
        if (attempt < retries - 1) {
          // 等待一小段时间后重试
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
          continue;
        }
        console.warn(`对话文件为空: ${filePath}`);
        return null;
      }

      // 尝试解析 JSON
      try {
        return JSON.parse(content);
      } catch (parseError) {
        // 如果是最后一次尝试，记录错误并返回 null
        if (attempt === retries - 1) {
          console.error(`对话文件 JSON 解析失败: ${filePath}`, parseError);
          console.error(`文件内容预览: ${content.substring(0, 200)}...`);
          return null;
        }
        // 否则等待后重试（可能是文件正在写入中）
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        continue;
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      // 如果是最后一次尝试，抛出错误
      if (attempt === retries - 1) {
        throw error;
      }
      // 其他错误也重试
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }

  return null;
}

/**
 * 写入对话文件
 */
async function writeConversationFile(id, data) {
  const filePath = getConversationFilePath(id);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 删除对话文件
 */
async function deleteConversationFile(id) {
  const filePath = getConversationFilePath(id);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
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
    for (
      let len = 1;
      len <= maxUnitLen && len * 2 <= normalized.length;
      len++
    ) {
      const unit = normalized.slice(0, len);
      if (normalized.startsWith(unit.repeat(2))) {
        normalized = unit + normalized.slice(len * 2);
        break;
      }
    }

    // 限制长度（最多10个字符）
    const finalTitle = normalized.slice(0, 10);
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
      const aiChatFiles = files.filter((file) =>
        file.startsWith("ai_chat_") && file.endsWith(".json")
      );

      const conversations = await Promise.all(
        aiChatFiles.map(async (file) => {
          try {
            const filePath = path.join(PROJECT_DIR, file);
            const content = await fs.readFile(filePath, "utf-8");
            const data = JSON.parse(content);
            // 从文件名提取 ID（去掉 ai_chat_ 前缀和 .json 后缀）
            const id = file.replace(/^ai_chat_/, "").replace(/\.json$/, "");
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
      } = req.body;

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
      const titlePromise = generateConversationTitle(
        initialInput || "",
        model,
        apiKey
      );

      // 构建对话对象
      const conversation = {
        id: conversationId,
        title: "新对话",
        mode,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 添加用户消息
      if (initialInput) {
        conversation.messages.push({
          role: "user",
          content: initialInput,
        });
      } else if (customMessages) {
        conversation.messages.push(...customMessages);
      }

      // 添加初始 assistant 消息（正在请求中）
      // 注意：currentRequestId 将在获取到服务器返回的 X-Request-Id 后更新
      conversation.messages.push({
        role: "assistant",
        content: "",
        isRequesting: true,
        currentRequestId: null, // 初始为 null，等待服务器返回真实的 requestId
      });

      // 保存对话文件
      await writeConversationFile(conversationId, conversation);

      // 异步处理流式响应
      (async () => {
        try {
          // 获取模式处理函数
          const processMode = getModeProcessor(mode);

          // 构建流式事件处理回调
          let accumulatedContent = "";
          let serverRequestId = null; // 存储从服务器获取的真实 requestId
          const onStreamEvent = (event) => {
            // 处理 request_id 事件（从响应头获取的真实 requestId）
            if (event.type === "request_id" && event.requestId) {
              serverRequestId = event.requestId;
              // 立即更新对话文件中的 currentRequestId
              (async () => {
                try {
                  const currentConversation = await readConversationFile(
                    conversationId
                  );
                  if (currentConversation) {
                    const lastMessage =
                      currentConversation.messages[
                      currentConversation.messages.length - 1
                      ];
                    if (lastMessage && lastMessage.role === "assistant") {
                      lastMessage.currentRequestId = serverRequestId;
                      currentConversation.updatedAt = Date.now();
                      await writeConversationFile(
                        conversationId,
                        currentConversation
                      );
                    }
                  }
                } catch (error) {
                  console.error("更新 requestId 失败:", error);
                }
              })();
            }

            // 发送事件到 SSE 客户端
            sendEvent(requestId, event);

            // 提取文本内容
            if (event.type === "content_block_delta" && event.delta?.text) {
              accumulatedContent += event.delta.text;
            } else if (event.type === "message_delta" && event.delta?.text) {
              accumulatedContent += event.delta.text;
            }

            // 实时更新对话文件中的 assistant 消息内容
            (async () => {
              try {
                const currentConversation = await readConversationFile(
                  conversationId
                );
                if (currentConversation) {
                  const lastMessage =
                    currentConversation.messages[
                    currentConversation.messages.length - 1
                    ];
                  if (lastMessage && lastMessage.role === "assistant") {
                    lastMessage.content = accumulatedContent;
                    // 如果已获取到服务器返回的 requestId，更新 currentRequestId
                    if (serverRequestId && !lastMessage.currentRequestId) {
                      lastMessage.currentRequestId = serverRequestId;
                    }
                    currentConversation.updatedAt = Date.now();
                    await writeConversationFile(
                      conversationId,
                      currentConversation
                    );
                  }
                }
              } catch (error) {
                console.error("实时更新对话失败:", error);
              }
            })();
          };

          // 调用模式处理函数
          const result = await processMode({
            conversation: null, // 新对话，没有历史
            currentInput: initialInput || "",
            mode,
            files,
            editorCode,
            model,
            apiKey,
            onStreamEvent,
          });

          // 获取服务器返回的真实 requestId
          serverRequestId = result.requestId || null;

          // 更新标题（如果已生成）
          const title = await titlePromise;
          conversation.title = title;

          // 更新最后的 assistant 消息
          const lastMessage =
            conversation.messages[conversation.messages.length - 1];
          if (lastMessage && lastMessage.role === "assistant") {
            lastMessage.content = result.fullResponse || accumulatedContent;
            lastMessage.isRequesting = false;
            // 使用服务器返回的真实 requestId
            lastMessage.currentRequestId = serverRequestId;
          }

          conversation.updatedAt = Date.now();
          await writeConversationFile(conversationId, conversation);

          // 发送完成事件
          sendEvent(requestId, {
            type: "message_complete",
            requestId: result.requestId || requestId,
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
      } = req.body;

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
      const lastMessage =
        conversation.messages[conversation.messages.length - 1];
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

      // 添加用户消息
      conversation.messages.push({
        role: "user",
        content,
      });

      // 添加新的 assistant 消息（正在请求中）
      // 注意：currentRequestId 将在获取到服务器返回的 X-Request-Id 后更新
      conversation.messages.push({
        role: "assistant",
        content: "",
        isRequesting: true,
        currentRequestId: null, // 初始为 null，等待服务器返回真实的 requestId
      });

      conversation.updatedAt = Date.now();
      await writeConversationFile(id, conversation);

      // 异步处理流式响应
      (async () => {
        try {
          const processMode = getModeProcessor(mode);

          let accumulatedContent = "";
          let serverRequestId = null; // 存储从服务器获取的真实 requestId
          const onStreamEvent = (event) => {
            // 处理 request_id 事件（从响应头获取的真实 requestId）
            if (event.type === "request_id" && event.requestId) {
              serverRequestId = event.requestId;
              // 立即更新对话文件中的 currentRequestId
              (async () => {
                try {
                  const currentConversation = await readConversationFile(id);
                  if (currentConversation) {
                    const lastMsg =
                      currentConversation.messages[
                      currentConversation.messages.length - 1
                      ];
                    if (lastMsg && lastMsg.role === "assistant") {
                      lastMsg.currentRequestId = serverRequestId;
                      currentConversation.updatedAt = Date.now();
                      await writeConversationFile(id, currentConversation);
                    }
                  }
                } catch (error) {
                  console.error("更新 requestId 失败:", error);
                }
              })();
            }

            sendEvent(requestId, event);

            if (event.type === "content_block_delta" && event.delta?.text) {
              accumulatedContent += event.delta.text;
            } else if (event.type === "message_delta" && event.delta?.text) {
              accumulatedContent += event.delta.text;
            }

            // 实时更新对话文件
            (async () => {
              try {
                const currentConversation = await readConversationFile(id);
                if (currentConversation) {
                  const lastMsg =
                    currentConversation.messages[
                    currentConversation.messages.length - 1
                    ];
                  if (lastMsg && lastMsg.role === "assistant") {
                    lastMsg.content = accumulatedContent;
                    // 如果已获取到服务器返回的 requestId，更新 currentRequestId
                    if (serverRequestId && !lastMsg.currentRequestId) {
                      lastMsg.currentRequestId = serverRequestId;
                    }
                    currentConversation.updatedAt = Date.now();
                    await writeConversationFile(id, currentConversation);
                  }
                }
              } catch (error) {
                console.error("实时更新对话失败:", error);
              }
            })();
          };

          const result = await processMode({
            conversation,
            currentInput: content,
            mode,
            files,
            editorCode,
            model,
            apiKey,
            onStreamEvent,
          });

          // 获取服务器返回的真实 requestId
          serverRequestId = result.requestId || null;

          // 更新最后的 assistant 消息
          const lastMsg =
            conversation.messages[conversation.messages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            lastMsg.content = result.fullResponse || accumulatedContent;
            lastMsg.isRequesting = false;
            // 使用服务器返回的真实 requestId
            lastMsg.currentRequestId = serverRequestId;
          }

          conversation.updatedAt = Date.now();
          await writeConversationFile(id, conversation);

          sendEvent(requestId, {
            type: "message_complete",
            requestId: result.requestId || requestId,
            timestamp: new Date().toISOString(),
          });

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

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
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
}

module.exports = { registerAiChatRoutes };

