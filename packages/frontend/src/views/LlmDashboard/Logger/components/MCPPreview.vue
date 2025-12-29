<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import {
  CloseOutlined,
  InfoOutlined,
  CodeOutlined,
  DescriptionOutlined,
  SearchOutlined,
} from "@vicons/material";
import CodeEditor from "@/components/code/CodeEditor.vue";
import type { LogRequest } from "../types";

const props = defineProps<{
  show: boolean;
  request: LogRequest | null;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
}>();

// 提取所有工具列表
const allTools = computed(() => {
  if (!props.request) return [];

  // 首先从 request body 日志中查找
  const bodyLog = props.request.logs.find(
    (l) => l.type === "request body" && l.data
  );

  if (bodyLog && bodyLog.data.tools && Array.isArray(bodyLog.data.tools)) {
    return bodyLog.data.tools;
  }

  // 如果没有找到，尝试从其他日志中查找原始请求体
  const finalReqLog = props.request.logs.find(
    (l) => l.request && l.request.body
  );
  if (finalReqLog) {
    try {
      const parsedBody =
        typeof finalReqLog.request.body === "string"
          ? JSON.parse(finalReqLog.request.body)
          : finalReqLog.request.body;
      if (parsedBody.tools && Array.isArray(parsedBody.tools)) {
        return parsedBody.tools;
      }
    } catch (e) {
      // ignore
    }
  }

  return [];
});

// 提取 MCP 工具列表（仅以 mcp__ 开头的工具）
const mcpTools = computed(() => {
  return allTools.value.filter(
    (tool: any) => tool.name && tool.name.startsWith("mcp__")
  );
});

// 搜索关键词
const searchKeyword = ref("");

// 工具类型筛选：'all' | 'mcp' | 'base'
const toolTypeFilter = ref<"all" | "mcp" | "base">("all");

// 过滤后的工具列表
const filteredTools = computed(() => {
  let tools = allTools.value;

  // 先按类型筛选
  if (toolTypeFilter.value === "mcp") {
    tools = tools.filter((tool: any) => isMCPTool(tool.name));
  } else if (toolTypeFilter.value === "base") {
    tools = tools.filter((tool: any) => !isMCPTool(tool.name));
  }

  // 再按搜索关键词筛选
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase().trim();
    tools = tools.filter((tool: any) => {
      const toolName = formatToolName(tool.name).toLowerCase();
      const description = (tool.description || "").toLowerCase();
      const serverName = getServerName(tool.name).toLowerCase();
      return (
        toolName.includes(keyword) ||
        description.includes(keyword) ||
        serverName.includes(keyword)
      );
    });
  }

  return tools;
});

// 当前选中的工具索引（基于过滤后的列表）
const selectedToolIndex = ref<number | null>(null);

const selectedTool = computed(() => {
  if (selectedToolIndex.value === null) return null;
  return filteredTools.value[selectedToolIndex.value] || null;
});

// 当前选中的 tab
const currentDetailTab = ref<"info" | "params" | "json">("info");

// 工具属性
const toolProperties = computed(() => {
  if (!selectedTool.value) return {};
  // 同时支持 inputSchema (驼峰) 和 input_schema (下划线) 两种格式
  const schema =
    selectedTool.value.inputSchema ||
    (selectedTool.value as any).input_schema ||
    selectedTool.value.annotations;
  return schema?.properties || {};
});

const toolRequired = computed(() => {
  if (!selectedTool.value) return [];
  // 同时支持 inputSchema (驼峰) 和 input_schema (下划线) 两种格式
  const schema =
    selectedTool.value.inputSchema ||
    (selectedTool.value as any).input_schema ||
    selectedTool.value.annotations;
  return schema?.required || [];
});

// 格式化工具名称（移除 mcp__ 前缀）
function formatToolName(name: string): string {
  if (name.startsWith("mcp__")) {
    return name.substring(5);
  }
  return name;
}

// 判断是否是 MCP 工具
function isMCPTool(toolName: string | undefined): boolean {
  return !!(toolName && toolName.startsWith("mcp__"));
}

// 获取工具所属的服务器名称（从工具名称中提取）
function getServerName(toolName: string): string {
  if (!toolName.startsWith("mcp__")) return "基础工具";
  const parts = toolName.substring(5).split("__");
  return parts[0] || "Unknown";
}

// 格式化 JSON
function formatJson(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

function closeModal() {
  emit("update:show", false);
  selectedToolIndex.value = null;
  currentDetailTab.value = "info";
  searchKeyword.value = "";
  toolTypeFilter.value = "all";
}

// 点击背景关闭
function handleBackdropClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("modal-backdrop")) {
    closeModal();
  }
}

// ESC 键关闭
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.show) {
    closeModal();
  }
}

// 监听 ESC 键
onMounted(() => {
  document.addEventListener("keydown", handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeyDown);
});

// 监听搜索关键词变化，如果当前选中的工具不在过滤结果中，清除选中状态
watch(
  () => filteredTools.value,
  () => {
    if (
      selectedToolIndex.value !== null &&
      selectedToolIndex.value >= filteredTools.value.length
    ) {
      selectedToolIndex.value = null;
    }
    // 如果有工具列表且当前没有选中任何工具，默认选中第一个
    if (filteredTools.value.length > 0 && selectedToolIndex.value === null) {
      selectedToolIndex.value = 0;
    }
  }
);

// 监听弹窗显示状态，当弹窗打开时自动选中第一个工具
watch(
  () => props.show,
  (newVal) => {
    if (newVal && filteredTools.value.length > 0) {
      selectedToolIndex.value = 0;
    }
  }
);
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="modal-backdrop fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click="handleBackdropClick"
    >
      <div
        class="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
        @click.stop
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0"
        >
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <InfoOutlined class="w-5 h-5" />
            <span class="text-lg">工具预览</span>
            <span class="text-sm font-normal text-slate-600 ml-2">
              ({{ filteredTools.length }}/{{ allTools.length }} 个工具
              <span v-if="mcpTools.length > 0"
                >，{{ mcpTools.length }} 个 MCP</span
              >)
            </span>
          </h3>
          <button class="btn-icon" @click="closeModal">
            <CloseOutlined class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden flex">
          <!-- 左侧工具列表 -->
          <div
            class="w-80 border-r border-slate-100 bg-slate-50 overflow-hidden flex flex-col shrink-0"
          >
            <!-- 搜索框和筛选器 -->
            <div class="p-4 border-b border-slate-200 shrink-0 space-y-3">
              <div class="relative">
                <SearchOutlined
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                />
                <input
                  v-model="searchKeyword"
                  type="text"
                  placeholder="搜索工具..."
                  class="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <!-- 类型筛选按钮 -->
              <div class="flex gap-2">
                <button
                  @click="toolTypeFilter = 'all'"
                  class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                  :class="
                    toolTypeFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  "
                >
                  全部 ({{ allTools.length }})
                </button>
                <button
                  @click="toolTypeFilter = 'mcp'"
                  class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                  :class="
                    toolTypeFilter === 'mcp'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white text-purple-600 border border-purple-200 hover:bg-purple-50'
                  "
                >
                  MCP ({{ mcpTools.length }})
                </button>
                <button
                  @click="toolTypeFilter = 'base'"
                  class="flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                  :class="
                    toolTypeFilter === 'base'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                  "
                >
                  基础 ({{ allTools.length - mcpTools.length }})
                </button>
              </div>
            </div>

            <!-- 工具列表 -->
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
              <div
                v-for="(tool, index) in filteredTools"
                :key="index"
                class="p-4 rounded-lg cursor-pointer transition-all border relative overflow-hidden"
                :class="
                  selectedToolIndex === index
                    ? 'bg-white border-slate-300 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                "
                @click="selectedToolIndex = index as number"
              >
                <!-- 右上角标签 -->
                <div
                  class="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none"
                >
                  <span
                    class="absolute top-3 -right-1/2 w-32 text-center text-[11px] px-3 py-1 font-bold transform rotate-45 origin-center whitespace-nowrap"
                    :class="
                      isMCPTool(tool.name)
                        ? 'bg-purple-200 text-purple-800'
                        : 'bg-blue-200 text-blue-800'
                    "
                  >
                    {{ isMCPTool(tool.name) ? "MCP" : "基础" }}
                  </span>
                </div>
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="mb-1">
                      <div
                        class="font-mono text-sm font-bold text-slate-800 truncate"
                        :title="formatToolName(tool.name)"
                      >
                        {{ formatToolName(tool.name) }}
                      </div>
                    </div>
                    <div
                      class="text-xs text-slate-500 mt-1 line-clamp-2"
                      v-if="tool.description"
                    >
                      {{ tool.description }}
                    </div>
                    <div class="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono"
                      >
                        {{ getServerName(tool.name) }}
                      </span>
                      <span
                        v-if="
                          tool.inputSchema?.properties ||
                          (tool as any).input_schema?.properties ||
                          tool.annotations?.properties
                        "
                        class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                      >
                        {{
                          Object.keys(
                            tool.inputSchema?.properties ||
                              (tool as any).input_schema?.properties ||
                              tool.annotations?.properties ||
                              {}
                          ).length
                        }}
                        个参数
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="filteredTools.length === 0"
                class="text-center py-8 text-slate-400 text-sm"
              >
                {{ searchKeyword.trim() ? "未找到匹配的工具" : "未找到工具" }}
              </div>
            </div>
          </div>

          <!-- 右侧工具详情 -->
          <div class="flex-1 overflow-hidden flex flex-col p-6">
            <div
              v-if="selectedToolIndex === null"
              class="flex-1 flex items-center justify-center"
            >
              <div class="text-center">
                <InfoOutlined class="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p class="text-slate-500 text-lg">选择一个工具查看详情</p>
              </div>
            </div>

            <div
              v-else-if="selectedTool"
              class="flex-1 overflow-hidden flex flex-col"
            >
              <!-- Tab 导航 -->
              <nav
                class="flex items-center gap-6 border-b border-slate-200 mb-4 shrink-0"
              >
                <button
                  class="px-1 py-3 text-sm font-medium transition-all flex items-center gap-2 relative -mb-px"
                  :class="
                    currentDetailTab === 'info'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
                  "
                  @click="currentDetailTab = 'info'"
                >
                  <InfoOutlined class="w-4 h-4" />
                  基本信息
                </button>
                <button
                  v-if="Object.keys(toolProperties).length > 0"
                  class="px-1 py-3 text-sm font-medium transition-all flex items-center gap-2 relative -mb-px"
                  :class="
                    currentDetailTab === 'params'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
                  "
                  @click="currentDetailTab = 'params'"
                >
                  <DescriptionOutlined class="w-4 h-4" />
                  参数定义
                </button>
                <button
                  class="px-1 py-3 text-sm font-medium transition-all flex items-center gap-2 relative -mb-px"
                  :class="
                    currentDetailTab === 'json'
                      ? 'text-primary border-b-2 border-primary'
                      : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
                  "
                  @click="currentDetailTab = 'json'"
                >
                  <CodeOutlined class="w-4 h-4" />
                  完整 JSON
                </button>
              </nav>

              <!-- Tab 内容 -->
              <div class="flex-1 overflow-hidden flex flex-col">
                <!-- 基本信息 Tab -->
                <div
                  v-if="currentDetailTab === 'info'"
                  class="flex-1 overflow-y-auto"
                >
                  <div class="space-y-3">
                    <div class="flex items-center gap-2 mb-3">
                      <span
                        class="text-xs px-3 py-1 rounded font-bold"
                        :class="
                          isMCPTool(selectedTool.name)
                            ? 'bg-purple-200 text-purple-800'
                            : 'bg-blue-200 text-blue-800'
                        "
                      >
                        {{
                          isMCPTool(selectedTool.name) ? "MCP 工具" : "基础工具"
                        }}
                      </span>
                    </div>
                    <div>
                      <div class="text-xs text-slate-500 mb-1">工具名称</div>
                      <div class="font-mono text-sm font-bold text-slate-800">
                        {{ formatToolName(selectedTool.name) }}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-slate-500 mb-1">完整名称</div>
                      <div class="font-mono text-sm text-slate-700">
                        {{ selectedTool.name }}
                      </div>
                    </div>
                    <div>
                      <div class="text-xs text-slate-500 mb-1">所属服务器</div>
                      <div class="text-sm text-slate-700">
                        {{ getServerName(selectedTool.name) }}
                      </div>
                    </div>
                    <div v-if="selectedTool.description">
                      <div class="text-xs text-slate-500 mb-1">描述</div>
                      <div class="text-sm text-slate-700 whitespace-pre-wrap">
                        {{ selectedTool.description }}
                      </div>
                    </div>
                    <div
                      v-if="Object.keys(toolProperties).length === 0"
                      class="mt-4 pt-4"
                    >
                      <p class="text-slate-500 text-sm text-center">
                        此工具不需要参数
                      </p>
                    </div>
                  </div>
                </div>

                <!-- 参数定义 Tab -->
                <div
                  v-if="
                    currentDetailTab === 'params' &&
                    Object.keys(toolProperties).length > 0
                  "
                  class="flex-1 overflow-y-auto"
                >
                  <div class="space-y-4">
                    <div
                      v-for="(prop, key) in toolProperties"
                      :key="key"
                      class="p-4"
                    >
                      <div class="flex items-center gap-2 mb-2">
                        <span
                          class="font-mono text-sm font-bold text-slate-800"
                        >
                          {{ key }}
                        </span>
                        <span
                          v-if="toolRequired.includes(key)"
                          class="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold"
                        >
                          必填
                        </span>
                        <span
                          v-if="prop.type"
                          class="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono"
                        >
                          {{ prop.type }}
                        </span>
                      </div>
                      <div
                        v-if="prop.description"
                        class="text-sm text-slate-600 mb-2"
                      >
                        {{ prop.description }}
                      </div>
                      <div v-if="prop.enum" class="text-xs text-slate-500 mb-1">
                        可选值:
                        <span class="font-mono">
                          {{ prop.enum.join(", ") }}
                        </span>
                      </div>
                      <div
                        v-if="prop.default !== undefined"
                        class="text-xs text-slate-500"
                      >
                        默认值:
                        <span class="font-mono text-slate-700">
                          {{ formatJson(prop.default) }}
                        </span>
                      </div>
                      <details v-if="Object.keys(prop).length > 5" class="mt-2">
                        <summary
                          class="text-xs text-slate-500 cursor-pointer hover:text-slate-700"
                        >
                          查看完整定义
                        </summary>
                        <pre
                          class="mt-2 text-xs font-mono p-2 overflow-x-auto"
                          >{{ formatJson(prop) }}</pre
                        >
                      </details>
                    </div>
                  </div>
                </div>

                <!-- 完整 JSON Tab -->
                <div
                  v-if="currentDetailTab === 'json'"
                  class="flex-1 min-h-0 flex flex-col"
                >
                  <div class="overflow-hidden flex-1 min-h-0">
                    <CodeEditor
                      class="h-full"
                      :model-value="formatJson(selectedTool)"
                      language="json"
                      :readonly="true"
                      :options="{
                        wordWrap: 'on',
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12,
                        lineNumbers: 'on',
                      }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.animate-in {
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
