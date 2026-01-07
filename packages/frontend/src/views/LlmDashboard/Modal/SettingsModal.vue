<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVModel } from "@vueuse/core";
import type { HealthStatus, LlmProvider } from "@/interface";
import { useClipboardWatch } from "@/hooks/useClipboardWatch";
import { useLlmApi } from "@/hooks/useLlmApi";
import { useToasts } from "@/hooks/useToasts";
import Input from "@/components/llm/Input.vue";
import RouterModelSelect from "@/components/llm/RouterModelSelect.vue";
import {
  SettingsOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ErrorOutlined,
  SaveOutlined,
} from "@vicons/material";

const props = defineProps<{
  show: boolean;
  baseUrl: string;
  tempApiKey: string;
  healthStatus: HealthStatus | null;
  translationModel: string;
  autoTranslate: boolean;
  providers: LlmProvider[];
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  "update:baseUrl": [value: string];
  "update:tempApiKey": [value: string];
  "update:translationModel": [value: string];
  "update:autoTranslate": [value: boolean];
  save: [];
  check: [];
}>();

const show = useVModel(props, "show", emit);
const baseUrl = useVModel(props, "baseUrl", emit);
const tempApiKey = useVModel(props, "tempApiKey", emit);
const translationModel = useVModel(props, "translationModel", emit);
const autoTranslate = useVModel(props, "autoTranslate", emit);
const {
  enabled: clipboardWatchEnabled,
  status: clipboardStatus,
  loading: clipboardLoading,
  refreshStatus,
  toggle,
} = useClipboardWatch();

const { fetchConfig, saveConfig } = useLlmApi();
const { pushToast } = useToasts();
const originalTempApiKey = ref<string>("");
const isSaving = ref(false);

const allModelOptions = computed(() => {
  const options: string[] = [];
  (props.providers || []).forEach((provider) => {
    if (provider.enabled !== false && provider.models) {
      provider.models.forEach((model) => {
        options.push(`${provider.name},${model}`);
      });
    }
  });
  return options.sort();
});

onMounted(() => {
  if (show.value) {
    refreshStatus();
    // 记录打开时的原始 tempApiKey 值
    originalTempApiKey.value = props.tempApiKey;
  }
});

watch(
  () => show.value,
  (val) => {
    if (val) {
      refreshStatus();
      // 记录打开时的原始 tempApiKey 值
      originalTempApiKey.value = props.tempApiKey;
    }
  }
);

async function handleSave() {
  try {
    isSaving.value = true;

    // 如果 tempApiKey 被修改，需要同步到后台配置
    if (tempApiKey.value !== originalTempApiKey.value) {
      try {
        // 获取当前配置
        const config = await fetchConfig();
        // 更新 APIKEY 字段
        config.APIKEY = tempApiKey.value.trim();
        // 保存配置到后台
        await saveConfig(config);
      } catch (err) {
        console.error("同步 API Key 到后台失败:", err);
        pushToast(`同步 API Key 失败: ${(err as Error).message}`, "error");
        // 即使同步失败，也继续保存本地设置
      }
    }

    // 触发保存事件，让父组件保存本地设置
    emit("save");
  } catch (err) {
    pushToast(`保存失败: ${(err as Error).message}`, "error");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
      >
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"
        >
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <SettingsOutlined class="w-5 h-5" />
            <span class="text-lg">全局设置</span>
          </h3>
          <button class="btn-icon" @click="show = false">
            <CloseOutlined class="w-5 h-5" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div class="space-y-2">
            <label class="label-base">API Base URL</label>
            <input
              :value="baseUrl"
              type="text"
              class="input-base bg-slate-100 cursor-not-allowed"
              placeholder="http://127.0.0.1:3457"
              readonly
              disabled
            />
            <p class="text-xs text-slate-500">后端服务的基础地址（只读）。</p>
          </div>
          <div class="space-y-2">
            <label class="label-base">临时 API Key</label>
            <Input
              v-model="tempApiKey"
              type="password"
              :passwordToggle="true"
              placeholder="在此填入调用时使用的临时 Key"
            />
            <p class="text-xs text-slate-500">
              仅当前会话生效，发送消息时优先使用；保存在本地浏览器。
            </p>
          </div>
          <div class="space-y-2">
            <label class="label-base">翻译模型</label>
            <RouterModelSelect
              v-model="translationModel"
              :options="allModelOptions"
              placeholder="-- 请选择用于翻译的模型 --"
            />
            <p class="text-xs text-slate-500">
              选择用于翻译工具描述与参数提示的路由模型，优先使用启用中的
              Provider。
            </p>
          </div>
          <div class="space-y-2">
            <label class="label-base">自动翻译</label>
            <div
              class="flex items-center justify-between gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50/70"
            >
              <div class="text-xs text-slate-500">
                开启后，在打开工具或相关面板时自动请求翻译，关闭后需手动触发。
              </div>
              <label
                class="inline-flex items-center gap-3 cursor-pointer select-none"
              >
                <div class="relative">
                  <input
                    v-model="autoTranslate"
                    type="checkbox"
                    class="sr-only peer"
                  />
                  <div
                    class="w-12 h-6 rounded-full bg-slate-200 peer-checked:bg-primary/80 transition-colors"
                  ></div>
                  <div
                    class="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all peer-checked:translate-x-6"
                  ></div>
                </div>
              </label>
            </div>
          </div>
          <div
            v-if="false"
            class="relative p-4 rounded-xl border border-slate-300 bg-slate-50/70 flex flex-col gap-3"
          >
            <div
              class="flex flex-col gap-3 md:flex-row md:gap-4 md:items-start md:justify-between"
            >
              <div class="space-y-1 flex-1">
                <div class="flex flex-wrap items-center gap-4">
                  <label class="label-base m-0">图片剪贴板监听</label>
                  <p v-if="clipboardStatus" class="text-[11px] text-slate-400">
                    进程 PID：{{ clipboardStatus.pid ?? "无" }}
                  </p>
                </div>
                <p class="text-xs text-slate-500 pr-16">
                  后台监听剪贴板中的图片，自动保存到本地并回写路径，便于Claude
                  Code直接引用。
                </p>
              </div>
              <div class="flex items-center gap-3 md:mt-1">
                <label
                  class="inline-flex items-center gap-3 cursor-pointer select-none"
                  :class="{
                    'opacity-60 pointer-events-none': clipboardLoading,
                  }"
                >
                  <div class="relative">
                    <input
                      type="checkbox"
                      class="sr-only peer"
                      :checked="clipboardWatchEnabled"
                      :disabled="clipboardLoading"
                      @change="toggle(!clipboardWatchEnabled)"
                    />
                    <div
                      class="w-12 h-6 rounded-full bg-slate-200 peer-checked:bg-primary/80 transition-colors"
                    ></div>
                    <div
                      class="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all peer-checked:translate-x-6"
                    ></div>
                  </div>
                </label>
              </div>
            </div>

            <div class="flex gap-2">
              <div
                class="flex-1 flex items-center gap-2 text-[11px] text-slate-500 bg-white/60 border border-dashed border-slate-200 rounded-lg px-3 py-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="w-4 h-4 text-primary"
                >
                  <path d="M9 18V5l12-2v13" />
                  <path d="M9 9l12-2" />
                  <path d="M9 14l12-2" />
                  <circle cx="6" cy="18" r="3" />
                </svg>
                <span>开启后会常驻后台监听，关闭即可结束进程。</span>
              </div>

              <div
                class="min-w-24 px-2 py-2 rounded-md border flex items-center gap-2"
                :class="
                  clipboardWatchEnabled
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                "
              >
                <div class="flex-1">
                  {{ clipboardWatchEnabled ? "运行中" : "未启动" }}
                </div>
                <button
                  class="h-3 w-3 flex items-center justify-center hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="clipboardLoading"
                  @click="refreshStatus"
                  aria-label="刷新状态"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="w-4 h-4"
                  >
                    <path d="M21 2v6h-6" />
                    <path d="M3 13v-3a9 9 0 0 1 14-7.36L21 8" />
                    <path d="M3 22v-6h6" />
                    <path d="M21 11v3a9 9 0 0 1-14 7.36L3 16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="healthStatus"
            class="p-3 rounded-lg text-sm flex items-start gap-2 border"
            :class="
              healthStatus.ok
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            "
          >
            <CheckCircleOutlined
              v-if="healthStatus.ok"
              class="w-4 h-4 mt-0.5 shrink-0"
            />
            <ErrorOutlined v-else class="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p class="font-bold text-xs uppercase mb-0.5">健康检查</p>
              <p class="text-xs break-all">{{ healthStatus.msg }}</p>
            </div>
          </div>
        </div>
        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center"
        >
          <button class="btn-secondary text-xs" @click="emit('check')">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="w-4 h-4"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            测试连接
          </button>
          <div class="flex gap-3">
            <button
              class="btn-secondary"
              @click="show = false"
              :disabled="isSaving"
            >
              取消
            </button>
            <button
              class="btn-primary"
              @click="handleSave"
              :disabled="isSaving"
            >
              <SaveOutlined class="w-4 h-4" />
              {{ isSaving ? "保存中..." : "保存设置" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
