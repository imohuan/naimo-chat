const {
  SSEServerTransport,
} = require("@modelcontextprotocol/sdk/server/sse.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const { randomUUID } = require("crypto");
const { Readable } = require("stream");

class TransportService {
  constructor() {
    this.sessions = new Map(); // sessionId -> { transport, server, initialized } 会话映射
    this.sseSessionMap = new Map(); //sse.sessionId -> sessionId
  }

  /**
   * 从请求中获取 sessionId
   * @param {*} req
   * @returns {string} sessionId
   */
  getSessionId(req, defaultSessionId = randomUUID()) {
    return (
      req.headers["mcp-session-id"] ||
      req.headers["x-session-id"] ||
      req.query.sessionId ||
      defaultSessionId
    );
  }

  convertSessionId(baseSessionId, prefix = "sse") {
    // 如果 sessionId 已经有任何前缀（sse: 或 http:），直接返回
    if (baseSessionId.includes(":")) {
      return baseSessionId;
    }
    // 否则添加指定的前缀
    return `${prefix}:${baseSessionId}`;
  }

  async handleSSEConnection(req, reply, mcpServer, baseSessionId) {
    console.log(
      `[SSE 连接] handleSSEConnection 已调用，URL: ${req.url}，组: ${req.params.group}`
    );
    console.log(
      `[SSE 连接] 基础会话ID: ${baseSessionId}，服务器: ${mcpServer?.name || "未知"
      }`
    );

    // 使用不同的键来区分 SSE 和 StreamableHTTP 会话，避免冲突
    // 先移除任何已有的前缀（http: 或 sse:），然后添加 sse: 前缀
    const cleanSessionId = baseSessionId?.includes(":")
      ? baseSessionId.split(":").slice(-1)[0]
      : baseSessionId;
    let sessionId = this.convertSessionId(cleanSessionId, "sse");

    console.log(
      `[SSE 连接] 清理后的会话ID: ${cleanSessionId}，最终会话ID: ${sessionId}`
    );
    console.log(
      `[SSE 连接] 当前已存在的会话: ${Array.from(this.sessions.keys()).join(", ") || "无"
      }`
    );

    // 设置 SSE 响应头
    console.log(`[SSE 连接] 正在设置 SSE 响应头`);
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no"); // 禁用 nginx 缓冲

    // 创建新的 SSEServerTransport
    // SSEServerTransport 的第一个参数是消息端点 URL（相对或绝对路径），第二个是响应流
    // 构建完整的消息端点 URL
    const protocol = req.protocol || "http";
    const host = req.headers.host || "127.0.0.1:3457";
    const messageEndpoint = `${protocol}://${host}/mcp/${req.params.group}/messages`;

    console.log(`[SSE 连接] 消息端点 URL: ${messageEndpoint}`);
    console.log(`[SSE 连接] 正在创建 SSEServerTransport`);

    const transport = new SSEServerTransport(messageEndpoint, reply.raw);
    console.log(`[SSE 连接] SSEServerTransport 已创建`);

    // SSEServerTransport 会生成自己的 sessionId，并在发送消息时自动追加到消息请求的 query 中
    // 这里用 transport.sessionId 覆盖之前的 sessionId，确保服务端存储的 key 与后续消息携带的一致
    // if (transport.sessionId) {
    //   sessionId = this.convertSessionId(transport.sessionId, "sse");
    //   console.log(
    //     `[SSE 连接] 使用 transport.sessionId 覆盖会话ID: ${sessionId}`
    //   );
    // } else {
    //   console.warn(
    //     `[SSE 连接] transport.sessionId 不存在，继续使用原 sessionId: ${sessionId}`
    //   );
    // }

    // 存储会话信息（SSE）
    const sessionData = {
      transport,
      server: mcpServer,
      group: req.params.group,
      transportType: "SSE", // 标识 transport 类型
      initialized: true, // SSE 连接时默认已初始化
    };
    const sseSession = transport.sessionId;
    this.sessions.set(sessionId, sessionData);
    this.sseSessionMap.set(sseSession, sessionId);

    console.log(
      `[SSE 连接] 已存储会话: ${sessionId}，传输类型=SSE，服务器=${mcpServer?.name || "未知"
      }，组=${req.params.group}`
    );
    console.log(
      `[SSE 连接] 存储后所有会话: ${Array.from(this.sessions.keys()).join(
        ", "
      )}`
    );

    try {
      // 将服务器连接到传输层
      console.log(
        `[SSE 连接] 正在将会话 ${sessionId} 的 MCP 服务器连接到传输层`
      );
      await mcpServer.connect(transport);
      console.log(
        `[SSE 连接] ✅ 已成功将会话 ${sessionId} 的 MCP 服务器连接到传输层`
      );
    } catch (error) {
      console.error(`[SSE 连接] ❌ 将 MCP 服务器连接到传输层失败:`, error);
      this.sessions.delete(sessionId);
      this.sseSessionMap.delete(sseSession);
      reply.code(500).send({ error: "建立 MCP 连接失败" });
      return;
    }

    // 处理连接关闭
    req.raw.on("close", () => {
      console.log(`[SSE 连接] 会话 ${sessionId} 的 SSE 连接已关闭`);
      this.sessions.delete(sessionId);
      this.sseSessionMap.delete(sseSession);
      console.log(
        `[SSE 连接] 已删除会话 ${sessionId}，剩余会话: ${Array.from(this.sessions.keys()).join(", ") || "无"
        }`
      );
      // 传输层会自动处理清理
    });

    console.log(`[SSE 连接] SSE 连接已建立，等待客户端消息...`);

    // 保持连接打开 - 不返回，让 Fastify 保持响应流打开
    // 注意：在 Fastify 中，我们需要确保响应流保持打开状态
    return new Promise(() => {
      // 这个 Promise 永远不会 resolve，保持连接打开
      // 当客户端断开连接时，req.raw 的 'close' 事件会触发
    });
  }

  /**
   * 从请求中获取 body（JSON 格式），并删除 model 字段
   * @param {Object} req - Fastify 请求对象
   * @param {string} context - 调用上下文，用于日志标识 ("SSE" 或 "StreamableHTTP")
   * @returns {Promise<Object>} 处理后的 body 对象（已删除 model 字段）
   */
  async getBody(req, context = "通用") {
    let body = null;

    if (req.body) {
      console.log(`[${context}] 使用 Fastify 已解析的 req.body`);
      body = req.body;
      console.log(
        `[${context}] Fastify 请求体:`,
        JSON.stringify(body, null, 2)
      );
      // 确保移除 model 字段 (虽然 preHandler 可能添加了它)
      if (Object.prototype.hasOwnProperty.call(body, "model")) {
        console.log(`[${context}] 已从请求体中移除 'model' 字段`);
        delete body.model;
      }
    } else {
      console.log(`[${context}] req.body 不存在，手动读取流`);
      const originalRequest = req.raw;
      const chunks = [];
      for await (const chunk of originalRequest) {
        chunks.push(chunk);
      }
      const bodyBuffer = Buffer.concat(chunks);
      const bodyString = bodyBuffer.toString("utf8");

      // 解析并处理 JSON
      if (bodyString) {
        console.log(
          `[${context}] 接收到的请求体: ${bodyString.substring(0, 500)}`
        );
        try {
          body = JSON.parse(bodyString);
          if (Object.prototype.hasOwnProperty.call(body, "model")) {
            console.log(`[${context}] 已从请求体中移除 'model' 字段`);
            delete body.model;
          }
        } catch (e) {
          console.warn(
            `[${context}] 解析请求体失败 (可能非 JSON): ${e.message}`
          );
        }
      }
    }

    return body;
  }

  /**
   * 在Cursor中我是用的是 Streamable 进行连接 开关MCP会调用sse，sse他的transport会默认生成一个sessionid然后mcp会根据这个生成的sessionid拼接URL /mcp/xxx/message?sessionId={transport.sessionId}这里就没有根据我设置的sessionid拼接，所以我提供了一个sseSessionMap来保存对应关系
   * @param {*} req
   * @param {*} reply
   * @returns
   */
  async handleHTTPMessage(req, reply) {
    console.log(`[SSE 调试] handleHTTPMessage 已调用，URL: ${req.url}`);
    // 明确指定前缀为 "sse"，因为这是 SSE 消息端点
    let sessionId = null;
    const originalSessionId = this.getSessionId(req);
    if (this.sseSessionMap.has(originalSessionId))
      sessionId = this.sseSessionMap.get(originalSessionId);
    if (!sessionId) sessionId = this.convertSessionId(originalSessionId, "sse");

    console.log(
      `[SSE 调试] 正在查找会话: ${sessionId}，可用会话: ${Array.from(
        this.sessions.keys()
      ).join(", ")}`
    );

    // 查找对应的 SSE 会话
    const session = this.sessions.get(sessionId);
    if (!session) {
      // 注意：reply 已经被 hijack，必须使用 reply.raw
      const response = reply.raw;
      if (!response.headersSent) {
        response.statusCode = 404;
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            error: "会话未找到。请先通过 SSE 连接。",
          })
        );
      }
      return;
    }

    // 验证 group 是否匹配
    if (session.group !== req.params.group) {
      const response = reply.raw;
      if (!response.headersSent) {
        response.statusCode = 400;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: "会话组不匹配" }));
      }
      return;
    }

    // 处理 POST 消息
    if (
      session.transport &&
      typeof session.transport.handlePostMessage === "function"
    ) {
      try {
        const originalRequest = req.raw;
        const response = reply.raw;

        // 1. 获取请求体（JSON 格式，已删除 model 字段）
        const body = await this.getBody(req, "SSE");
        const bodyString = JSON.stringify(body);

        // 3. 创建一个新的可读流，包含处理后的 body
        const newStream = Readable.from([Buffer.from(bodyString)]);

        // 准备 headers
        const headers = { ...originalRequest.headers };
        // 更新 Content-Length
        headers["content-length"] = Buffer.byteLength(bodyString).toString();
        // 移除 Transfer-Encoding，因为我们现在提供固定长度的内容
        delete headers["transfer-encoding"];

        // 直接在流对象上分配属性，而不是使用 Proxy
        // 这样可以避免 Proxy 带来的一些潜在问题（如 internal slots 检查）
        Object.assign(newStream, {
          headers,
          method: originalRequest.method,
          url: originalRequest.url,
          httpVersion: originalRequest.httpVersion,
          // 模拟 IncomingMessage 的一些属性
          rawHeaders: originalRequest.rawHeaders,
          socket: originalRequest.socket,
        });

        const requestProxy = newStream;

        // 5. 创建 Response Proxy
        // 主要是为了防止 MCP SDK 检查 headersSent 或其他属性时出错
        // 并且我们可以拦截 output
        // SSEServerTransport.handlePostMessage 实际上只是写入 response (usually 202 Accepted)
        const responseProxy = new Proxy(response, {
          get(target, prop) {
            // 拦截 _readableState 等内部属性防止报错（如果有）
            if (prop === "_readableState" && target._readableState) {
              return new Proxy(target._readableState, {
                get(stateTarget, stateProp) {
                  if (stateProp === "encoding") return null;
                  return stateTarget[stateProp];
                },
                has(stateTarget, stateProp) {
                  if (stateProp === "encoding") return false;
                  return stateProp in stateTarget;
                },
              });
            }
            if (prop === "readableEncoding") return null;

            const value = target[prop];
            if (typeof value === "function") {
              return value.bind(target);
            }
            return value;
          },
          has(target, prop) {
            if (prop === "readableEncoding") return false;
            return prop in target;
          },
        });

        console.log(
          `[SSE 消息] 调用 transport.handlePostMessage，会话ID: ${sessionId}`
        );

        await session.transport.handlePostMessage(requestProxy, responseProxy);

        console.log(`[SSE 消息] handlePostMessage 已完成`);

        // 如果响应还没有结束，手动结束它
        // handlePostMessage 可能不会自动结束响应，所以我们需要确保响应被结束
        const responseCallback = response; // safe alias
        if (!responseCallback.writableEnded && !responseCallback.destroyed) {
          if (!responseCallback.headersSent) {
            responseCallback.statusCode = 200;
            responseCallback.setHeader("Content-Type", "application/json");
            responseCallback.end(
              JSON.stringify({
                status: "ok",
                message: "消息已接收，响应将通过 SSE 连接发送",
              })
            );
          } else {
            // 如果响应头已发送但响应未结束，直接结束
            responseCallback.end();
          }
          console.log(`[SSE 消息] 响应已手动结束`);
        }
      } catch (error) {
        console.error("处理 POST 消息时出错:", error);
        const response = reply.raw;
        if (!response.headersSent) {
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json");
          response.end(
            JSON.stringify({
              error: "处理消息失败",
              details: error.message,
            })
          );
        }
      }
    } else {
      const response = reply.raw;
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ error: "传输层不支持 POST 消息" }));
      }
    }
  }

  // 检查请求是否是 initialize 请求
  isInitializeRequest(body) {
    return body && body.method === "initialize";
  }

  /**
   * 发送 JSON-RPC 错误响应
   * @param {Object} response - Node.js 响应对象
   * @param {number} statusCode - HTTP 状态码
   * @param {number|string} code - JSON-RPC 错误代码
   * @param {string} message - 错误消息
   * @param {*} id - 请求 ID（可选）
   */
  sendErrorResponse(response, statusCode, code, message, id = null) {
    if (!response.headersSent) {
      response.statusCode = statusCode;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code,
            message,
          },
          id,
        })
      );
    }
  }

  async handleStreamableHTTP(
    req,
    reply,
    mcpServer,
    requestBody = null,
    routeSessionId = null
  ) {
    // 如果 requestBody 没有传递，从请求中获取并清理请求体
    if (!requestBody) requestBody = await this.getBody(req, "StreamableHTTP");

    // 优先使用路由中传递的 sessionId，然后检查 headers 和 query
    // 注意：StreamableHTTP 会话使用 "http:" 前缀来区分
    const baseSessionId = routeSessionId || this.getSessionId(req, "");

    // 如果 sessionId 已经有前缀，直接使用；否则添加 "http:" 前缀
    // const providedSessionId =
    //   baseSessionId && !baseSessionId.includes(":")
    //     ? `http:${baseSessionId}`
    //     : baseSessionId;
    const providedSessionId = this.convertSessionId(baseSessionId, "http");

    // 检查是否是 initialize 请求
    const isInitialize = requestBody && this.isInitializeRequest(requestBody);
    console.log(
      `[StreamableHTTP] 正在处理请求，提供的会话ID: ${providedSessionId}，是否为初始化: ${isInitialize}`
    );
    // 检查是否已有 streamableHttp 会话
    let session = providedSessionId
      ? this.sessions.get(providedSessionId)
      : null;

    console.log(
      `[StreamableHTTP] 会话查找: 提供的会话ID=${providedSessionId}，是否找到=${!!session}，所有会话=${Array.from(
        this.sessions.keys()
      ).join(", ")}`
    );

    // 详细诊断会话状态
    if (session) {
      console.log(
        `[StreamableHTTP] 会话详情: 传输层=${!!session.transport}，传输类型=${session.transport?.constructor?.name
        }，是否为StreamableHTTP=${session.transport instanceof StreamableHTTPServerTransport
        }，服务器=${!!session.server}，组=${session.group}`
      );
    }

    let transport;
    let sessionId = providedSessionId;
    let serverToUse = mcpServer; // 默认使用传入的 server

    // 如果是初始化请求，且已经存在会话，则删除旧会话以重新开始
    // 这可以防止 "Server already initialized" 错误，当客户端重启但使用相同 sessionId 时
    if (isInitialize && session) {
      console.log(`[StreamableHTTP] 收到新的初始化请求，正在清理旧会话: ${providedSessionId}`);
      this.sessions.delete(providedSessionId);
      session = null;
    }

    if (session && session.transport instanceof StreamableHTTPServerTransport) {
      // 重用现有会话
      transport = session.transport;
      sessionId = providedSessionId;
      // 使用会话中存储的 server，而不是创建新的
      // 因为 transport 已经连接到了这个 server
      // 如果会话中的 server 丢失，使用传入的 mcpServer
      serverToUse = session.server || mcpServer;
      if (!session.server) {
        console.warn(
          `[StreamableHTTP] 会话 ${sessionId} 没有服务器，使用提供的 mcpServer`
        );
        // 更新会话中的 server
        session.server = mcpServer;
      }
      console.log(
        `[StreamableHTTP] 重用现有会话: ${sessionId}，服务器: ${serverToUse?.name || serverToUse?.displayName || "未知"
        }，已初始化: ${session.initialized || false}`
      );

      // 如果会话已初始化且收到 initialize 请求，直接返回保存的初始化响应
      // 这样可以避免 SDK 抛出 "Server already initialized" 错误
      if (session.initialized && isInitialize && requestBody) {
        console.log(
          `[StreamableHTTP] 会话 ${sessionId} 已初始化，拦截重复的 initialize 请求并返回保存的初始化响应`
        );
        const response = reply.raw;
        if (!response.headersSent) {
          // 如果会话中保存了初始化响应，使用保存的响应（但更新 id 以匹配当前请求）
          if (session.initResponse) {
            const savedResponse = JSON.parse(JSON.stringify(session.initResponse));
            savedResponse.id = requestBody.id || savedResponse.id;
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(savedResponse));
            console.log(
              `[StreamableHTTP] 已返回保存的初始化响应，会话ID: ${sessionId}`
            );
          } else {
            // 如果没有保存的响应，返回一个基本的响应（向后兼容）
            console.warn(
              `[StreamableHTTP] 会话 ${sessionId} 没有保存的初始化响应，返回基本响应`
            );
            const initResponse = {
              jsonrpc: "2.0",
              result: {
                protocolVersion: requestBody.params?.protocolVersion || "2024-11-05",
                capabilities: {
                  tools: {},
                },
                serverInfo: {
                  name: serverToUse?.name || "mcp-server",
                  version: "1.0.0",
                },
              },
              id: requestBody.id || null,
            };
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(initResponse));
          }
        }
        return;
      }
    }

    // 标记是否因为类型不匹配而删除了会话
    let sessionTypeMismatch = false;

    if (
      session &&
      !(session.transport instanceof StreamableHTTPServerTransport)
    ) {
      // 会话存在但 transport 类型不正确（可能是 SSE 会话覆盖了 StreamableHTTP 会话）
      // 删除错误的会话，然后继续创建新的 StreamableHTTP 会话
      // 注意：即使不是 initialize 请求，也允许重新创建，因为这是服务器端的错误
      console.warn(
        `[StreamableHTTP] 会话 ${sessionId} 存在但传输层不是 StreamableHTTPServerTransport。传输类型: ${session.transport?.constructor?.name || "未定义"
        }。正在删除并重新创建为 StreamableHTTP 会话。`
      );
      this.sessions.delete(sessionId);
      session = null;
      sessionTypeMismatch = true;
      // 继续执行创建新会话的逻辑
    }

    // 如果没有找到有效的 StreamableHTTP 会话，创建新会话
    if (
      !session ||
      !(session.transport instanceof StreamableHTTPServerTransport)
    ) {
      // 如果提供了 sessionId 但不是 initialize 请求，且没有有效会话，返回错误
      // 但是，如果会话类型不匹配（已经被删除），允许重新创建
      if (providedSessionId && !isInitialize && !sessionTypeMismatch) {
        console.warn(
          `[StreamableHTTP] 对于非初始化请求，未找到会话 ${providedSessionId}`
        );
        this.sendErrorResponse(
          reply.raw,
          400,
          -32000,
          "错误请求: 未提供有效的会话ID",
          requestBody?.id || null
        );
        return;
      }

      // 创建新的 streamableHttp 传输
      // 如果没有提供 sessionId，生成一个新的（带 http: 前缀）
      console.log(
        `[StreamableHTTP] 正在创建新的 StreamableHTTPServerTransport，会话ID: ${sessionId}`
      );
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => {
          console.log(
            `[StreamableHTTP] 会话ID生成器被调用，返回: ${sessionId}`
          );
          return sessionId;
        },
        onsessioninitialized: (initializedSessionId) => {
          console.log(
            `[StreamableHTTP] ✅✅✅ 会话初始化回调已触发！初始化的会话ID: ${initializedSessionId}，期望: ${sessionId}`
          );
          // 如果实际初始化的 sessionId 与预期不同，更新会话映射
          if (initializedSessionId !== sessionId) {
            console.warn(
              `[StreamableHTTP] ⚠️ 会话ID不匹配: 期望 ${sessionId}，实际得到 ${initializedSessionId}`
            );
            // 更新会话映射，使用实际初始化的 sessionId
            const existingSession = this.sessions.get(sessionId);
            if (existingSession) {
              this.sessions.delete(sessionId);
              existingSession.initialized = true; // 标记为已初始化
              this.sessions.set(initializedSessionId, existingSession);
              console.log(
                `[StreamableHTTP] 已更新会话映射，从 ${sessionId} 到 ${initializedSessionId}`
              );
            }
          } else {
            console.log(`[StreamableHTTP] ✅ 会话ID与期望值匹配: ${sessionId}`);
            // 注意：不要在这里设置 initialized = true
            // initialized 应该在收到第一个成功且解析后的 MCP initialize 响应后设置
          }
        },
      });
      console.log(`[StreamableHTTP] StreamableHTTPServerTransport 已创建`);

      // 设置关闭回调
      // 注意：在 StreamableHTTP 中，onclose 可能不会在每次请求后都被调用
      // 只有在会话真正关闭时才会被调用
      transport.onclose = () => {
        console.log(`[StreamableHTTP] 会话 ${sessionId} 的关闭回调已触发`);
        const session = this.sessions.get(sessionId);
        if (session) {
          console.log(`[StreamableHTTP] 正在删除会话: ${sessionId}`);
          this.sessions.delete(sessionId);
        } else {
          console.warn(
            `[StreamableHTTP] 调用 onclose 时未找到会话 ${sessionId}`
          );
        }
      };

      // 存储会话信息（StreamableHTTP）
      const sessionData = {
        transport,
        server: mcpServer,
        group: req.params.group,
        transportType: "StreamableHTTP", // 标识 transport 类型
        initialized: false, // 初始状态为未初始化，在 onsessioninitialized 回调中设置为 true
      };
      this.sessions.set(sessionId, sessionData);
      console.log(
        `[StreamableHTTP] 已存储会话: ${sessionId}，传输类型=${transport.constructor?.name
        }，服务器=${mcpServer?.name || mcpServer?.displayName || "未知"}`
      );

      serverToUse = mcpServer; // 使用新创建的 server

      try {
        // 将服务器连接到传输层
        // 必须在调用 handleRequest 之前连接服务器
        console.log(
          `[StreamableHTTP] 正在将会话 ${sessionId} 的 MCP 服务器连接到传输层`
        );
        await serverToUse.connect(transport);
        console.log(
          `[StreamableHTTP] 已成功将会话 ${sessionId} 的 MCP 服务器连接到传输层`
        );
      } catch (error) {
        console.error(
          `[StreamableHTTP] 将会话 ${sessionId} 的 MCP 服务器连接到传输层失败:`,
          error
        );
        this.sessions.delete(sessionId);
        this.sendErrorResponse(
          reply.raw,
          500,
          -32000,
          `建立 MCP 连接失败: ${error.message}`,
          null
        );
        return;
      }
    }

    // 处理请求 - StreamableHTTPServerTransport 的 handleRequest 方法
    // 需要将 Fastify 的 req/reply 转换为 Node.js 原生的 req/res
    // 确保响应流没有设置编码（StreamableHTTPServerTransport 要求）
    const response = reply.raw;
    const request = req.raw;

    // StreamableHTTPServerTransport 要求响应流不能有编码设置
    // 创建一个 Proxy 包装的响应对象，确保编码检查通过
    // 同时拦截 initialize 请求的响应以保存初始化信息
    let responseChunks = [];
    // 判断是否是第一次初始化请求（需要保存响应）
    // 如果会话不存在或未初始化，且当前请求是 initialize，则需要保存响应
    const isFirstInitialize = isInitialize && (!session || !session.initialized);

    // 保存 sessionId 和 this 的引用，以便在 Proxy 中访问
    const transportService = this;
    const currentSessionId = sessionId;

    const wrappedResponse = new Proxy(response, {
      get(target, prop) {
        // 如果访问 _readableState，返回一个代理对象
        if (prop === "_readableState" && target._readableState) {
          return new Proxy(target._readableState, {
            get(stateTarget, stateProp) {
              // 如果访问 encoding 属性，返回 null
              if (stateProp === "encoding") {
                return null;
              }
              return stateTarget[stateProp];
            },
            has(stateTarget, stateProp) {
              // 即使 encoding 存在，也返回 false（如果可能）
              if (stateProp === "encoding") {
                return false;
              }
              return stateProp in stateTarget;
            },
          });
        }
        // 如果访问 readableEncoding，返回 null
        if (prop === "readableEncoding") {
          return null;
        }

        // 拦截 write 方法以捕获响应内容（用于保存初始化响应）
        if (prop === "write" && isFirstInitialize) {
          return function (chunk, encoding, callback) {
            if (chunk) {
              responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
            }
            return target.write(chunk, encoding, callback);
          };
        }

        // 拦截 end 方法以保存完整的初始化响应
        if (prop === "end" && isFirstInitialize) {
          return function (chunk, encoding, callback) {
            if (chunk) {
              responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
            }

            // 尝试解析并保存初始化响应
            if (responseChunks.length > 0) {
              try {
                const responseBody = Buffer.concat(responseChunks).toString("utf8");
                const parsedResponse = JSON.parse(responseBody);

                // 如果是 initialize 响应（有 result 字段且包含 protocolVersion 或 capabilities）
                if (parsedResponse.result && (parsedResponse.result.protocolVersion || parsedResponse.result.capabilities)) {
                  // 从 sessions Map 中获取会话（确保获取最新的会话对象）
                  const currentSession = transportService.sessions.get(currentSessionId);
                  if (currentSession) {
                    currentSession.initResponse = parsedResponse;
                    currentSession.initialized = true; // 在成功拿到响应后才标记为已初始化
                    console.log(
                      `[StreamableHTTP] 已成功初始化并保存响应到会话 ${currentSessionId}:`,
                      JSON.stringify(parsedResponse, null, 2).substring(0, 500)
                    );
                  } else {
                    console.warn(
                      `[StreamableHTTP] 无法保存初始化响应：会话 ${currentSessionId} 不存在`
                    );
                  }
                }
              } catch (error) {
                console.warn(
                  `[StreamableHTTP] 解析初始化响应失败，无法保存:`,
                  error.message
                );
              }
            }

            return target.end(chunk, encoding, callback);
          };
        }

        // 其他属性正常返回
        return target[prop];
      },
      has(target, prop) {
        // 对于 readableEncoding，即使存在也返回 false
        if (prop === "readableEncoding") {
          return false;
        }
        return prop in target;
      },
    });

    // 添加响应事件监听，用于诊断
    const originalEnd = response.end.bind(response);
    let responseEnded = false;
    response.end = function (...args) {
      responseEnded = true;
      console.log(`[StreamableHTTP] 会话 ${sessionId} 的响应已结束`);
      return originalEnd(...args);
    };

    response.on("finish", () => {
      console.log(`[StreamableHTTP] 会话 ${sessionId} 的响应已完成`);
    });

    response.on("close", () => {
      console.log(`[StreamableHTTP] 会话 ${sessionId} 的响应已关闭`);
    });

    try {
      console.log(
        `[StreamableHTTP] 正在为会话 ${sessionId} 调用 transport.handleRequest，请求体:`,
        requestBody ? JSON.stringify(requestBody).substring(0, 200) : "null"
      );
      // 使用包装的响应对象，确保编码检查通过
      // StreamableHTTPServerTransport 会自己处理请求体的解析和响应流的编码
      // 如果 requestBody 已解析，可以传递它作为第三个参数（可选）
      if (requestBody) {
        await transport.handleRequest(request, wrappedResponse, requestBody);
      } else {
        await transport.handleRequest(request, wrappedResponse);
      }
      console.log(
        `[StreamableHTTP] 会话 ${sessionId} 的 handleRequest 已完成，响应已结束: ${responseEnded}，响应头已发送: ${response.headersSent}`
      );
    } catch (error) {
      console.error(
        `[StreamableHTTP] 处理会话 ${sessionId} 的请求时出错:`,
        error
      );
      this.sendErrorResponse(
        response,
        500,
        -32000,
        `处理请求失败: ${error.message}`,
        null
      );
    }
  }
}

module.exports = new TransportService();
