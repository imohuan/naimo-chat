<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import {
  ChevronDown,
  Sparkles,
  RotateCcw,
  Wrench,
  Sliders,
  Search,
} from "lucide-vue-next";
import RouterModelSelect from "@/components/llm/RouterModelSelect.vue";
import Dropdown from "@/components/llm/Dropdown.vue";
import { useMcpApi } from "@/hooks/useMcpApi";
import type { McpServer } from "@/interface";

const props = defineProps<{
  modelId: string;
  modelOptions: string[];
}>();

const emit = defineEmits<{
  "update:modelId": [modelId: string];
  "update:temperature": [value: number];
  "update:topP": [value: number];
  "update:maxTokens": [value: number];
  "update:selectedMcpIds": [ids: string[]];
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

// 临时配置参数（用户正在编辑的值，只有点击应用后才会生效）
const tempModelId = ref(props.modelId);
const temperature = ref(0.7);
const topP = ref(0.9);
const maxTokens = ref(4096);
const selectedMcpIds = ref<string[]>([]);

// MCP 相关
const { fetchServers } = useMcpApi();
const mcpServers = ref<McpServer[]>([]);
const isLoadingMcps = ref(false);

// 加载 MCP 服务器列表
async function loadMcpServers() {
  try {
    isLoadingMcps.value = true;
    const serversData = await fetchServers();
    mcpServers.value = Object.entries(serversData)
      .map(([name, config]) => ({
        name,
        config,
      }))
      .filter((f) => f.config.enabled !== false);
  } catch (err) {
    console.error("加载 MCP 服务器失败:", err);
  } finally {
    isLoadingMcps.value = false;
  }
}

// 过滤后的 MCP 列表
const filteredMcps = computed(() => {
  if (!searchQuery.value) return mcpServers.value;
  const q = searchQuery.value.toLowerCase();
  return mcpServers.value.filter(
    (mcp) =>
      mcp.name.toLowerCase().includes(q) ||
      (mcp.config.command || "").toLowerCase().includes(q)
  );
});

// 切换 MCP 选择（只更新临时值，不立即生效）
function toggleMcp(id: string) {
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
}

// 应用配置（将临时值应用到已应用的值，并 emit 给父组件）
function applyConfig() {
  // 更新已应用的值
  appliedModelId.value = tempModelId.value;
  appliedTemperature.value = temperature.value;
  appliedTopP.value = topP.value;
  appliedMaxTokens.value = maxTokens.value;
  appliedSelectedMcpIds.value = [...selectedMcpIds.value];

  // Emit 给父组件
  emit("update:modelId", tempModelId.value);
  emit("update:temperature", temperature.value);
  emit("update:topP", topP.value);
  emit("update:maxTokens", maxTokens.value);
  emit("update:selectedMcpIds", [...selectedMcpIds.value]);

  isOpen.value = false;
}

// 处理模型选择（只更新临时值，不立即生效）
function handleModelSelect(value: string) {
  tempModelId.value = value;
}

// 当弹窗打开时，用已应用的值初始化临时值
function onDropdownOpen() {
  tempModelId.value = appliedModelId.value;
  temperature.value = appliedTemperature.value;
  topP.value = appliedTopP.value;
  maxTokens.value = appliedMaxTokens.value;
  selectedMcpIds.value = [...appliedSelectedMcpIds.value];
}

// 当弹窗关闭时（不点击应用），恢复临时值到已应用的值
function onDropdownClose() {
  tempModelId.value = appliedModelId.value;
  temperature.value = appliedTemperature.value;
  topP.value = appliedTopP.value;
  maxTokens.value = appliedMaxTokens.value;
  selectedMcpIds.value = [...appliedSelectedMcpIds.value];
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

onMounted(() => {
  loadMcpServers();
  // 初始化已应用的值
  appliedModelId.value = props.modelId;
  tempModelId.value = props.modelId;
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
              @click="toggleMcp(mcp.name)"
              :class="[
                'p-3 rounded-lg border transition-all cursor-pointer group relative overflow-hidden',
                selectedMcpIds.includes(mcp.name)
                  ? 'border-indigo-500 bg-indigo-50/30 shadow-[0_0_0_1px_rgba(99,102,241,0.2)] hover:shadow-[0_0_0_1px_rgba(99,102,241,0.3)]'
                  : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/10 shadow-sm hover:shadow-md',
              ]"
            >
              <div class="flex items-start gap-3 relative z-10 w-full">
                <!-- Icon Container -->
                <div
                  class="shrink-0 p-2 rounded-md transition-all"
                  :class="
                    selectedMcpIds.includes(mcp.name)
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'
                  "
                >
                  <Wrench
                    class="w-4 h-4 transition-transform group-hover:rotate-12"
                    :class="{
                      'rotate-12': selectedMcpIds.includes(mcp.name),
                    }"
                  />
                </div>

                <!-- Content -->
                <div class="min-w-0 flex-1 flex flex-col gap-0.5">
                  <h4
                    class="text-sm font-semibold truncate leading-tight transition-colors"
                    :class="
                      selectedMcpIds.includes(mcp.name)
                        ? 'text-indigo-700'
                        : 'text-slate-700 group-hover:text-slate-900'
                    "
                  >
                    {{ mcp.name }}
                  </h4>
                  <p
                    class="text-xs truncate leading-tight transition-colors"
                    :class="
                      selectedMcpIds.includes(mcp.name)
                        ? 'text-indigo-500/70'
                        : 'text-slate-400 group-hover:text-slate-500'
                    "
                  >
                    {{ mcp.config.command || "MCP 服务" }}
                  </p>
                </div>

                <!-- Selection Indicator -->
                <div
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
