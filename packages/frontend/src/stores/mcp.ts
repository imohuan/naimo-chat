import { defineStore } from "pinia";
import { ref } from "vue";
import type { McpServer, McpServerConfig, McpTool } from "@/interface";
import { useMcpApi } from "@/hooks/useMcpApi";
import { useLlmApi } from "@/hooks/useLlmApi";
import { useToasts } from "@/hooks/useToasts";

export const useMcpStore = defineStore("mcp", () => {
  const { pushToast } = useToasts();
  const {
    fetchServers,
    // fetchTools, // 旧版 SSE API，已改用直接 API 调用
    updateServer,
    deleteServer,
  } = useMcpApi();
  const {
    fetchConfig,
    fetchMcpServerTools,
    refreshMcpServerTools,
  } = useLlmApi();

  const servers = ref<McpServer[]>([]);
  const isLoading = ref(false);

  // 每个服务器的工具列表和加载状态
  const serverTools = ref<Record<string, McpTool[]>>({});
  const serverToolsLoading = ref<Record<string, boolean>>({});
  const serverToggleLoading = ref<Record<string, boolean>>({});

  // MCP Router API Key 状态
  const hasApiKey = ref(false);
  const mcpRouterApiKey = ref<string>("");

  // 检查 API Key 配置
  async function checkApiKey() {
    try {
      const config = await fetchConfig();
      const apiKey = (config as any).MCPRouterApiKey || "";
      hasApiKey.value = !!(apiKey && apiKey.trim());
      mcpRouterApiKey.value = apiKey || "";
    } catch (err) {
      console.error("检查 API Key 配置失败:", err);
      hasApiKey.value = false;
      mcpRouterApiKey.value = "";
    }
  }

  // 加载服务器列表
  async function loadServers() {
    try {
      isLoading.value = true;
      const serversData = await fetchServers();
      servers.value = Object.entries(serversData).map(([name, config]) => ({
        name,
        config: config as McpServerConfig,
      }));

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

      // 使用新的直接 API 调用（不通过 SSE）
      const tools = await fetchMcpServerTools(serverName);

      // 然后设置新数据
      serverTools.value[serverName] = tools;

      // 旧版 SSE API 调用（已注释）
      // const server = servers.value.find((s) => s.name === serverName);
      // const tools = await fetchTools(serverName, server?.config);
      // await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`加载工具列表失败 (${serverName}):`, err);
      serverTools.value[serverName] = [];
      pushToast(
        `加载工具列表失败 (${serverName}): ${(err as Error).message}`,
        "error"
      );
    } finally {
      serverToolsLoading.value[serverName] = false;
    }
  }

  // 刷新所有服务器的工具列表
  async function refreshAllTools() {
    try {
      for (const server of servers.value) {
        if (server.config.enabled !== false) {
          try {
            serverToolsLoading.value[server.name] = true;
            // 使用新的刷新 API（直接调用后端刷新接口）
            const tools = await refreshMcpServerTools(server.name);
            serverTools.value[server.name] = tools;
          } catch (err) {
            console.error(`刷新工具列表失败 (${server.name}):`, err);
            // 如果刷新失败，尝试使用普通获取
            await loadToolsForServer(server.name);
          } finally {
            serverToolsLoading.value[server.name] = false;
          }
        }
      }
      pushToast("已刷新所有工具列表", "success");
    } catch (err) {
      pushToast(`刷新工具列表失败: ${(err as Error).message}`, "error");
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
      const latestConfig = (result as any).config || requestConfig;

      // 与后端返回的最新配置保持一致
      const serverIndex = servers.value.findIndex(
        (s) => s.name === server.name
      );
      if (serverIndex !== -1 && servers.value[serverIndex]) {
        servers.value[serverIndex].config = latestConfig;
      }

      if ((result as any).success) {
        if (latestConfig.enabled !== false) {
          await loadToolsForServer(server.name);
        } else {
          delete serverTools.value[server.name];
        }
        pushToast(
          `服务器已${latestConfig.enabled !== false ? "启用" : "禁用"}`,
          "success"
        );
      } else {
        // 启用失败，保持 UI 为禁用状态
        delete serverTools.value[server.name];
        pushToast(`启用失败: ${(result as any).error || "连接失败"}`, "error");
      }
    } catch (err) {
      pushToast(`操作失败: ${(err as Error).message}`, "error");
    } finally {
      serverToggleLoading.value[server.name] = false;
    }
  }

  // 删除服务器
  async function handleDeleteServer(server: McpServer) {
    try {
      await deleteServer(server.name);

      // 从列表中移除
      const index = servers.value.findIndex((s) => s.name === server.name);
      if (index !== -1) {
        servers.value.splice(index, 1);
      }

      // 清空相关工具数据
      delete serverTools.value[server.name];
      delete serverToolsLoading.value[server.name];

      pushToast("服务器已删除", "success");
    } catch (err) {
      pushToast(`删除失败: ${(err as Error).message}`, "error");
    }
  }

  return {
    // state
    servers,
    isLoading,
    serverTools,
    serverToolsLoading,
    serverToggleLoading,
    hasApiKey,
    mcpRouterApiKey,

    // actions
    checkApiKey,
    loadServers,
    loadToolsForServer,
    refreshAllTools,
    handleToggleServer,
    handleDeleteServer,
  };
});


