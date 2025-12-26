<script setup lang="ts">
import { ref, watch } from "vue";
import { Plus, X, Settings } from "lucide-vue-next";
import type { TransformerConfig, TransformerConfigItem } from "@/interface";

interface Transformer {
  name: string;
  endpoint: string | null;
}

const props = defineProps<{
  modelValue: TransformerConfig | undefined;
  options: Transformer[];
  models?: string[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: TransformerConfig | undefined];
}>();

// 全局 transformer 列表
const globalTransformers = ref<TransformerConfigItem[]>([]);
// 模型特定的 transformer 配置
const modelSpecificConfigs = ref<
  Array<{ model: string; transformers: TransformerConfigItem[] }>
>([]);

// 初始化数据
function initializeData() {
  if (!props.modelValue) {
    globalTransformers.value = [];
    modelSpecificConfigs.value = [];
    return;
  }

  // 提取全局 transformer
  if (props.modelValue.use && Array.isArray(props.modelValue.use)) {
    globalTransformers.value = [...props.modelValue.use];
  } else {
    globalTransformers.value = [];
  }

  // 提取模型特定的 transformer
  const modelConfigs: Array<{
    model: string;
    transformers: TransformerConfigItem[];
  }> = [];
  if (props.models && props.modelValue) {
    props.models.forEach((model) => {
      const modelConfig = props.modelValue![model];
      if (modelConfig && typeof modelConfig === "object" && "use" in modelConfig) {
        if (Array.isArray(modelConfig.use)) {
          modelConfigs.push({
            model,
            transformers: [...modelConfig.use],
          });
        }
      }
    });
  }
  modelSpecificConfigs.value = modelConfigs;
}

// 监听 props 变化
watch(
  () => [props.modelValue, props.models],
  () => {
    initializeData();
  },
  { immediate: true, deep: true }
);

// 更新全局 transformer
function updateGlobalTransformers() {
  const config: TransformerConfig = {
    ...props.modelValue,
    use: globalTransformers.value.length > 0 ? globalTransformers.value : undefined,
  };
  emit("update:modelValue", config);
}

// 更新模型特定的 transformer
function updateModelTransformers(model: string, transformers: TransformerConfigItem[]) {
  const config: TransformerConfig = {
    ...props.modelValue,
    [model]: transformers.length > 0 ? { use: transformers } : undefined,
  };
  emit("update:modelValue", config);
}

// 添加全局 transformer
function addGlobalTransformer() {
  if (props.options.length === 0 || !props.options[0]) return;
  globalTransformers.value.push(props.options[0].name);
  updateGlobalTransformers();
}

// 移除全局 transformer
function removeGlobalTransformer(index: number) {
  globalTransformers.value.splice(index, 1);
  updateGlobalTransformers();
}

// 更新全局 transformer
function updateGlobalTransformer(index: number, value: TransformerConfigItem) {
  globalTransformers.value[index] = value;
  updateGlobalTransformers();
}

// 添加模型特定的 transformer
function addModelTransformer(model: string) {
  const config = modelSpecificConfigs.value.find((c) => c.model === model);
  if (config) {
    if (props.options.length === 0 || !props.options[0]) return;
    config.transformers.push(props.options[0].name);
    updateModelTransformers(model, config.transformers);
  } else {
    // 创建新的模型配置
    if (props.options.length === 0 || !props.options[0]) return;
    modelSpecificConfigs.value.push({
      model,
      transformers: [props.options[0].name],
    });
    updateModelTransformers(model, [props.options[0].name]);
  }
}

// 移除模型特定的 transformer
function removeModelTransformer(model: string, index: number) {
  const config = modelSpecificConfigs.value.find((c) => c.model === model);
  if (config) {
    config.transformers.splice(index, 1);
    if (config.transformers.length === 0) {
      // 移除空配置
      const idx = modelSpecificConfigs.value.findIndex((c) => c.model === model);
      if (idx !== -1) {
        modelSpecificConfigs.value.splice(idx, 1);
      }
      updateModelTransformers(model, []);
    } else {
      updateModelTransformers(model, config.transformers);
    }
  }
}

// 更新模型特定的 transformer
function updateModelTransformer(
  model: string,
  index: number,
  value: TransformerConfigItem
) {
  const config = modelSpecificConfigs.value.find((c) => c.model === model);
  if (config) {
    config.transformers[index] = value;
    updateModelTransformers(model, config.transformers);
  }
}

// 获取 transformer 名称
function getTransformerName(item: TransformerConfigItem): string {
  if (typeof item === "string") {
    return item;
  }
  if (Array.isArray(item) && typeof item[0] === "string") {
    return item[0];
  }
  return "";
}

// 获取 transformer 配置
function getTransformerConfig(
  item: TransformerConfigItem
): Record<string, any> | undefined {
  if (Array.isArray(item) && item.length > 1 && typeof item[1] === "object") {
    return item[1];
  }
  return undefined;
}

// 检查是否有配置
function hasConfig(item: TransformerConfigItem): boolean {
  return Array.isArray(item) && item.length > 1;
}

// 显示配置对话框
const showConfigDialog = ref(false);
const editingItem = ref<{
  type: "global" | "model";
  model?: string;
  index: number;
  name: string;
  config: Record<string, any> | undefined;
} | null>(null);

function openConfigDialog(
  type: "global" | "model",
  index: number,
  item: TransformerConfigItem,
  model?: string
) {
  editingItem.value = {
    type,
    model,
    index,
    name: getTransformerName(item),
    config: getTransformerConfig(item) || {},
  };
  showConfigDialog.value = true;
}

function saveConfig() {
  if (!editingItem.value) return;

  const { type, index, name, config, model } = editingItem.value;
  const newItem: TransformerConfigItem =
    Object.keys(config || {}).length > 0 ? [name, config!] : name;

  if (type === "global") {
    updateGlobalTransformer(index, newItem);
  } else if (model) {
    updateModelTransformer(model, index, newItem);
  }

  showConfigDialog.value = false;
  editingItem.value = null;
}

// 配置编辑器
const configJson = ref("");

watch(editingItem, (item) => {
  if (item) {
    configJson.value = JSON.stringify(item.config || {}, null, 2);
  }
});

function updateConfigJson() {
  if (!editingItem.value) return;
  try {
    const parsed = JSON.parse(configJson.value);
    editingItem.value.config = parsed;
  } catch (e) {
    // 忽略解析错误
  }
}
</script>

<template>
  <div class="w-full space-y-3">
    <!-- 全局 Transformer -->
    <div>
      <label class="text-xs font-medium text-slate-700 mb-1.5 block">
        全局 Transformer
      </label>
      <div class="space-y-2">
        <div
          v-for="(item, index) in globalTransformers"
          :key="index"
          class="flex items-center gap-2 p-2 bg-slate-50 rounded-md border border-slate-200"
        >
          <select
            :value="getTransformerName(item)"
            @change="
              (e) =>
                updateGlobalTransformer(
                  index,
                  (e.target as HTMLSelectElement).value
                )
            "
            class="flex-1 input-base text-sm"
            :disabled="disabled || loading"
          >
            <option value="">选择 Transformer</option>
            <option v-for="opt in options" :key="opt.name" :value="opt.name">
              {{ opt.name }}{{ opt.endpoint ? ` (${opt.endpoint})` : "" }}
            </option>
          </select>
          <button
            v-if="hasConfig(item)"
            type="button"
            @click="openConfigDialog('global', index, item)"
            class="btn-secondary px-2 py-1 text-xs"
            :disabled="disabled || loading"
            title="编辑配置"
          >
            <Settings class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="removeGlobalTransformer(index)"
            class="btn-secondary px-2 py-1 text-xs text-red-600 hover:text-red-700"
            :disabled="disabled || loading"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          type="button"
          @click="addGlobalTransformer"
          class="w-full btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"
          :disabled="disabled || loading || options.length === 0"
        >
          <Plus class="w-3.5 h-3.5" />
          添加全局 Transformer
        </button>
      </div>
    </div>

    <!-- 模型特定的 Transformer -->
    <div v-if="models && models.length > 0">
      <label class="text-xs font-medium text-slate-700 mb-1.5 block">
        模型特定 Transformer
      </label>
      <div class="space-y-3">
        <div
          v-for="model in models"
          :key="model"
          class="border border-slate-200 rounded-md p-3 bg-white"
        >
          <div class="text-xs font-medium text-slate-600 mb-2">{{ model }}</div>
          <div class="space-y-2">
            <div
              v-for="(item, index) in modelSpecificConfigs.find((c) => c.model === model)
                ?.transformers || []"
              :key="index"
              class="flex items-center gap-2"
            >
              <select
                :value="getTransformerName(item)"
                @change="
                  (e) =>
                    updateModelTransformer(
                      model,
                      index,
                      (e.target as HTMLSelectElement).value
                    )
                "
                class="flex-1 input-base text-sm"
                :disabled="disabled || loading"
              >
                <option value="">选择 Transformer</option>
                <option v-for="opt in options" :key="opt.name" :value="opt.name">
                  {{ opt.name }}{{ opt.endpoint ? ` (${opt.endpoint})` : "" }}
                </option>
              </select>
              <button
                v-if="hasConfig(item)"
                type="button"
                @click="openConfigDialog('model', index, item, model)"
                class="btn-secondary px-2 py-1 text-xs"
                :disabled="disabled || loading"
                title="编辑配置"
              >
                <Settings class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="removeModelTransformer(model, index)"
                class="btn-secondary px-2 py-1 text-xs text-red-600 hover:text-red-700"
                :disabled="disabled || loading"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              @click="addModelTransformer(model)"
              class="w-full btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"
              :disabled="disabled || loading || options.length === 0"
            >
              <Plus class="w-3.5 h-3.5" />
              为此模型添加 Transformer
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置对话框 -->
    <div
      v-if="showConfigDialog && editingItem"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      @click.self="showConfigDialog = false"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
      >
        <div class="px-6 py-4 border-b border-slate-100">
          <h3 class="font-bold text-lg text-slate-800">
            配置 Transformer: {{ editingItem.name }}
          </h3>
        </div>
        <div class="flex-1 overflow-y-auto p-6">
          <div class="space-y-4">
            <div>
              <label class="label-base">配置 JSON</label>
              <textarea
                v-model="configJson"
                @input="updateConfigJson"
                class="input-base font-mono text-sm min-h-[200px]"
                placeholder='{"key": "value"}'
              />
              <p class="text-xs text-slate-500 mt-1">
                输入 JSON 格式的配置对象，例如: {"maxTokens": 4096}
              </p>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button class="btn-secondary" @click="showConfigDialog = false">取消</button>
          <button class="btn-primary" @click="saveConfig">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import "@/style.css";
.input-base {
  @apply w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none;
}

.btn-secondary {
  @apply px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-primary {
  @apply px-4 py-2 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.label-base {
  @apply block text-sm font-medium text-slate-700 mb-1.5;
}
</style>
