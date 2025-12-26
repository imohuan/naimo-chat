<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { McpServer, McpServerConfig, McpTool } from "@/interface";
import { useMcpApi } from "@/hooks/useMcpApi";
import { useToasts } from "@/hooks/useToasts";
import { useLlmApi } from "@/hooks/useLlmApi";
import {
  AddOutlined,
  SearchOutlined,
  RefreshOutlined,
  DnsOutlined,
  WarningOutlined,
  OpenInNewOutlined,
  SettingsOutlined,
  EditOutlined,
} from "@vicons/material";
import MCPItem from "./components/MCPItem.vue";
import ToolModal from "./components/ToolModal.vue";
import ServerModal from "./components/ServerModal.vue";
import ApiKeyModal from "./components/ApiKeyModal.vue";
import ConfigEditorModal from "./components/ConfigEditorModal.vue";
import cloudMcpServers from "./cloud_mcp_servers.json";

const { pushToast } = useToasts();
const {
  fetchServers,
  createServer,
  updateServer,
  deleteServer,
  fetchTools,
  callTool,
} = useMcpApi();

const servers = ref<McpServer[]>([]);
const filteredServers = ref<McpServer[]>([]);
const searchQuery = ref("");
const isLoading = ref(false);
const isSavingServer = ref(false);
const currentTab = ref<"servers" | "empty">("servers");

type CloudMcpServer = {
  name: string;
  description: string;
  value: string;
  realName: string;
};
const cloudServers = ref<CloudMcpServer[]>(cloudMcpServers as CloudMcpServer[]);

// 每个服务器的工具列表和加载状态
const serverTools = ref<Record<string, McpTool[]>>({});
const serverToolsLoading = ref<Record<string, boolean>>({});
const serverToggleLoading = ref<Record<string, boolean>>({});

// 服务器编辑/新建模态框
const showServerModal = ref(false);
const editingServer = ref<McpServer | null>(null);
const serverModalDefaultName = ref("");
const serverModalDefaultConfig = ref<McpServerConfig | null>(null);

// 工具模态框
const showToolModal = ref(false);
const selectedTool = ref<McpTool | null>(null);
const selectedServerName = ref("");
const toolExecutionResult = ref<any>(null);
const toolExecutionError = ref<string | null>(null);
const isExecutingTool = ref(false);

// API Key 设置模态框
const showApiKeyModal = ref(false);
const hasApiKey = ref(false);
const mcpRouterApiKey = ref<string>("");
const { fetchConfig } = useLlmApi();

// 全屏配置编辑器
const showConfigEditor = ref(false);
const isSavingConfig = ref(false);

// 检查 API Key 配置
async function checkApiKey() {
  try {
    const config = await fetchConfig();
    const apiKey = config.MCPRouterApiKey || "";
    hasApiKey.value = !!(apiKey && apiKey.trim());
    mcpRouterApiKey.value = apiKey || "";
  } catch (err) {
    console.error("检查 API Key 配置失败:", err);
    hasApiKey.value = false;
    mcpRouterApiKey.value = "";
  }
}

// 搜索过滤
const filteredServersComputed = computed(() => {
  if (!searchQuery.value.trim()) {
    return filteredServers.value;
  }
  const query = searchQuery.value.toLowerCase();
  return filteredServers.value.filter(
    (server) =>
      server.name.toLowerCase().includes(query) ||
      (server.config.command || "").toLowerCase().includes(query) ||
      (server.config.url || "").toLowerCase().includes(query)
  );
});

// 加载服务器列表
async function loadServers() {
  try {
    isLoading.value = true;
    const serversData = await fetchServers();
    servers.value = Object.entries(serversData).map(([name, config]) => ({
      name,
      config,
    }));
    filteredServers.value = [...servers.value];

    // 自动为已启用的服务器加载工具列表
    for (const server of servers.value) {
      if (server.config.enabled !== false) {
        await loadToolsForServer(server.name);
      }
    }
  } catch (err) {
    pushToast(`加载服务器列表失败: ${(err as Error).message}`, "error");
  } finally {
    isLoading.value = false;
  }
}

// 为特定服务器加载工具列表
async function loadToolsForServer(serverName: string) {
  try {
    serverToolsLoading.value[serverName] = true;
    // 先清空工具列表
    serverTools.value[serverName] = [];
    const server = servers.value.find((s) => s.name === serverName);
    const tools = await fetchTools(serverName, server?.config);
    await new Promise((resolve) => setTimeout(resolve, 100));
    // 然后设置新数据
    serverTools.value[serverName] = tools;
  } catch (err) {
    console.error(`加载工具列表失败 (${serverName}):`, err);
    serverTools.value[serverName] = [];
    pushToast(`加载工具列表失败 (${serverName}): ${(err as Error).message}`, "error");
  } finally {
    serverToolsLoading.value[serverName] = false;
  }
}

// 刷新所有服务器的工具列表
async function refreshAllTools() {
  for (const server of servers.value) {
    if (server.config.enabled !== false) {
      await loadToolsForServer(server.name);
    }
  }
  pushToast("已刷新所有工具列表", "success");
}

// 打开新建服务器模态框
function openCreateServerModal() {
  editingServer.value = null;
  serverModalDefaultName.value = "";
  serverModalDefaultConfig.value = null;
  showServerModal.value = true;
}

// 打开编辑服务器模态框
function openEditServerModal(server: McpServer) {
  editingServer.value = server;
  serverModalDefaultName.value = "";
  serverModalDefaultConfig.value = null;
  showServerModal.value = true;
}

// 从云端模板添加服务器
function openCloudServerModal(server: CloudMcpServer) {
  const realName = server.realName || server.value.split("/").pop() || server.value;
  editingServer.value = null;
  serverModalDefaultName.value = realName;
  // 如果已配置 API Key，使用配置的值，否则使用占位符
  const apiKey = mcpRouterApiKey.value || "<请填写 API Key>";
  serverModalDefaultConfig.value = {
    url: `https://mcprouter.to/${realName}`,
    type: "sse",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://www.cursor.com/",
      "X-Title": "Cursor",
    },
  };
  showServerModal.value = true;
}

// 保存服务器（新建或更新）
async function handleSaveServer(name: string, config: McpServerConfig) {
  isSavingServer.value = true;
  try {
    if (editingServer.value) {
      // 更新服务器
      const serverToEdit = editingServer.value;
      await updateServer(serverToEdit.name, config);

      // 更新本地状态
      const index = servers.value.findIndex((s) => s.name === serverToEdit.name);
      if (index !== -1 && servers.value[index]) {
        servers.value[index].config = config;
        filteredServers.value = [...servers.value];
      }

      pushToast("服务器已更新", "success");
    } else {
      // 新建服务器
      await createServer(name, config);
      pushToast("服务器已创建", "success");
      // 重新加载服务器列表
      await loadServers();
    }

    showServerModal.value = false;
    editingServer.value = null;
  } catch (err) {
    pushToast(`保存失败: ${(err as Error).message}`, "error");
    await reloadServersAndOpenEdit(name);
  } finally {
    isSavingServer.value = false;
  }
}

// 失败时刷新列表并进入编辑模式，使用最新配置
async function reloadServersAndOpenEdit(serverName: string) {
  try {
    const serversData = await fetchServers();
    servers.value = Object.entries(serversData).map(([name, cfg]) => ({
      name,
      config: cfg,
    }));
    filteredServers.value = [...servers.value];

    const target = servers.value.find((s) => s.name === serverName);
    if (target) {
      editingServer.value = target;
      showServerModal.value = true;
    }
  } catch (error) {
    console.error("刷新服务器列表失败:", error);
  }
}

// 切换服务器启用状态
async function handleToggleServer(server: McpServer) {
  serverToggleLoading.value[server.name] = true;
  try {
    const originalConfig = server.config;
    const requestConfig: McpServerConfig = {
      ...originalConfig,
      enabled: originalConfig.enabled === false ? true : false,
    };

    const result = await updateServer(server.name, requestConfig);
    const latestConfig = result.config || requestConfig;

    // 与后端返回的最新配置保持一致
    const serverIndex = servers.value.findIndex((s) => s.name === server.name);
    if (serverIndex !== -1 && servers.value[serverIndex]) {
      servers.value[serverIndex].config = latestConfig;
      filteredServers.value = [...servers.value];
    }

    if (result.success) {
      if (latestConfig.enabled !== false) {
        await loadToolsForServer(server.name);
      } else {
        delete serverTools.value[server.name];
      }
      pushToast(`服务器已${latestConfig.enabled !== false ? "启用" : "禁用"}`, "success");
    } else {
      // 启用失败，保持 UI 为禁用状态
      delete serverTools.value[server.name];
      pushToast(`启用失败: ${result.error || "连接失败"}`, "error");
    }
  } catch (err) {
    pushToast(`操作失败: ${(err as Error).message}`, "error");
  } finally {
    serverToggleLoading.value[server.name] = false;
  }
}

// 删除服务器
async function handleDeleteServer(server: McpServer) {
  if (!confirm(`确认删除服务器 "${server.name}"?`)) {
    return;
  }

  try {
    await deleteServer(server.name);

    // 从列表中移除
    const index = servers.value.findIndex((s) => s.name === server.name);
    if (index !== -1) {
      servers.value.splice(index, 1);
      filteredServers.value = [...servers.value];
    }

    // 清空相关工具数据
    delete serverTools.value[server.name];
    delete serverToolsLoading.value[server.name];

    pushToast("服务器已删除", "success");
  } catch (err) {
    pushToast(`删除失败: ${(err as Error).message}`, "error");
  }
}

// 点击工具
function handleToolClick(tool: McpTool, serverName: string) {
  selectedTool.value = tool;
  selectedServerName.value = serverName;
  showToolModal.value = true;
  toolExecutionResult.value = null;
  toolExecutionError.value = null;
}

// 执行工具
async function handleExecuteTool(tool: McpTool, args: Record<string, any>) {
  try {
    isExecutingTool.value = true;
    toolExecutionError.value = null;
    toolExecutionResult.value = null;

    const server = servers.value.find((s) => s.name === selectedServerName.value);
    const result = await callTool(
      selectedServerName.value,
      tool.name,
      args,
      server?.config
    );
    toolExecutionResult.value = result;
    pushToast("工具执行成功", "success");
  } catch (err) {
    toolExecutionError.value = (err as Error).message;
    pushToast(`工具执行失败: ${(err as Error).message}`, "error");
  } finally {
    isExecutingTool.value = false;
  }
}

function openApiKeySettings() {
  window.open("https://mcprouter.co/settings/keys", "_blank");
}

function openApiKeyModal() {
  showApiKeyModal.value = true;
}

async function handleApiKeySaved() {
  pushToast("API 密钥已保存", "success");
  await checkApiKey();
}

// 打开配置编辑器
function openConfigEditor() {
  showConfigEditor.value = true;
}

// 配置保存开始（由模态框触发，模态框会立即关闭）
function handleConfigSaving() {
  isSavingConfig.value = true;
}

// 配置保存后处理
async function handleConfigSaved() {
  try {
    // 重新加载服务器列表
    await loadServers();
    pushToast("配置已保存并重载", "success");
  } catch (err) {
    pushToast(`配置保存失败: ${(err as Error).message}`, "error");
  } finally {
    isSavingConfig.value = false;
  }
}

onMounted(() => {
  loadServers();
  checkApiKey();
});
</script>

<template>
  <div class="max-w-7xl mx-auto h-full overflow-hidden flex flex-col">
    <!-- Header -->
    <div
      class="flex justify-between items-center p-6 pb-4 border-b border-slate-200 shrink-0"
    >
      <div class="flex items-center gap-4 flex-1">
        <!-- Tab 切换 -->
        <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2"
            :class="
              currentTab === 'servers'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="currentTab = 'servers'"
          >
            <DnsOutlined class="w-4 h-4" />
            服务器
          </button>
          <button
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            :class="
              currentTab === 'empty'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="currentTab = 'empty'"
          >
            <span class="font-mono">MCPRouter</span>
          </button>
        </div>

        <!-- 搜索框 -->
        <div v-if="currentTab === 'servers'" class="flex-1 max-w-md relative">
          <SearchOutlined
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
          />
          <input
            v-model="searchQuery"
            type="text"
            class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            placeholder="搜索服务器..."
          />
        </div>
      </div>

      <div v-if="currentTab === 'servers'" class="flex items-center gap-3">
        <button
          class="btn-secondary shadow-sm"
          :disabled="isLoading"
          @click="refreshAllTools"
        >
          <RefreshOutlined class="w-4 h-4" />
          刷新工具
        </button>
        <button
          class="btn-secondary shadow-sm"
          @click="openConfigEditor"
          title="编辑整个 MCP 配置"
        >
          <EditOutlined class="w-4 h-4" />
          编辑配置
        </button>
        <button
          class="btn-primary shadow-lg shadow-indigo-500/20"
          @click="openCreateServerModal"
        >
          <AddOutlined class="w-4 h-4" />
          新增服务器
        </button>
      </div>

      <div v-else class="flex items-center gap-3">
        <div
          v-if="!hasApiKey"
          class="flex items-center gap-3 px-4 py-1 bg-yellow-50 border border-yellow-200 rounded-lg"
          style="min-height: 40px"
        >
          <WarningOutlined class="w-4 h-4 text-yellow-600 shrink-0" />
          <div class="flex items-center gap-3">
            <div>
              <div class="text-sm font-semibold text-slate-900 leading-tight">
                API 密钥未配置
              </div>
            </div>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors ml-2 shrink-0"
              @click="openApiKeySettings"
            >
              <OpenInNewOutlined class="w-3.5 h-3.5" />
              获取 API 密钥
            </button>
          </div>
        </div>
        <button
          class="btn-secondary shadow-sm flex items-center gap-1.5"
          @click="openApiKeyModal"
        >
          <SettingsOutlined class="w-4 h-4" />
          在设置中配置
        </button>
      </div>
    </div>

    <!-- Content -->
    <div v-if="currentTab === 'servers'" class="flex-1 overflow-y-auto p-6">
      <!-- Loading State -->
      <div
        v-if="isLoading && servers.length === 0"
        class="flex items-center justify-center py-16"
      >
        <div
          class="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
        ></div>
        <span class="ml-4 text-slate-600">加载中...</span>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredServersComputed.length === 0"
        class="py-16 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"
      >
        <DnsOutlined class="w-12 h-12 mb-4 text-slate-300" />
        <p class="font-medium">
          {{ searchQuery ? "未找到匹配的服务器" : "暂无 MCP 服务器" }}
        </p>
        <button
          v-if="!searchQuery"
          class="mt-4 text-indigo-600 hover:underline text-sm"
          @click="loadServers"
        >
          点击添加第一个
        </button>
      </div>

      <!-- Servers Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MCPItem
          v-for="server in filteredServersComputed"
          :key="server.name"
          :server="server"
          :tools="serverTools[server.name] || []"
          :is-loading-tools="serverToolsLoading[server.name] || false"
          :is-toggling="serverToggleLoading[server.name] || false"
          :is-saving-config="isSavingConfig"
          @delete="handleDeleteServer"
          @toggle="handleToggleServer"
          @edit="openEditServerModal"
          @tool-click="(tool) => handleToolClick(tool, server.name)"
          @refresh="(server) => loadToolsForServer(server.name)"
        />
      </div>
    </div>

    <!-- Cloud MCP 列表 -->
    <div v-else class="flex-1 overflow-y-auto p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="cloud in cloudServers"
          :key="cloud.value"
          class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full group"
        >
          <div class="flex items-start justify-between gap-2 mb-3">
            <h3 class="font-bold text-slate-800 text-sm truncate">
              {{ cloud.name }}
            </h3>
            <button
              class="btn-icon text-slate-400 hover:text-indigo-600"
              title="添加到服务器"
              @click="openCloudServerModal(cloud)"
            >
              <AddOutlined class="w-4 h-4" />
            </button>
          </div>
          <p class="text-sm text-slate-600 leading-6 line-clamp-3 flex-1">
            {{ cloud.description }}
          </p>
          <div class="mt-3 pt-3 border-t border-slate-100">
            <span
              class="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-mono"
            >
              {{ cloud.realName }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Server Modal -->
    <ServerModal
      :show="showServerModal"
      :server="editingServer"
      :default-name="serverModalDefaultName"
      :default-config="serverModalDefaultConfig"
      :is-saving="isSavingServer"
      @update:show="showServerModal = $event"
      @save="handleSaveServer"
    />

    <!-- Tool Modal -->
    <ToolModal
      v-if="selectedTool"
      :show="showToolModal"
      :tool="selectedTool"
      :server-name="selectedServerName"
      :execution-result="toolExecutionResult"
      :execution-error="toolExecutionError"
      :is-executing="isExecutingTool"
      @update:show="showToolModal = $event"
      @execute="handleExecuteTool"
    />

    <!-- API Key Modal -->
    <ApiKeyModal
      :show="showApiKeyModal"
      @update:show="showApiKeyModal = $event"
      @saved="handleApiKeySaved"
    />

    <!-- Config Editor Modal -->
    <ConfigEditorModal
      :show="showConfigEditor"
      @update:show="showConfigEditor = $event"
      @saving="handleConfigSaving"
      @saved="handleConfigSaved"
    />
  </div>
</template>
