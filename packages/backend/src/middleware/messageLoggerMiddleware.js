/**
 * 消息日志记录中间件
 * 用于保存 /v1/messages 接口的请求和响应
 * 
 * 为每个请求创建以下文件：
 * - {requestId}-req.json: 请求的所有参数
 * - {requestId}-res.md: 提取的响应内容（Markdown 格式）
 * - {requestId}-res-full.jsonl: 原始响应数据（JSONL 格式，流式响应也记录）
 */

const fs = require("fs").promises;
const path = require("path");
const { Readable } = require("stream");

/**
 * 创建消息日志记录中间件
 * @param {Object} options - 配置选项
 * @param {string} options.logDir - 日志保存目录（默认: ./logs/messages）
 * @param {Function} options.onSave - 自定义保存函数 (requestData, responseData) => Promise<void>
 * @param {boolean} options.saveToFile - 是否保存到文件（默认: true）
 * @param {boolean} options.logStream - 是否记录流式响应（默认: false，因为流式响应较大）
 * @returns {Object} 中间件对象
 */
function createMessageLoggerMiddleware(options = {}) {
  const {
    logDir = path.join(process.cwd(), "logs", "messages"),
    onSave = null,
    saveToFile = true,
    logStream = false,
  } = options;

  // 确保日志目录存在
  if (saveToFile) {
    fs.mkdir(logDir, { recursive: true }).catch((err) => {
      console.error(`[MessageLogger] 创建日志目录失败:`, err);
    });
  }

  /**
   * 保存请求文件
   */
  async function saveRequestFile(requestId, requestData) {
    if (!saveToFile) return;

    try {
      const fileName = `${requestId}-req.json`;
      const filePath = path.join(logDir, fileName);
      await fs.writeFile(
        filePath,
        JSON.stringify(requestData, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error(`[MessageLogger] 保存请求文件失败:`, error);
    }
  }

  /**
   * 从 Anthropic 格式响应中提取文本内容
   */
  function extractContentFromResponse(responseData) {
    if (!responseData || typeof responseData !== "object") {
      return "";
    }

    // 处理非流式响应
    if (responseData.content && Array.isArray(responseData.content)) {
      const textParts = [];
      for (const item of responseData.content) {
        if (item.type === "text" && item.text) {
          textParts.push(item.text);
        }
      }
      return textParts.join("\n\n");
    }

    // 处理流式响应（已收集的完整数据）
    if (Array.isArray(responseData)) {
      const textParts = [];
      for (const event of responseData) {
        if (event.type === "content_block_delta" && event.delta?.text) {
          textParts.push(event.delta.text);
        } else if (event.type === "content_block_delta" && event.delta?.thinking) {
          // 思考内容
          textParts.push(`\n\n[思考]\n${event.delta.thinking}\n\n`);
        }
      }
      return textParts.join("");
    }

    // 处理其他格式
    if (responseData.message || responseData.text) {
      return responseData.message || responseData.text || "";
    }

    return "";
  }

  /**
   * 保存响应内容文件（Markdown 格式）
   */
  async function saveResponseContentFile(requestId, responseData) {
    if (!saveToFile) return;

    try {
      const content = extractContentFromResponse(responseData);
      const fileName = `${requestId}-res.md`;
      const filePath = path.join(logDir, fileName);

      // 如果内容为空，记录提示信息
      const markdown = content || "*（无文本内容）*";
      await fs.writeFile(filePath, markdown, "utf8");
    } catch (error) {
      console.error(`[MessageLogger] 保存响应内容文件失败:`, error);
    }
  }

  /**
   * 保存完整响应文件（JSONL 格式）
   */
  async function saveResponseFullFile(requestId, responseData, isStream = false) {
    if (!saveToFile) return;

    try {
      const fileName = `${requestId}-res-full.jsonl`;
      const filePath = path.join(logDir, fileName);

      if (isStream && Array.isArray(responseData)) {
        // 流式响应：每行一个事件
        const lines = responseData.map((event) => JSON.stringify(event)).join("\n");
        await fs.writeFile(filePath, lines + "\n", "utf8");
      } else {
        // 非流式响应：单行 JSON
        await fs.writeFile(
          filePath,
          JSON.stringify(responseData) + "\n",
          "utf8"
        );
      }
    } catch (error) {
      console.error(`[MessageLogger] 保存完整响应文件失败:`, error);
    }
  }

  /**
   * 创建流式响应拦截器
   */
  function createStreamInterceptor(originalStream, requestId) {
    const chunks = [];
    let buffer = "";

    // 创建一个新的 ReadableStream 来拦截原始流
    const interceptedStream = new ReadableStream({
      start: async (controller) => {
        const reader = originalStream.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 将数据传递给下游
            controller.enqueue(value);

            // 收集数据用于日志记录
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            // 解析 SSE 事件
            for (const line of lines) {
              if (line.trim() && line.startsWith("data: ")) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr !== "[DONE]" && jsonStr) {
                  try {
                    const event = JSON.parse(jsonStr);
                    chunks.push(event);
                  } catch {
                    // 忽略解析错误
                  }
                }
              }
            }
          }

          // 流结束后保存日志
          if (logStream && chunks.length > 0) {
            saveResponseFullFile(requestId, chunks, true).catch((err) => {
              console.error(`[MessageLogger] 保存流式响应失败:`, err);
            });
            saveResponseContentFile(requestId, chunks).catch((err) => {
              console.error(`[MessageLogger] 保存流式响应内容失败:`, err);
            });
          }
        } catch (error) {
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return interceptedStream;
  }

  /**
   * 提取请求数据
   */
  function extractRequestData(req) {
    return {
      method: req.method,
      url: req.url,
      headers: {
        // 只记录部分关键头部，避免记录敏感信息
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
      },
      body: req.body ? JSON.parse(JSON.stringify(req.body)) : null,
      query: req.query,
      ip: req.ip,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 提取响应数据（非流式）
   */
  async function extractResponseData(payload) {
    try {
      // 如果 payload 是字符串，尝试解析为 JSON
      if (typeof payload === "string") {
        try {
          return JSON.parse(payload);
        } catch {
          return payload;
        }
      }
      // 如果已经是对象，直接返回
      if (typeof payload === "object") {
        return payload;
      }
      return payload;
    } catch {
      return { error: "无法解析响应数据", raw: String(payload) };
    }
  }

  /**
   * preHandler hook - 记录请求
   */
  const preHandler = async (req, reply) => {
    // 只处理 /v1/messages 接口
    if (
      !req.url.startsWith("/v1/messages") ||
      req.url.startsWith("/v1/messages/count_tokens")
    ) {
      return;
    }

    // 提取请求数据
    const requestData = extractRequestData(req);
    const originalRequestId = req.id;

    // 生成带时间戳的唯一 ID，避免重复
    // 格式：req-{原始ID}-{时间戳}
    // 如果原始 ID 已经包含 req- 前缀，则去掉前缀再拼接
    const baseId = originalRequestId.toString().replace(/^req-/, '');
    const timestamp = Date.now();
    const uniqueRequestId = `req-${baseId}-${timestamp}`;

    // 更新请求数据中的 requestId 为唯一 ID
    requestData.requestId = uniqueRequestId;

    // 在响应头中添加唯一请求 ID，方便客户端获取
    reply.header("X-Request-Id", uniqueRequestId);

    // 将请求数据存储到 request 对象上，供 onSend hook 使用
    req._messageLogger = {
      requestData,
      startTime: timestamp,
      originalRequestId,
      uniqueRequestId,
    };

    // 立即保存请求文件（使用唯一 ID）
    saveRequestFile(uniqueRequestId, requestData).catch((err) => {
      console.error(`[MessageLogger] 保存请求文件失败:`, err);
    });
  };

  /**
   * onSend hook - 记录响应
   */
  const onSend = async (req, reply, payload) => {
    // 只处理 /v1/messages 接口
    if (
      !req.url.startsWith("/v1/messages") ||
      req.url.startsWith("/v1/messages/count_tokens")
    ) {
      return payload;
    }

    // 检查是否有请求数据
    if (!req._messageLogger) {
      return payload;
    }

    const { requestData, startTime, uniqueRequestId } = req._messageLogger;
    const duration = Date.now() - startTime;
    const requestId = uniqueRequestId || req.id;

    // 确保响应头中包含唯一请求 ID（防止其他中间件覆盖）
    reply.header("X-Request-Id", requestId);

    // 检查是否是流式响应
    const isStream =
      reply.getHeader("content-type")?.includes("text/event-stream") ||
      req.body?.stream === true;

    // 处理流式响应
    if (isStream && logStream) {
      // 如果 payload 是 ReadableStream，需要拦截它
      if (payload instanceof ReadableStream) {
        const interceptedStream = createStreamInterceptor(payload, requestId);
        return interceptedStream;
      }
      // 如果 payload 是 Node.js Stream
      if (payload instanceof Readable) {
        const chunks = [];
        let buffer = "";

        // 创建一个新的流来拦截原始流
        const interceptedStream = new Readable({
          read() {
            // 这个方法会被自动调用，但我们通过 data 事件来处理数据
          },
        });

        // 监听原始流的数据事件
        payload.on("data", (chunk) => {
          // 传递给下游
          if (!interceptedStream.push(chunk)) {
            // 如果下游背压，暂停原始流
            payload.pause();
          }

          // 收集数据用于日志
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() && line.startsWith("data: ")) {
              const jsonStr = line.substring(6).trim();
              if (jsonStr !== "[DONE]" && jsonStr) {
                try {
                  const event = JSON.parse(jsonStr);
                  chunks.push(event);
                } catch {
                  // 忽略解析错误
                }
              }
            }
          }
        });

        // 监听原始流的结束事件
        payload.on("end", () => {
          // 处理剩余的 buffer
          if (buffer.trim()) {
            const lines = buffer.split("\n");
            for (const line of lines) {
              if (line.trim() && line.startsWith("data: ")) {
                const jsonStr = line.substring(6).trim();
                if (jsonStr !== "[DONE]" && jsonStr) {
                  try {
                    const event = JSON.parse(jsonStr);
                    chunks.push(event);
                  } catch {
                    // 忽略解析错误
                  }
                }
              }
            }
          }

          // 保存日志
          if (chunks.length > 0) {
            saveResponseFullFile(requestId, chunks, true).catch((err) => {
              console.error(`[MessageLogger] 保存流式响应失败:`, err);
            });
            saveResponseContentFile(requestId, chunks).catch((err) => {
              console.error(`[MessageLogger] 保存流式响应内容失败:`, err);
            });
          }

          interceptedStream.push(null);
        });

        payload.on("error", (err) => {
          interceptedStream.emit("error", err);
        });

        // 处理背压
        interceptedStream.on("drain", () => {
          payload.resume();
        });

        return interceptedStream;
      }
    }

    // 处理非流式响应
    if (!isStream) {
      try {
        const responseBody = await extractResponseData(payload);

        // 保存完整响应
        saveResponseFullFile(requestId, responseBody, false).catch((err) => {
          console.error(`[MessageLogger] 保存响应文件失败:`, err);
        });

        // 保存提取的内容
        saveResponseContentFile(requestId, responseBody).catch((err) => {
          console.error(`[MessageLogger] 保存响应内容文件失败:`, err);
        });
        // 如果提供了自定义保存函数
        if (onSave && typeof onSave === "function") {
          const responseData = {
            statusCode: reply.statusCode,
            headers: {
              "content-type": reply.getHeader("content-type"),
            },
            duration,
            isStream: false,
            body: responseBody,
          };
          onSave(requestData, responseData).catch((err) => {
            console.error(`[MessageLogger] 自定义保存函数执行失败:`, err);
          });
        }
      } catch (error) {
        console.error(`[MessageLogger] 处理非流式响应失败:`, error);
      }
    }

    return payload;
  };

  return {
    preHandler,
    onSend,
  };
}

module.exports = {
  createMessageLoggerMiddleware,
};
