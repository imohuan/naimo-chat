<script setup lang="ts">
import { computed } from "vue";
import type { McpServer, McpTool } from "@/interface";
import {
  DeleteOutlined,
  BuildOutlined,
  EditOutlined,
  RefreshOutlined,
} from "@vicons/material";

const props = withDefaults(
  defineProps<{
    server: McpServer;
    tools: McpTool[];
    isLoadingTools: boolean;
    isToggling?: boolean;
    isSavingConfig?: boolean;
    showTools?: boolean;
    compact?: boolean;
  }>(),
  {
    showTools: false,
    compact: false,
  }
);

const emit = defineEmits<{
  delete: [server: McpServer];
  toggle: [server: McpServer];
  edit: [server: McpServer];
  toolClick: [tool: McpTool];
  refresh: [server: McpServer];
}>();

const isEnabled = computed(() => props.server.config.enabled !== false);

const serverType = computed(() => {
  if (props.server.config.command) return "stdio";
  if (props.server.config.url) {
    return props.server.config.type || "sse";
  }
  return "unknown";
});

const serverTypeLabel = computed(() => {
  const type = serverType.value;
  if (type === "stdio") return "STDIO";
  if (type === "sse") return "SSE";
  if (type === "streamable-http") return "HTTP";
  return "未知";
});

const serverTypeColor = computed(() => {
  const type = serverType.value;
  if (type === "stdio") return "bg-blue-100 text-blue-700";
  if (type === "sse") return "bg-green-100 text-green-700";
  if (type === "streamable-http") return "bg-purple-100 text-purple-700";
  return "bg-slate-100 text-slate-700";
});

const serverDescription = computed(() => {
  const config = props.server.config;
  if (config.command) {
    return `${config.command} ${(config.args || []).join(" ")}`;
  }
  if (config.url) {
    return config.url;
  }
  return "无描述";
});

function handleToggle() {
  emit("toggle", props.server);
}

function handleDelete() {
  emit("delete", props.server);
}

function handleEdit() {
  emit("edit", props.server);
}

function handleToolClick(tool: McpTool) {
  emit("toolClick", tool);
}

function handleRefresh() {
  emit("refresh", props.server);
}
</script>

<template>
  <div
    class="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
    :class="compact ? 'px-4 pb-2 pt-4' : 'p-4'"
  >
    <div class="flex items-start" :class="compact ? 'gap-3' : 'gap-4'">
      <!-- 左侧：服务器信息 -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between" :class="compact ? 'mb-2' : 'mb-3'">
          <div class="flex items-center flex-1 min-w-0" :class="compact ? 'gap-2' : 'gap-3'">
            <h3 class="font-bold text-slate-800 truncate" :class="compact ? 'text-sm' : 'text-base'">
              {{ server.name }}
            </h3>
            <span
              class="text-xs font-mono font-bold rounded shrink-0"
              :class="[
                compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
                serverTypeColor
              ]"
            >
              {{ serverTypeLabel }}
            </span>
            <span
              class="text-xs font-semibold rounded flex items-center gap-1 shrink-0"
              :class="[
                compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5',
                isEnabled ? 'text-green-700' : 'text-slate-600'
              ]"
            >
              <span
                class="w-2 h-2 rounded-full"
                :class="isEnabled ? 'bg-green-500' : 'bg-slate-300'"
              ></span>
              {{ isEnabled ? "已启用" : "已禁用" }}
            </span>
          </div>
          <div class="flex gap-2 items-center shrink-0">
            <div
              v-if="isSavingConfig"
              class="btn-icon text-slate-400 cursor-default"
              title="保存配置中..."
            >
              <RefreshOutlined class="w-4 h-4 animate-spin" />
            </div>
            <div
              v-else
              class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                class="btn-icon text-slate-400 hover:text-indigo-600"
                title="编辑"
                @click="handleEdit"
              >
                <EditOutlined class="w-4 h-4" />
              </button>
              <button
                class="btn-icon text-slate-400 hover:text-red-600"
                title="删除"
                @click="handleDelete"
              >
                <DeleteOutlined class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div
          v-if="!compact"
          class="text-sm text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mb-3"
        >
          {{ serverDescription }}
        </div>
      </div>

      <!-- 中间：工具列表 -->
      <div v-if="showTools" class="w-96 shrink-0">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <BuildOutlined class="w-3 h-3" />
            工具列表
          </h4>
          <div class="flex items-center gap-2">
            <button
              class="btn-icon text-slate-400 hover:text-indigo-600"
              title="刷新工具列表"
              :disabled="isLoadingTools"
              @click="handleRefresh"
            >
              <RefreshOutlined
                class="w-3 h-3"
                :class="{ 'animate-spin': isLoadingTools }"
              />
            </button>
            <span class="text-xs text-slate-500">{{ tools.length }} 个工具</span>
          </div>
        </div>
        <div
          v-if="isLoadingTools && tools.length === 0"
          class="text-center py-4 text-slate-400 text-xs"
        >
          加载工具列表中...
        </div>
        <div
          v-else-if="tools.length === 0"
          class="text-center py-4 text-slate-400 text-xs"
        >
          暂无工具
        </div>
        <div v-else class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          <button
            v-for="tool in tools"
            :key="tool.name"
            class="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-mono cursor-pointer hover:bg-gray-100 hover:text-indigo-700 transition-colors"
            :title="tool.description || tool.name"
            @click="handleToolClick(tool)"
          >
            {{ tool.name }}
          </button>
        </div>
      </div>

      <!-- 最右侧：操作按钮 -->
      <div class="flex flex-col gap-2 shrink-0">
        <button
          class="text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
          :class="[
            compact ? 'px-2 py-1' : 'px-3 py-1.5',
            isEnabled
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-green-50 text-green-600 hover:bg-green-100',
            isToggling ? 'opacity-70 cursor-not-allowed pointer-events-none' : '',
          ]"
          :disabled="isToggling"
          @click="handleToggle"
        >
          <RefreshOutlined v-if="isToggling" class="w-3 h-3 animate-spin" />
          <span>{{ isEnabled ? "禁用" : "启用" }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
