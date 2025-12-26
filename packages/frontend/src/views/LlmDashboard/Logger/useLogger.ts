import { computed, ref } from "vue";
import type { LogEntry, LogFile, LogRequest } from "./types";
import { useLlmApi } from "@/hooks/useLlmApi";

export function useLogger() {
  const {
    fetchLogFiles: apiFetchLogFiles,
    fetchLogs: apiFetchLogs,
    clearLogs: apiClearLogs,
  } = useLlmApi();
  const logFiles = ref<LogFile[]>([]);
  const selectedLogFile = ref<string>("");
  const selectedLogFileObj = ref<LogFile | null>(null);
  const requests = ref<LogRequest[]>([]);
  const selectedRequestId = ref<string | null>(null);
  const searchQuery = ref("");
  const filterType = ref<"all" | "success" | "failed">("all");
  const isRefreshing = ref(false);

  // 分页相关状态
  const currentOffset = ref(0);
  const pageSize = ref(10000 - 1); // 每次加载200行
  const isLoadingMore = ref(false);
  const hasMore = ref(true);
  const allLogLines = ref<string[]>([]); // 存储所有已加载的日志行

  /** 聚合用于搜索的文本 */
  function appendSearchText(req: LogRequest, value: unknown) {
    if (value === undefined || value === null) return;
    let text = "";
    if (typeof value === "string") {
      text = value;
    } else {
      try {
        text = JSON.stringify(value);
      } catch {
        text = String(value);
      }
    }
    if (!text) return;
    req.searchText = req.searchText
      ? `${req.searchText}\n${text}`
      : text;
  }

  /** 加载日志文件列表 */
  async function loadLogFiles(autoSelectFirst = false) {
    try {
      const files = await apiFetchLogFiles();
      logFiles.value = files || [];
      if (autoSelectFirst && logFiles.value.length > 0) {
        const latestFile = logFiles.value[0];
        if (latestFile) {
          await selectLogFile(latestFile);
        }
      }
    } catch (error) {
      console.error("Error loading log files:", error);
    }
  }

  /** 加载日志内容（初始加载，只加载200行） */
  async function loadLogContent(filePath: string, offset?: number, size?: number) {
    try {
      // 重置状态
      currentOffset.value = 0;
      allLogLines.value = [];
      requests.value = [];
      hasMore.value = true;

      const initialSize = size || pageSize.value;
      const logLines = await apiFetchLogs(filePath, offset || 0, initialSize);

      if (Array.isArray(logLines)) {
        allLogLines.value = logLines;
        // 如果返回的行数少于请求的数量，说明没有更多数据了
        if (logLines.length < initialSize) {
          hasMore.value = false;
        }
        currentOffset.value = logLines.length;
      }

      const logContent = Array.isArray(logLines)
        ? logLines
          .map((line) =>
            typeof line === "string" ? line : JSON.stringify(line)
          )
          .join("\n")
        : logLines;
      processLogs(logContent, false); // false 表示替换模式
      return true;
    } catch (error) {
      console.error("Error loading log content:", error);
      return false;
    }
  }

  /** 加载更多日志内容 */
  async function loadMoreLogs() {
    if (!selectedLogFile.value || isLoadingMore.value || !hasMore.value) {
      return false;
    }

    isLoadingMore.value = true;
    try {
      const logLines = await apiFetchLogs(
        selectedLogFile.value,
        currentOffset.value,
        pageSize.value
      );

      if (Array.isArray(logLines) && logLines.length > 0) {
        // 追加到已加载的日志行
        allLogLines.value = [...allLogLines.value, ...logLines];
        currentOffset.value += logLines.length;

        // 如果返回的行数少于请求的数量，说明没有更多数据了
        if (logLines.length < pageSize.value) {
          hasMore.value = false;
        }

        // 处理新加载的日志内容
        const logContent = logLines
          .map((line) =>
            typeof line === "string" ? line : JSON.stringify(line)
          )
          .join("\n");
        processLogs(logContent, true); // true 表示追加模式
        return true;
      } else {
        hasMore.value = false;
        return false;
      }
    } catch (error) {
      console.error("Error loading more logs:", error);
      return false;
    } finally {
      isLoadingMore.value = false;
    }
  }

  /** 处理日志内容，解析为请求列表 */
  function processLogs(content: string, append: boolean = false) {
    const lines = content.split("\n");
    const reqMap = new Map<string, LogRequest>();

    // 如果是追加模式，需要保留现有的请求（深拷贝）
    if (append) {
      requests.value.forEach((req) => {
        reqMap.set(req.id, {
          ...req,
          logs: [...req.logs], // 深拷贝 logs 数组
        });
      });
    }

    lines.forEach((line) => {
      if (!line.trim()) return;
      try {
        const log: LogEntry = JSON.parse(line);

        if (log.reqId) {
          if (!reqMap.has(log.reqId)) {
            reqMap.set(log.reqId, {
              id: log.reqId,
              startTime: log.time,
              logs: [],
              method: "UNKNOWN",
              url: "",
              status: null,
              model: "",
              fullResponse: "",
              hasError: false,
              error: null,
              searchText: "",
            });
          }

          const reqObj = reqMap.get(log.reqId)!;
          reqObj.logs.push(log);
          appendSearchText(reqObj, log.msg);

          if (log.req) {
            reqObj.method = log.req.method;
            reqObj.url = log.req.url;
            appendSearchText(reqObj, log.req.method);
            appendSearchText(reqObj, log.req.url);
          }

          if (log.data?.model) {
            reqObj.model = log.data.model;
            appendSearchText(reqObj, log.data.model);
          }

          if (log.res) {
            reqObj.status = log.res.statusCode;
            reqObj.duration = log.responseTime;
            appendSearchText(reqObj, log.res);
          }

          if (log.err || log.level >= 50) {
            reqObj.hasError = true;
            reqObj.error = log.err || log.msg;
            appendSearchText(reqObj, log.err || log.msg);

            // 添加错误日志条目
            const errorLog: LogEntry = {
              time: log.time,
              level: log.level || 50,
              msg: "Error",
              type: "error",
              err: log.err || log.msg,
              reqId: log.reqId,
            };
            reqObj.logs.push(errorLog);
          }

          // 重构流式响应
          if (log.type === "recieved data" && log.data) {
            try {
              const chunkData =
                typeof log.data === "string" ? JSON.parse(log.data) : log.data;
              const delta =
                chunkData.choices?.[0]?.delta?.content || "";
              if (delta) {
                reqObj.fullResponse += delta;
                appendSearchText(reqObj, delta);
              }
            } catch {
              // ignore chunk parse error
            }
          }
          // 处理非流式响应
          else if ((log.response || log.result) && !reqObj.fullResponse) {
            const payload = log.response || log.result;
            let content = "";
            if (payload.choices?.[0]?.message?.content) {
              content = payload.choices[0].message.content;
            } else if (
              Array.isArray(payload.content) &&
              payload.content[0]?.text
            ) {
              content = payload.content[0].text;
            }
            if (content) {
              reqObj.fullResponse = content;
              appendSearchText(reqObj, content);

              // 添加响应日志条目
              const responseLog: LogEntry = {
                time: log.time,
                level: 30,
                msg: "Full Response",
                type: "full_response",
                data: { content, model: reqObj.model },
                reqId: log.reqId,
              };
              reqObj.logs.push(responseLog);
            }
          }

          // 收集用于搜索的有效负载信息
          if (log.data) {
            appendSearchText(reqObj, log.data);
          }
          if (log.request) {
            appendSearchText(reqObj, log.request);
          }
          if (log.response) {
            appendSearchText(reqObj, log.response);
          }
          if (log.result) {
            appendSearchText(reqObj, log.result);
          }
        }
      } catch (e) {
        console.warn("Failed to parse log line:", e);
      }
    });

    // 为流式响应添加完整的响应日志条目
    reqMap.forEach((reqObj) => {
      if (reqObj.fullResponse && !reqObj.logs.some(log => log.type === 'full_response')) {
        const lastLogTime = reqObj.logs.length > 0
          ? Math.max(...reqObj.logs.map(log => log.time))
          : reqObj.startTime;

        const responseLog: LogEntry = {
          time: lastLogTime + 1,
          level: 30,
          msg: "Full Response (Stream)",
          type: "full_response",
          data: { content: reqObj.fullResponse, model: reqObj.model },
          reqId: reqObj.id,
        };
        reqObj.logs.push(responseLog);
      }

      // 对每个请求的日志按时间排序
      reqObj.logs.sort((a, b) => a.time - b.time);
    });

    // 排序并按条件过滤
    const newRequests = Array.from(reqMap.values())
      .sort((a, b) => b.startTime - a.startTime)
      .filter(
        (f) =>
          f.url.includes("/v1/messages") &&
          !f.url.includes("/v1/messages/count_tokens")
      );

    if (append) {
      // 追加模式：合并新请求到现有列表，去重
      const existingIds = new Set(requests.value.map((r) => r.id));
      const uniqueNewRequests = newRequests.filter((r) => !existingIds.has(r.id));
      requests.value = [...requests.value, ...uniqueNewRequests].sort(
        (a, b) => b.startTime - a.startTime
      );
    } else {
      // 替换模式
      requests.value = newRequests;

      // 自动选择第一个
      if (requests.value.length > 0 && !selectedRequestId.value) {
        const firstRequest = requests.value[0];
        if (firstRequest) {
          selectedRequestId.value = firstRequest.id;
        }
      }
    }
  }

  /** 选择日志文件 */
  async function selectLogFile(file: LogFile) {
    selectedLogFile.value = file.path;
    selectedLogFileObj.value = file;
    await loadLogContent(file.path);
  }

  /** 刷新日志文件 */
  async function refreshLogFile() {
    if (!selectedLogFile.value || !selectedLogFileObj.value) return;

    isRefreshing.value = true;
    try {
      await loadLogFiles();
      const updatedFile = logFiles.value.find(
        (f) => f.path === selectedLogFile.value
      );
      if (updatedFile) {
        selectedLogFileObj.value = updatedFile;
      }
      await loadLogContent(selectedLogFile.value);
    } finally {
      isRefreshing.value = false;
    }
  }

  /** 清空当前选中的日志文件内容 */
  async function clearCurrentLogFile() {
    if (!selectedLogFile.value || !selectedLogFileObj.value) return;
    try {
      await apiClearLogs(selectedLogFile.value);
      // 清空本地状态并重新加载（此时应为空）
      await loadLogContent(selectedLogFile.value);
      // 可选：刷新文件列表以更新大小/修改时间
      await loadLogFiles();
    } catch (error) {
      console.error("Error clearing log content:", error);
    }
  }

  /** 处理文件上传 */
  function handleFileUpload(file: File) {
    selectedLogFile.value = "";
    selectedLogFileObj.value = null;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        processLogs(content);
      }
    };
    reader.readAsText(file);
  }

  /** 过滤后的请求列表 */
  const filteredRequests = computed(() => {
    return requests.value.filter((req) => {
      if (
        filterType.value === "success" &&
        (req.hasError || (req.status !== null && req.status >= 400))
      ) {
        return false;
      }
      if (filterType.value === "failed") {
        const isFailed =
          req.hasError || (req.status !== null && req.status >= 400);
        if (!isFailed) return false;
      }

      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        const searchBlob = (
          req.searchText ||
          `${req.id} ${req.url} ${req.model || ""} ${req.fullResponse || ""}`
        ).toLowerCase();
        return (
          searchBlob.includes(q) ||
          (req.error &&
            JSON.stringify(req.error).toLowerCase().includes(q))
        );
      }
      return true;
    });
  });

  /** 选中的请求 */
  const selectedRequest = computed(() => {
    const found = requests.value.find((r) => r.id === selectedRequestId.value);
    return found ?? null;
  });

  return {
    logFiles,
    selectedLogFile,
    selectedLogFileObj,
    requests,
    selectedRequestId,
    selectedRequest,
    filteredRequests,
    searchQuery,
    filterType,
    isRefreshing,
    isLoadingMore,
    hasMore,
    loadLogFiles,
    selectLogFile,
    refreshLogFile,
    loadMoreLogs,
    handleFileUpload,
    clearCurrentLogFile,
  };
}

