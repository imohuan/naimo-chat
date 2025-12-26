<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useVModel } from "@vueuse/core";
import type { McpServer, McpServerConfig } from "@/interface";
import { CloseOutlined, SaveOutlined } from "@vicons/material";
import CodeEditor from "@/components/code/CodeEditor.vue";

const props = defineProps<{
  show: boolean;
  server: McpServer | null; // null 表示新建模式
  defaultName?: string;
  defaultConfig?: McpServerConfig | null;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  save: [name: string, config: McpServerConfig];
}>();

const show = useVModel(props, "show", emit);
const serverName = ref("");
const jsonText = ref("");
const jsonError = ref("");

const isEditing = computed(() => props.server !== null);

// 初始化表单数据
watch(
  () => [props.show, props.server] as [boolean, McpServer | null],
  ([newShow, newServer]) => {
    if (newShow) {
      if (newServer) {
        // 编辑模式
        serverName.value = newServer.name;
        jsonText.value = JSON.stringify(newServer.config, null, 2);
      } else {
        // 新建模式，支持外部默认值
        serverName.value = props.defaultName || "";
        const fallbackConfig = {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-fetch"],
          env: {},
        };
        const configToUse = props.defaultConfig || fallbackConfig;
        jsonText.value = JSON.stringify(configToUse, null, 2);
      }
      jsonError.value = "";
    }
  },
  { immediate: true }
);

function handleEscClose(event: KeyboardEvent) {
  if (event.key === "Escape" && show.value) {
    closeModal();
  }
}

watch(
  () => show.value,
  (isVisible) => {
    if (isVisible) {
      window.addEventListener("keydown", handleEscClose);
    } else {
      window.removeEventListener("keydown", handleEscClose);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleEscClose);
});

function handleSave() {
  try {
    // 验证名称
    if (!isEditing.value && !serverName.value.trim()) {
      jsonError.value = "请填写服务器名称";
      return;
    }

    // 解析 JSON
    let config: McpServerConfig;
    try {
      config = JSON.parse(jsonText.value);
    } catch (parseError) {
      jsonError.value = `JSON 解析失败: ${(parseError as Error).message}`;
      return;
    }

    // 验证配置
    if (!config.command && !config.url) {
      jsonError.value = "配置必须包含 command 或 url 字段";
      return;
    }

    jsonError.value = "";
    emit("save", isEditing.value ? props.server!.name : serverName.value.trim(), config);
  } catch (error) {
    jsonError.value = (error as Error).message;
  }
}

function closeModal() {
  show.value = false;
  jsonError.value = "";
}
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
        @click.stop
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0"
        >
          <h3 class="font-bold text-slate-800 text-lg">
            {{ isEditing ? "编辑服务器" : "新建服务器" }}
          </h3>
          <button class="btn-icon" @click="closeModal">
            <CloseOutlined class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- 服务器名称（仅新建模式） -->
          <div v-if="!isEditing">
            <label class="label-base">
              服务器名称 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="serverName"
              type="text"
              class="input-base"
              placeholder="例如: my-mcp-server"
            />
          </div>

          <!-- 服务器名称（编辑模式，只读） -->
          <div v-else>
            <label class="label-base">服务器名称</label>
            <div class="input-base bg-slate-100 text-slate-600 cursor-not-allowed">
              {{ serverName }}
            </div>
          </div>

          <!-- JSON 编辑器 -->
          <div class="flex flex-col">
            <label class="label-base mb-2">
              服务配置 (JSON) <span class="text-red-500">*</span>
            </label>
            <div
              class="border border-slate-200 rounded-lg overflow-hidden"
              style="height: 400px"
            >
              <CodeEditor
                v-model="jsonText"
                language="json"
                theme="vs"
                class="w-full h-full"
              />
            </div>
            <p class="text-xs text-slate-500 mt-2">
              直接编辑 JSON 配置，使用 Shift+Alt+F 格式化（或右键菜单）
            </p>
          </div>

          <!-- 错误提示 -->
          <div
            v-if="jsonError"
            class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {{ jsonError }}
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0"
        >
          <button class="btn-secondary" @click="closeModal" :disabled="props.isSaving">
            取消
          </button>
          <button class="btn-primary" :disabled="props.isSaving" @click="handleSave">
            <template v-if="props.isSaving">
              <span
                class="inline-block w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin"
              ></span>
              <span class="ml-2">保存中...</span>
            </template>
            <template v-else>
              <SaveOutlined class="w-4 h-4" />
              保存
            </template>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
