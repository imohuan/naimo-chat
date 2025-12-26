import type { McpServerConfig, McpTool } from "../interface";
import { useLlmApi } from "./useLlmApi";

export function useMcpApi() {
  const { baseUrl, endpoint } = useLlmApi();

  type UpdateServerResponse = {
    success: boolean;
    config?: McpServerConfig;
    error?: string;
  };

  async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${endpoint.value}${path}`;
    const headers: Record<string, string> = {};
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    const data = (await res.json()) as T;
    if (!res.ok) {
      const message =
        ((data as unknown) as { error?: string; message?: string })?.error ||
        ((data as unknown) as { error?: string; message?: string })?.message ||
        "请求失败";
      throw new Error(message);
    }
    return data;
  }

  /**
   * 获取所有 MCP 服务器
   */
  async function fetchServers(): Promise<Record<string, McpServerConfig>> {
    return await apiCall<Record<string, McpServerConfig>>("/api/mcp/servers");
  }

  /**
   * 获取单个 MCP 服务器
   */
  async function fetchServer(name: string): Promise<McpServerConfig> {
    return await apiCall<McpServerConfig>(`/api/mcp/servers/${encodeURIComponent(name)}`);
  }

  /**
   * 创建 MCP 服务器
   */
  async function createServer(name: string, config: McpServerConfig): Promise<void> {
    await apiCall("/api/mcp/servers", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });
  }

  /**
   * 更新 MCP 服务器
   */
  async function updateServer(
    name: string,
    config: McpServerConfig
  ): Promise<UpdateServerResponse> {
    return await apiCall<UpdateServerResponse>(
      `/api/mcp/servers/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify({ config }),
      }
    );
  }

  /**
   * 删除 MCP 服务器
   */
  async function deleteServer(name: string): Promise<void> {
    await apiCall(`/api/mcp/servers/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  /**
   * 获取 MCP 服务器的工具列表（统一使用 SSE 方式）
   * @param group MCP 服务器名称（作为 group）
   * @param _serverConfig 服务器配置（保留用于向后兼容，当前未使用）
   * @param sessionId 会话 ID（可选）
   */
  async function fetchTools(
    group: string,
    _serverConfig?: McpServerConfig,
    sessionId?: string
  ): Promise<McpTool[]> {
    return new Promise((resolve, reject) => {
      if (!sessionId) {
        sessionId = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const requestId = Date.now();
      let eventSource: EventSource | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let requestSent = false;

      // 清理函数
      const cleanup = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      // 设置超时（10秒）
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("获取工具列表超时（10秒内未收到响应）"));
      }, 10000);

      try {
        // 建立 SSE 连接
        const sseUrl = `${endpoint.value}/mcp/${group}?sessionId=${sessionId}`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          console.log(`SSE 连接已建立: ${group}`);

          // 连接建立后发送 tools/list 请求
          if (!requestSent) {
            requestSent = true;
            sendToolsListRequest(group, sessionId!, requestId).catch((err) => {
              cleanup();
              reject(new Error(`发送请求失败: ${err.message}`));
            });
          }
        };

        // 处理 SSE 消息
        const handleMessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);

            // 检查是否是我们要的响应（通过 id 匹配）
            if (data.id === requestId && data.result) {
              if (data.result.tools && Array.isArray(data.result.tools)) {
                cleanup();
                resolve(data.result.tools);
              } else if (data.error) {
                cleanup();
                reject(new Error(data.error.message || "获取工具列表失败"));
              }
            }
          } catch (e) {
            // 忽略解析错误，继续等待正确的响应
            console.warn("解析 SSE 消息失败:", e);
          }
        };

        eventSource.onmessage = handleMessage;

        // 也监听其他可能的事件类型
        ["response", "data", "jsonrpc", "result"].forEach((eventType) => {
          eventSource!.addEventListener(eventType, handleMessage);
        });

        eventSource.onerror = (error) => {
          console.error("SSE 连接错误:", error);
          if (eventSource?.readyState === EventSource.CLOSED) {
            cleanup();
            reject(new Error("SSE 连接已关闭"));
          }
        };
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  /**
   * 发送 tools/list 请求（用于 SSE 模式）
   */
  async function sendToolsListRequest(
    group: string,
    sessionId: string,
    requestId: number
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000); // 3秒超时

    try {
      const response = await fetch(`${endpoint.value}/mcp/${group}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
          id: requestId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`发送请求失败: ${response.status} - ${errorText}`);
      }

      // SSE 模式下，响应通过 EventSource 返回，这里只确认请求已发送
      console.log("tools/list 请求已发送，等待 SSE 响应...");
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        // 超时是正常的，响应会通过 SSE 返回
        console.log("请求已提交（超时是正常的），等待 SSE 响应...");
      } else {
        throw error;
      }
    }
  }

  /**
   * 调用 MCP 工具（统一使用 SSE 方式）
   * @param group MCP 服务器名称（作为 group）
   * @param toolName 工具名称
   * @param args 工具参数
   * @param _serverConfig 服务器配置（保留用于向后兼容，当前未使用）
   * @param sessionId 会话 ID（可选）
   */
  async function callTool(
    group: string,
    toolName: string,
    args: Record<string, any>,
    _serverConfig?: McpServerConfig,
    sessionId?: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!sessionId) {
        sessionId = `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const requestId = Date.now();
      let eventSource: EventSource | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let requestSent = false;

      // 清理函数
      const cleanup = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      // 设置超时（30秒，工具调用可能需要更长时间）
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("工具调用超时（30秒内未收到响应）"));
      }, 30000);

      try {
        // 建立 SSE 连接
        const sseUrl = `${endpoint.value}/mcp/${group}?sessionId=${sessionId}`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          console.log(`SSE 连接已建立: ${group}`);

          // 连接建立后发送 tools/call 请求
          if (!requestSent) {
            requestSent = true;
            sendToolCallRequest(group, sessionId!, toolName, args, requestId).catch(
              (err) => {
                cleanup();
                reject(new Error(`发送请求失败: ${err.message}`));
              }
            );
          }
        };

        // 处理 SSE 消息
        const handleMessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);

            // 检查是否是我们要的响应（通过 id 匹配）
            if (data.id === requestId) {
              if (data.result !== undefined) {
                cleanup();
                resolve(data.result);
              } else if (data.error) {
                cleanup();
                reject(new Error(data.error.message || "工具调用失败"));
              }
            }
          } catch (e) {
            // 忽略解析错误，继续等待正确的响应
            console.warn("解析 SSE 消息失败:", e);
          }
        };

        eventSource.onmessage = handleMessage;

        // 也监听其他可能的事件类型
        ["response", "data", "jsonrpc", "result"].forEach((eventType) => {
          eventSource!.addEventListener(eventType, handleMessage);
        });

        eventSource.onerror = (error) => {
          console.error("SSE 连接错误:", error);
          if (eventSource?.readyState === EventSource.CLOSED) {
            cleanup();
            reject(new Error("SSE 连接已关闭"));
          }
        };
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  /**
   * 发送 tools/call 请求（用于 SSE 模式）
   */
  async function sendToolCallRequest(
    group: string,
    sessionId: string,
    toolName: string,
    args: Record<string, any>,
    requestId: number
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000); // 3秒超时

    try {
      const response = await fetch(`${endpoint.value}/mcp/${group}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: requestId,
          params: {
            name: toolName,
            arguments: args,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`发送请求失败: ${response.status} - ${errorText}`);
      }

      // SSE 模式下，响应通过 EventSource 返回，这里只确认请求已发送
      console.log("tools/call 请求已发送，等待 SSE 响应...");
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        // 超时是正常的，响应会通过 SSE 返回
        console.log("请求已提交（超时是正常的），等待 SSE 响应...");
      } else {
        throw error;
      }
    }
  }

  return {
    baseUrl,
    endpoint,
    fetchServers,
    fetchServer,
    createServer,
    updateServer,
    deleteServer,
    fetchTools,
    callTool,
  };
}
