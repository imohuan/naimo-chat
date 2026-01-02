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
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  Square,
  Check,
  Eye,
  EyeOff,
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
const appliedSelectedMcpTools = ref<Record<string, string[]>>({});
const appliedReasoning = ref<"none" | "normal" | "hard" | "mega" | "ultra" | undefined>(
  undefined
);

// 临时配置参数（用户正在编辑的值，只有点击应用后才会生效）
const tempModelId = ref(props.modelId);
const temperature = ref(0.7);
const topP = ref(0.9);
const maxTokens = ref(4096);
const selectedMcpTools = ref<Record<string, string[]>>({});
const reasoning = ref<"none" | "normal" | "hard" | "mega" | "ultra" | undefined>(
  undefined
);

// 右侧面板视图状态：'servers' 显示 MCP 服务列表，'tools' 显示工具选择器
const rightPanelView = ref<"servers" | "tools">("servers");
const currentToolSelectorServer = ref<McpServer | null>(null);
// 工具选择器的本地选中状态（用于编辑）
const localSelectedToolNames = ref<string[]>([]);
// 是否显示工具详情
const showToolDetails = ref(false);

// Reasoning 选项
const reasoningOptions: Array<{
  value: "none" | "normal" | "hard" | "mega" | "ultra" | undefined;
  label: string;
  description: string;
}> = [
  {
    value: undefined,
    label: "无",
    description: "无思考模式，直接响应",
  },
  {
    value: "normal",
    label: "基础思考",
    description: "想想、思考、考虑",
  },
  {
    value: "hard",
    label: "中级思考",
    description: "再想想、多想想、想清楚、想明白、考虑清楚",
  },
  {
    value: "mega",
    label: "强力思考",
    description: "强力思考、大力思考、用力思考、努力思考、好好思考、仔细思考",
  },
  {
    value: "ultra",
    label: "超级思考",
    description: "超级思考、极限思考、深度思考、全力思考、超强思考、认真仔细思考",
  },
];

// 当前选中的思考选项
const selectedReasoningOption = computed(() => {
  const found = reasoningOptions.find((opt) => opt.value === reasoning.value);
  return found || reasoningOptions[0]!;
});

const isReasoningDropdownOpen = ref(false);

// MCP 相关 - 使用 store
const mcpStore = useMcpStore();
const { servers: mcpServers, isLoading: isLoadingMcps, serverTools } = storeToRefs(
  mcpStore
);
const { loadServers, refreshAllTools } = mcpStore;

// 判断服务器是否可选（已启用且有工具）
const isServerSelectable = (server: McpServer) => {
  return (
    server.config.enabled !== false && (serverTools.value[server.name] || []).length > 0
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

// 切换 MCP 选择（选中/取消所有工具）
function toggleMcp(server: McpServer) {
  if (!isServerSelectable(server)) {
    return; // 不可选的服务器不允许切换
  }
  const serverName = server.name;
  const tools = serverTools.value[serverName] || [];
  const allToolNames = tools.map((tool) => tool.name);

  if (selectedMcpTools.value[serverName]) {
    // 如果已选择，取消选择（删除该服务器）
    delete selectedMcpTools.value[serverName];
  } else {
    // 如果未选择，全选该服务器的所有工具
    selectedMcpTools.value[serverName] = [...allToolNames];
  }
}

// 打开工具选择器（切换到工具选择视图）
function openToolSelector(server: McpServer, event: MouseEvent) {
  event.stopPropagation(); // 阻止触发 toggleMcp
  if (!isServerSelectable(server)) {
    return;
  }
  currentToolSelectorServer.value = server;
  // 初始化本地选中状态为当前已选中的工具
  localSelectedToolNames.value = [...(selectedMcpTools.value[server.name] || [])];
  rightPanelView.value = "tools";
}

// 返回 MCP 服务列表视图
function backToServersView() {
  rightPanelView.value = "servers";
  currentToolSelectorServer.value = null;
}

// 工具选择器相关函数
const currentTools = computed(() => {
  if (!currentToolSelectorServer.value) return [];
  return serverTools.value[currentToolSelectorServer.value.name] || [];
});

const selectedToolCount = computed(() => localSelectedToolNames.value.length);
const totalToolCount = computed(() => currentTools.value.length);

const isAllToolsSelected = computed(
  () =>
    currentTools.value.length > 0 &&
    localSelectedToolNames.value.length === currentTools.value.length
);

const isIndeterminateTools = computed(
  () =>
    localSelectedToolNames.value.length > 0 &&
    localSelectedToolNames.value.length < currentTools.value.length
);

// 切换单个工具
function toggleTool(toolName: string) {
  const index = localSelectedToolNames.value.indexOf(toolName);
  if (index > -1) {
    localSelectedToolNames.value.splice(index, 1);
  } else {
    localSelectedToolNames.value.push(toolName);
  }
}

// 全选工具
function selectAllTools() {
  localSelectedToolNames.value = currentTools.value.map((tool) => tool.name);
}

// 反选工具
function invertToolSelection() {
  const allToolNames = currentTools.value.map((tool) => tool.name);
  localSelectedToolNames.value = allToolNames.filter(
    (name) => !localSelectedToolNames.value.includes(name)
  );
}

// 检查工具是否被选中
function isToolSelected(toolName: string) {
  return localSelectedToolNames.value.includes(toolName);
}

// 确认工具选择
function confirmToolSelection() {
  if (currentToolSelectorServer.value) {
    updateMcpTools(currentToolSelectorServer.value.name, [
      ...localSelectedToolNames.value,
    ]);
  }
  backToServersView();
}

// 更新某个 MCP 的选中工具
function updateMcpTools(serverName: string, toolNames: string[]) {
  if (toolNames.length === 0) {
    // 如果没有选中任何工具，删除该服务器
    delete selectedMcpTools.value[serverName];
  } else {
    // 更新选中的工具列表
    selectedMcpTools.value[serverName] = [...toolNames];
  }
}

// 获取某个 MCP 的选中工具数量
function getSelectedToolCount(serverName: string): number {
  return selectedMcpTools.value[serverName]?.length || 0;
}

// 检查某个 MCP 是否被选中（至少选中一个工具）
function isMcpSelected(serverName: string): boolean {
  return (
    selectedMcpTools.value[serverName] !== undefined &&
    selectedMcpTools.value[serverName].length > 0
  );
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
  reasoning.value = undefined;
  selectedMcpTools.value = {};
}

// 应用配置（将临时值应用到已应用的值，并 emit 给父组件）
function applyConfig() {
  // 更新已应用的值
  appliedModelId.value = tempModelId.value;
  appliedTemperature.value = temperature.value;
  appliedTopP.value = topP.value;
  appliedMaxTokens.value = maxTokens.value;
  appliedSelectedMcpTools.value = { ...selectedMcpTools.value };
  appliedReasoning.value = reasoning.value;

  // 统一导出配置对象
  emit("update:modelConfig", {
    modelId: tempModelId.value,
    temperature: temperature.value,
    topP: topP.value,
    maxTokens: maxTokens.value,
    selectedMcpTools: { ...selectedMcpTools.value },
    reasoning: reasoning.value,
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
  selectedMcpTools.value = { ...appliedSelectedMcpTools.value };
  reasoning.value = appliedReasoning.value;
  // 刷新 MCP 服务器列表和工具
  await loadServers();
}

// 当弹窗关闭时（不点击应用），恢复临时值到已应用的值
function onDropdownClose() {
  tempModelId.value = appliedModelId.value;
  temperature.value = appliedTemperature.value;
  topP.value = appliedTopP.value;
  maxTokens.value = appliedMaxTokens.value;
  selectedMcpTools.value = { ...appliedSelectedMcpTools.value };
  reasoning.value = appliedReasoning.value;
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

// 监听 props.modelConfig 的变化，同步 reasoning 等配置
watch(
  () => props.modelConfig,
  (newConfig) => {
    if (newConfig) {
      if (newConfig.reasoning !== undefined) {
        appliedReasoning.value = newConfig.reasoning;
        if (!isOpen.value) {
          reasoning.value = newConfig.reasoning;
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
      if (newConfig.selectedMcpTools !== undefined) {
        appliedSelectedMcpTools.value = { ...newConfig.selectedMcpTools };
        if (!isOpen.value) {
          selectedMcpTools.value = { ...newConfig.selectedMcpTools };
        }
      }
    }
  },
  { deep: true }
);

// 计算已选择的 MCP 服务器数量（至少选中一个工具的服务器）
const selectedMcpCount = computed(() => {
  return Object.keys(selectedMcpTools.value).filter(
    (serverName) => (selectedMcpTools.value[serverName]?.length || 0) > 0
  ).length;
});

const appliedSelectedMcpCount = computed(() => {
  return Object.keys(appliedSelectedMcpTools.value).filter(
    (serverName) => (appliedSelectedMcpTools.value[serverName]?.length || 0) > 0
  ).length;
});

// 初始化 reasoning_effort（从 props.modelConfig 或默认值）
onMounted(() => {
  // 初始化已应用的值
  appliedModelId.value = props.modelId;
  tempModelId.value = props.modelId;
  // 如果 props.modelConfig 存在，使用其值初始化
  if (props.modelConfig?.reasoning !== undefined) {
    appliedReasoning.value = props.modelConfig.reasoning;
    reasoning.value = props.modelConfig.reasoning;
  }
  if (props.modelConfig?.selectedMcpTools !== undefined) {
    appliedSelectedMcpTools.value = { ...props.modelConfig.selectedMcpTools };
    selectedMcpTools.value = { ...props.modelConfig.selectedMcpTools };
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
            MCP {{ appliedSelectedMcpCount }}
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
      style="width: 800px; max-height: 600px; overflow: hidden; display: flex"
    >
      <!-- Left Section: Config -->
      <div
        class="w-full md:w-[35%] border-r border-slate-100 flex flex-col bg-white overflow-hidden"
      >
        <div
          class="px-4 py-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between"
        >
          <h2 class="text-sm font-bold text-slate-700 flex items-center gap-1.5">
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

        <div class="flex-1 min-h-0 p-4 space-y-5 overflow-y-auto custom-scrollbar">
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
            <Dropdown
              :show="isReasoningDropdownOpen"
              :verticalFlipOnly="true"
              :viewport-padding="30"
              @update:show="isReasoningDropdownOpen = $event"
            >
              <template #trigger>
                <div class="relative w-full font-mono" @click.stop>
                  <input
                    type="text"
                    readonly
                    :value="selectedReasoningOption.label"
                    class="w-full input-base router-model-select__input pr-9 text-left cursor-pointer"
                    :class="{
                      'text-slate-400': !reasoning,
                    }"
                    placeholder="选择思考级别..."
                    @click.stop="isReasoningDropdownOpen = !isReasoningDropdownOpen"
                  />
                  <ChevronDown
                    class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 shrink-0 pointer-events-none"
                    :class="{ 'rotate-180': isReasoningDropdownOpen }"
                  />
                </div>
              </template>

              <div class="font-mono">
                <div class="overflow-y-auto p-1 flex flex-col gap-1">
                  <div
                    v-for="option in reasoningOptions"
                    :key="option.value ?? 'none'"
                    class="px-3 py-2 text-xs rounded-md cursor-pointer transition-colors"
                    :class="{
                      'bg-indigo-50 text-indigo-700 font-medium':
                        reasoning === option.value,
                      'hover:bg-slate-100 text-slate-700': reasoning !== option.value,
                    }"
                    @mousedown.prevent.stop="
                      reasoning = option.value;
                      isReasoningDropdownOpen = false;
                    "
                  >
                    <div class="font-semibold mb-0.5">{{ option.label }}</div>
                    <div
                      class="text-xs text-slate-500 leading-relaxed"
                      :class="{
                        'text-indigo-600': reasoning === option.value,
                      }"
                    >
                      {{ option.description }}
                    </div>
                  </div>
                </div>
              </div>
            </Dropdown>
          </div>

          <!-- Parameters -->
          <div class="space-y-4 pt-4 border-t border-slate-50">
            <!-- Temperature -->
            <div class="space-y-1">
              <div class="flex justify-between items-center px-0.5">
                <span class="text-xs font-bold text-slate-600">Temperature</span>
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

      <!-- Right Section: MCP Services / Tool Selector -->
      <div class="w-full md:w-[65%] flex flex-col bg-slate-50/30 overflow-hidden">
        <!-- Header: 根据视图显示不同内容 -->
        <div
          class="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center gap-4"
        >
          <!-- 工具选择器视图：显示返回按钮和服务器名称 -->
          <template v-if="rightPanelView === 'tools' && currentToolSelectorServer">
            <button
              @click="backToServersView"
              class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors shrink-0"
              title="返回"
            >
              <ArrowLeft class="w-4 h-4" />
            </button>
            <div class="shrink-0">
              <h2 class="text-sm font-bold text-slate-800">
                MCP 工具选择 - {{ currentToolSelectorServer.name }}
              </h2>
            </div>
          </template>

          <!-- MCP 服务列表视图：显示标题和搜索 -->
          <template v-else>
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
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoadingMcps }" />
            </button>

            <div
              class="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              已就绪
            </div>
          </template>
        </div>

        <!-- MCP Grid Area / Tool Selector Content -->
        <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <!-- 工具选择器视图 -->
          <div
            v-if="rightPanelView === 'tools' && currentToolSelectorServer"
            class="flex flex-col h-full"
          >
            <!-- Toolbar -->
            <div
              class="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between"
            >
              <div class="flex items-center gap-2">
                <button
                  @click="selectAllTools"
                  class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-indigo-300 transition-colors flex items-center gap-1.5"
                  :disabled="currentTools.length === 0"
                >
                  <CheckSquare v-if="isAllToolsSelected" class="w-3.5 h-3.5" />
                  <Square v-else-if="isIndeterminateTools" class="w-3.5 h-3.5" />
                  <Square v-else class="w-3.5 h-3.5" />
                  全选
                </button>
                <button
                  @click="invertToolSelection"
                  class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-indigo-300 transition-colors"
                  :disabled="currentTools.length === 0"
                >
                  反选
                </button>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-xs text-slate-600">
                  已选择:
                  <span class="font-bold text-indigo-600"
                    >{{ selectedToolCount }}/{{ totalToolCount }}</span
                  >
                </div>
                <button
                  @click="showToolDetails = !showToolDetails"
                  class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-indigo-300 transition-colors flex items-center gap-1.5"
                  :title="showToolDetails ? '隐藏详情' : '显示详情'"
                >
                  <Eye v-if="showToolDetails" class="w-3.5 h-3.5" />
                  <EyeOff v-else class="w-3.5 h-3.5" />
                  <span>{{ showToolDetails ? "隐藏详情" : "显示详情" }}</span>
                </button>
              </div>
            </div>

            <!-- Tools List -->
            <div class="flex-1 min-h-0 p-4 overflow-y-auto">
              <div
                v-if="currentTools.length === 0"
                class="text-center py-8 text-slate-400"
              >
                <p class="text-sm">暂无可用工具</p>
              </div>
              <div v-else class="space-y-2">
                <label
                  v-for="tool in currentTools"
                  :key="tool.name"
                  class="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all group"
                  :class="{
                    'border-indigo-400 bg-indigo-50/50': isToolSelected(tool.name),
                  }"
                >
                  <div class="mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      :checked="isToolSelected(tool.name)"
                      @change="toggleTool(tool.name)"
                      class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span
                        class="text-sm font-semibold text-slate-800 font-mono"
                        :class="{
                          'text-indigo-700': isToolSelected(tool.name),
                        }"
                      >
                        {{ tool.name }}
                      </span>
                    </div>
                    <p
                      v-if="showToolDetails && tool.description"
                      class="text-xs text-slate-500 leading-relaxed"
                      :class="{
                        'text-indigo-600/70': isToolSelected(tool.name),
                      }"
                    >
                      {{ tool.description }}
                    </p>
                  </div>
                  <div
                    v-if="isToolSelected(tool.name)"
                    class="shrink-0 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Check class="w-4 h-4" />
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- MCP 服务列表视图 -->
          <div v-else class="p-3">
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
                  isMcpSelected(mcp.name)
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
                      isMcpSelected(mcp.name)
                        ? 'bg-indigo-100 text-indigo-600'
                        : isServerSelectable(mcp)
                        ? 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                        : 'bg-slate-100 text-slate-300'
                    "
                  >
                    <Wrench
                      class="w-4 h-4 transition-transform"
                      :class="{
                        'rotate-12': isMcpSelected(mcp.name) && isServerSelectable(mcp),
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
                          isMcpSelected(mcp.name)
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
                        class="text-[10px] px-1 py-0.5 rounded font-mono font-bold"
                        :class="
                          isMcpSelected(mcp.name)
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-emerald-50 text-emerald-600'
                        "
                        :title="
                          isMcpSelected(mcp.name)
                            ? `已选择 ${getSelectedToolCount(mcp.name)}/${
                                (serverTools[mcp.name] || []).length
                              }`
                            : '工具数量'
                        "
                      >
                        {{
                          isMcpSelected(mcp.name)
                            ? `${getSelectedToolCount(mcp.name)}/${
                                (serverTools[mcp.name] || []).length
                              }`
                            : (serverTools[mcp.name] || []).length
                        }}
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
                        isMcpSelected(mcp.name)
                          ? 'text-indigo-500/70'
                          : isServerSelectable(mcp)
                          ? 'text-slate-400 group-hover:text-slate-500'
                          : 'text-slate-300'
                      "
                    >
                      {{ mcp.config.command || mcp.config.url || "MCP 服务" }}
                    </p>
                  </div>

                  <!-- Right Side: 默认显示小圆点（选中时），hover 时显示箭头图标 -->
                  <div class="shrink-0 mt-1">
                    <button
                      v-if="isServerSelectable(mcp)"
                      @click="openToolSelector(mcp, $event)"
                      class="relative p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                      title="选择工具"
                    >
                      <!-- 默认显示的小圆点（选中时） -->
                      <div
                        v-if="isMcpSelected(mcp.name)"
                        class="w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-indigo-200 absolute inset-0 m-auto group-hover:opacity-0 transition-opacity"
                      ></div>
                      <!-- hover 时显示的箭头图标 -->
                      <ArrowRight
                        class="w-3.5 h-3.5 absolute inset-0 m-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </button>
                    <div v-else class="opacity-50" title="无可用工具，无法选择">
                      <div class="w-2 h-2 rounded-full bg-slate-300"></div>
                    </div>
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
        </div>

        <!-- Bottom Bar -->
        <div
          class="px-4 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between"
        >
          <!-- 工具选择器视图的底部 -->
          <template v-if="rightPanelView === 'tools'">
            <div class="text-xs text-slate-500">
              已选择
              <span class="text-indigo-600 font-bold">{{ selectedToolCount }}</span>
            </div>
            <button
              @click="confirmToolSelection"
              class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded shadow-sm transition-all active:scale-95"
            >
              确认
            </button>
          </template>

          <!-- MCP 服务列表视图的底部 -->
          <template v-else>
            <div class="text-xs text-slate-500">
              已选择
              <span class="text-indigo-600 font-bold">{{ selectedMcpCount }}</span>
            </div>
            <button
              @click="applyConfig"
              class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded shadow-sm transition-all active:scale-95"
            >
              应用
            </button>
          </template>
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
