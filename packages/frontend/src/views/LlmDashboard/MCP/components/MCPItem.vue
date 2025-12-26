<script setup lang="ts">
import { computed, ref } from "vue";
import type { McpServer, McpTool } from "@/interface";
import {
  DeleteOutlined,
  BuildOutlined,
  EditOutlined,
  RefreshOutlined,
  ContentCopyOutlined,
  CheckOutlined,
} from "@vicons/material";

const props = defineProps<{
  server: McpServer;
  tools: McpTool[];
  isLoadingTools: boolean;
  isToggling?: boolean;
  isSavingConfig?: boolean;
}>();

const emit = defineEmits<{
  delete: [server: McpServer];
  toggle: [server: McpServer];
  edit: [server: McpServer];
  toolClick: [tool: McpTool];
  refresh: [server: McpServer];
}>();

const isEnabled = computed(() => props.server.config.enabled !== false);
const copyState = ref<"idle" | "copying" | "done">("idle");

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

async function handleCopyConfig() {
  if (!navigator?.clipboard || copyState.value === "copying") return;
  const payload = {
    [props.server.name]: {
      url: "{baseurl}/mcp/" + props.server.name,
    },
  };
  const text = JSON.stringify(payload, null, 2);
  try {
    copyState.value = "copying";
    await navigator.clipboard.writeText(text);
    copyState.value = "done";
  } finally {
    setTimeout(() => {
      copyState.value = "idle";
    }, 800);
  }
}
</script>

<template>
  <div
    class="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full relative"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-2 mb-2">
      <div class="flex-1 min-w-0 pr-1 flex flex-col gap-2">
        <h3 class="font-bold text-slate-800 text-sm truncate">
          {{ server.name }}
        </h3>

        <div
          class="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 truncate mt-0.5"
        >
          <span class="truncate">{{ serverDescription }}</span>
        </div>
      </div>
      <div class="flex gap-1 items-center shrink-0">
        <!-- 配置保存加载图标（始终显示） -->
        <div
          v-if="isSavingConfig"
          class="btn-icon text-slate-400 cursor-default"
          title="保存配置中..."
        >
          <RefreshOutlined class="w-4 h-4 animate-spin" />
        </div>
        <!-- 编辑和删除按钮（hover 时显示） -->
        <div
          v-if="!isSavingConfig"
          class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            class="btn-icon text-slate-400 hover:text-primary-600"
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

    <!-- Tools Section -->
    <div class="mt-2 pt-2 border-t border-slate-100">
      <div class="flex items-center justify-between mb-1.5">
        <h4 class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <BuildOutlined class="w-3 h-3" />
          工具列表
        </h4>
        <div class="flex items-center gap-1.5">
          <button
            class="btn-icon text-slate-400 hover:text-primary-600"
            title="刷新工具列表"
            @click="handleRefresh"
            :disabled="isLoadingTools"
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

      <div v-else-if="tools.length === 0" class="text-center py-4 text-slate-400 text-xs">
        暂无工具
      </div>

      <div v-else class="flex flex-wrap gap-1.5 content-start h-24 overflow-y-auto">
        <button
          v-for="tool in tools"
          :key="tool.name"
          class="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-mono cursor-pointer hover:bg-gray-100 hover:text-primary-700 transition-colors"
          :title="tool.description || tool.name"
          @click="handleToolClick(tool)"
        >
          {{ tool.name }}
        </button>
      </div>
    </div>

    <!-- Environment Variables -->
    <div
      v-if="server.config.env && Object.keys(server.config.env).length > 0"
      class="mt-2 pt-2 border-t border-slate-100"
    >
      <h4 class="text-xs font-semibold text-slate-700 mb-1">环境变量</h4>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="key in Object.keys(server.config.env)"
          :key="key"
          class="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-mono"
        >
          {{ key }}
        </span>
      </div>
    </div>

    <!-- Footer: Status Tags and Toggle -->
    <div class="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <span
          class="px-2 py-0.5 text-xs font-mono font-bold rounded"
          :class="serverTypeColor"
        >
          {{ serverTypeLabel }}
        </span>
        <span
          class="px-2 py-0.5 text-xs font-semibold rounded flex items-center gap-1"
          :class="isEnabled ? ' text-green-700' : ' text-slate-600'"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="isEnabled ? 'bg-green-500' : 'bg-slate-300'"
          ></span>
          {{ isEnabled ? "已启用" : "已禁用" }}
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="btn-icon bg-white text-slate-500 hover:text-primary-600"
          :class="[
            copyState === 'done' ? 'text-green-600 border-green-200 bg-green-50' : '',
            copyState === 'copying' ? 'opacity-80 cursor-wait' : '',
          ]"
          :disabled="copyState === 'copying'"
          title="复制 MCP 配置"
          @click="handleCopyConfig"
        >
          <component
            :is="copyState === 'done' ? CheckOutlined : ContentCopyOutlined"
            class="w-3 h-3"
            :class="{
              'animate-pulse': copyState === 'copying',
              'text-green-600': copyState === 'done',
            }"
          />
        </button>
        <button
          class="text-xs font-medium px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
          :class="[
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
