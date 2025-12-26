<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useVModel } from "@vueuse/core";
import { CloseOutlined, SaveOutlined } from "@vicons/material";
import { useLlmApi } from "@/hooks/useLlmApi";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  saved: [];
}>();

const show = useVModel(props, "show", emit);
const apiKey = ref("");
const isLoading = ref(false);
const error = ref("");

// 初始化表单数据
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      // 打开时加载现有配置
      loadConfig();
      error.value = "";
    }
  }
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

const { fetchConfig, saveConfig } = useLlmApi();

async function loadConfig() {
  try {
    isLoading.value = true;
    const config = await fetchConfig();
    // 尝试从配置中获取 MCPRouter API key
    apiKey.value = config.MCPRouterApiKey || "";
  } catch (err) {
    error.value = `加载配置失败: ${(err as Error).message}`;
  } finally {
    isLoading.value = false;
  }
}

async function handleSave() {
  try {
    error.value = "";

    if (!apiKey.value.trim()) {
      error.value = "请输入 API 密钥";
      return;
    }

    isLoading.value = true;

    // 先获取当前配置
    const config = await fetchConfig();

    // 更新 MCPRouter API key
    config.MCPRouterApiKey = apiKey.value.trim();

    // 保存配置
    const result = await saveConfig(config);

    if (result.success) {
      emit("saved");
      closeModal();
    } else {
      error.value = result.message || "保存失败";
    }
  } catch (err) {
    error.value = `保存失败: ${(err as Error).message}`;
  } finally {
    isLoading.value = false;
  }
}

function closeModal() {
  show.value = false;
  error.value = "";
}
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
        @click.stop
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0"
        >
          <h3 class="font-bold text-slate-800 text-lg">配置 MCPRouter API 密钥</h3>
          <button class="btn-icon" @click="closeModal">
            <CloseOutlined class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label class="label-base">
              API 密钥 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="apiKey"
              type="password"
              class="input-base font-mono text-sm"
              placeholder="请输入 MCPRouter API 密钥"
              :disabled="isLoading"
            />
            <p class="text-xs text-slate-500 mt-2">
              请前往
              <a
                href="https://mcprouter.co/settings/keys"
                target="_blank"
                class="text-indigo-600 hover:underline"
              >
                https://mcprouter.co/settings/keys
              </a>
              获取 API 密钥
            </p>
          </div>

          <!-- 错误提示 -->
          <div
            v-if="error"
            class="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {{ error }}
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0"
        >
          <button class="btn-secondary" @click="closeModal" :disabled="isLoading">
            取消
          </button>
          <button class="btn-primary" @click="handleSave" :disabled="isLoading">
            <SaveOutlined class="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
