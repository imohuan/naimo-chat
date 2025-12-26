<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useVModel } from "@vueuse/core";
import { useLlmApi } from "@/hooks/useLlmApi";
import { useToasts } from "@/hooks/useToasts";
import { CloseOutlined, SaveOutlined, CodeOutlined } from "@vicons/material";
import CodeEditor from "@/components/code/CodeEditor.vue";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  saving: [];
  saved: [];
}>();

const show = useVModel(props, "show", emit);
const { endpoint } = useLlmApi();
const { pushToast } = useToasts();
const configText = ref("");
const configError = ref("");
const isSavingConfig = ref(false);
const isLoadingConfig = ref(false);

// 初始化配置数据
watch(
  () => show.value,
  async (isVisible) => {
    if (isVisible) {
      await loadConfig();
    } else {
      configError.value = "";
    }
  },
  { immediate: true }
);

// 加载配置
async function loadConfig() {
  try {
    isLoadingConfig.value = true;
    configError.value = "";
    const url = `${endpoint.value}/api/mcp/config`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`获取配置失败: ${response.statusText}`);
    }
    const config = await response.json();
    configText.value = JSON.stringify(config, null, 2);
  } catch (error) {
    configError.value = `加载配置失败: ${(error as Error).message}`;
    console.error("加载配置失败:", error);
  } finally {
    isLoadingConfig.value = false;
  }
}

// 保存配置
async function handleSave() {
  try {
    // 验证 JSON 格式
    let config: any;
    try {
      config = JSON.parse(configText.value);
    } catch (parseError) {
      configError.value = `JSON 解析失败: ${(parseError as Error).message}`;
      return;
    }

    configError.value = "";

    // 触发 saving 事件并立即关闭模态框
    emit("saving");
    closeModal();

    // 在后台执行保存操作
    isSavingConfig.value = true;
    const url = `${endpoint.value}/api/mcp/config`;
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `保存配置失败: ${response.statusText}`);
    }

    await response.json();
    emit("saved");
  } catch (error) {
    // 保存失败时显示错误提示
    pushToast(`保存配置失败: ${(error as Error).message}`, "error");
    console.error("保存配置失败:", error);
    emit("saved"); // 仍然触发 saved 事件以结束加载状态
  } finally {
    isSavingConfig.value = false;
  }
}

function closeModal() {
  show.value = false;
  configError.value = "";
}

// ESC 键关闭
function handleEscClose(event: KeyboardEvent) {
  if (event.key === "Escape" && show.value && !isSavingConfig.value) {
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
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-7xl flex flex-col h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"
        >
          <h3 class="font-bold text-lg text-slate-800 flex items-center gap-3">
            <CodeOutlined class="w-7 h-7" />
            <span>编辑 MCP 配置</span>
          </h3>
          <button class="btn-icon" @click="closeModal">
            <CloseOutlined class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden bg-slate-50 relative">
          <!-- Loading State -->
          <div
            v-if="isLoadingConfig"
            class="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-10"
          >
            <div
              class="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
            ></div>
            <span class="ml-4 text-slate-600">加载配置中...</span>
          </div>

          <!-- Editor -->
          <CodeEditor
            v-model="configText"
            language="json"
            theme="vs"
            class="w-full h-full"
          />
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-4"
        >
          <span v-if="configError" class="text-sm text-red-600 truncate">{{
            configError
          }}</span>
          <span v-else class="text-xs text-slate-500"
            >编辑完整的 MCP 配置 JSON，保存后将重载所有 MCP 连接。</span
          >
          <div class="flex gap-2">
            <button
              class="btn-secondary"
              :disabled="isSavingConfig || isLoadingConfig"
              @click="closeModal"
            >
              取消
            </button>
            <button
              class="btn-primary"
              :disabled="isSavingConfig || isLoadingConfig"
              @click="handleSave"
            >
              <SaveOutlined class="w-4 h-4" />
              {{ isSavingConfig ? "保存中..." : "保存" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
