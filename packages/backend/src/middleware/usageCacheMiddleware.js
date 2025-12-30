/**
 * 用量缓存中间件
 * 
 * 功能概述：
 * 1. 从 API 响应中提取并缓存会话的 token 用量信息（usage）
 * 2. 支持流式响应（SSE）和非流式响应两种格式
 * 3. 支持 agents 工具调用场景，能够检测工具调用、执行工具、并将结果返回给模型继续对话
 * 4. **重要**：工具调用事件会正常传递给前端，前端可以显示工具调用的完整过程
 * 
 * 工作流程：
 * - 流式响应（带 agents）：
 *   1. 解析 SSE 流为结构化事件
 *   2. 检测工具调用事件（content_block_start/content_block_delta/content_block_stop）
 *   3. **正常传递所有事件给前端**（前端可以显示工具调用过程）
 *   4. 在后台异步执行工具（不阻塞事件传递）
 *   5. 工具执行完成后，发送 tool:result 或 tool:error 事件给前端
 *   6. 当收到 message_delta 事件且所有工具执行完成后，发送新请求让模型继续对话
 *   7. 转发模型基于工具结果的回复流
 * - 流式响应（无 agents）：克隆流 → 后台读取提取 usage → 缓存 → 返回原流
 * - 非流式响应：直接提取 usage → 缓存 → 返回原响应
 * 
 * 新增的 SSE 事件类型（用于前端显示）：
 * - tool:result: 工具执行成功，包含 tool_use_id、tool_name、result、index
 * - tool:error: 工具执行失败，包含 tool_use_id、tool_name、error、index
 * - tool:continue_error: 工具执行后继续对话失败，包含 error
 */
const { SSEParserTransform } = require("../utils/SSEParser.transform");
const { SSESerializerTransform } = require("../utils/SSESerializer.transform");
const { rewriteStream } = require("../utils/rewriteStream");
const JSON5 = require("json5");

// 兼容 Node.js 环境的 fetch
const fetch =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

/**
 * 安全地向流控制器推送事件（处理流已关闭的情况）
 * @param {ReadableStreamDefaultController} controller - 流控制器
 * @param {Object} event - 要推送的事件对象
 * @returns {boolean} 是否成功推送
 */
function safeEnqueue(controller, event) {
  try {
    controller.enqueue(event);
    return true;
  } catch (error) {
    // 流可能已关闭，这是正常情况，不需要记录为错误
    if (error.code === 'ERR_INVALID_STATE' || error.message?.includes('closed')) {
      // 静默忽略，不记录警告
      return false;
    }
    // 其他错误仍然记录
    console.warn("Failed to enqueue event:", error);
    return false;
  }
}

/**
 * 发送工具结果到模型，让模型基于工具结果继续生成回复
 * @param {ReadableStreamDefaultController} controller - 流控制器
 * @param {Array} toolMessages - 工具执行结果消息数组
 * @param {Array} assistantMessages - 助手工具调用消息数组
 * @param {Object} req - 原始请求对象
 * @param {Object} config - 配置对象
 * @param {AbortController} abortController - 中止控制器
 */
async function sendToolResultToModel(controller, toolMessages, assistantMessages, req, config, abortController) {
  try {
    // 将助手工具调用消息和工具结果消息添加到请求历史中
    const newReqBody = JSON.parse(JSON.stringify(req.body)); // 深拷贝避免修改原请求
    newReqBody.messages.push({
      role: 'assistant',
      content: assistantMessages  // 模型调用了哪些工具
    });
    newReqBody.messages.push({
      role: 'user',
      content: toolMessages       // 工具执行的结果
    });

    // 获取服务端口（默认 3457）
    const port = config?.PORT || 3457;
    const host = config?.HOST || "127.0.0.1";

    // 构建请求头 - 使用 Authorization: Bearer 格式（与 llmRequest.js 保持一致）
    const headers = {
      "Content-Type": "application/json",
    };
    if (config?.APIKEY) {
      headers["Authorization"] = `Bearer ${config.APIKEY}`;
    }

    // 发送新的请求到 API，让模型基于工具结果继续生成
    // 添加标记，避免新请求被中间件重复处理工具调用
    newReqBody._internalToolContinue = true;

    console.log(`[usageCacheMiddleware] 发送新请求到模型，工具消息数量: ${toolMessages.length}`);
    const response = await fetch(`http://${host}:${port}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(newReqBody),
      signal: abortController.signal
    });

    console.log(`[usageCacheMiddleware] 新请求响应状态: ${response.status} ${response.statusText}`);
    console.log(`[usageCacheMiddleware] 新请求响应 Content-Type: ${response.headers.get('content-type')}`);

    // 如果请求失败，发送错误事件给前端
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error(`[usageCacheMiddleware] 新请求失败: ${response.status} ${errorText}`);
      safeEnqueue(controller, {
        event: 'tool:continue_error',
        data: {
          type: 'tool:continue_error',
          error: `工具执行后继续对话失败: ${response.status} ${errorText}`
        }
      });
      return;
    }

    // 检查响应是否是流式响应
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream') && !contentType.includes('text/plain')) {
      console.warn(`[usageCacheMiddleware] 新请求响应不是 SSE 流格式: ${contentType}`);
    }

    // 检查响应体是否存在
    if (!response.body) {
      console.error(`[usageCacheMiddleware] 新请求响应体为空`);
      safeEnqueue(controller, {
        event: 'tool:continue_error',
        data: {
          type: 'tool:continue_error',
          error: '新请求响应体为空'
        }
      });
      return;
    }

    // 解析新响应的 SSE 流
    const stream = response.body.pipeThrough(new SSEParserTransform());
    const reader = stream.getReader();
    console.log(`[usageCacheMiddleware] 开始读取新请求的流`);

    // 读取并转发新响应的所有事件（模型基于工具结果的回复）
    let eventCount = 0;
    let receivedMessageComplete = false;
    while (true) {
      try {
        const { value, done } = await reader.read();
        if (done) {
          console.log(`[usageCacheMiddleware] 新请求流读取完成，共转发 ${eventCount} 个事件`);
          // 如果新请求流完成但没有收到 message_complete，发送一个标记事件
          if (!receivedMessageComplete) {
            safeEnqueue(controller, {
              event: 'tool:continue_complete',
              data: {
                type: 'tool:continue_complete',
                timestamp: new Date().toISOString()
              }
            });
          }
          break;
        }

        // 检测 message_complete 事件
        if (value.event === 'message_complete' || (value.data && value.data.type === 'message_complete')) {
          receivedMessageComplete = true;
          // 发送工具继续完成事件，通知前端和会话管理可以关闭连接
          safeEnqueue(controller, {
            event: 'tool:continue_complete',
            data: {
              type: 'tool:continue_complete',
              timestamp: new Date().toISOString()
            }
          });
        }

        // 跳过消息开始和结束事件（这些是控制事件，不需要传递给客户端）
        if (value.event && ['message_start', 'message_stop'].includes(value.event)) {
          continue;
        }

        // 确保事件格式正确：需要包含 event 和 data 字段
        // 如果只有 data 字段，尝试从 data.type 推断 event
        if (!value.event && value.data && value.data.type) {
          value.event = value.data.type;
        }

        // 调试：记录事件信息
        if (eventCount < 5) {
          console.log(`[usageCacheMiddleware] 新请求事件 #${eventCount + 1}:`, {
            event: value.event,
            hasData: !!value.data,
            dataType: value.data?.type
          });
        }

        // 检查流是否仍然可写（背压控制）
        // 如果 desiredSize <= 0，说明下游处理不过来，停止读取
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          console.warn(`[usageCacheMiddleware] 流背压，停止读取新请求的事件`);
          break;
        }

        // 确保事件格式正确：必须包含 event 和 data 字段
        const eventToEnqueue = {
          event: value.event || (value.data?.type ? value.data.type : 'message'),
          data: value.data || value,
        };

        // 如果原始 value 有 id，保留它
        if (value.id) {
          eventToEnqueue.id = value.id;
        }

        // 将事件推送到输出流
        // 使用 safeEnqueue 来避免流已关闭的错误
        if (safeEnqueue(controller, eventToEnqueue)) {
          eventCount++;
          // 调试：记录前几个事件的详细信息
          if (eventCount <= 3) {
            console.log(`[usageCacheMiddleware] 成功转发事件 #${eventCount}:`, {
              event: eventToEnqueue.event,
              hasData: !!eventToEnqueue.data,
              dataType: eventToEnqueue.data?.type
            });
          }
        } else {
          // 流已关闭，停止读取
          console.log(`[usageCacheMiddleware] 流已关闭，停止读取新请求的事件 (已转发 ${eventCount} 个)`);
          break;
        }
      } catch (readError) {
        // 处理流提前关闭的情况
        if (readError.name === 'AbortError' || readError.code === 'ERR_STREAM_PREMATURE_CLOSE') {
          console.log(`[usageCacheMiddleware] 新请求流被中止或提前关闭`);
          abortController.abort();
          break;
        }
        console.error(`[usageCacheMiddleware] 读取新请求流时出错:`, readError);
        throw readError;
      }
    }

    // 确保读取器被释放
    try {
      reader.releaseLock();
    } catch {
      // 忽略释放锁的错误
    }
  } catch (error) {
    // 如果错误不是流关闭错误，则重新抛出
    if (error.name !== 'AbortError' && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      throw error;
    }
  }
}

/**
 * 创建用量缓存中间件
 * 
 * @param {Object} sessionUsageCache - 会话用量缓存对象，提供 put(sessionId, usage) 方法
 * @param {Object} config - 配置对象，包含 PORT（端口）和 APIKEY（API 密钥）等
 * @param {Object} agentsManager - Agents 管理器，提供 getAgent(name) 方法获取 agent 实例
 * @returns {Object} 包含 preHandler 和 onSend 方法的对象
 */
function createUsageCacheMiddleware(sessionUsageCache, config = null, agentsManager = null) {
  const preHandler = async (req, _reply) => {
    if (req.url.startsWith("/v1/messages") && !req.url.startsWith("/v1/messages/count_tokens")) {
      const useAgents = [];

      if (agentsManager) {
        for (const agent of agentsManager.getAllAgents()) {
          if (agent.shouldHandle && agent.shouldHandle(req, config)) {
            // 设置agent标识
            useAgents.push(agent.name);

            // change request body
            if (agent.reqHandler) {
              try {
                agent.reqHandler(req, config);
              } catch (error) {
                console.error(`[usageCacheMiddleware] Agent ${agent.name} reqHandler 执行失败:`, error);
              }
            }

            // append agent tools
            if (agent.tools && agent.tools.size) {
              if (!req.body?.tools?.length) {
                req.body.tools = [];
              }
              req.body.tools.unshift(...Array.from(agent.tools.values()).map(item => {
                return {
                  name: item.name,
                  description: item.description,
                  input_schema: item.input_schema
                };
              }));
            }
          }
        }
      }

      if (useAgents.length) {
        req.agents = useAgents;
      }
    }
  };

  const onSend = (req, reply, payload, done) => {
    // ========== 条件检查：只处理符合条件的请求 ==========
    // 1. 必须有会话 ID
    // 2. 必须是 /v1/messages 接口（排除 count_tokens 子接口）
    // 3. 排除内部工具继续请求（避免重复处理）
    if (
      req.sessionId &&
      req.url.startsWith("/v1/messages") &&
      !req.url.startsWith("/v1/messages/count_tokens") &&
      !req.body?._internalToolContinue
    ) {
      // ========== 流式响应处理 ==========
      if (payload instanceof ReadableStream) {
        // ========== 场景 1：处理 agents 工具调用 ==========
        // 当请求包含 agents 且提供了 agentsManager 时，需要拦截工具调用并执行
        if (req.agents && agentsManager) {
          // 创建中止控制器，用于在流提前关闭时取消操作
          const abortController = new AbortController();

          // 将原始 SSE 字符串流转换为结构化事件对象流
          const eventStream = payload.pipeThrough(new SSEParserTransform());

          // ========== 工具调用状态跟踪变量 ==========
          let currentAgent = undefined;      // 当前正在处理的 agent 实例
          let currentToolIndex = -1;         // 当前工具调用的索引位置
          let currentToolName = '';          // 当前工具的名称
          let currentToolArgs = '';          // 当前工具的参数（JSON 字符串，可能分片传输）
          let currentToolId = '';            // 当前工具调用的唯一 ID

          // ========== 消息收集数组 ==========
          const toolMessages = [];           // 存储工具执行结果消息（tool_result）
          const assistantMessages = [];      // 存储助手工具调用消息（tool_use）
          const pendingToolExecutions = new Map(); // 跟踪正在执行的工具（toolId -> Promise）
          let messageDeltaReceived = false;  // 标记是否已收到 message_delta 事件

          // 使用 rewriteStream 重写流，在流传输过程中拦截和处理事件
          return done(null, rewriteStream(eventStream, async (data, controller) => {
            try {
              // ========== 阶段 1：检测工具调用开始 ==========
              // 当收到 content_block_start 事件且包含工具名称时，说明模型开始调用工具
              if (data.event === 'content_block_start' && data?.data?.content_block?.name) {
                // 遍历请求中的 agents，查找哪个 agent 注册了这个工具
                const agent = req.agents.find((name) => {
                  const agentInstance = agentsManager.getAgent(name);
                  // 检查该 agent 是否注册了此工具
                  return agentInstance?.tools?.get(data.data.content_block.name);
                });

                // 如果找到对应的 agent，记录工具调用信息（但不隐藏事件，让前端能看到）
                if (agent) {
                  hasToolCalls = true; // 标记有工具调用
                  const agentInstance = agentsManager.getAgent(agent);
                  if (agentInstance) {
                    currentAgent = agentInstance;
                    currentToolIndex = data.data.index;              // 记录工具在内容块中的索引
                    currentToolName = data.data.content_block.name;   // 记录工具名称
                    currentToolId = data.data.content_block.id;      // 记录工具调用 ID
                    // 正常传递事件给前端，让前端能够显示工具调用
                  }
                }
                // 无论是否找到 agent，都正常传递事件给前端
                return data;
              }

              // ========== 阶段 2：收集工具参数 ==========
              // 工具参数可能以分片形式传输（input_json_delta），需要拼接完整
              if (currentToolIndex > -1 &&
                data.data?.index === currentToolIndex &&
                data.data?.delta?.type === 'input_json_delta') {
                // 累加分片的 JSON 参数
                currentToolArgs += data.data?.delta?.partial_json || '';
                // 正常传递参数分片事件给前端，让前端能够显示工具参数
                return data;
              }

              // ========== 阶段 3：工具调用完成，执行工具 ==========
              // 当收到 content_block_stop 事件时，说明工具参数已收集完整
              if (currentToolIndex > -1 &&
                data.data?.index === currentToolIndex &&
                data.data?.type === 'content_block_stop') {
                // 先正常传递事件给前端，让前端能够显示工具调用完成
                // 然后在后台异步执行工具，不阻塞事件传递
                const toolIndex = currentToolIndex;
                const toolId = currentToolId;
                const toolName = currentToolName;
                const toolArgs = currentToolArgs;
                const agentInstance = currentAgent;

                // 异步执行工具（不阻塞事件传递）
                const toolExecutionPromise = (async () => {
                  try {
                    // 解析完整的工具参数（使用 JSON5 支持更宽松的 JSON 格式）
                    const args = JSON5.parse(toolArgs);

                    // 构建助手消息：记录模型调用了哪个工具
                    assistantMessages.push({
                      type: "tool_use",
                      id: toolId,
                      name: toolName,
                      input: args
                    });

                    // 执行工具：调用 agent 中注册的工具处理器
                    const toolResult = await agentInstance?.tools?.get(toolName)?.handler(args, {
                      req,    // 传递请求对象，工具可能需要访问请求上下文
                      config  // 传递配置对象，工具可能需要访问配置信息
                    });

                    // 构建工具结果消息：记录工具执行的结果
                    toolMessages.push({
                      "tool_use_id": toolId,  // 关联到对应的工具调用 ID
                      "type": "tool_result",
                      "content": toolResult           // 工具执行的结果
                    });

                    // 发送工具执行结果事件给前端（失败不影响 Promise 状态）
                    safeEnqueue(controller, {
                      event: 'tool:result',
                      data: {
                        type: 'tool:result',
                        tool_use_id: toolId,
                        tool_name: toolName,
                        result: toolResult,
                        index: toolIndex
                      }
                    });

                    // 如果已经收到 message_delta 事件，立即发送新请求
                    // 注意：即使流已关闭，sendToolResultToModel 也会安全处理
                    if (messageDeltaReceived && toolMessages.length > 0) {
                      try {
                        await sendToolResultToModel(controller, toolMessages, assistantMessages, req, config, abortController);
                      } catch (sendError) {
                        // 发送新请求失败不影响工具执行 Promise 的状态
                        // 错误已经在 sendToolResultToModel 中处理
                        console.error("Error sending tool result to model:", sendError);
                      }
                    }
                  } catch (e) {
                    console.error("Error processing tool call:", e);
                    // 发送工具执行错误事件给前端（失败不影响 Promise 状态）
                    safeEnqueue(controller, {
                      event: 'tool:error',
                      data: {
                        type: 'tool:error',
                        tool_use_id: toolId,
                        tool_name: toolName,
                        error: e.message || String(e),
                        index: toolIndex
                      }
                    });
                  } finally {
                    // 从待执行列表中移除
                    pendingToolExecutions.delete(toolId);
                  }
                })();

                // 记录正在执行的工具
                pendingToolExecutions.set(toolId, toolExecutionPromise);

                // ========== 重置状态变量 ==========
                currentAgent = undefined;
                currentToolIndex = -1;
                currentToolName = '';
                currentToolArgs = '';
                currentToolId = '';

                // 正常传递工具调用停止事件给前端
                return data;
              }

              // ========== 阶段 4：工具执行完成，发送新请求继续对话 ==========
              // 当收到 message_delta 事件时，标记已收到，并检查是否有工具需要执行
              if (data.event === 'message_delta') {
                messageDeltaReceived = true;
                console.log(`[usageCacheMiddleware] 收到 message_delta，工具消息数量: ${toolMessages.length}，待执行工具数量: ${pendingToolExecutions.size}`);

                // 如果有工具消息且没有待执行的工具，立即发送新请求
                if (toolMessages.length > 0 && pendingToolExecutions.size === 0) {
                  // 异步发送新请求（不阻塞当前事件传递）
                  const messagesToSend = [...toolMessages];
                  const assistantMessagesToSend = [...assistantMessages];

                  console.log(`[usageCacheMiddleware] 立即发送新请求，工具消息数量: ${messagesToSend.length}`);

                  // 清空工具消息数组，避免重复发送
                  toolMessages.length = 0;
                  assistantMessages.length = 0;

                  sendToolResultToModel(controller, messagesToSend, assistantMessagesToSend, req, config, abortController).catch(error => {
                    console.error("[usageCacheMiddleware] Error continuing conversation after tool execution:", error);
                    safeEnqueue(controller, {
                      event: 'tool:continue_error',
                      data: {
                        type: 'tool:continue_error',
                        error: error.message || String(error)
                      }
                    });
                  });
                } else if (pendingToolExecutions.size > 0) {
                  // 如果有待执行的工具，等待所有工具执行完成后再发送新请求
                  console.log(`[usageCacheMiddleware] 等待 ${pendingToolExecutions.size} 个工具执行完成`);
                  Promise.all(Array.from(pendingToolExecutions.values())).then(() => {
                    console.log(`[usageCacheMiddleware] 所有工具执行完成，工具消息数量: ${toolMessages.length}`);
                    if (toolMessages.length > 0) {
                      const messagesToSend = [...toolMessages];
                      const assistantMessagesToSend = [...assistantMessages];

                      console.log(`[usageCacheMiddleware] 发送新请求，工具消息数量: ${messagesToSend.length}`);

                      // 清空工具消息数组，避免重复发送
                      toolMessages.length = 0;
                      assistantMessages.length = 0;

                      sendToolResultToModel(controller, messagesToSend, assistantMessagesToSend, req, config, abortController).catch(error => {
                        console.error("[usageCacheMiddleware] Error continuing conversation after tool execution:", error);
                        safeEnqueue(controller, {
                          event: 'tool:continue_error',
                          data: {
                            type: 'tool:continue_error',
                            error: error.message || String(error)
                          }
                        });
                      });
                    } else {
                      console.warn(`[usageCacheMiddleware] 所有工具执行完成，但没有工具消息`);
                    }
                  }).catch(error => {
                    console.error("[usageCacheMiddleware] Error waiting for tool executions:", error);
                  });
                } else {
                  console.log(`[usageCacheMiddleware] 没有工具消息，不需要发送新请求`);
                }

                // 正常传递 message_delta 事件给前端
                return data;
              }

              // ========== 其他事件：直接传递 ==========
              // 对于不涉及工具调用的事件，直接传递给下游
              return data;
            } catch (error) {
              console.error('Unexpected error in stream processing:', error);

              // 处理流提前关闭的错误
              if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                abortController.abort();
                return undefined;
              }

              // 其他错误仍然抛出，让上层处理
              throw error;
            }
          }).pipeThrough(new SSESerializerTransform()));  // 将结构化事件对象转换回 SSE 字符串格式
        }

        // ========== 场景 2：标准流式响应处理（无 agents） ==========
        // 当没有 agents 时，只需要提取 usage 信息并缓存，不需要拦截工具调用

        // 使用 tee() 方法克隆流：一个用于返回给客户端，一个用于后台读取提取 usage
        const [originalStream, clonedStream] = payload.tee();

        /**
         * 后台读取流并提取 usage 信息
         * @param {ReadableStream} stream - 要读取的流
         */
        const read = async (stream) => {
          const reader = stream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // 将二进制数据解码为字符串
              const dataStr = new TextDecoder().decode(value);

              // 只处理 message_delta 事件（usage 信息通常在这个事件中）
              if (!dataStr.startsWith("event: message_delta")) {
                continue;
              }

              // 提取 data 部分（跳过 "event: message_delta\n" 前缀，共 27 个字符）
              const str = dataStr.slice(27);
              try {
                // 解析 JSON 数据
                const message = JSON.parse(str);

                // 如果包含 usage 信息，则缓存到会话缓存中
                if (message.usage) {
                  sessionUsageCache.put(req.sessionId, message.usage);
                }
              } catch {
                // 忽略解析错误（可能是数据不完整或其他格式问题）
              }
            }
          } catch (readError) {
            // 处理流读取错误
            if (
              readError.name === "AbortError" ||
              readError.code === "ERR_STREAM_PREMATURE_CLOSE"
            ) {
              console.error("后台读取流被提前关闭");
            } else {
              console.error("后台流读取出错:", readError);
            }
          } finally {
            // 释放读取器锁
            reader.releaseLock();
          }
        };

        // 在后台异步读取克隆流（不阻塞主流程）
        read(clonedStream);

        // 返回原始流给客户端（客户端可以正常接收响应）
        return done(null, originalStream);
      }

      // ========== 非流式响应处理 ==========
      // 对于非流式响应（JSON 对象），直接提取 usage 并缓存
      if (payload && typeof payload === "object" && payload.usage) {
        sessionUsageCache.put(req.sessionId, payload.usage);
      }

      // 处理错误响应
      if (typeof payload === "object") {
        if (payload.error) {
          return done(payload.error, null);
        } else {
          return done(null, payload);
        }
      }
    }

    // ========== 非目标请求的处理 ==========
    // 对于不符合条件的请求，直接传递 payload
    // 但如果 payload 是错误对象，需要特殊处理
    if (typeof payload === "object" && payload.error) {
      return done(payload.error, null);
    }
    done(null, payload);
  };

  return { preHandler, onSend };
}

module.exports = {
  createUsageCacheMiddleware,
};


// 它负责在聊天接口 /v1/messages 的响应里，把「这次会话用了多少 token」的信息捞出来存进缓存，后面别的地方可以直接拿。
// 支持两种响应形式：流式（SSE）和一次性 JSON。流式就边收边看，非流式就直接看整个对象。
// 如果请求里带了 agents（工具调用）：
// 它会监听 SSE 事件，发现模型开始调用哪个工具、工具参数是什么，就把参数拼起来。
// 参数拼好后，直接调用对应 agent 的工具函数拿结果。
// 然后把「模型调用了哪个工具」和「工具返回了啥」塞回消息里，再自己发一个新的 /v1/messages 请求，让模型继续基于工具结果回复。
// 新的回复流里，跳过开头/结尾控制事件，其余内容再转发给客户端。
// 如果是普通流式（没有 agents）：
// 把流复制成两份。一份原样给客户端；另一份后台读，只关心 message_delta 事件，看到里面带 usage 就存缓存。
// 如果是非流式 JSON：
// 直接看 payload 里有没有 usage 字段，有就缓存。
// 处理错误：
// 如果 payload 里有 error 就直接返回错误。
// 流提前关闭会中止读取，避免报错。
