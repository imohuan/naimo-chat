<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { LlmProvider } from "@/interface";
import {
  CodeOutlined,
  AddOutlined,
  SaveOutlined,
  HelpOutlineOutlined,
  SearchOutlined,
  ViewListOutlined,
  GridViewOutlined,
  ListOutlined,
} from "@vicons/material";
import { useLlmApi } from "@/hooks/useLlmApi";
import { useToasts } from "@/hooks/useToasts";
import RouterModelSelect from "@/components/llm/RouterModelSelect.vue";
import Input from "@/components/llm/Input.vue";
import ProviderListLayout from "./components/ProviderListLayout.vue";
import ProviderGridLayout from "./components/ProviderGridLayout.vue";
import ProviderCompactLayout from "./components/ProviderCompactLayout.vue";

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

// 搜索关键词
const searchQuery = ref("");

// 布局类型：'list' | 'grid' | 'compact'
type LayoutType = "list" | "grid" | "compact";
const layoutType = ref<LayoutType>("list");

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

// 过滤后的 providers（根据搜索关键词）
const filteredProviders = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.providers;
  }
  const query = searchQuery.value.toLowerCase().trim();
  return props.providers.filter((provider) => {
    // 搜索 provider 名称
    if (provider.name.toLowerCase().includes(query)) {
      return true;
    }
    // 搜索 baseUrl
    if (provider.baseUrl?.toLowerCase().includes(query)) {
      return true;
    }
    // 搜索模型名称
    if (provider.models?.some((model) => model.toLowerCase().includes(query))) {
      return true;
    }
    return false;
  });
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
function handleCopyModelTag(providerName: string, modelName: string) {
  // 事件已经由子组件处理，这里只是转发
}

// 切换布局类型
function setLayoutType(type: LayoutType) {
  layoutType.value = type;
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

    <div class="flex-1 overflow-hidden flex gap-2">
      <!-- 左侧：Provider 列表 -->
      <div class="flex-1 overflow-hidden flex flex-col p-6">
        <!-- 搜索栏和布局切换 -->
        <div class="flex items-center gap-3 mb-4 shrink-0">
          <div class="flex-1 relative">
            <SearchOutlined
              class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10"
            />
            <Input
              v-model="searchQuery"
              type="text"
              placeholder="搜索 Provider、模型或 URL..."
              class="w-full pl-10"
            />
          </div>
          <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1 shrink-0">
            <button
              type="button"
              class="p-1.5 rounded transition-colors"
              :class="
                layoutType === 'list'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              "
              title="列表布局"
              @click="setLayoutType('list')"
            >
              <ListOutlined class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded transition-colors"
              :class="
                layoutType === 'grid'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              "
              title="网格布局"
              @click="setLayoutType('grid')"
            >
              <GridViewOutlined class="w-4 h-4" />
            </button>
            <button
              type="button"
              class="p-1.5 rounded transition-colors"
              :class="
                layoutType === 'compact'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              "
              title="紧凑布局"
              @click="setLayoutType('compact')"
            >
              <ViewListOutlined class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Provider 列表内容 -->
        <div class="flex-1 overflow-y-auto pr-2">
          <div
            v-if="filteredProviders.length === 0"
            class="py-16 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50"
          >
            <CodeOutlined class="w-12 h-12 mb-4 text-slate-300" />
            <p class="font-medium">
              {{ searchQuery ? "未找到匹配的 Provider" : "暂无 Provider 配置" }}
            </p>
            <button
              v-if="!searchQuery"
              class="mt-4 text-primary-600 hover:underline text-sm"
              @click="emit('create')"
            >
              点击添加第一个
            </button>
            <button
              v-else
              class="mt-4 text-primary-600 hover:underline text-sm"
              @click="searchQuery = ''"
            >
              清除搜索
            </button>
          </div>

          <ProviderListLayout
            v-else-if="layoutType === 'list'"
            :providers="filteredProviders"
            :default-visible-model-count="defaultVisibleModelCount"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
            @toggle="emit('toggle', $event)"
            @copy-model-tag="handleCopyModelTag"
          />
          <ProviderGridLayout
            v-else-if="layoutType === 'grid'"
            :providers="filteredProviders"
            :default-visible-model-count="defaultVisibleModelCount"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
            @toggle="emit('toggle', $event)"
            @copy-model-tag="handleCopyModelTag"
          />
          <ProviderCompactLayout
            v-else-if="layoutType === 'compact'"
            :providers="filteredProviders"
            :default-visible-model-count="defaultVisibleModelCount"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
            @toggle="emit('toggle', $event)"
            @copy-model-tag="handleCopyModelTag"
          />
        </div>
      </div>

      <!-- 右侧：Router 配置 -->
      <div
        class="ml-0 m-6 w-96 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
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
