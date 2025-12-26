const http = require("http");
const { spawn } = require("child_process");

// ==================== 配置常量 ====================
const CONFIG = {
  hostname: "127.0.0.1",
  port: 3457,
  serverStartDelay: 2000,
  sseWaitDelay: 1000,
  testTimeout: 20000,
};

// ==================== 服务器管理 ====================
let serverProcess;

function startServer() {
  console.log("Starting server...");
  const server = spawn("node", ["src/index_llm.js"], {
    shell: true,
    stdio: "pipe",
  });

  server.stdout.on("data", (data) => {
    const str = data.toString();
    console.log(`Server stdout: ${str.trim()}`);
    if (
      str.includes("服务已启动") ||
      str.includes("Server listening") ||
      str.includes("服务已在后台运行")
    ) {
      console.log(
        `Server is running! Waiting ${CONFIG.serverStartDelay}ms to ensure readiness...`
      );
      setTimeout(runTest, CONFIG.serverStartDelay);
    }
  });

  server.stderr.on("data", (data) => {
    console.error(`Server stderr: ${data}`);
  });

  return server;
}

// ==================== HTTP 请求封装 ====================
/**
 * 发送 HTTP 请求的通用函数
 * @param {Object} options - 请求选项
 * @param {string} options.path - 请求路径
 * @param {string} options.method - HTTP 方法
 * @param {Object} options.headers - 请求头
 * @param {string} options.body - 请求体（可选）
 * @returns {Promise<Object>} 返回响应数据
 */
function sendHttpRequest({ path, method, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: CONFIG.hostname,
      port: CONFIG.port,
      path,
      method,
      headers: {
        ...headers,
        ...(body && {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        }),
      },
    };

    const req = http.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

// ==================== SSE 连接 ====================
let sseResponseHandler = null;

/**
 * 解析 SSE 数据
 * @param {string} data - SSE 原始数据
 * @returns {Array<Object>} 解析后的消息数组
 */
function parseSSEData(data) {
  const messages = [];
  const lines = data.split("\n");
  let currentMessage = {};

  for (const line of lines) {
    if (line === "") {
      if (Object.keys(currentMessage).length > 0) {
        messages.push(currentMessage);
        currentMessage = {};
      }
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const field = line.substring(0, colonIndex).trim();
    const value = line.substring(colonIndex + 1).trim();

    if (field === "data") {
      try {
        currentMessage.data = JSON.parse(value);
      } catch {
        // 如果解析失败，使用原始字符串值
        currentMessage.data = value;
      }
    } else if (field === "event") {
      currentMessage.event = value;
    } else if (field === "id") {
      currentMessage.id = value;
    }
  }

  if (Object.keys(currentMessage).length > 0) {
    messages.push(currentMessage);
  }

  return messages;
}

/**
 * 建立 SSE 连接
 * @param {string} sessionId - 会话ID
 * @param {string} serverPath - 服务器路径
 * @returns {Promise<Function>} 返回一个函数用于设置响应处理器
 */
function connectSSE(sessionId, serverPath = "/mcp/context7") {
  return new Promise((resolve, reject) => {
    console.log("Connecting to SSE...");
    const options = {
      hostname: CONFIG.hostname,
      port: CONFIG.port,
      path: serverPath,
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        "x-session-id": sessionId,
      },
    };

    let buffer = "";

    const req = http.request(options, (res) => {
      console.log(`SSE Status: ${res.statusCode}`);

      if (res.statusCode !== 200) {
        reject(
          new Error(`SSE Connection failed with status ${res.statusCode}`)
        );
        return;
      }

      // 接收并解析 SSE 数据
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // 保留最后一个不完整的消息

        for (const line of lines) {
          if (line.trim()) {
            const messages = parseSSEData(line);
            for (const message of messages) {
              if (sseResponseHandler) {
                sseResponseHandler(message);
              }
            }
          }
        }
      });

      // 提供一个函数来设置响应处理器
      resolve((handler) => {
        sseResponseHandler = handler;
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

// ==================== MCP 消息发送 ====================
/**
 * 发送 tools/list 请求
 * @param {string} sessionId - 会话ID
 * @param {string} serverName - 服务器名称
 */
async function sendToolsList(sessionId, serverName = "test-group") {
  console.log("Sending tools/list request...");
  const requestBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/list",
    id: 1,
  });

  try {
    const response = await sendHttpRequest({
      path: `/mcp/${serverName}/messages`,
      method: "POST",
      headers: {
        "x-session-id": sessionId,
      },
      body: requestBody,
    });

    console.log(`Message API Status: ${response.statusCode}`);
    console.log(`Message API Response: ${response.body}`);

    if (response.statusCode === 200 || response.statusCode === 202) {
      console.log("✅ TEST PASSED: tools/list request accepted");
      return true;
    } else {
      console.log("❌ TEST FAILED: Unexpected status code");
      return false;
    }
  } catch (error) {
    console.error(`Message API Error: ${error.message}`);
    return false;
  }
}

/**
 * 调用工具
 * @param {string} sessionId - 会话ID
 * @param {string} toolName - 工具名称
 * @param {Object} toolArguments - 工具参数
 * @param {string} serverName - 服务器名称
 * @param {number} requestId - 请求ID（可选）
 * @param {Function} waitForResponse - 等待响应的函数
 * @returns {Promise<Object|null>} 返回工具调用的实际结果
 */
async function callTool(
  sessionId,
  toolName,
  toolArguments,
  serverName = "test-group",
  requestId = null,
  waitForResponse = null
) {
  console.log(`Calling tool: ${toolName}...`);
  const actualRequestId = requestId || Date.now();
  const requestBody = JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    id: actualRequestId,
    params: {
      name: toolName,
      arguments: toolArguments,
    },
  });

  try {
    const response = await sendHttpRequest({
      path: `/mcp/${serverName}/messages`,
      method: "POST",
      headers: {
        "x-session-id": sessionId,
      },
      body: requestBody,
    });

    console.log(`Tool Call Status: ${response.statusCode}`);
    console.log(`Tool Call HTTP Response: ${response.body}`);

    if (response.statusCode === 200 || response.statusCode === 202) {
      console.log(`✅ Tool ${toolName} call accepted, waiting for response...`);

      // 如果有等待响应的函数，等待实际的工具调用结果
      if (waitForResponse) {
        const actualResponse = await waitForResponse(actualRequestId);
        if (actualResponse) {
          console.log(`\n📦 Tool Call Result:`);
          console.log(JSON.stringify(actualResponse, null, 2));
          return actualResponse;
        }
      }

      return { accepted: true };
    } else {
      console.log(`❌ TEST FAILED: Unexpected status code for ${toolName}`);
      return null;
    }
  } catch (error) {
    console.error(`Tool Call Error: ${error.message}`);
    return null;
  }
}

// ==================== 测试流程 ====================
async function runTest() {
  console.log("Starting test...");

  const sessionId = "test-session-" + Date.now();
  const serverName = "context7"; // 统一使用 context7 服务器
  console.log(`Using Session ID: ${sessionId}`);
  console.log(`Using Server: ${serverName}`);

  try {
    // 1. 建立 SSE 连接并设置响应处理器
    const setSSEHandler = await connectSSE(sessionId, `/mcp/${serverName}`);
    console.log("SSE connection established");

    // 创建等待响应的机制
    const pendingResponses = new Map();

    setSSEHandler((message) => {
      if (message.data && typeof message.data === "object") {
        const responseId = message.data.id;
        if (responseId && pendingResponses.has(responseId)) {
          const { resolve } = pendingResponses.get(responseId);
          pendingResponses.delete(responseId);
          resolve(message.data);
        }
      }
    });

    // 创建等待响应的函数
    const waitForResponse = (requestId, timeout = 10000) => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingResponses.delete(requestId);
          resolve(null);
        }, timeout);

        pendingResponses.set(requestId, {
          resolve: (data) => {
            clearTimeout(timer);
            resolve(data);
          },
        });
      });
    };

    // 等待一下确保连接稳定
    await new Promise((resolve) => setTimeout(resolve, CONFIG.sseWaitDelay));

    // 2. 发送 tools/list 请求
    await sendToolsList(sessionId, serverName);

    // 3. 调用 context7__resolve-library-id 工具
    await callTool(
      sessionId,
      "context7__resolve-library-id",
      { libraryName: "vue" },
      serverName,
      1765712614420,
      waitForResponse
    );

    console.log("\n✅ All tests completed");
  } catch (error) {
    console.error(`Test failed: ${error.message}`);
  } finally {
    // 等待一下再清理，确保所有响应都被接收
    setTimeout(cleanup, 1000);
  }
}

// ==================== 清理函数 ====================
function cleanup() {
  if (serverProcess) {
    console.log("Cleaning up...");
    process.exit(0);
  }
}

// ==================== 启动测试 ====================
serverProcess = startServer();

// 超时保护
setTimeout(() => {
  console.log("Test timed out");
  cleanup();
}, CONFIG.testTimeout);
