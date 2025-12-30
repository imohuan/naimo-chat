/**
 * 通用 LLM 请求函数
 * 用于调用 /v1/messages 接口，支持流式响应
 */

const { getClaudeConfig } = require("../../chat/router/chatRoutes");

// 兼容 Node.js 环境的 fetch
const fetch =
  globalThis.fetch ||
  ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

/**
 * 通用 LLM 请求函数
 * @param {Object} options - 请求选项
 * @param {Array} options.messages - 消息数组
 * @param {string} options.model - 模型ID（格式：provider,model）
 * @param {string} options.apiKey - API Key（可选，用于临时覆盖）
 * @param {Function} options.onStreamEvent - 流式事件回调函数 (event) => void
 * @param {string} options.requestId - 自定义请求ID（可选，用于日志记录）
 * @param {string} [options.sessionId] - 会话ID（可选，用于用量缓存）
 * @param {number} [options.temperature] - 温度参数
 * @param {number} [options.topP] - Top P 参数
 * @param {number} [options.maxTokens] - 最大 token 数
 * @param {string[]} [options.mcpIds] - MCP 服务器 ID 列表
 * @param {Array} [options.tools] - 工具列表
 * @returns {Promise<Object>} { requestId, fullResponse, events }
 */
async function requestLLM(options) {
  const {
    messages,
    model,
    apiKey,
    onStreamEvent,
    requestId: customRequestId,
    sessionId,
    temperature,
    topP,
    maxTokens,
    // mcpIds,
    tools,
  } = options;
  const config = await getClaudeConfig();
  const port = config.PORT || 3457;
  const host = config.HOST || "127.0.0.1";

  // 构建请求头 - 使用 Authorization: Bearer 格式（与 useLlmApi.ts 保持一致）
  const headers = {
    "Content-Type": "application/json",
  };
  if (config.APIKEY) {
    headers["Authorization"] = `Bearer ${config.APIKEY}`;
  }
  // 如果提供了自定义请求ID，在请求头中设置
  if (customRequestId) {
    headers["X-Request-Id"] = customRequestId;
  }

  // 构建请求体
  const body = {
    messages,
    model: model || "iflow,glm-4.6", // 默认模型
    stream: true,
  };
  if (apiKey) {
    body.apiKey = apiKey.trim();
  }
  // 如果提供了 sessionId，添加到 metadata 中，以便 routeMiddleware 提取并设置 req.sessionId
  // 格式：chat_session_{sessionId}，routeMiddleware 会提取 {sessionId} 部分
  if (sessionId) {
    body.metadata = {
      user_id: `chat_session_${sessionId}`,
    };
  }
  // 添加扩展配置参数
  if (typeof temperature === "number") {
    body.temperature = temperature;
  }
  if (typeof topP === "number") {
    body.topP = topP;
  }
  if (typeof maxTokens === "number") {
    body.maxTokens = maxTokens;
  }
  if (tools && Array.isArray(tools) && tools.length > 0) {
    // 转换工具格式：将 inputSchema (驼峰) 转换为 input_schema (下划线)
    // Anthropic/Claude API 期望使用 input_schema 格式
    body.tools = tools.map((tool) => {
      const normalizedTool = { ...tool };
      // 如果存在 inputSchema，转换为 input_schema
      if (normalizedTool.inputSchema && !normalizedTool.input_schema) {
        normalizedTool.input_schema = normalizedTool.inputSchema;
        delete normalizedTool.inputSchema;
      }
      return normalizedTool;
    });
  }

  // 对message进行验证，可能有一些错误的消息，没有content的过滤掉
  body.messages = body.messages.filter((message) => message.content);

  const url = `http://${host}:${port}/v1/messages`;

  // 发送 POST 请求到 /v1/messages
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (fetchError) {
    // 处理网络错误
    const errorMessage =
      fetchError instanceof Error
        ? fetchError.message
        : "网络请求失败，请检查网络连接或服务器是否正常运行";
    throw new Error(errorMessage);
  }

  // 获取请求ID（从响应头）
  const requestId = response.headers.get("X-Request-Id") || customRequestId;

  // 如果响应头中有 requestId，立即通过回调传递（用于流式响应过程中更新 currentRequestId）
  if (requestId && onStreamEvent) {
    onStreamEvent({
      type: "request_id",
      requestId: requestId,
    });
  }

  if (!response.ok) {
    let errorMessage = `请求失败 (${response.status})`;
    try {
      const errorData = await response.json().catch(() => ({}));
      errorMessage =
        errorData?.message ?? errorData?.error ?? errorMessage;
    } catch {
      // 如果无法解析错误响应，使用默认消息
      const text = await response.text().catch(() => "");
      if (text) {
        errorMessage = text.substring(0, 200);
      }
    }

    // 确保错误信息为字符串
    if (typeof errorMessage === "object") {
      try {
        errorMessage = JSON.stringify(errorMessage);
      } catch {
        errorMessage = "[object Object]";
      }
    }

    throw new Error(String(errorMessage));
  }

  // 检查响应类型，如果不是流式响应，尝试解析为 JSON
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/event-stream") && !contentType.includes("stream")) {
    try {
      const data = await response.json();
      const events = [data];
      let fullResponse = "";

      if (data.content && Array.isArray(data.content)) {
        fullResponse = data.content.map((c) => c.text || "").join("");
      } else if (data.choices?.[0]?.message?.content) {
        fullResponse = data.choices[0].message.content;
      } else if (data.message) {
        fullResponse = data.message;
      }

      // 调用回调函数
      if (onStreamEvent) {
        onStreamEvent(data);
      }

      return { requestId, fullResponse: fullResponse.trim(), events };
    } catch {
      // 忽略解析错误，继续按流式处理
    }
  }

  if (!response.body) {
    throw new Error("响应体为空");
  }

  // 解析 SSE 流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";
  const events = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        // 处理 SSE 格式
        let jsonLine = line.trim();

        // 跳过事件类型行
        if (jsonLine.startsWith("event: ")) {
          continue;
        }

        if (jsonLine.startsWith("data: ")) {
          jsonLine = jsonLine.substring(6).trim();
        }

        // 跳过注释行和 [DONE] 标记
        if (jsonLine.startsWith(":") || jsonLine === "[DONE]") {
          continue;
        }

        // 跳过空行
        if (!jsonLine) {
          continue;
        }

        try {
          const event = JSON.parse(jsonLine);
          events.push(event);

          // 调用回调函数，通知监听者
          if (onStreamEvent) {
            onStreamEvent(event);
          }

          // 提取文本内容（根据不同的响应格式）
          // Anthropic 原生格式
          if (event.type === "content_block_delta" && event.delta?.text) {
            fullResponse += event.delta.text;
          } else if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta" &&
            event.delta.text
          ) {
            fullResponse += event.delta.text;
          } else if (event.type === "message_delta" && event.delta?.text) {
            fullResponse += event.delta.text;
          }
          // OpenAI 格式
          else if (event.choices?.[0]?.delta?.content) {
            const deltaContent = event.choices[0].delta.content;
            if (deltaContent) {
              fullResponse += deltaContent;
            }
          } else if (event.choices?.[0]?.delta?.message?.content) {
            const deltaContent = event.choices[0].delta.message.content;
            if (deltaContent) {
              fullResponse += deltaContent;
            }
          }
          // 直接内容格式
          else if (typeof event.content === "string") {
            fullResponse = event.content;
          }
          // 通用 delta 格式
          else if (event.delta?.text) {
            fullResponse += event.delta.text;
          }
          // 处理完整的 content_block
          else if (event.type === "content_block" && Array.isArray(event.content)) {
            for (const part of event.content) {
              if (part.type === "text" && part.text) {
                fullResponse += part.text;
              }
            }
          }
          // 处理完整的 message
          else if (event.type === "message" && Array.isArray(event.content)) {
            for (const part of event.content) {
              if (part.type === "text" && part.text) {
                fullResponse += part.text;
              }
            }
          }
          // 处理 finish_reason，流结束
          else if (event.choices?.[0]?.finish_reason) {
            // 流结束，但内容可能已经在之前的 delta 中更新
            continue;
          }
        } catch (parseError) {
          // 忽略解析错误，继续处理下一行
          console.warn("[llmRequest] Failed to parse SSE event:", parseError, "Line:", jsonLine);
        }
      }
    }
  } catch (streamError) {
    // 处理流读取错误
    const errorMessage =
      streamError instanceof Error ? streamError.message : "流式读取失败";
    throw new Error(`流式响应处理失败: ${errorMessage}`);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // 忽略释放锁的错误
    }
  }

  return { requestId, fullResponse: fullResponse.trim(), events };
}

/**
 * 非流式 LLM 请求函数（用于标题生成等场景）
 * @param {Object} options - 请求选项
 * @param {Array} options.messages - 消息数组
 * @param {string} options.model - 模型ID
 * @param {string} options.apiKey - API Key（可选）
 * @param {string} [options.sessionId] - 会话ID（可选，用于用量缓存）
 * @returns {Promise<string>} 返回完整响应文本
 */
async function requestLLMSync(options) {
  const { messages, model, apiKey, sessionId } = options;
  const config = await getClaudeConfig();
  const port = config.PORT || 3457;
  const host = config.HOST || "127.0.0.1";

  // 构建请求头 - 使用 Authorization: Bearer 格式（与 useLlmApi.ts 保持一致）
  const headers = {
    "Content-Type": "application/json",
  };
  if (config.APIKEY) {
    headers["Authorization"] = `Bearer ${config.APIKEY}`;
  }

  const body = {
    messages,
    model: model || "iflow,glm-4.6",
    stream: false,
  };
  if (apiKey) {
    body.apiKey = apiKey.trim();
  }
  // 如果提供了 sessionId，添加到 metadata 中，以便 routeMiddleware 提取并设置 req.sessionId
  // 格式：chat_session_{sessionId}，routeMiddleware 会提取 {sessionId} 部分
  if (sessionId) {
    body.metadata = {
      user_id: `chat_session_${sessionId}`,
    };
  }

  const url = `http://${host}:${port}/v1/messages`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (fetchError) {
    // 处理网络错误
    const errorMessage =
      fetchError instanceof Error
        ? fetchError.message
        : "网络请求失败，请检查网络连接或服务器是否正常运行";
    throw new Error(errorMessage);
  }

  if (!response.ok) {
    let errorMessage = `请求失败 (${response.status})`;
    try {
      const errorData = await response.json().catch(() => ({}));
      errorMessage =
        errorData?.message ?? errorData?.error ?? errorMessage;
    } catch {
      // 如果无法解析错误响应，使用默认消息
      const text = await response.text().catch(() => "");
      if (text) {
        errorMessage = text.substring(0, 200);
      }
    }

    // 确保错误信息为字符串
    if (typeof errorMessage === "object") {
      try {
        errorMessage = JSON.stringify(errorMessage);
      } catch {
        errorMessage = "[object Object]";
      }
    }

    throw new Error(String(errorMessage));
  }

  const data = await response.json();

  // 提取文本内容
  let content = "";
  if (data.content && Array.isArray(data.content)) {
    content = data.content.map((c) => c.text || "").join("");
  } else if (data.choices?.[0]?.message?.content) {
    content = data.choices[0].message.content;
  } else if (data.message) {
    content = data.message;
  } else {
    content = JSON.stringify(data);
  }

  return content.trim();
}

module.exports = {
  requestLLM,
  requestLLMSync,
};

