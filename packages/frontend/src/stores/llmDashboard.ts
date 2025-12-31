import { defineStore } from "pinia";
import { ref } from "vue";
import type { LlmProvider, TransformerConfig } from "@/interface";
import { useLlmApi } from "@/hooks/useLlmApi";

export const useLlmDashboardStore = defineStore("llmDashboard", () => {
  // Providers 相关状态
  const providers = ref<LlmProvider[]>([]);

  // 编辑器相关状态
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
  const providersJson = ref("");

  // Modal 相关状态
  const showSettingsModal = ref(false);
  const showClaudeSettingsModal = ref(false);
  const showProvidersJsonModal = ref(false);
  const showConfigJsonModal = ref(false);
  const providersJsonError = ref("");
  const configJsonError = ref("");
  const isSavingProvidersJson = ref(false);
  const isSavingConfigJson = ref(false);
  const configJson = ref("");

  // Claude 设置
  const claudeTimeoutMs = ref("300000");
  const claudeBaseUrl = ref("http://127.0.0.1:3457/");
  const claudeApiKey = ref("sk-imohuan");
  const claudePath = ref("claude");
  const claudeWorkDir = ref("G:\\ClaudeCode");
  const claudeTerminalType = ref("powershell");

  // 重启状态
  const isRestarting = ref(false);

  // 使用 useLlmApi hook
  const {
    baseUrl,
    tempApiKey,
    translationModel,
    autoTranslate,
    needsRestart,
    healthStatus,
    persistSettings: persistLlmSettings,
    fetchProviders: fetchProvidersApi,
    toggleProvider: toggleProviderApi,
    deleteProvider: deleteProviderApi,
    saveProvider: saveProviderApi,
    restartService,
    checkHealth,
    fetchConfig,
    saveConfig,
    startClaudeCli,
  } = useLlmApi();

  // 排序 Providers
  function sortProvidersList(list: LlmProvider[]) {
    return [...list].sort((a, b) => {
      const aSort = typeof a.sort === "number" ? a.sort : Number.MAX_SAFE_INTEGER;
      const bSort = typeof b.sort === "number" ? b.sort : Number.MAX_SAFE_INTEGER;
      if (aSort !== bSort) return aSort - bSort;
      return a.name.localeCompare(b.name);
    });
  }

  // 收集 API Keys
  function collectKeys() {
    const keys: string[] = [];
    (editForm.value.apiKeys || []).forEach((k) => {
      if (k && k.trim()) keys.push(k.trim());
    });
    return Array.from(new Set(keys));
  }

  // 从表单生成 Provider
  function providerFromForm(): LlmProvider {
    const models = Array.from(new Set(editForm.value.models || []));
    const mergedKeys = collectKeys();
    const apiKey = "sk-imohuan";
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

    if (editForm.value.transformer) {
      result.transformer = editForm.value.transformer;
    }

    return result;
  }

  // 加载 Providers
  async function loadProviders() {
    providers.value = sortProvidersList(await fetchProvidersApi());
  }

  // 打开编辑器
  function openEditor(provider?: LlmProvider, tab: "form" | "json" = "form") {
    showEditor.value = true;
    isEditing.value = !!provider;
    editorTab.value = tab;

    if (provider) {
      if (Array.isArray(provider.apiKeys) && provider.apiKeys.length > 0) {
        editForm.value = {
          name: provider.name,
          baseUrl: provider.baseUrl,
          apiKey: "",
          apiKeys: provider.apiKeys.filter(Boolean),
          models: provider.models || [],
          limit: provider.limit || 0,
          transformer: provider.transformer,
        };
      } else {
        const merged = [];
        if (provider.apiKey && provider.apiKey !== "sk-imohuan") {
          merged.push(provider.apiKey);
        }
        editForm.value = {
          name: provider.name,
          baseUrl: provider.baseUrl,
          apiKey: "",
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
        apiKey: "",
        apiKeys: [],
        models: [],
        limit: 0,
        transformer: undefined,
      };
    }
    providersJson.value = JSON.stringify(providerFromForm(), null, 2);
  }

  // 关闭编辑器
  function closeEditor() {
    showEditor.value = false;
  }

  // 保存 Provider
  async function saveProvider(payload: LlmProvider, editing: boolean) {
    await saveProviderApi(payload, editing);
    await loadProviders();
  }

  // 切换 Provider 启用状态
  async function toggleProvider(p: LlmProvider) {
    const target = await toggleProviderApi(p);
    p.enabled = target;
    return target;
  }

  // 删除 Provider
  async function deleteProvider(name: string) {
    await deleteProviderApi(name);
    await loadProviders();
  }

  // 重新排序 Providers
  async function reorderProviders(list: LlmProvider[]) {
    const withSort = list.map((p, idx) => ({ ...p, sort: idx }));
    providers.value = sortProvidersList(withSort);

    const config = await fetchConfig();
    const orderMap = new Map(withSort.map((p) => [p.name, p.sort]));
    const mergedProviders = (config.Providers || config.providers || []).map(
      (p: any) => {
        const sort = orderMap.get(p.name);
        return typeof sort === "number" ? { ...p, sort } : p;
      }
    );

    withSort.forEach((p) => {
      if (!mergedProviders.some((item: any) => item.name === p.name)) {
        mergedProviders.push({ ...p });
      }
    });

    const updatedConfig = { ...config, Providers: mergedProviders };
    await saveConfig(updatedConfig);
  }

  // 添加 API Key
  function addArrayKey() {
    if (newArrayKey.value.trim()) {
      editForm.value.apiKeys.push(newArrayKey.value.trim());
      newArrayKey.value = "";
    }
  }

  // 移除 API Key
  function removeArrayKey(i: number) {
    editForm.value.apiKeys.splice(i, 1);
  }

  // 保存设置
  function persistSettings() {
    persistLlmSettings();
  }

  return {
    // 状态
    providers,
    showEditor,
    isEditing,
    editorTab,
    editForm,
    newArrayKey,
    providersJson,
    showSettingsModal,
    showClaudeSettingsModal,
    showProvidersJsonModal,
    showConfigJsonModal,
    providersJsonError,
    configJsonError,
    isSavingProvidersJson,
    isSavingConfigJson,
    configJson,
    claudeTimeoutMs,
    claudeBaseUrl,
    claudeApiKey,
    claudePath,
    claudeWorkDir,
    claudeTerminalType,
    isRestarting,
    baseUrl,
    tempApiKey,
    translationModel,
    autoTranslate,
    needsRestart,
    healthStatus,

    // 方法
    loadProviders,
    openEditor,
    closeEditor,
    saveProvider,
    toggleProvider,
    deleteProvider,
    reorderProviders,
    addArrayKey,
    removeArrayKey,
    providerFromForm,
    persistSettings,
    restartService,
    checkHealth,
    fetchConfig,
    saveConfig,
    startClaudeCli,
  };
});

