<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import {
  ChevronDown,
  Sparkles,
  RotateCcw,
  Wrench,
  Sliders,
  Search,
  RefreshCw,
} from "lucide-vue-next";
import RouterModelSelect from "@/components/llm/RouterModelSelect.vue";
import Dropdown from "@/components/llm/Dropdown.vue";
import { storeToRefs } from "pinia";
import { useMcpStore } from "@/stores/mcp";
import type { McpServer } from "@/interface";
import type { ChatModelConfig } from "../types";

const props = defineProps<{
  modelId: string;
  modelOptions: string[];
  modelConfig?: ChatModelConfig;
}>();

const emit = defineEmits<{
  "update:modelConfig": [config: ChatModelConfig];
}>();

const isOpen = ref(false);
const searchQuery = ref("");
const isRotating = ref(false);

// 已应用的配置参数（当前生效的值）
const appliedModelId = ref(props.modelId);
const appliedTemperature = ref(0.7);
const appliedTopP = ref(0.9);
const appliedMaxTokens = ref(4096);
const appliedSelectedMcpIds = ref<string[]>([]);
const appliedReasoningEffort = ref<
  "low" | "medium" | "high" | "minimal" | "xhigh" | undefined
>(undefined);

// 临时配置参数（用户正在编辑的值，只有点击应用后才会生效）
const tempModelId = ref(props.modelId);
const temperature = ref(0.7);
const topP = ref(0.9);
const maxTokens = ref(4096);
const selectedMcpIds = ref<string[]>([]);
const reasoningEffort = ref<
  "low" | "medium" | "high" | "minimal" | "xhigh" | undefined
>(undefined);

// Reasoning Effort 选项
const reasoningEffortOptions: Array<{
  value: "low" | "medium" | "high" | "minimal" | "xhigh" | undefined;
  label: string;
}> = [
  { value: undefined, label: "无" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "minimal", label: "极简" },
  { value: "xhigh", label: "超高" },
];

// MCP 相关 - 使用 store
const mcpStore = useMcpStore();
const {
  servers: mcpServers,
  isLoading: isLoadingMcps,
  serverTools,
} = storeToRefs(mcpStore);
const { loadServers, refreshAllTools } = mcpStore;

// 判断服务器是否可选（已启用且有工具）
const isServerSelectable = (server: McpServer) => {
  return (
    server.config.enabled !== false &&
    (serverTools.value[server.name] || []).length > 0
  );
};

// 过滤后的 MCP 列表（包含所有已启用的服务器，用于显示）
const filteredMcps = computed(() => {
  let list = mcpServers.value.filter((s) => s.config.enabled !== false);

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (mcp) =>
        mcp.name.toLowerCase().includes(q) ||
        (mcp.config.command || "").toLowerCase().includes(q) ||
        (mcp.config.url || "").toLowerCase().includes(q)
    );
  }

  return list;
});

// 刷新 MCP 配置
async function refreshMcpConfig() {
  await refreshAllTools();
}

// 切换 MCP 选择（只更新临时值，不立即生效，只允许选择可用的服务器）
function toggleMcp(server: McpServer) {
  if (!isServerSelectable(server)) {
    return; // 不可选的服务器不允许切换
  }
  const id = server.name;
  const index = selectedMcpIds.value.indexOf(id);
  if (index > -1) {
    selectedMcpIds.value.splice(index, 1);
  } else {
    selectedMcpIds.value.push(id);
  }
}

// 重置参数（只重置临时值，不立即生效）
function resetParams() {
  // 触发旋转动画
  isRotating.value = true;
  setTimeout(() => {
    isRotating.value = false;
  }, 600); // 动画持续 0.6 秒

  temperature.value = 0.7;
  topP.value = 0.9;
  maxTokens.value = 4096;
  reasoningEffort.value = undefined;
}

// 应用配置（将临时值应用到已应用的值，并 emit 给父组件）
function applyConfig() {
  // 更新已应用的值
  appliedModelId.value = tempModelId.value;
  appliedTemperature.value = temperature.value;
  appliedTopP.value = topP.value;
  appliedMaxTokens.value = maxTokens.value;
  appliedSelectedMcpIds.value = [...selectedMcpIds.value];
  appliedReasoningEffort.value = reasoningEffort.value;

  // 统一导出配置对象
  emit("update:modelConfig", {
    modelId: tempModelId.value,
    temperature: temperature.value,
    topP: topP.value,
    maxTokens: maxTokens.value,
    selectedMcpIds: [...selectedMcpIds.value],
    reasoningEffort: reasoningEffort.value,
  });

  isOpen.value = false;
}

// 处理模型选择（只更新临时值，不立即生效）
function handleModelSelect(value: string) {
  tempModelId.value = value;
}

// 当弹窗打开时，用已应用的值初始化临时值，并刷新 MCP 列表
async function onDropdownOpen() {
  tempModelId.value = appliedModelId.value;
  temperature.value = appliedTemperature.value;
  topP.value = appliedTopP.value;
  maxTokens.value = appliedMaxTokens.value;
  selectedMcpIds.value = [...appliedSelectedMcpIds.value];
  reasoningEffort.value = appliedReasoningEffort.value;
  // 刷新 MCP 服务器列表和工具
  await loadServers();
}

// 当弹窗关闭时（不点击应用），恢复临时值到已应用的值
function onDropdownClose() {
  tempModelId.value = appliedModelId.value;
  temperature.value = appliedTemperature.value;
  topP.value = appliedTopP.value;
  maxTokens.value = appliedMaxTokens.value;
  selectedMcpIds.value = [...appliedSelectedMcpIds.value];
  reasoningEffort.value = appliedReasoningEffort.value;
}

// 监听 props.modelId 的变化，同步到已应用的值
watch(
  () => props.modelId,
  (newValue) => {
    appliedModelId.value = newValue;
    // 如果弹窗未打开，也更新临时值
    if (!isOpen.value) {
      tempModelId.value = newValue;
    }
  }
);

// 监听 props.modelConfig 的变化，同步 reasoningEffort 等配置
watch(
  () => props.modelConfig,
  (newConfig) => {
    if (newConfig) {
      if (newConfig.reasoningEffort !== undefined) {
        appliedReasoningEffort.value = newConfig.reasoningEffort;
        if (!isOpen.value) {
          reasoningEffort.value = newConfig.reasoningEffort;
        }
      }
      // 同步其他配置项
      if (newConfig.temperature !== undefined) {
        appliedTemperature.value = newConfig.temperature;
        if (!isOpen.value) {
          temperature.value = newConfig.temperature;
        }
      }
      if (newConfig.topP !== undefined) {
        appliedTopP.value = newConfig.topP;
        if (!isOpen.value) {
          topP.value = newConfig.topP;
        }
      }
      if (newConfig.maxTokens !== undefined) {
        appliedMaxTokens.value = newConfig.maxTokens;
        if (!isOpen.value) {
          maxTokens.value = newConfig.maxTokens;
        }
      }
      if (newConfig.selectedMcpIds !== undefined) {
        appliedSelectedMcpIds.value = [...newConfig.selectedMcpIds];
        if (!isOpen.value) {
          selectedMcpIds.value = [...newConfig.selectedMcpIds];
        }
      }
    }
  },
  { deep: true }
);

// 初始化 reasoning_effort（从 props.modelConfig 或默认值）
onMounted(() => {
  // 初始化已应用的值
  appliedModelId.value = props.modelId;
  tempModelId.value = props.modelId;
  // 如果 props.modelConfig 存在，使用其值初始化
  if (props.modelConfig?.reasoningEffort !== undefined) {
    appliedReasoningEffort.value = props.modelConfig.reasoningEffort;
    reasoningEffort.value = props.modelConfig.reasoningEffort;
  }
  // 加载 MCP 服务器列表
  loadServers();
});
</script>

<template>
  <Dropdown
    :show="isOpen"
    @update:show="
      (value) => {
        isOpen = value;
        if (value) {
          onDropdownOpen();
        } else {
          onDropdownClose();
        }
      }
    "
    :max-width="900"
    :min-width="800"
    position="bottom"
    :show-arrow="true"
    :disable-content-scroll="true"
    :vertical-flip-only="true"
    :viewport-padding="30"
  >
    <!-- 触发区域：显示当前模型 + MCP 数量（横向布局） -->
    <template #trigger="{ toggle }">
      <button
        type="button"
        class="w-full inline-flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:bg-slate-50 transition-colors router-model-config-trigger h-8"
        @click.stop="toggle()"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <Sparkles class="w-4 h-4 text-slate-400 shrink-0" />
          <span class="truncate font-mono text-sm text-slate-800">
            {{ props.modelId || "选择或搜索模型..." }}
          </span>
          <span
            class="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600 shrink-0 font-mono font-bold"
          >
            MCP {{ appliedSelectedMcpIds.length }}
          </span>
        </div>
        <ChevronDown
          class="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2"
          :class="{ 'rotate-180': isOpen }"
        />
      </button>
    </template>

    <div
      class="bg-white rounded-lg shadow-lg border border-slate-200 flex flex-col md:flex-row"
      style="width: 800px; max-height: 400px; overflow: hidden; display: flex"
    >
      <!-- Left Section: Config -->
      <div
        class="w-full md:w-[35%] border-r border-slate-100 flex flex-col bg-white overflow-hidden"
      >
        <div
          class="px-4 py-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between"
        >
          <h2
            class="text-sm font-bold text-slate-700 flex items-center gap-1.5"
          >
            <Sliders class="w-3.5 h-3.5 text-indigo-500" />
            核心配置
          </h2>
          <button
            @click="resetParams"
            class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
            title="重置参数"
          >
            <RotateCcw class="w-4 h-4" :class="{ 'rotate-icon': isRotating }" />
          </button>
        </div>

        <div
          class="flex-1 min-h-0 p-4 space-y-5 overflow-y-auto custom-scrollbar"
        >
          <!-- Model Dropdown -->
          <div class="space-y-1">
            <label
              class="text-sm font-bold text-slate-400 uppercase tracking-tighter mb-1 block"
              >模型选择</label
            >
            <RouterModelSelect
              :model-value="tempModelId"
              :options="modelOptions"
              placeholder="选择或搜索模型..."
              @update:model-value="handleModelSelect"
            />
          </div>

          <!-- Reasoning Effort -->
          <div class="space-y-1">
            <label
              class="text-sm font-bold text-slate-400 uppercase tracking-tighter mb-1 block"
              >模型思考</label
            >
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in reasoningEffortOptions"
                :key="option.value ?? 'none'"
                @click="reasoningEffort = option.value"
                type="button"
                class="px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all"
                :class="
                  reasoningEffort === option.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700'
                "
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <!-- Parameters -->
          <div class="space-y-4 pt-4 border-t border-slate-50">
            <!-- Temperature -->
            <div class="space-y-1">
              <div class="flex justify-between items-center px-0.5">
                <span class="text-xs font-bold text-slate-600"
                  >Temperature</span
                >
                <span class="text-xs font-mono font-bold text-indigo-600">{{
                  temperature
                }}</span>
              </div>
              <input
                type="range"
                v-model.number="temperature"
                min="0"
                max="2"
                step="0.1"
                class="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div class="flex justify-between">
                <span class="text-xs text-slate-400">生成创造力</span>
              </div>
            </div>

            <!-- Top P -->
            <div class="space-y-1">
              <div class="flex justify-between items-center px-0.5">
                <span class="text-xs font-bold text-slate-600">Top P</span>
                <span class="text-xs font-mono font-bold text-indigo-600">{{
                  topP
                }}</span>
              </div>
              <input
                type="range"
                v-model.number="topP"
                min="0"
                max="1"
                step="0.05"
                class="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div class="flex justify-between">
                <span class="text-xs text-slate-400">核采样范围</span>
              </div>
            </div>

            <!-- Max Tokens -->
            <div class="space-y-1">
              <div class="flex justify-between items-center px-0.5">
                <span class="text-xs font-bold text-slate-600">Max Tokens</span>
                <span class="text-xs font-mono font-bold text-indigo-600">{{
                  maxTokens
                }}</span>
              </div>
              <input
                type="range"
                v-model.number="maxTokens"
                min="256"
                max="16384"
                step="256"
                class="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div class="flex justify-between">
                <span class="text-xs text-slate-400">最大输出长度</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Section: MCP Services -->
      <div
        class="w-full md:w-[65%] flex flex-col bg-slate-50/30 overflow-hidden"
      >
        <div
          class="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-4"
        >
          <div class="shrink-0">
            <h2 class="text-sm font-bold text-slate-800">MCP 服务</h2>
          </div>

          <!-- Search Bar -->
          <div class="flex-1 relative group">
            <span
              class="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400"
            >
              <Search class="w-3.5 h-3.5" />
            </span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索扩展工具..."
              class="w-full bg-slate-100 border-none rounded-md py-1.5 pl-8 pr-4 text-sm focus:bg-white focus:ring-1 focus:ring-indigo-500/30 transition-all outline-none"
            />
          </div>

          <!-- Refresh Button -->
          <button
            @click="refreshMcpConfig"
            :disabled="isLoadingMcps"
            class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="刷新 MCP 配置"
          >
            <RefreshCw
              class="w-4 h-4"
              :class="{ 'animate-spin': isLoadingMcps }"
            />
          </button>

          <div
            class="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded"
          >
            <span
              class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
            ></span>
            已就绪
          </div>
        </div>

        <!-- MCP Grid Area -->
        <div class="flex-1 min-h-0 p-3 overflow-y-auto custom-scrollbar">
          <div
            v-if="filteredMcps.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <div
              v-for="mcp in filteredMcps"
              :key="mcp.name"
              @click="toggleMcp(mcp)"
              :class="[
                'p-3 rounded-lg border transition-all group relative overflow-hidden',
                isServerSelectable(mcp)
                  ? 'cursor-pointer'
                  : 'cursor-not-allowed opacity-50',
                selectedMcpIds.includes(mcp.name)
                  ? 'border-indigo-500 bg-indigo-50/30 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]'
                  : isServerSelectable(mcp)
                  ? 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/10 shadow-sm hover:shadow-md'
                  : 'border-slate-200 bg-slate-50 shadow-sm',
              ]"
            >
              <div class="flex items-start gap-3 relative z-10 w-full">
                <!-- Icon Container -->
                <div
                  class="shrink-0 p-2 rounded-md transition-all"
                  :class="
                    selectedMcpIds.includes(mcp.name)
                      ? 'bg-indigo-100 text-indigo-600'
                      : isServerSelectable(mcp)
                      ? 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                      : 'bg-slate-100 text-slate-300'
                  "
                >
                  <Wrench
                    class="w-4 h-4 transition-transform"
                    :class="{
                      'rotate-12':
                        selectedMcpIds.includes(mcp.name) &&
                        isServerSelectable(mcp),
                      'group-hover:rotate-12': isServerSelectable(mcp),
                    }"
                  />
                </div>

                <!-- Content -->
                <div class="min-w-0 flex-1 flex flex-col gap-0.5">
                  <div class="flex items-center gap-1.5">
                    <h4
                      class="text-sm font-semibold truncate leading-tight transition-colors"
                      :class="
                        selectedMcpIds.includes(mcp.name)
                          ? 'text-indigo-700'
                          : isServerSelectable(mcp)
                          ? 'text-slate-700 group-hover:text-slate-900'
                          : 'text-slate-400'
                      "
                    >
                      {{ mcp.name }}
                    </h4>
                    <span
                      v-if="isServerSelectable(mcp)"
                      class="text-[10px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 font-mono font-bold"
                      title="工具数量"
                    >
                      {{ (serverTools[mcp.name] || []).length }}
                    </span>
                    <span
                      v-else
                      class="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-400 font-mono"
                      title="无可用工具"
                    >
                      0
                    </span>
                  </div>
                  <p
                    class="text-xs truncate leading-tight transition-colors"
                    :class="
                      selectedMcpIds.includes(mcp.name)
                        ? 'text-indigo-500/70'
                        : isServerSelectable(mcp)
                        ? 'text-slate-400 group-hover:text-slate-500'
                        : 'text-slate-300'
                    "
                  >
                    {{ mcp.config.command || mcp.config.url || "MCP 服务" }}
                  </p>
                </div>

                <!-- Selection Indicator -->
                <div
                  v-if="isServerSelectable(mcp)"
                  class="shrink-0 mt-1 transition-all"
                  :class="
                    selectedMcpIds.includes(mcp.name)
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-30'
                  "
                >
                  <div
                    class="w-2 h-2 rounded-full"
                    :class="
                      selectedMcpIds.includes(mcp.name)
                        ? 'bg-indigo-500 ring-2 ring-indigo-200'
                        : 'bg-slate-300'
                    "
                  ></div>
                </div>
                <div
                  v-else
                  class="shrink-0 mt-1 opacity-50"
                  title="无可用工具，无法选择"
                >
                  <div class="w-2 h-2 rounded-full bg-slate-300"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else
            class="h-full flex flex-col items-center justify-center text-center opacity-60"
          >
            <p class="text-sm text-slate-500">
              {{ isLoadingMcps ? "加载中..." : "未找到相关服务" }}
            </p>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div
          class="px-4 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between"
        >
          <div class="text-xs text-slate-500">
            已选择
            <span class="text-indigo-600 font-bold">{{
              selectedMcpIds.length
            }}</span>
          </div>
          <button
            @click="applyConfig"
            class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded shadow-sm transition-all active:scale-95"
          >
            应用
          </button>
        </div>
      </div>
    </div>
  </Dropdown>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 3px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 12px;
  width: 12px;
  border-radius: 50%;
  background: #4f46e5;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.rotate-icon {
  animation: rotate 0.6s ease-in-out;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
