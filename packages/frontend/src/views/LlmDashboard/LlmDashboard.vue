<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
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
import { useLlmApi } from "@/hooks/useLlmApi";
import { useToasts } from "@/hooks/useToasts";
import type { ChatMessage, LlmProvider, TransformerConfig } from "@/interface";
import ChatPanel from "./Chat/ChatPanel.vue";
import ProvidersPanel from "./Providers/ProvidersPanel.vue";
import LoggerPanel from "./Logger/LoggerPanel.vue";
import StatusLinePanel from "./StatusLine/StatusLinePanel.vue";
import MCPPanel from "./MCP/MCPPanel.vue";
import ClaudeIcon from "@/components/svg/claude.vue";
import SettingsModal from "./Modal/SettingsModal.vue";
import JSONEditorModal from "./Modal/JSONEditorModal.vue";
import ProviderEditorModal from "./Modal/ProviderEditorModal.vue";
import ClaudeSettingsModal from "./Modal/ClaudeSettingsModal.vue";

const currentTab = ref<"chat" | "providers" | "logger" | "statusline" | "mcp">("chat");

const messages = ref<ChatMessage[]>(
  JSON.parse(localStorage.getItem("llm_chat_history") || "[]")
);

const chatInput = ref("");
const selectedModelKey = ref("");
const isChatLoading = ref(false);
const isRestarting = ref(false);

const providers = ref<LlmProvider[]>([]);
const showSettingsModal = ref(false);
const showClaudeSettingsModal = ref(false);
const showProvidersJsonModal = ref(false);
const providersJson = ref("");
const providersJsonError = ref("");
const isSavingProvidersJson = ref(false);

const showConfigJsonModal = ref(false);
const configJson = ref("");
const configJsonError = ref("");
const isSavingConfigJson = ref(false);

const claudeTimeoutMs = ref("300000");
const claudeBaseUrl = ref("http://127.0.0.1:3457/");
const claudeApiKey = ref("sk-imohuan");
const claudePath = ref("claude");
const claudeWorkDir = ref("G:\\ClaudeCode");

const showEditor = ref(false);
const isEditing = ref(false);
const editorTab = ref<"form" | "json">("form");
const editForm = ref({
  name: "",
  baseUrl: "",
  apiKey: "",
  apiKeys: [] as string[],
  models: [] as string[],
  limit: 0,
  transformer: undefined as TransformerConfig | undefined,
});
const newArrayKey = ref("");

const { pushToast } = useToasts();
const {
  baseUrl,
  tempApiKey,
  translationModel,
  autoTranslate,
  needsRestart,
  healthStatus,
  persistSettings,
  fetchProviders,
  toggleProvider,
  deleteProvider,
  saveProvider,
  restartService,
  checkHealth,
  fetchConfig,
  saveConfig,
  startClaudeCli,
} = useLlmApi();

function sortProvidersList(list: LlmProvider[]) {
  return [...list].sort((a, b) => {
    const aSort = typeof a.sort === "number" ? a.sort : Number.MAX_SAFE_INTEGER;
    const bSort = typeof b.sort === "number" ? b.sort : Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    return a.name.localeCompare(b.name);
  });
}

function collectKeys() {
  // 编辑时只操作 apiKeys，不操作 apiKey
  const keys: string[] = [];
  (editForm.value.apiKeys || []).forEach((k) => {
    if (k && k.trim()) keys.push(k.trim());
  });
  return Array.from(new Set(keys));
}

async function loadProviders() {
  try {
    providers.value = sortProvidersList(await fetchProviders());
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

function clearHistory() {
  messages.value = [];
  localStorage.removeItem("llm_chat_history");
}

function updateChatInput(value: string) {
  chatInput.value = value;
}

function updateSelectedModelKey(value: string) {
  selectedModelKey.value = value;
}

function providerFromForm(): LlmProvider {
  const models = Array.from(new Set(editForm.value.models || []));
  const mergedKeys = collectKeys();
  // apiKey 统一使用 "sk-imohuan" 作为占位符，必须有值
  const apiKey = "sk-imohuan";
  // apiKeys 从表单收集
  const apiKeys = mergedKeys;

  const result: LlmProvider = {
    name: editForm.value.name,
    baseUrl: editForm.value.baseUrl,
    apiKey,
    apiKeys,
    models,
    limit: editForm.value.limit || 0,
    enabled: true,
  };

  // 直接使用 transformer 配置
  if (editForm.value.transformer) {
    result.transformer = editForm.value.transformer;
  }

  return result;
}

function openEditor(provider?: LlmProvider, tab: "form" | "json" = "form") {
  showEditor.value = true;
  isEditing.value = !!provider;
  editorTab.value = tab;

  if (provider) {
    // 编辑时只操作 apiKeys，不操作 apiKey（apiKey 统一使用占位符）
    // 如果 apiKeys 有数据，只使用 apiKeys
    if (Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0) {
      editForm.value = {
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey: "", // 编辑时不显示 apiKey，只编辑 apiKeys
        apiKeys: provider.apiKeys.filter(Boolean),
        models: provider.models || [],
        limit: provider.limit || 0,
        transformer: provider.transformer,
      };
    } else {
      // 如果 apiKeys 为空，尝试从 apiKey 迁移（兼容旧数据）
      const merged = [];
      if (provider.apiKey && provider.apiKey !== "sk-imohuan") {
        merged.push(provider.apiKey);
      }
      editForm.value = {
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey: "", // 编辑时不显示 apiKey，只编辑 apiKeys
        apiKeys: merged.filter(Boolean),
        models: provider.models || [],
        limit: provider.limit || 0,
        transformer: provider.transformer,
      };
    }
  } else {
    editForm.value = {
      name: "",
      baseUrl: baseUrl.value,
      apiKey: "", // 编辑时不显示 apiKey，只编辑 apiKeys
      apiKeys: [],
      models: [],
      limit: 0,
      transformer: undefined,
    };
  }
  providersJson.value = JSON.stringify(providerFromForm(), null, 2);
}

function closeEditor() {
  showEditor.value = false;
}

async function handleReorderProviders(list: LlmProvider[]) {
  try {
    const withSort = list.map((p, idx) => ({ ...p, sort: idx }));
    providers.value = sortProvidersList(withSort);

    const config = await fetchConfig();
    const orderMap = new Map(withSort.map((p) => [p.name, p.sort]));
    const mergedProviders = (config.Providers || config.providers || []).map((p: any) => {
      const sort = orderMap.get(p.name);
      return typeof sort === "number" ? { ...p, sort } : p;
    });

    withSort.forEach((p) => {
      if (!mergedProviders.some((item: any) => item.name === p.name)) {
        mergedProviders.push({ ...p });
      }
    });

    const updatedConfig = { ...config, Providers: mergedProviders };
    await saveConfig(updatedConfig);
    // 拖拽排序无需重启，显式复位标记
    needsRestart.value = false;
    pushToast("排序已保存", "success");
  } catch (err) {
    pushToast(`保存排序失败: ${(err as Error).message}`, "error");
  }
}

async function handleSaveProvider() {
  try {
    const payload = providerFromForm();
    if (!payload.name || !payload.baseUrl || (payload.models || []).length === 0) {
      pushToast("请完善 Provider 信息", "error");
      return;
    }
    await saveProvider(payload, isEditing.value);
    pushToast("保存成功", "success");
    showEditor.value = false;
    loadProviders();
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

async function handleToggleProvider(p: LlmProvider) {
  try {
    const target = await toggleProvider(p);
    p.enabled = target;
    pushToast(`Provider 已${target ? "启用" : "禁用"}`, "info");
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

async function handleDeleteProvider(p: LlmProvider) {
  try {
    await deleteProvider(p.name);
    pushToast("删除成功", "success");
    loadProviders();
  } catch (err) {
    pushToast((err as Error).message, "error");
  }
}

async function openProvidersJsonEditor() {
  try {
    const config = await fetchConfig();
    // 只编辑 providers 属性
    const providersData = config.Providers || config.providers || [];
    providersJson.value = JSON.stringify(providersData, null, 2);
    providersJsonError.value = "";
    showProvidersJsonModal.value = true;
  } catch (err) {
    pushToast(`获取配置失败: ${(err as Error).message}`, "error");
  }
}

async function openConfigJsonEditor() {
  try {
    const config = await fetchConfig();
    configJson.value = JSON.stringify(config, null, 2);
    configJsonError.value = "";
    showConfigJsonModal.value = true;
  } catch (err) {
    pushToast(`获取配置失败: ${(err as Error).message}`, "error");
  }
}

function closeProvidersJsonEditor() {
  showProvidersJsonModal.value = false;
  isSavingProvidersJson.value = false;
}

function closeConfigJsonEditor() {
  showConfigJsonModal.value = false;
  isSavingConfigJson.value = false;
}

async function handleSaveProvidersJson() {
  let providersData: any[];
  try {
    const parsed = JSON.parse(providersJson.value || "[]");
    if (!Array.isArray(parsed)) {
      providersJsonError.value = "JSON 须为有效的数组";
      return;
    }
    providersData = parsed;
  } catch (err) {
    providersJsonError.value = `JSON 解析失败: ${(err as Error).message}`;
    return;
  }
  try {
    isSavingProvidersJson.value = true;
    // 获取当前配置，只更新 providers 属性
    const config = await fetchConfig();
    const updatedConfig = {
      ...config,
      Providers: providersData,
    };
    const result = await saveConfig(updatedConfig);
    providersJsonError.value = "";
    pushToast(result.message || "配置已保存，正在重启服务...", "success");
    showProvidersJsonModal.value = false;
    // 立即重启服务
    try {
      isRestarting.value = true;
      await restartService();
      pushToast("服务重启中...", "info");
    } catch (restartErr) {
      pushToast(`重启失败: ${(restartErr as Error).message}`, "error");
      isRestarting.value = false;
      isSavingProvidersJson.value = false;
    }
    loadProviders();
  } catch (err) {
    providersJsonError.value = (err as Error).message;
    isSavingProvidersJson.value = false;
  }
}

async function handleSaveConfigJson() {
  let config: Record<string, any>;
  try {
    config = JSON.parse(configJson.value || "{}");
  } catch (err) {
    configJsonError.value = `JSON 解析失败: ${(err as Error).message}`;
    return;
  }
  if (!config || typeof config !== "object") {
    configJsonError.value = "JSON 须为有效的配置对象";
    return;
  }
  try {
    isSavingConfigJson.value = true;
    const result = await saveConfig(config);
    configJsonError.value = "";
    pushToast(result.message || "配置已保存，正在重启服务...", "success");
    showConfigJsonModal.value = false;
    // 立即重启服务
    try {
      isRestarting.value = true;
      await restartService();
      pushToast("服务重启中...", "info");
    } catch (restartErr) {
      pushToast(`重启失败: ${(restartErr as Error).message}`, "error");
      isRestarting.value = false;
      isSavingConfigJson.value = false;
    }
    loadProviders();
  } catch (err) {
    configJsonError.value = (err as Error).message;
    isSavingConfigJson.value = false;
  }
}

function openSettings() {
  showSettingsModal.value = true;
  checkHealth();
}

function openClaudeSettings() {
  // 打开 Claude 弹窗时，使用当前全局设置中的 URL 和 Key 进行同步
  claudeBaseUrl.value = baseUrl.value;
  claudeApiKey.value = tempApiKey.value;
  showClaudeSettingsModal.value = true;
}

async function saveSettings() {
  persistSettings();
  await loadProviders();
  pushToast("设置已保存", "success");
  showSettingsModal.value = false;
}

async function handleConfirmClaudeSettings() {
  showClaudeSettingsModal.value = false;
  try {
    await startClaudeCli({
      timeoutMs: claudeTimeoutMs.value,
      baseUrl: claudeBaseUrl.value,
      apiKey: claudeApiKey.value,
      claudePath: claudePath.value,
      workDir: claudeWorkDir.value,
    });

    pushToast(
      `已触发 Claude 启动：超时时间 ${claudeTimeoutMs.value} ms，基础 URL ${claudeBaseUrl.value}`,
      "success"
    );
  } catch (err) {
    pushToast(`启动 Claude 失败：${(err as Error).message}`, "error");
  }
}

async function handleRestart() {
  try {
    isRestarting.value = true;
    await restartService();
    pushToast("服务重启中...", "info");
  } catch (err) {
    pushToast((err as Error).message, "error");
    isRestarting.value = false;
  }
}

function addArrayKey() {
  if (newArrayKey.value.trim()) {
    editForm.value.apiKeys.push(newArrayKey.value.trim());
    newArrayKey.value = "";
  }
}

function removeArrayKey(i: number) {
  editForm.value.apiKeys.splice(i, 1);
}

watch(
  () => ({ ...editForm.value }),
  () => {
    if (editorTab.value === "json") {
      providersJson.value = JSON.stringify(providerFromForm(), null, 2);
    }
  },
  { deep: true }
);

watch(
  () => messages.value,
  (val) => {
    localStorage.setItem("llm_chat_history", JSON.stringify(val));
  },
  { deep: true }
);

watch(currentTab, (tab) => {
  if (tab === "chat" || tab === "providers") {
    loadProviders();
  }
});

watch(showProvidersJsonModal, (val) => {
  if (!val) {
    isSavingProvidersJson.value = false;
  }
});

watch(showConfigJsonModal, (val) => {
  if (!val) {
    isSavingConfigJson.value = false;
  }
});

useEventListener(window, "keydown", (e) => {
  if (e.key !== "Escape") return;
  if (showEditor.value) closeEditor();
  if (showProvidersJsonModal.value) closeProvidersJsonEditor();
  if (showConfigJsonModal.value) closeConfigJsonEditor();
  if (showSettingsModal.value) showSettingsModal.value = false;
  if (showClaudeSettingsModal.value) showClaudeSettingsModal.value = false;
});

onMounted(() => {
  loadProviders();
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
            @click="currentTab = 'chat'"
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
            @click="currentTab = 'mcp'"
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
            @click="currentTab = 'providers'"
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
            @click="currentTab = 'statusline'"
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
            @click="currentTab = 'logger'"
          >
            <DescriptionOutlined class="w-4 h-4" />
            日志
          </button>
        </nav>
      </div>
      <div class="flex items-center gap-3">
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
            isRestarting
              ? 'bg-primary text-white border-primary shadow-sm'
              : needsRestart
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-white text-slate-700 border-slate-200 hover:text-primary /40'
          "
          :disabled="isRestarting"
          @click="handleRestart"
        >
          <AutorenewOutlined class="w-4 h-4" :class="{ 'animate-spin': isRestarting }" />
          <span>{{ isRestarting ? "重启中..." : "重启服务" }}</span>
          <span
            v-if="needsRestart && !isRestarting"
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

        <div class="h-6 w-px bg-slate-200 mx-1"></div>
        <!-- 通用右侧 Teleport 目标 -->
        <div id="header-right-target"></div>
        <button class="btn-icon" title="设置" @click="openSettings">
          <SettingsOutlined class="w-5 h-5" />
        </button>
      </div>
    </header>

    <main class="flex-1 h-full overflow-hidden relative bg-slate-50">
      <LoggerPanel v-show="currentTab === 'logger'" :current-tab="currentTab" />
      <MCPPanel v-show="currentTab === 'mcp'" :current-tab="currentTab" />
      <ChatPanel
        v-show="currentTab === 'chat'"
        :providers="providers"
        :messages="messages"
        :current-tab="currentTab"
        :chat-input="chatInput"
        :selected-model-key="selectedModelKey"
        :is-chat-loading="isChatLoading"
        @update:chat-input="updateChatInput"
        @update:selected-model-key="updateSelectedModelKey"
        @clear="clearHistory"
      />
      <ProvidersPanel
        v-if="currentTab === 'providers'"
        :providers="providers"
        @openJson="openProvidersJsonEditor"
        @create="() => openEditor()"
        @edit="openEditor"
        @toggle="handleToggleProvider"
        @remove="handleDeleteProvider"
        @reorder="handleReorderProviders"
      />
      <StatusLinePanel v-else-if="currentTab === 'statusline'" />
    </main>

    <div
      v-if="isRestarting"
      class="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50"
    >
      <div
        class="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"
      ></div>
      <div class="text-sm text-slate-700">服务重启中，请稍候...</div>
    </div>

    <SettingsModal
      v-model:show="showSettingsModal"
      v-model:base-url="baseUrl"
      v-model:temp-api-key="tempApiKey"
      v-model:translation-model="translationModel"
      v-model:auto-translate="autoTranslate"
      :health-status="healthStatus"
      :providers="providers"
      @save="saveSettings"
      @check="checkHealth"
    />

    <ClaudeSettingsModal
      v-model:show="showClaudeSettingsModal"
      v-model:timeout-ms="claudeTimeoutMs"
      v-model:base-url="claudeBaseUrl"
      v-model:api-key="claudeApiKey"
      v-model:claude-path="claudePath"
      v-model:work-dir="claudeWorkDir"
      @confirm="handleConfirmClaudeSettings"
    />

    <JSONEditorModal
      v-model:show="showProvidersJsonModal"
      v-model:json-value="providersJson"
      :error="providersJsonError"
      :is-saving="isSavingProvidersJson"
      title="编辑 Providers JSON"
      description="编辑 Providers 配置数组，保存后将立即重启服务。"
      @save="handleSaveProvidersJson"
    />

    <JSONEditorModal
      v-model:show="showConfigJsonModal"
      v-model:json-value="configJson"
      :error="configJsonError"
      :is-saving="isSavingConfigJson"
      title="编辑配置 JSON"
      description="编辑完整的配置 JSON，保存后将立即重启服务。"
      @save="handleSaveConfigJson"
    />

    <ProviderEditorModal
      v-model:show="showEditor"
      v-model:editor-tab="editorTab"
      v-model:form="editForm"
      v-model:new-array-key="newArrayKey"
      v-model:json-preview="providersJson"
      :is-editing="isEditing"
      @addKey="addArrayKey"
      @removeKey="removeArrayKey"
      @save="handleSaveProvider"
      @close="closeEditor"
    />
  </div>
</template>

<style scoped></style>
