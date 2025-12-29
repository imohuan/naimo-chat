import { ref } from "vue";
import type { LogFile } from "./types";
import { useLlmApi } from "@/hooks/useLlmApi";

export function useLogger() {
  const {
    fetchLogFiles: apiFetchLogFiles,
    clearLogs: apiClearLogs,
  } = useLlmApi();
  const logFiles = ref<LogFile[]>([]);
  const selectedLogFile = ref<string>("");
  const selectedLogFileObj = ref<LogFile | null>(null);
  const isRefreshing = ref(false);

  // 简化后的状态，不再需要复杂的日志处理逻辑

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

  // 已删除旧的日志处理逻辑（processLogs, loadLogContent, loadMoreLogs 等）
  // 普通日志现在直接使用编辑器显示，不再需要解析和组装

  /** 选择日志文件 */
  async function selectLogFile(file: LogFile) {
    selectedLogFile.value = file.path;
    selectedLogFileObj.value = file;
    // 不再需要调用 loadLogContent，由父组件处理
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
    } finally {
      isRefreshing.value = false;
    }
  }

  /** 清空当前选中的日志文件内容 */
  async function clearCurrentLogFile() {
    if (!selectedLogFile.value || !selectedLogFileObj.value) return;
    try {
      await apiClearLogs(selectedLogFile.value);
      // 刷新文件列表以更新大小/修改时间
      await loadLogFiles();
      // 更新选中的文件对象，确保 watch 能触发
      const updatedFile = logFiles.value.find(
        (f) => f.path === selectedLogFile.value
      );
      if (updatedFile) {
        selectedLogFileObj.value = updatedFile;
      }
    } catch (error) {
      console.error("Error clearing log content:", error);
    }
  }

  return {
    logFiles,
    selectedLogFile,
    selectedLogFileObj,
    isRefreshing,
    loadLogFiles,
    selectLogFile,
    refreshLogFile,
    clearCurrentLogFile,
  };
}

