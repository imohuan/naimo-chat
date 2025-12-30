/**
 * 用量缓存中间件
 * 
 * 功能概述：
 * 1. 从 API 响应中提取并缓存会话的 token 用量信息（usage）
 * 2. 支持流式响应（SSE）和非流式响应两种格式
 * 3. 支持 agents 工具调用场景，能够拦截工具调用、执行工具、并将结果返回给模型继续对话
 * 
 * 工作流程：
 * - 流式响应（带 agents）：解析 SSE 流 → 检测工具调用 → 执行工具 → 发送新请求 → 转发响应流
 * - 流式响应（无 agents）：克隆流 → 后台读取提取 usage → 缓存 → 返回原流
 * - 非流式响应：直接提取 usage → 缓存 → 返回原响应
 */
const { SSEParserTransform } = require("../utils/SSEParser.transform");
const { SSESerializerTransform } = require("../utils/SSESerializer.transform");
const { rewriteStream } = require("../utils/rewriteStream");
const fetch = require("node-fetch");
const JSON5 = require("json5");

/**
 * 创建用量缓存中间件
 * 
 * @param {Object} sessionUsageCache - 会话用量缓存对象，提供 put(sessionId, usage) 方法
 * @param {Object} config - 配置对象，包含 PORT（端口）和 APIKEY（API 密钥）等
 * @param {Object} agentsManager - Agents 管理器，提供 getAgent(name) 方法获取 agent 实例
 * @returns {Function} Fastify 中间件函数
 */
function createUsageCacheMiddleware(sessionUsageCache, config = null, agentsManager = null) {
  return (req, reply, payload, done) => {
    // ========== 条件检查：只处理符合条件的请求 ==========
    // 1. 必须有会话 ID
    // 2. 必须是 /v1/messages 接口（排除 count_tokens 子接口）
    if (
      req.sessionId &&
      req.url.startsWith("/v1/messages") &&
      !req.url.startsWith("/v1/messages/count_tokens")
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

          // ========== Agent 请求处理器跟踪 ==========
          const processedAgents = new Set(); // 跟踪已经调用过 reqHandler 的 agent

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

                // 如果找到对应的 agent，检查是否应该处理该请求
                if (agent) {
                  const agentInstance = agentsManager.getAgent(agent);
                  // 调用 shouldHandle 判断是否应该处理该请求
                  if (agentInstance && agentInstance.shouldHandle && agentInstance.shouldHandle(req, config)) {
                    // 如果该 agent 还没有调用过 reqHandler，则调用一次
                    if (!processedAgents.has(agent) && agentInstance.reqHandler) {
                      try {
                        agentInstance.reqHandler(req, config);
                        processedAgents.add(agent);
                      } catch (error) {
                        console.error(`[usageCacheMiddleware] Agent ${agent} reqHandler 执行失败:`, error);
                      }
                    }
                    currentAgent = agentInstance;
                    currentToolIndex = data.data.index;              // 记录工具在内容块中的索引
                    currentToolName = data.data.content_block.name;   // 记录工具名称
                    currentToolId = data.data.content_block.id;      // 记录工具调用 ID
                    // 返回 undefined 表示不将此事件传递给下游（隐藏工具调用开始事件）
                    return undefined;
                  }
                  // 如果 shouldHandle 返回 false，不处理该工具调用，让事件继续传递
                }
              }

              // ========== 阶段 2：收集工具参数 ==========
              // 工具参数可能以分片形式传输（input_json_delta），需要拼接完整
              if (currentToolIndex > -1 &&
                data.data?.index === currentToolIndex &&
                data.data?.delta?.type === 'input_json_delta') {
                // 累加分片的 JSON 参数
                currentToolArgs += data.data?.delta?.partial_json || '';
                // 返回 undefined 表示不传递参数分片事件
                return undefined;
              }

              // ========== 阶段 3：工具调用完成，执行工具 ==========
              // 当收到 content_block_stop 事件时，说明工具参数已收集完整
              if (currentToolIndex > -1 &&
                data.data?.index === currentToolIndex &&
                data.data?.type === 'content_block_stop') {
                try {
                  // 解析完整的工具参数（使用 JSON5 支持更宽松的 JSON 格式）
                  const args = JSON5.parse(currentToolArgs);

                  // 构建助手消息：记录模型调用了哪个工具
                  assistantMessages.push({
                    type: "tool_use",
                    id: currentToolId,
                    name: currentToolName,
                    input: args
                  });

                  // 执行工具：调用 agent 中注册的工具处理器
                  const toolResult = await currentAgent?.tools?.get(currentToolName)?.handler(args, {
                    req,    // 传递请求对象，工具可能需要访问请求上下文
                    config  // 传递配置对象，工具可能需要访问配置信息
                  });

                  // 构建工具结果消息：记录工具执行的结果
                  toolMessages.push({
                    "tool_use_id": currentToolId,  // 关联到对应的工具调用 ID
                    "type": "tool_result",
                    "content": toolResult           // 工具执行的结果
                  });

                  // ========== 重置状态变量 ==========
                  currentAgent = undefined;
                  currentToolIndex = -1;
                  currentToolName = '';
                  currentToolArgs = '';
                  currentToolId = '';
                } catch (e) {
                  console.error("Error processing tool call:", e);
                }
                // 返回 undefined 表示不传递工具调用停止事件
                return undefined;
              }

              // ========== 阶段 4：工具执行完成，发送新请求继续对话 ==========
              // 当收到 message_delta 事件且已有工具消息时，说明模型已完成工具调用
              // 此时需要将工具结果发送回模型，让模型基于工具结果继续生成回复
              if (data.event === 'message_delta' && toolMessages.length) {
                // 将助手工具调用消息和工具结果消息添加到请求历史中
                req.body.messages.push({
                  role: 'assistant',
                  content: assistantMessages  // 模型调用了哪些工具
                });
                req.body.messages.push({
                  role: 'user',
                  content: toolMessages       // 工具执行的结果
                });

                // 获取服务端口（默认 3457）
                const port = config?.PORT || 3457;

                // 发送新的请求到 API，让模型基于工具结果继续生成
                const response = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
                  method: "POST",
                  headers: {
                    'x-api-key': config?.APIKEY || '',
                    'content-type': 'application/json',
                  },
                  body: JSON.stringify(req.body),
                });

                // 如果请求失败，不传递任何数据
                if (!response.ok) {
                  return undefined;
                }

                // 解析新响应的 SSE 流
                const stream = response.body.pipeThrough(new SSEParserTransform());
                const reader = stream.getReader();

                // 读取并转发新响应的所有事件（模型基于工具结果的回复）
                while (true) {
                  try {
                    const { value, done } = await reader.read();
                    if (done) {
                      break;
                    }

                    // 跳过消息开始和结束事件（这些是控制事件，不需要传递给客户端）
                    if (['message_start', 'message_stop'].includes(value.event)) {
                      continue;
                    }

                    // 检查流是否仍然可写（背压控制）
                    // 如果 desiredSize <= 0，说明下游处理不过来，停止读取
                    if (controller.desiredSize !== null && controller.desiredSize <= 0) {
                      break;
                    }

                    // 将事件推送到输出流
                    controller.enqueue(value);
                  } catch (readError) {
                    // 处理流提前关闭的情况
                    if (readError.name === 'AbortError' || readError.code === 'ERR_STREAM_PREMATURE_CLOSE') {
                      abortController.abort();
                      break;
                    }
                    throw readError;
                  }
                }

                // 清空工具消息数组，避免重复发送
                toolMessages.length = 0;
                assistantMessages.length = 0;

                // 返回 undefined，因为我们已经手动转发了新响应的事件
                return undefined;
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
