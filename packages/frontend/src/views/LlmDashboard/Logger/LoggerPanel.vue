<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import LoggerFileSelector from "./components/LoggerFileSelector.vue";
import LoggerRequestList from "./components/LoggerRequestList.vue";
import LoggerRequestDetail from "./components/LoggerRequestDetail.vue";
import { useLogger } from "./useLogger";

const props = defineProps<{
  currentTab: "chat" | "providers" | "logger" | "statusline" | "mcp";
}>();

const {
  logFiles,
  selectedLogFileObj,
  requests,
  selectedRequestId,
  selectedRequest,
  searchQuery,
  filterType,
  isRefreshing,
  isLoadingMore,
  hasMore,
  loadLogFiles,
  selectLogFile,
  refreshLogFile,
  loadMoreLogs,
  clearCurrentLogFile,
} = useLogger();

function handleClickOutside(e: MouseEvent) {
  const dropdown = (e.target as Element).closest("[data-log-dropdown]");
  if (!dropdown) {
    // 可以在这里处理关闭下拉菜单的逻辑
  }
}

onMounted(async () => {
  await loadLogFiles(true);
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="h-full flex flex-col bg-slate-50 overflow-hidden">
    <!-- 日志文件选择器（通过 Teleport 传送到顶部导航栏） -->
    <LoggerFileSelector
      :log-files="logFiles"
      :selected-log-file-obj="selectedLogFileObj"
      :is-refreshing="isRefreshing"
      :current-tab="currentTab"
      @select-file="selectLogFile"
      @refresh="refreshLogFile"
      @clear-log="clearCurrentLogFile"
    />
    <!-- 主内容区域 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧：请求列表 -->
      <div class="w-80 shrink-0">
        <LoggerRequestList
          :requests="requests"
          :selected-request-id="selectedRequestId"
          :search-query="searchQuery"
          :filter-type="filterType"
          :is-loading-more="isLoadingMore"
          :has-more="hasMore"
          @update:selected-request-id="(id) => (selectedRequestId = id)"
          @update:filter-type="(type) => (filterType = type)"
          @update:search-query="(query) => (searchQuery = query)"
          @load-more="loadMoreLogs"
        />
      </div>

      <!-- 右侧：请求详情 -->
      <div class="flex-1 min-w-0 w-full h-full flex items-center justify-center">
        <LoggerRequestDetail :request="selectedRequest" />
      </div>
    </div>
  </div>
</template>
