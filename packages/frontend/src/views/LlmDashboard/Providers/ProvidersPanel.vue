<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { LlmProvider } from "@/interface";
import {
  CodeOutlined,
  InfoOutlined,
  EditOutlined,
  DeleteOutlined,
  AddOutlined,
  SaveOutlined,
  HelpOutlineOutlined,
  DragIndicatorOutlined,
} from "@vicons/material";
import Popconfirm from "@/components/llm/Popconfirm.vue";
import { useLlmApi } from "@/hooks/useLlmApi";
import { useToasts } from "@/hooks/useToasts";
import RouterModelSelect from "@/components/llm/RouterModelSelect.vue";
import { VueDraggable } from "vue-draggable-plus";

const props = defineProps<{
  providers: LlmProvider[];
}>();

const emit = defineEmits<{
  openJson: [];
  create: [];
  edit: [provider: LlmProvider];
  toggle: [provider: LlmProvider];
  remove: [provider: LlmProvider];
  reorder: [providers: LlmProvider[]];
}>();

const { fetchConfig, saveConfig } = useLlmApi();
const { pushToast } = useToasts();

// Router 配置介绍对象
const routerConfigInfo: Record<string, { name: string; desc: string }> = {
  default: {
    name: "默认模型",
    desc: "用于常规请求的默认路由",
  },
  background: {
    name: "后台任务",
    desc: "用于异步或长时间运行的任务",
  },
  think: {
    name: "思考任务",
    desc: "用于需要深度思考的复杂任务",
  },
  longContext: {
    name: "长上下文",
    desc: "用于需要处理大量上下文的任务",
  },
  webSearch: {
    name: "网络搜索",
    desc: "用于需要网络搜索能力的任务",
  },
  image: {
    name: "图像处理",
    desc: "用于图像相关的任务",
  },
};

// Router 配置的所有 key（按顺序）
const routerConfigKeys = Object.keys(routerConfigInfo);

// Router 配置
const routerConfig = ref<Record<string, string>>({});
const isLoadingConfig = ref(false);
const isSavingConfig = ref(false);
const fullConfig = ref<Record<string, any>>({});

// 展开状态：存储已展开的 provider 的 key
const expandedProviders = ref<Set<string>>(new Set());

// 默认显示的模型数量
const defaultVisibleModelCount = ref(5);

// 收集所有可用的模型选项（格式：provider,model）
const allModelOptions = computed(() => {
  const options: string[] = [];
  props.providers.forEach((provider) => {
    if (provider.enabled !== false && provider.models) {
      provider.models.forEach((model) => {
        options.push(`${provider.name},${model}`);
      });
    }
  });
  return options.sort();
});

// 获取 Router 配置值（返回实际存储的值，可能为空）
function getRouterValue(key: string): string {
  return routerConfig.value[key] || "";
}

// 加载配置
async function loadConfig() {
  try {
    isLoadingConfig.value = true;
    fullConfig.value = await fetchConfig();
    const loadedRouter = fullConfig.value.Router || {};
    // 确保所有定义的 key 都存在
    routerConfig.value = {};
    routerConfigKeys.forEach((key) => {
      routerConfig.value[key] = loadedRouter[key] || "";
    });
  } catch (err) {
    pushToast(`加载配置失败: ${(err as Error).message}`, "error");
  } finally {
    isLoadingConfig.value = false;
  }
}

// 保存配置
async function saveRouterConfig() {
  try {
    isSavingConfig.value = true;
    // 先获取最新的配置，避免覆盖其他可能已更新的配置
    const latestConfig = await fetchConfig();
    // 保留原有的 Router 配置（可能包含其他字段如 longContextThreshold）
    const existingRouter = latestConfig.Router || {};
    // 更新我们管理的配置项
    const routerToSave: Record<string, any> = { ...existingRouter };
    routerConfigKeys.forEach((key) => {
      const value = routerConfig.value[key];
      // 如果值为空，则删除该 key（让服务器使用 default）
      if (value && value.trim()) {
        routerToSave[key] = value;
      } else if (key !== "default") {
        // 对于非 default 的 key，如果为空则删除，使用 default
        delete routerToSave[key];
      } else {
        // default 如果为空，也删除（但通常 default 应该有值）
        delete routerToSave[key];
      }
    });
    // 合并最新配置和当前的 Router 配置
    const updatedConfig = {
      ...latestConfig,
      Router: routerToSave,
    };
    await saveConfig(updatedConfig);
    fullConfig.value = updatedConfig;
    pushToast("Router 配置已保存", "success");
  } catch (err) {
    pushToast(`保存配置失败: ${(err as Error).message}`, "error");
  } finally {
    isSavingConfig.value = false;
  }
}

// 更新单个 Router 配置项
function updateRouterItem(key: string, value: string) {
  if (value && value.trim()) {
    routerConfig.value[key] = value;
  } else {
    // 如果值为空，删除该配置项
    delete routerConfig.value[key];
  }
}

// 清空 Router 配置项（使用默认模型）
function clearRouterItem(key: string) {
  if (key !== "default") {
    delete routerConfig.value[key];
  }
}

// 复制模型标识（格式：provider名称,模型名称）
async function copyModelTag(providerName: string, modelName: string) {
  const text = `${providerName},${modelName}`;
  try {
    await navigator.clipboard.writeText(text);
    pushToast(`已复制: ${text}`, "success");
  } catch (err) {
    pushToast(`复制失败: ${(err as Error).message}`, "error");
  }
}

// 切换 provider 的展开状态
function toggleProviderExpanded(providerKey: string) {
  if (expandedProviders.value.has(providerKey)) {
    expandedProviders.value.delete(providerKey);
  } else {
    expandedProviders.value.add(providerKey);
  }
}

// 检查 provider 是否已展开
function isProviderExpanded(providerKey: string): boolean {
  return expandedProviders.value.has(providerKey);
}

// 可拖拽的 provider 列表
const draggableProviders = ref<LlmProvider[]>([...props.providers]);

watch(
  () => props.providers,
  (val) => {
    draggableProviders.value = [...val];
  },
  { immediate: true, deep: true }
);

function handleReorder() {
  emit("reorder", draggableProviders.value);
}

onMounted(() => {
  loadConfig();
});
</script>

<template>
  <div class="max-w-7xl mx-auto h-full overflow-hidden flex flex-col">
    <div
      class="flex justify-between items-center p-6 pb-4 border-b border-slate-200 shrink-0"
    >
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Providers</h2>
        <p class="text-slate-500 text-sm mt-1">管理你的 LLM 服务商配置</p>
      </div>
      <div class="flex items-center gap-3">
        <button class="btn-secondary shadow-sm" @click="emit('openJson')">
          <CodeOutlined class="w-4 h-4" /> 编辑
        </button>
        <button
          class="btn-primary shadow-lg shadow-primary-500/20"
          @click="emit('create')"
        >
          <AddOutlined class="w-4 h-4" /> 新增 Provider
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-hidden flex gap-1 p-6">
      <!-- 左侧：Provider 卡片列表 -->
      <div class="flex-1 overflow-y-auto pr-3">
        <div
          v-if="providers.length === 0"
          class="py-16 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"
        >
          <CodeOutlined class="w-12 h-12 mb-4 text-slate-300" />
          <p class="font-medium">暂无 Provider 配置</p>
          <button
            class="mt-4 text-primary-600 hover:underline text-sm"
            @click="emit('create')"
          >
            点击添加第一个
          </button>
        </div>

        <VueDraggable
          v-model="draggableProviders"
          :animation="150"
          handle=".provider-drag-handle"
          :item-key="(p: LlmProvider) => p.id || p.name"
          class="grid grid-cols-1 gap-3"
          @end="handleReorder"
        >
          <div
            v-for="element in draggableProviders"
            :key="element.id || element.name"
            class="bg-white rounded-xl border border-slate-200 p-3 pl-7 shadow-sm hover:shadow-md transition-shadow group relative"
          >
            <button
              class="provider-drag-handle absolute -left-3 top-3 w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-primary-50 hover:text-primary-600 flex items-center justify-center shadow-sm"
              title="拖动以排序"
            >
              <DragIndicatorOutlined class="w-4 h-4" />
            </button>
            <div class="flex justify-between items-start mb-2">
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm uppercase"
                >
                  {{ element.name.substring(0, 2) }}
                </div>
                <div>
                  <h3 class="font-bold text-slate-800 text-sm">
                    {{ element.name }}
                  </h3>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span
                      class="w-2 h-2 rounded-full"
                      :class="element.enabled === false ? 'bg-slate-300' : 'bg-green-500'"
                    ></span>
                    <span class="text-xs text-slate-500">{{
                      element.enabled === false ? "已禁用" : "运行中"
                    }}</span>
                  </div>
                </div>
              </div>
              <div
                class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <button
                  class="btn-icon text-slate-400 hover:text-primary-600"
                  title="编辑"
                  @click="emit('edit', element)"
                >
                  <EditOutlined class="w-4 h-4" />
                </button>
                <Popconfirm
                  title="删除 Provider"
                  description="确定要删除该 Provider 吗？此操作不可撤销。"
                  type="danger"
                  confirm-text="删除"
                  @confirm="emit('remove', element)"
                >
                  <template #reference="{ toggle }">
                    <button
                      class="btn-icon text-slate-400 hover:text-red-600"
                      title="删除"
                      @click="toggle"
                    >
                      <DeleteOutlined class="w-4 h-4" />
                    </button>
                  </template>
                </Popconfirm>
              </div>
            </div>

            <div class="space-y-2">
              <div
                class="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 truncate"
              >
                <InfoOutlined class="w-3 h-3 shrink-0" />
                <span class="truncate">{{ element.baseUrl }}</span>
              </div>

              <div
                class="flex flex-wrap gap-1.5 content-start"
                :class="
                  isProviderExpanded(element.id || element.name) ? '' : 'overflow-hidden'
                "
              >
                <span
                  v-for="m in isProviderExpanded(element.id || element.name)
                    ? element.models || []
                    : (element.models || []).slice(0, defaultVisibleModelCount)"
                  :key="m"
                  class="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-mono cursor-pointer hover:bg-gray-100 -300 hover:text-primary-700 transition-colors"
                  :title="`点击复制: ${element.name},${m}`"
                  @click="copyModelTag(element.name, m)"
                >
                  {{ m }}
                </span>
                <span
                  v-if="(element.models || []).length > defaultVisibleModelCount"
                  class="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-mono cursor-pointer hover:bg-gray-200 hover:text-slate-700 transition-colors"
                  :title="
                    isProviderExpanded(element.id || element.name)
                      ? '点击收起'
                      : `点击展开全部 ${element.models.length} 个模型`
                  "
                  @click="toggleProviderExpanded(element.id || element.name)"
                >
                  {{
                    isProviderExpanded(element.id || element.name)
                      ? "收起"
                      : `+${element.models.length - defaultVisibleModelCount}`
                  }}
                </span>
              </div>
            </div>

            <div
              class="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center"
            >
              <span class="text-xs text-slate-400"
                >速率限制: {{ element.limit ?? "无限制" }}</span
              >
              <button
                class="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
                :class="
                  element.enabled === false
                    ? 'bg-green-50 text-green-600 hover:bg-green-100'
                    : 'bg-red-50 text-red-600 hover:bg-red-100'
                "
                @click="emit('toggle', element)"
              >
                {{ element.enabled === false ? "启用" : "禁用" }}
              </button>
            </div>
          </div>
        </VueDraggable>
      </div>

      <!-- 右侧：Router 配置 -->
      <div
        class="w-96 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
      >
        <div class="p-5 border-b border-slate-200">
          <h3 class="text-lg font-bold text-slate-800">Router 配置</h3>
          <p class="text-xs text-slate-500 mt-1">全局路由配置</p>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <div v-if="isLoadingConfig" class="text-center text-slate-400 py-8">
            加载中...
          </div>

          <div v-else v-for="key in routerConfigKeys" :key="key" class="space-y-2">
            <label
              class="flex items-center justify-between text-sm font-medium text-slate-700"
            >
              <div class="flex items-center gap-2">
                <span>{{ routerConfigInfo[key]?.name || key }}</span>
                <div class="group relative">
                  <HelpOutlineOutlined
                    class="w-4 h-4 text-slate-400 hover:text-slate-600 cursor-help"
                  />
                  <div
                    class="absolute left-0 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none"
                  >
                    {{ routerConfigInfo[key]?.desc || "" }}
                    <div
                      class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"
                    ></div>
                  </div>
                </div>
              </div>
              <button
                v-if="getRouterValue(key) && key !== 'default'"
                type="button"
                class="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="清空并使用默认模型"
                @click="clearRouterItem(key)"
              >
                <DeleteOutlined class="w-4 h-4" />
              </button>
            </label>
            <RouterModelSelect
              :model-value="getRouterValue(key)"
              :options="allModelOptions"
              :placeholder="key === 'default' ? '-- 请选择模型 --' : '使用默认模型'"
              @update:model-value="(val) => updateRouterItem(key, val)"
            />
          </div>
        </div>

        <div class="p-5 border-t border-slate-200">
          <button
            class="btn-primary w-full justify-center"
            :disabled="isSavingConfig || isLoadingConfig"
            @click="saveRouterConfig"
          >
            <SaveOutlined class="w-4 h-4" />
            {{ isSavingConfig ? "保存中..." : "保存 Router 配置" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
