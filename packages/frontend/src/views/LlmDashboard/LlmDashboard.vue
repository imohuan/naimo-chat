<script setup lang="ts">
import { computed, onMounted, watch, provide } from "vue";
import { useRouter, useRoute, RouterView } from "vue-router";
import { useEventListener } from "@vueuse/core";
import {
  StorageOutlined,
  SettingsOutlined,
  ForumOutlined,
  DnsOutlined,
  DescriptionOutlined,
  AutorenewOutlined,
  DashboardOutlined,
  ExtensionOutlined,
  CodeOutlined,
} from "@vicons/material";
import { useToasts } from "@/hooks/useToasts";
import { useLlmDashboardStore } from "@/stores/llmDashboard";
import ClaudeIcon from "@/components/svg/claude.vue";
import SettingsModal from "./Modal/SettingsModal.vue";
import JSONEditorModal from "./Modal/JSONEditorModal.vue";
import ProviderEditorModal from "./Modal/ProviderEditorModal.vue";
import ClaudeSettingsModal from "./Modal/ClaudeSettingsModal.vue";

const router = useRouter();
const route = useRoute();
const { pushToast } = useToasts();
const store = useLlmDashboardStore();

// 当前 tab，根据路由名称计算
const currentTab = computed(() => {
  const name = route.name as string;
  if (name === "Chat") return "chat";
  if (name === "Providers") return "providers";
  if (name === "Logger") return "logger";
  if (name === "StatusLine") return "statusline";
  if (name === "MCP") return "mcp";
  return "chat";
});

// Tab 路由映射
const tabRoutes: Record<string, string> = {
  chat: "/chat",
  providers: "/providers",
  logger: "/logger",
  statusline: "/statusline",
  mcp: "/mcp",
};

// 导航到指定 tab
function navigateToTab(tab: string) {
  const path = tabRoutes[tab];
  if (path) {
    router.push(path);
  }
}

// 打开编辑器
async function openEditor(provider?: any, tab: "form" | "json" = "form") {
  store.openEditor(provider, tab);
}

// 关闭编辑器
function closeEditor() {
  store.closeEditor();
}

// 保存 Provider
async function handleSaveProvider() {
  try {
    const payload = store.providerFromForm();
    if (!payload.name || !payload.baseUrl || (payload.models || []).length === 0) {
      pushToast("请完善 Provider 信息", "error");
      return;
    }
    await store.saveProvider(payload, store.isEditing);
    pushToast("保存成功", "success");
    store.closeEditor();
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

// 切换 Provider
async function handleToggleProvider(p: any) {
  try {
    const target = await store.toggleProvider(p);
    pushToast(`Provider 已${target ? "启用" : "禁用"}`, "info");
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

// 删除 Provider
async function handleDeleteProvider(p: any) {
  try {
    await store.deleteProvider(p.name);
    pushToast("删除成功", "success");
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

// 重新排序 Providers
async function handleReorderProviders(list: any[]) {
  try {
    await store.reorderProviders(list);
    pushToast("排序已保存", "success");
  } catch (err) {
    pushToast(`保存排序失败: ${(err as Error).message}`, "error");
  }
}

// 打开 Providers JSON 编辑器
async function openProvidersJsonEditor() {
  try {
    const config = await store.fetchConfig();
    const providersData = config.Providers || config.providers || [];
    store.providersJson = JSON.stringify(providersData, null, 2);
    store.providersJsonError = "";
    store.showProvidersJsonModal = true;
  } catch (err) {
    pushToast(`获取配置失败: ${(err as Error).message}`, "error");
  }
}

// 关闭 Providers JSON 编辑器
function closeProvidersJsonEditor() {
  store.showProvidersJsonModal = false;
  store.isSavingProvidersJson = false;
}

// 打开配置 JSON 编辑器
async function openConfigJsonEditor() {
  try {
    const config = await store.fetchConfig();
    store.configJson = JSON.stringify(config, null, 2);
    store.configJsonError = "";
    store.showConfigJsonModal = true;
  } catch (err) {
    pushToast(`获取配置失败: ${(err as Error).message}`, "error");
  }
}

// 关闭配置 JSON 编辑器
function closeConfigJsonEditor() {
  store.showConfigJsonModal = false;
  store.isSavingConfigJson = false;
}

// 保存 Providers JSON
async function handleSaveProvidersJson() {
  let providersData: any[];
  try {
    const parsed = JSON.parse(store.providersJson || "[]");
    if (!Array.isArray(parsed)) {
      store.providersJsonError = "JSON 须为有效的数组";
      return;
    }
    providersData = parsed;
  } catch (err) {
    store.providersJsonError = `JSON 解析失败: ${(err as Error).message}`;
    return;
  }
  try {
    store.isSavingProvidersJson = true;
    const config = await store.fetchConfig();
    const updatedConfig = {
      ...config,
      Providers: providersData,
    };
    const result = await store.saveConfig(updatedConfig);
    store.providersJsonError = "";
    pushToast(result.message || "配置已保存，正在重启服务...", "success");
    store.showProvidersJsonModal = false;
    try {
      store.isRestarting = true;
      await store.restartService();
      pushToast("服务重启中...", "info");
    } catch (restartErr) {
      pushToast(`重启失败: ${(restartErr as Error).message}`, "error");
      store.isRestarting = false;
      store.isSavingProvidersJson = false;
    }
  } catch (err) {
    store.providersJsonError = (err as Error).message;
    store.isSavingProvidersJson = false;
  }
}

// 保存配置 JSON
async function handleSaveConfigJson() {
  let config: Record<string, any>;
  try {
    config = JSON.parse(store.configJson || "{}");
  } catch (err) {
    store.configJsonError = `JSON 解析失败: ${(err as Error).message}`;
    return;
  }
  if (!config || typeof config !== "object") {
    store.configJsonError = "JSON 须为有效的配置对象";
    return;
  }
  try {
    store.isSavingConfigJson = true;
    const result = await store.saveConfig(config);
    store.configJsonError = "";
    pushToast(result.message || "配置已保存，正在重启服务...", "success");
    store.showConfigJsonModal = false;
    try {
      store.isRestarting = true;
      await store.restartService();
      pushToast("服务重启中...", "info");
    } catch (restartErr) {
      pushToast(`重启失败: ${(restartErr as Error).message}`, "error");
      store.isRestarting = false;
      store.isSavingConfigJson = false;
    }
  } catch (err) {
    store.configJsonError = (err as Error).message;
    store.isSavingConfigJson = false;
  }
}

// 打开设置
function openSettings() {
  store.showSettingsModal = true;
  store.checkHealth();
}

// 打开 Claude 设置
function openClaudeSettings() {
  store.claudeBaseUrl = store.baseUrl;
  store.claudeApiKey = store.tempApiKey;
  store.showClaudeSettingsModal = true;
}

// 保存设置
async function saveSettings() {
  store.persistSettings();
  try {
    await store.loadProviders();
    pushToast("设置已保存", "success");
    store.showSettingsModal = false;
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

// 确认 Claude 设置
async function handleConfirmClaudeSettings() {
  store.showClaudeSettingsModal = false;
  try {
    await store.startClaudeCli({
      timeoutMs: store.claudeTimeoutMs,
      baseUrl: store.claudeBaseUrl,
      apiKey: store.claudeApiKey,
      claudePath: store.claudePath,
      workDir: store.claudeWorkDir,
      terminalType: store.claudeTerminalType,
    });

    pushToast(
      `已触发 Claude 启动：超时时间 ${store.claudeTimeoutMs} ms，基础 URL ${store.claudeBaseUrl}`,
      "success"
    );
  } catch (err) {
    pushToast(`启动 Claude 失败：${(err as Error).message}`, "error");
  }
}

// 重启服务
async function handleRestart() {
  try {
    store.isRestarting = true;
    await store.restartService();
    pushToast("服务重启中...", "info");
  } catch (err) {
    pushToast((err as Error).message, "error");
    store.isRestarting = false;
  }
}

// 监听 editForm 变化，更新 JSON 预览
watch(
  () => ({ ...store.editForm }),
  () => {
    if (store.editorTab === "json") {
      store.providersJson = JSON.stringify(store.providerFromForm(), null, 2);
    }
  },
  { deep: true }
);

// 监听路由变化，加载 providers
watch(
  () => route.name,
  (name) => {
    if (name === "Chat" || name === "Providers") {
      store.loadProviders().catch((err) => {
        pushToast((err as Error).message, "error");
      });
    }
  }
);

watch(
  () => store.showProvidersJsonModal,
  (val) => {
    if (!val) {
      store.isSavingProvidersJson = false;
    }
  }
);

watch(
  () => store.showConfigJsonModal,
  (val) => {
    if (!val) {
      store.isSavingConfigJson = false;
    }
  }
);

useEventListener(window, "keydown", (e) => {
  if (e.key !== "Escape") return;
  if (store.showEditor) store.closeEditor();
  if (store.showProvidersJsonModal) closeProvidersJsonEditor();
  if (store.showConfigJsonModal) closeConfigJsonEditor();
  if (store.showSettingsModal) store.showSettingsModal = false;
  if (store.showClaudeSettingsModal) store.showClaudeSettingsModal = false;
});

// 提供 store 给子组件使用
provide("llmDashboardStore", store);
provide("llmDashboardActions", {
  openEditor,
  handleToggleProvider,
  handleDeleteProvider,
  handleReorderProviders,
  openProvidersJsonEditor,
});

onMounted(() => {
  store.loadProviders().catch((err) => {
    pushToast((err as Error).message, "error");
  });
});
</script>

<template>
  <div
    class="w-full h-full bg-slate-50 text-slate-800 overflow-hidden flex flex-col relative"
  >
    <header
      class="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 shadow-sm z-20"
    >
      <div class="flex items-center gap-8">
        <div class="flex items-center gap-2 text-primary">
          <StorageOutlined class="w-6 h-6" />
          <span class="font-bold text-lg tracking-tight text-slate-800">LLM Server</span>
        </div>
        <nav class="flex items-center gap-1 bg-slate-100 p-1 rounded-lg scale-90">
          <button
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border border-transparent"
            :class="
              currentTab === 'chat'
                ? 'bg-white text-primary shadow-sm border border-primary/20'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="navigateToTab('chat')"
          >
            <ForumOutlined class="w-4 h-4" />
            对话
          </button>
          <button
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border border-transparent"
            :class="
              currentTab === 'mcp'
                ? 'bg-white text-primary shadow-sm border border-primary/20'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="navigateToTab('mcp')"
          >
            <ExtensionOutlined class="w-4 h-4" />
            MCP
          </button>
          <button
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border border-transparent"
            :class="
              currentTab === 'providers'
                ? 'bg-white text-primary shadow-sm border border-primary/20'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="navigateToTab('providers')"
          >
            <DnsOutlined class="w-4 h-4" />
            提供商
          </button>

          <button
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border border-transparent"
            :class="
              currentTab === 'statusline'
                ? 'bg-white text-primary shadow-sm border border-primary/20'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="navigateToTab('statusline')"
          >
            <DashboardOutlined class="w-4 h-4" />
            状态栏
          </button>

          <button
            class="px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 border border-transparent"
            :class="
              currentTab === 'logger'
                ? 'bg-white text-primary shadow-sm border border-primary/20'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="navigateToTab('logger')"
          >
            <DescriptionOutlined class="w-4 h-4" />
            日志
          </button>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <template v-if="currentTab !== 'logger'">
          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border transition-all bg-white text-slate-700 border-slate-200 hover:text-primary hover:border-primary/40"
            type="button"
            @click="openClaudeSettings"
          >
            <ClaudeIcon class="w-5 h-5 rounded-md overflow-hidden" />
            <span class="leading-1 font-mono">Claude CLI</span>
          </button>

          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            :class="
              store.isRestarting
                ? 'bg-primary text-white border-primary shadow-sm'
                : store.needsRestart
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-white text-slate-700 border-slate-200 hover:text-primary /40'
            "
            :disabled="store.isRestarting"
            @click="handleRestart"
          >
            <AutorenewOutlined
              class="w-4 h-4"
              :class="{ 'animate-spin': store.isRestarting }"
            />
            <span>{{ store.isRestarting ? "重启中..." : "重启服务" }}</span>
            <span
              v-if="store.needsRestart && !store.isRestarting"
              class="text-amber-700 text-xs bg-amber-100 px-1.5 py-0.5 rounded-full"
            >
              需重启
            </span>
          </button>

          <button
            class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border transition-all bg-white text-slate-700 border-slate-200 hover:text-primary hover:border-primary/40"
            type="button"
            @click="openConfigJsonEditor"
          >
            <CodeOutlined class="w-4 h-4" />
            <span>编辑配置</span>
          </button>
        </template>
        <div class="h-6 w-px bg-slate-200 mx-1"></div>
        <!-- 通用右侧 Teleport 目标 -->
        <div id="header-right-target" class="flex items-center gap-2"></div>
        <button class="btn-icon" title="设置" @click="openSettings">
          <SettingsOutlined class="w-5 h-5" />
        </button>
      </div>
    </header>

    <main class="flex-1 h-full overflow-hidden relative bg-slate-50">
      <RouterView v-slot="{ Component, route: routeInfo }">
        <KeepAlive>
          <component :is="Component" v-if="Component" :key="routeInfo.path" />
        </KeepAlive>
      </RouterView>
    </main>

    <div
      v-if="store.isRestarting"
      class="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50"
    >
      <div
        class="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"
      ></div>
      <div class="text-sm text-slate-700">服务重启中，请稍候...</div>
    </div>

    <SettingsModal
      v-model:show="store.showSettingsModal"
      v-model:base-url="store.baseUrl"
      v-model:temp-api-key="store.tempApiKey"
      v-model:translation-model="store.translationModel"
      v-model:auto-translate="store.autoTranslate"
      :health-status="store.healthStatus"
      :providers="store.providers"
      @save="saveSettings"
      @check="store.checkHealth"
    />

    <ClaudeSettingsModal
      v-model:show="store.showClaudeSettingsModal"
      v-model:timeout-ms="store.claudeTimeoutMs"
      v-model:base-url="store.claudeBaseUrl"
      v-model:api-key="store.claudeApiKey"
      v-model:claude-path="store.claudePath"
      v-model:work-dir="store.claudeWorkDir"
      v-model:terminal-type="store.claudeTerminalType"
      @confirm="handleConfirmClaudeSettings"
    />

    <JSONEditorModal
      v-model:show="store.showProvidersJsonModal"
      v-model:json-value="store.providersJson"
      :error="store.providersJsonError"
      :is-saving="store.isSavingProvidersJson"
      title="编辑 Providers JSON"
      description="编辑 Providers 配置数组，保存后将立即重启服务。"
      @save="handleSaveProvidersJson"
    />

    <JSONEditorModal
      v-model:show="store.showConfigJsonModal"
      v-model:json-value="store.configJson"
      :error="store.configJsonError"
      :is-saving="store.isSavingConfigJson"
      title="编辑配置 JSON"
      description="编辑完整的配置 JSON，保存后将立即重启服务。"
      @save="handleSaveConfigJson"
    />

    <ProviderEditorModal
      v-model:show="store.showEditor"
      v-model:editor-tab="store.editorTab"
      v-model:form="store.editForm"
      v-model:new-array-key="store.newArrayKey"
      v-model:json-preview="store.providersJson"
      :is-editing="store.isEditing"
      @addKey="store.addArrayKey"
      @removeKey="store.removeArrayKey"
      @save="handleSaveProvider"
      @close="closeEditor"
    />
  </div>
</template>

<style scoped></style>
