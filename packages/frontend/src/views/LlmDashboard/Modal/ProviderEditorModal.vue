<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { useVModel } from "@vueuse/core";
import {
  AddOutlined,
  SaveOutlined,
  RefreshOutlined,
  PlayArrowOutlined,
} from "@vicons/material";
import Input from "@/components/llm/Input.vue";
import CodeEditor from "@/components/code/CodeEditor.vue";
import ModelListSelector from "@/components/llm/ModelListSelector.vue";
import ApiKeyItem from "./ApiKeyItem.vue";
import TransformerConfigList from "@/components/Transformer/TransformerConfigList.vue";
import { useLlmApi } from "@/hooks/useLlmApi";
import { useLlmDashboardStore } from "@/stores/llmDashboard";
import { useToasts } from "@/hooks/useToasts";

import type { TransformerConfig } from "@/interface";

interface ProviderForm {
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeys: string[];
  models: string[];
  limit: number;
  transformer?: TransformerConfig;
}

const props = defineProps<{
  show: boolean;
  isEditing: boolean;
  editorTab: "form" | "json";
  form: ProviderForm;
  newArrayKey: string;
  jsonPreview: string;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  "update:editorTab": ["form" | "json"];
  "update:form": [ProviderForm];
  "update:newArrayKey": [string];
  "update:jsonPreview": [string];
  addKey: [];
  removeKey: [index: number];
  save: [];
  close: [];
}>();

const show = useVModel(props, "show", emit);
const editorTab = useVModel(props, "editorTab", emit);
const form = useVModel(props, "form", emit, { deep: true });
const newArrayKey = useVModel(props, "newArrayKey", emit);
const jsonPreview = useVModel(props, "jsonPreview", emit);

// API Key Item 组件的引用
const apiKeyItemRefs = ref<(InstanceType<typeof ApiKeyItem> | null)[]>([]);
const isBatchTesting = ref(false);

// Store 和 Toasts
const store = useLlmDashboardStore();
const { pushToast } = useToasts();

// Transformers 相关
const { fetchTransformers: fetchTransformersApi } = useLlmApi();
const transformers = ref<Array<{ name: string; endpoint: string | null }>>([]);
const isLoadingTransformers = ref(false);

// 获取 transformers 列表
async function fetchTransformers() {
  isLoadingTransformers.value = true;
  try {
    transformers.value = await fetchTransformersApi();
  } finally {
    isLoadingTransformers.value = false;
  }
}

const primaryApiKey = computed(() => {
  // 编辑时只操作 apiKeys，apiKey 统一使用占位符，所以只从 apiKeys 获取
  const apiKeys = form.value.apiKeys || [];
  const validKey = apiKeys.find((k) => k?.trim());
  return validKey?.trim() || "";
});

watch(show, (newVal) => {
  if (!newVal) {
    isBatchTesting.value = false;
  } else {
    // 当模态框显示时，获取 transformers 列表
    // fetchTransformers();
  }
});

onMounted(() => {
  // 组件挂载时也获取一次 transformers 列表
  if (show.value) {
    // fetchTransformers();
  }
});

/**
 * 批量测试所有 API 密钥
 */
async function testAllApiKeys() {
  const apiKeys = form.value.apiKeys || [];
  if (apiKeys.length === 0) {
    return;
  }

  // 需要 baseUrl 和至少一个模型才能测试
  if (!form.value.baseUrl?.trim() || form.value.models.length === 0) {
    return;
  }

  // 先执行保存（使用与保存按钮相同的逻辑，但不关闭模态框）
  try {
    const payload = store.providerFromForm();
    if (!payload.name || !payload.baseUrl || (payload.models || []).length === 0) {
      pushToast("请完善 Provider 信息", "error");
      return;
    }
    await store.saveProvider(payload, props.isEditing);
    pushToast("保存成功，开始测试密钥...", "success");
  } catch (err) {
    pushToast((err as Error).message, "error");
    return;
  }

  isBatchTesting.value = true;

  // 并发测试所有密钥
  const testPromises = apiKeyItemRefs.value
    .filter((item): item is InstanceType<typeof ApiKeyItem> => item !== null)
    .map((item) => item.testKey());
  await Promise.all(testPromises);

  isBatchTesting.value = false;
}
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"
        >
          <h3 class="font-bold text-lg text-slate-800">
            {{ isEditing ? "编辑 Provider" : "新增 Provider" }}
          </h3>
          <div class="bg-slate-100 p-1 rounded-lg flex text-xs font-medium">
            <button
              class="px-3 py-1 rounded transition-all"
              :class="
                editorTab === 'form'
                  ? 'bg-white shadow text-primary-600'
                  : 'text-slate-500 hover:text-slate-700'
              "
              @click="editorTab = 'form'"
            >
              表单配置
            </button>
            <button
              class="px-3 py-1 rounded transition-all"
              :class="
                editorTab === 'json'
                  ? 'bg-white shadow text-primary-600'
                  : 'text-slate-500 hover:text-slate-700'
              "
              @click="editorTab = 'json'"
            >
              JSON 源码
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-hidden relative bg-slate-50">
          <div v-show="editorTab === 'form'" class="h-full overflow-y-auto p-6 space-y-5">
            <div class="grid grid-cols-2 gap-5">
              <div class="col-span-2 sm:col-span-1">
                <label class="label-base"
                  >名称 (ID) <span class="text-red-500">*</span></label
                >
                <Input
                  v-model="form.name"
                  type="text"
                  :disabled="isEditing"
                  placeholder="例如: openai"
                />
              </div>
              <div class="col-span-2 sm:col-span-1">
                <label class="label-base">速率限制</label>
                <Input
                  :model-value="form.limit.toString()"
                  @update:model-value="form.limit = Number($event) || 0"
                  type="number"
                  placeholder="0 (无限制)"
                />
              </div>
            </div>

            <div>
              <label class="label-base"
                >基础地址 <span class="text-red-500">*</span></label
              >
              <Input
                v-model="form.baseUrl"
                type="text"
                placeholder="https://api.example.com"
              />
            </div>

            <div>
              <label class="label-base"
                >API 密钥 <span class="text-red-500">*</span></label
              >
              <div class="flex gap-2 mb-2">
                <Input
                  v-model="newArrayKey"
                  type="text"
                  placeholder="添加 Key（可多个，至少 1 个）..."
                  class="text-xs flex-1"
                  @keydown.enter.prevent="emit('addKey')"
                />
                <button class="btn-secondary px-3" @click="emit('addKey')">
                  <AddOutlined class="w-4 h-4" />
                </button>
                <button
                  class="btn-secondary px-3"
                  :disabled="form.apiKeys.length === 0 || isBatchTesting"
                  @click="testAllApiKeys"
                  :title="isBatchTesting ? '正在批量测试...' : '批量测试所有密钥'"
                >
                  <RefreshOutlined v-if="isBatchTesting" class="w-4 h-4 animate-spin" />
                  <PlayArrowOutlined v-else class="w-4 h-4" />
                </button>
              </div>
              <div
                class="bg-white border border-slate-200 rounded-md p-2 space-y-1 max-h-32 overflow-y-auto"
              >
                <ApiKeyItem
                  v-for="(k, i) in form.apiKeys"
                  :key="i + k"
                  :ref="(el: any) => {
                    if (el) {
                      apiKeyItemRefs[i] = el as InstanceType<typeof ApiKeyItem>;
                    } else {
                      apiKeyItemRefs[i] = null;
                    }
                  }"
                  :api-key="k"
                  :base-url="form.baseUrl"
                  :models="form.models"
                  :provider-name="form.name || ''"
                  :disabled="isBatchTesting"
                  @remove="emit('removeKey', i)"
                />
                <div
                  v-if="form.apiKeys.length === 0"
                  class="text-center text-xs text-slate-400 py-2"
                >
                  暂无 Key，请先添加
                </div>
              </div>
            </div>

            <div>
              <label class="label-base"
                >模型列表 <span class="text-red-500">*</span></label
              >
              <ModelListSelector
                v-model="form.models"
                :base-url="form.baseUrl"
                :api-key="primaryApiKey"
                placeholder="输入或选择模型，回车添加"
              />
              <p class="text-xs text-slate-500 mt-2">
                支持从接口拉取模型，也可直接输入后回车添加，自动去重。
              </p>
            </div>

            <div>
              <label class="label-base">Transformer 转换器</label>
              <TransformerConfigList
                v-model="form.transformer"
                :options="transformers"
                :models="form.models"
                :loading="isLoadingTransformers"
                :disabled="isLoadingTransformers"
                placeholder="选择或输入 Transformer"
              />
              <p class="text-xs text-slate-500 mt-2">
                配置全局和模型特定的请求/响应转换器（可选）。
              </p>
            </div>
          </div>

          <div v-show="editorTab === 'json'" class="h-full flex flex-col">
            <CodeEditor
              v-model="jsonPreview"
              language="json"
              theme="vs"
              class="flex-1 w-full h-full"
            />
          </div>
        </div>

        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3"
        >
          <button class="btn-secondary" @click="emit('close')">取消</button>
          <button class="btn-primary" @click="emit('save')">
            <SaveOutlined class="w-4 h-4" /> 保存配置
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>
