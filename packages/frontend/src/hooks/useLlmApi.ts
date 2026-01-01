import { computed, ref } from "vue";
import type {
  ChatMessage,
  ClipboardWatchStatus,
  HealthStatus,
  LlmProvider,
  McpTool,
} from "../interface";

const BASE_URL_KEY = "llm_base_url";
const TEMP_API_KEY = "llm_temp_api_key";
const TRANSLATION_MODEL_KEY = "llm_translation_model";
const AUTO_TRANSLATE_KEY = "llm_auto_translate";
const PROVIDERS_CACHE = "llm_providers_cache";

function normalizeBase(url: string) {
  return url.replace(/\/$/, "");
}

export function useLlmApi() {
  const baseUrl = ref<string>(
    localStorage.getItem(BASE_URL_KEY) || "http://127.0.0.1:3457"
  );
  const tempApiKey = ref<string>(localStorage.getItem(TEMP_API_KEY) || "");
  const translationModel = ref<string>(localStorage.getItem(TRANSLATION_MODEL_KEY) || "");
  const autoTranslate = ref<boolean>(localStorage.getItem(AUTO_TRANSLATE_KEY) === "1");
  const needsRestart = ref(false);
  const healthStatus = ref<HealthStatus | null>(null);

  const endpoint = computed(() => normalizeBase(baseUrl.value));

  function persistSettings() {
    localStorage.setItem(BASE_URL_KEY, baseUrl.value);
    localStorage.setItem(TEMP_API_KEY, tempApiKey.value);
    if (translationModel.value) {
      localStorage.setItem(TRANSLATION_MODEL_KEY, translationModel.value);
    } else {
      localStorage.removeItem(TRANSLATION_MODEL_KEY);
    }
    localStorage.setItem(AUTO_TRANSLATE_KEY, autoTranslate.value ? "1" : "0");
  }

  async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${endpoint.value}${path}`;
    // 只在有 body 的情况下设置 Content-Type
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
        ((data as unknown) as { message?: string; error?: string })?.message ||
        "请求失败";
      throw new Error(message);
    }
    return data;
  }

  async function fetchProviders(): Promise<LlmProvider[]> {
    try {
      const list = await apiCall<LlmProvider[]>("/providers");
      localStorage.setItem(PROVIDERS_CACHE, JSON.stringify(list));
      return list;
    } catch (err) {
      const cached = localStorage.getItem(PROVIDERS_CACHE);
      if (cached) {
        return JSON.parse(cached) as LlmProvider[];
      }
      throw err;
    }
  }

  /**
   * 同步配置 - 将 providers 数据同步到本地配置文件
   * @returns {Promise<{success: boolean; message: string; providersCount?: number}>} 同步操作的结果
   */
  async function syncConfig(): Promise<{
    success: boolean;
    message: string;
    providersCount?: number;
  }> {
    try {
      return await apiCall<{
        success: boolean;
        message: string;
        providersCount?: number;
      }>("/api/config-sync", {
        method: "GET",
      });
    } catch (err) {
      console.error("配置同步失败:", err);
      throw err;
    }
  }

  async function toggleProvider(provider: LlmProvider) {
    const target = provider.enabled === false;
    await apiCall(`/api/providers/enabled`, {
      method: "POST",
      body: JSON.stringify({ name: provider.name, enabled: target }),
    });
    await syncConfig().catch((err) => {
      console.warn("配置同步失败，但不影响操作:", err);
    });
    return target;
  }

  async function deleteProvider(name: string) {
    await apiCall(`/providers/${name}`, { method: "DELETE" });
    // 同步配置到本地文件
    await syncConfig().catch((err) => {
      console.warn("配置同步失败，但不影响操作:", err);
    });
  }

  async function saveProvider(
    provider: LlmProvider,
    isEditing: boolean,
    skipSync = false
  ) {
    const payload = {
      type: provider.type || "openai",
      id: provider.name,
      ...provider,
    };
    if (isEditing) {
      await apiCall(`/providers/${provider.name}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      // 临时添加 model 字段以绕过后端的 preHandler hook 检查
      // hook 会检查 POST 请求是否有 model 字段，但后端注册 provider 时会忽略此字段
      await apiCall("/providers", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          model: "dummy", // 临时字段，用于绕过 hook 检查
        }),
      });
    }
    // 同步配置到本地文件（除非跳过）
    if (!skipSync) {
      await syncConfig().catch((err) => {
        console.warn("配置同步失败，但不影响操作:", err);
      });
    }
  }

  async function saveProvidersJson(list: LlmProvider[]) {
    const existing = new Set((await fetchProviders()).map((p) => p.name));
    const next = new Set(list.map((p) => p.name));

    // delete removed
    for (const name of existing) {
      if (!next.has(name)) {
        await apiCall(`/providers/${name}`, { method: "DELETE" });
      }
    }

    // add / update（跳过每次同步，批量操作完成后统一同步）
    for (const item of list) {
      await saveProvider(item, existing.has(item.name), true);
    }

    // 批量操作完成后统一同步一次配置
    await syncConfig().catch((err) => {
      console.warn("配置同步失败，但不影响操作:", err);
    });
  }

  /**
   * 轮询检查服务健康状态，直到服务可用
   * @param maxAttempts 最大尝试次数，默认60次（约30秒）
   * @param interval 每次检查的间隔时间（毫秒），默认500ms
   * @returns Promise<boolean> 服务是否可用
   */
  async function waitForService(maxAttempts = 60, interval = 500): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await apiCall("/health");
        return true; // 服务可用
      } catch {
        // 服务还未就绪，继续等待
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    }
    return false; // 超时，服务未就绪
  }

  async function restartService() {
    await apiCall("/api/restart", {
      method: "POST",
      body: JSON.stringify({}),
    });
    needsRestart.value = false;

    // 在等待服务重启之前，从 localStorage 读取最新的 baseUrl
    // 因为如果配置中修改了 HOST/PORT，服务会在新端口启动
    // 健康检查需要使用新的 baseUrl
    const savedBaseUrl = localStorage.getItem(BASE_URL_KEY);
    if (savedBaseUrl && savedBaseUrl !== baseUrl.value) {
      baseUrl.value = savedBaseUrl;
    }

    // 等待服务重启
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // 轮询检查服务健康状态，直到服务可用（使用新的 baseUrl）
    const isReady = await waitForService();
    if (isReady) {
      // 服务已就绪，刷新页面以重新连接服务
      window.location.reload();
    } else {
      // 超时，仍然刷新页面（可能服务需要更长时间）
      console.warn("服务重启超时，但仍将刷新页面");
      window.location.reload();
    }
  }

  /**
   * 从服务器读取配置
   * @returns {Promise<Record<string, any>>} 返回完整的配置对象
   * @throws {Error} 当请求失败时抛出错误
   * @description 调用 GET /api/config 端点获取当前服务的配置信息
   */
  async function fetchConfig(): Promise<Record<string, any>> {
    return await apiCall<Record<string, any>>("/api/config");
  }

  /**
   * 保存配置到服务器
   * @param {Record<string, any>} config - 要保存的配置对象，包含所有配置项
   * @returns {Promise<{success: boolean; message: string}>} 保存操作的结果，包含成功状态和消息
   * @throws {Error} 当请求失败时抛出错误
   * @description 调用 POST /api/config 端点保存配置，服务器会自动备份现有配置文件后再写入新配置
   * @description 保存成功后会将 needsRestart 标志设置为 true，提示需要重启服务
   * @description 如果配置中包含 HOST/PORT，会同步更新 baseUrl；如果包含 APIKEY，会同步更新 tempApiKey
   */
  async function saveConfig(
    config: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    const result = await apiCall<{ success: boolean; message: string }>("/api/config", {
      method: "POST",
      body: JSON.stringify(config),
    });

    // 同步 HOST 和 PORT 到 baseUrl
    // 注意：如果 HOST/PORT 变化，只更新 localStorage，不更新 ref
    // 因为服务需要重启才能在新端口生效，重启请求仍需要使用旧端口
    // 重启成功后页面会刷新，会自动从 localStorage 读取新值
    if (config.HOST !== undefined || config.PORT !== undefined) {
      const host = config.HOST ?? "127.0.0.1";
      const port = config.PORT ?? 3457;
      const newBaseUrl = `http://${host}:${port}`;

      // 只有当 baseUrl 发生变化时才更新 localStorage
      // 但不更新 ref，保持旧值用于重启请求
      if (baseUrl.value !== newBaseUrl) {
        localStorage.setItem(BASE_URL_KEY, newBaseUrl);
        // 不更新 baseUrl.value，等重启成功后页面刷新会自动读取新值
      }
    }

    // 同步 APIKEY 到 tempApiKey
    if (config.APIKEY !== undefined) {
      const newApiKey = String(config.APIKEY || "").trim();

      // 只有当 tempApiKey 发生变化时才更新
      if (tempApiKey.value !== newApiKey) {
        tempApiKey.value = newApiKey;
        localStorage.setItem(TEMP_API_KEY, newApiKey);
      }
    }

    return result;
  }

  async function checkHealth() {
    healthStatus.value = { ok: false, msg: "连接中..." };
    try {
      await apiCall("/health");
      healthStatus.value = { ok: true, msg: "服务在线" };
    } catch (err) {
      healthStatus.value = { ok: false, msg: (err as Error).message };
    }
  }

  async function fetchClipboardWatchStatus(): Promise<ClipboardWatchStatus> {
    const data = await apiCall<{ running: boolean; pid: number | null }>(
      "/api/clipboard-watch/status",
      { method: "GET" }
    );
    return { running: !!data.running, pid: data.pid ?? null };
  }

  async function startClipboardWatch(): Promise<ClipboardWatchStatus> {
    const data = await apiCall<{ running: boolean; pid: number | null }>(
      "/api/clipboard-watch/start",
      { method: "GET" }
    );
    return { running: !!data.running, pid: data.pid ?? null };
  }

  async function stopClipboardWatch(): Promise<ClipboardWatchStatus> {
    const data = await apiCall<{ running: boolean; pid: number | null }>(
      "/api/clipboard-watch/stop",
      { method: "GET" }
    );
    return { running: !!data.running, pid: data.pid ?? null };
  }

  /**
   * 获取日志文件列表
   * @returns {Promise<Array<{name: string; path: string; size: number; lastModified: string}>>} 日志文件列表
   */
  async function fetchLogFiles(): Promise<
    Array<{ name: string; path: string; size: number; lastModified: string }>
  > {
    return await apiCall<
      Array<{ name: string; path: string; size: number; lastModified: string }>
    >("/api/logs/files", { method: "GET" });
  }

  /**
   * 获取日志内容
   * @param {string} filePath - 日志文件路径
   * @param {number} [offset=0] - 从末尾开始的偏移量，默认0（从最后一行开始）
   * @param {number} [size=1000] - 返回的行数，默认1000行，最大10000行
   * @returns {Promise<string[]>} 日志行数组
   */
  async function fetchLogs(
    filePath: string,
    offset: number = 0,
    size: number = 1000
  ): Promise<string[]> {
    const params = new URLSearchParams({
      file: filePath,
    });
    if (offset > 0) {
      params.append("offset", offset.toString());
    }
    if (size > 0) {
      params.append("size", Math.min(size, 10000).toString());
    }
    return await apiCall<string[]>(`/api/logs?${params.toString()}`, {
      method: "GET",
    });
  }

  /**
   * 清除日志内容
   * @param {string} filePath - 日志文件路径
   * @returns {Promise<{success: boolean; message: string}>} 清除操作的结果
   */
  async function clearLogs(
    filePath: string
  ): Promise<{ success: boolean; message: string }> {
    return await apiCall<{ success: boolean; message: string }>(
      `/api/logs?file=${encodeURIComponent(filePath)}`,
      { method: "DELETE" }
    );
  }

  /**
   * 更新 Claude settings.json 中的 statusLine 配置
   * @returns {Promise<{success: boolean; message: string}>} 更新操作的结果
   */
  async function updateStatusLine(): Promise<{ success: boolean; message: string }> {
    return await apiCall<{ success: boolean; message: string }>(
      "/api/statusline/update",
      {
        method: "GET",
      }
    );
  }

  /**
   * 启动 Claude CLI（在服务端打开新的终端窗口并设置环境变量）
   */
  async function startClaudeCli(params: {
    timeoutMs: string;
    baseUrl: string;
    apiKey: string;
    claudePath: string;
    workDir: string;
    terminalType?: string;
  }): Promise<{ success: boolean; message: string }> {
    return await apiCall<{ success: boolean; message: string }>("/api/claude/start", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * 获取对话列表
   * @param limit 每页数量
   * @param offset 偏移量
   * @returns 对话列表
   */
  async function fetchMessages(
    limit: number = 100,
    offset: number = 0
  ): Promise<{
    messages: Array<{
      requestId: string;
      hasRequest: boolean;
      hasResponse: boolean;
      hasStreamResponse: boolean;
      timestamp: string | null;
      model: string | null;
      lastModified: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return await apiCall(`/api/messages?${params.toString()}`);
  }

  /**
   * 获取对话详情
   * @param requestId 请求 ID
   * @returns 对话详情
   */
  async function fetchMessageDetail(requestId: string): Promise<{
    requestId: string;
    request: any;
    response: {
      content: string | null;
      full: any[] | null;
      isStream: boolean;
    };
  }> {
    return await apiCall(`/api/messages/${requestId}`);
  }

  /**
   * 删除消息
   * @param requestIds 请求 ID 或请求 ID 数组
   * @returns 删除结果
   */
  async function deleteMessages(
    requestIds: string | string[]
  ): Promise<{
    success: boolean;
    deleted: number;
    failed: number;
    message: string;
  }> {
    return await apiCall(`/api/messages`, {
      method: "DELETE",
      body: JSON.stringify({
        requestIds: Array.isArray(requestIds) ? requestIds : [requestIds],
      }),
    });
  }

  /**
   * 获取指定 MCP 服务器的工具列表（直接 API 调用，不通过 SSE）
   * @param serverName 服务器名称
   * @returns 工具列表
   */
  async function fetchMcpServerTools(serverName: string): Promise<McpTool[]> {
    const data = await apiCall<{ tools: McpTool[] }>(
      `/api/mcp/servers/${encodeURIComponent(serverName)}/tools`,
      {
        method: "GET",
      }
    );
    return data.tools || [];
  }

  /**
   * 刷新指定 MCP 服务器的工具列表（直接 API 调用，不通过 SSE）
   * @param serverName 服务器名称
   * @returns 刷新后的工具列表
   */
  async function refreshMcpServerTools(serverName: string): Promise<McpTool[]> {
    const data = await apiCall<{ success: boolean; tools: McpTool[] }>(
      `/api/mcp/servers/${encodeURIComponent(serverName)}/tools/refresh`,
      {
        method: "POST",
      }
    );
    return data.tools || [];
  }

  /**
   * 获取 transformers 列表
   * @returns transformers 列表
   */
  async function fetchTransformers(): Promise<Array<{ name: string; endpoint: string | null }>> {
    try {
      const data = await apiCall<{ transformers?: Array<{ name: string; endpoint: string | null }> }>(
        "/api/transformers"
      );
      return data.transformers || [];
    } catch (err) {
      console.error("获取 transformers 失败:", err);
      return [];
    }
  }

  /**
   * 发送消息
   * @param messages 对话消息
   * @param model 目标模型（格式：provider,model）
   * @param serviceApiKey 路由服务自身的认证 key（放在 header 里）
   * @param providerApiKey 上游模型服务商的真实 key（放在 body 里透传）
   */
  async function sendMessage(
    messages: ChatMessage[],
    model: string,
    serviceApiKey?: string,
    providerApiKey?: string
  ): Promise<ChatMessage> {
    const headers: Record<string, string> = {};
    if (serviceApiKey) {
      headers.Authorization = `Bearer ${serviceApiKey}`;
    }
    const data = await apiCall<{
      content?: { text?: string }[];
      message?: string;
      choices?: any[];
    }>("/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        model,
        stream: false,
        apiKey: providerApiKey?.trim() || undefined,
      }),
    });

    let content = "";
    if (data.content && Array.isArray(data.content)) {
      content = data.content.map((c) => c.text || "").join("");
    } else if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
    } else if (((data as unknown) as { message?: string }).message) {
      content = ((data as unknown) as { message?: string }).message ?? "";
    } else {
      content = JSON.stringify(data);
    }

    return { role: "assistant", content };
  }

  async function sendMessageStream(
    messages: ChatMessage[],
    model: string,
    serviceApiKey: string | undefined,
    onChunk: (chunk: string) => void,
    providerApiKey?: string
  ): Promise<void> {
    const headers: Record<string, string> = {};
    if (serviceApiKey) {
      headers.Authorization = `Bearer ${serviceApiKey}`;
    }

    const url = `${endpoint.value}/v1/messages`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          messages,
          model,
          stream: true,
          apiKey: providerApiKey?.trim() || undefined,
        }),
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
      let errorMessage: unknown = `请求失败 (${response.status})`;
      try {
        const errorData = await response.json().catch(() => ({}));
        errorMessage =
          (errorData as { message?: unknown; error?: unknown })?.message ??
          (errorData as { message?: unknown; error?: unknown })?.error ??
          errorMessage;
      } catch {
        // 如果无法解析错误响应，使用默认消息
        const text = await response.text().catch(() => "");
        if (text) {
          errorMessage = text.substring(0, 200);
        }
      }

      // 确保错误信息为字符串，避免出现 [object Object]
      if (typeof errorMessage === "object") {
        try {
          errorMessage = JSON.stringify(errorMessage);
        } catch {
          errorMessage = "[object Object]";
        }
      }

      throw new Error(String(errorMessage));
    }

    const contentType = response.headers.get("Content-Type") || "";
    if (!contentType.includes("text/event-stream") && !contentType.includes("stream")) {
      // 如果不是流式响应，尝试解析为 JSON
      try {
        const data = await response.json();
        if (data.content && Array.isArray(data.content)) {
          const content = data.content.map((c: any) => c.text || "").join("");
          onChunk(content);
          return;
        }
      } catch {
        // 忽略解析错误
      }
    }

    if (!response.body) {
      throw new Error("响应体为空");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

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
            const data = JSON.parse(jsonLine);

            // 处理不同的流式响应格式
            // Anthropic 原生格式
            if (data.type === "content_block_delta" && data.delta?.text) {
              content += data.delta.text;
              onChunk(content);
            } else if (
              data.type === "content_block_delta" &&
              data.delta?.type === "text_delta" &&
              data.delta.text
            ) {
              content += data.delta.text;
              onChunk(content);
            } else if (data.type === "message_delta" && data.delta?.text) {
              content += data.delta.text;
              onChunk(content);
            }
            // OpenAI 格式
            else if (data.choices?.[0]?.delta?.content) {
              const deltaContent = data.choices[0].delta.content;
              if (deltaContent) {
                content += deltaContent;
                onChunk(content);
              }
            } else if (data.choices?.[0]?.delta?.message?.content) {
              const deltaContent = data.choices[0].delta.message.content;
              if (deltaContent) {
                content += deltaContent;
                onChunk(content);
              }
            }
            // 直接内容格式
            else if (typeof data.content === "string") {
              content = data.content;
              onChunk(content);
            }
            // 通用 delta 格式
            else if (data.delta?.text) {
              content += data.delta.text;
              onChunk(content);
            }
            // 处理 finish_reason，流结束
            else if (data.choices?.[0]?.finish_reason) {
              // 流结束，但内容可能已经在之前的 delta 中更新
              continue;
            }
          } catch (parseError) {
            // 忽略解析错误，继续处理下一行
            // 只在开发环境输出警告
            if (import.meta.env.DEV) {
              console.warn("解析流数据失败:", jsonLine, parseError);
            }
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
  }

  return {
    baseUrl,
    tempApiKey,
    translationModel,
    autoTranslate,
    needsRestart,
    healthStatus,
    endpoint,
    persistSettings,
    fetchProviders,
    toggleProvider,
    deleteProvider,
    saveProvider,
    saveProvidersJson,
    syncConfig,
    restartService,
    fetchConfig,
    saveConfig,
    checkHealth,
    fetchClipboardWatchStatus,
    startClipboardWatch,
    stopClipboardWatch,
    fetchLogFiles,
    fetchLogs,
    clearLogs,
    sendMessage,
    sendMessageStream,
    updateStatusLine,
    startClaudeCli,
    fetchMessages,
    fetchMessageDetail,
    deleteMessages,
    fetchMcpServerTools,
    refreshMcpServerTools,
    fetchTransformers,
  };
}
