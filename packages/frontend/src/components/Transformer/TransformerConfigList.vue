<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BaseSelect, { type SelectOption } from "@/components/llm/BaseSelect.vue";
import {
  Trash2,
  Plus,
  Copy,
  ChevronDown,
  AlertTriangle,
} from "lucide-vue-next";
import ParamList from "./ParamList.vue";
import type { TransformerConfig, TransformerConfigItem } from "@/interface";

interface TransformerOption {
  name: string;
  endpoint?: string | null;
}

type FlatConfigItem = {
  id: number;
  scope: string;
  type: string;
  params: Record<string, any>;
};

type ScopeConfig = {
  scope: string;
  transformers: FlatConfigItem[];
};

type ParamKind = "string" | "number" | "boolean" | "json";

export type ParamField = {
  key: string;
  label: string;
  type: ParamKind;
  placeholder?: string;
  helper?: string;
};

type TransformerSchema = {
  params?: ParamField[];
  allowCustom?: boolean;
  description?: string;
};

const builtinTransformers = [
  "AnthropicTransformer",
  "OpenAITransformer",
  "OpenrouterTransformer",
  "GeminiTransformer",
  "VertexGeminiTransformer",
  "VertexClaudeTransformer",
  "VercelTransformer",
  "GroqTransformer",
  "DeepseekTransformer",
  "CerebrasTransformer",
  "OpenAIResponsesTransformer",
  "StreamOptionsTransformer",
  "TooluseTransformer",
  "MaxTokenTransformer",
  "MaxCompletionTokens",
  "SamplingTransformer",
  "ReasoningTransformer",
  "ForceReasoningTransformer",
  "EnhanceToolTransformer",
  "CleancacheTransformer",
  "CustomParamsTransformer",
];

// 前端显示名称到后端实际 key 的映射
const transformerNameToBackendKey: Record<string, string> = {
  "AnthropicTransformer": "Anthropic",
  "OpenAITransformer": "OpenAI",
  "OpenrouterTransformer": "openrouter",
  "GeminiTransformer": "gemini",
  "VertexGeminiTransformer": "vertex-gemini",
  "VertexClaudeTransformer": "vertex-claude",
  "VercelTransformer": "vercel",
  "GroqTransformer": "groq",
  "DeepseekTransformer": "deepseek",
  "CerebrasTransformer": "cerebras",
  "OpenAIResponsesTransformer": "openai-responses",
  "StreamOptionsTransformer": "streamoptions",
  "TooluseTransformer": "tooluse",
  "MaxTokenTransformer": "maxtoken",
  "MaxCompletionTokens": "maxcompletiontokens",
  "SamplingTransformer": "sampling",
  "ReasoningTransformer": "reasoning",
  "ForceReasoningTransformer": "forcereasoning",
  "EnhanceToolTransformer": "enhancetool",
  "CleancacheTransformer": "cleancache",
  "CustomParamsTransformer": "customparams",
};

// 后端 key 到前端显示名称的反向映射
const backendKeyToTransformerName: Record<string, string> = Object.fromEntries(
  Object.entries(transformerNameToBackendKey).map(([key, value]) => [value, key])
);


const transformerSchemas: Record<string, TransformerSchema> = {
  AnthropicTransformer: {
    params: [
      {
        key: "UseBearer",
        label: "UseBearer",
        type: "boolean",
        helper: "true 时放入 Authorization Bearer，默认 false 使用 x-api-key",
      },
    ],
  },
  OpenAITransformer: {},
  OpenrouterTransformer: {
    allowCustom: true,
    description: "可携带任意键值，合并到请求体",
  },
  GeminiTransformer: {},
  VertexGeminiTransformer: {},
  VertexClaudeTransformer: {},
  VercelTransformer: { allowCustom: true, description: "任意键值合并请求体" },
  GroqTransformer: {},
  DeepseekTransformer: {},
  CerebrasTransformer: {},
  OpenAIResponsesTransformer: {},
  StreamOptionsTransformer: {},
  TooluseTransformer: {},
  MaxTokenTransformer: {
    params: [
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number",
        placeholder: "4096",
      },
    ],
  },
  MaxCompletionTokens: {},
  SamplingTransformer: {
    params: [
      {
        key: "max_tokens",
        label: "max_tokens",
        type: "number",
        placeholder: "4096",
      },
      {
        key: "temperature",
        label: "temperature",
        type: "number",
        placeholder: "0.7",
      },
      { key: "top_p", label: "top_p", type: "number", placeholder: "0.9" },
      { key: "top_k", label: "top_k", type: "number", placeholder: "40" },
      {
        key: "repetition_penalty",
        label: "repetition_penalty",
        type: "number",
        placeholder: "1.05",
      },
    ],
  },
  ReasoningTransformer: {
    params: [
      {
        key: "enable",
        label: "enable",
        type: "boolean",
        helper: "默认 true，关闭则禁用 reasoning",
      },
    ],
  },
  ForceReasoningTransformer: {},
  EnhanceToolTransformer: {},
  CleancacheTransformer: {},
  CustomParamsTransformer: {
    allowCustom: true,
    description: "附加任意键值对对象，递归合并",
  },
};

const schemaTypeNames = computed(() => Object.keys(transformerSchemas));

// 将前端显示名称转换为后端实际 key
function toBackendKey(frontendName: string): string {
  return transformerNameToBackendKey[frontendName] || frontendName;
}

// 将后端 key 转换为前端显示名称
function toFrontendName(backendKey: string): string {
  return backendKeyToTransformerName[backendKey] || backendKey;
}

const props = defineProps<{
  modelValue?: TransformerConfig;
  models?: string[];
  options?: TransformerOption[];
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: TransformerConfig | undefined];
}>();

const scopeConfigs = ref<ScopeConfig[]>([]);
const availableModels = ref<string[]>([]);
const nextId = ref(1);
const collapsedParams = ref<Record<number, boolean>>({});
const isInternalUpdate = ref(false);

const typeOptions = computed(() => {
  const allowed = new Set([...schemaTypeNames.value, ...builtinTransformers]);
  // 将 props.options 中的后端 key 转换为前端显示名称
  const external = (props.options?.map((o) => toFrontendName(o.name)) ?? []).filter((n) =>
    allowed.has(n)
  );
  const merged = [...builtinTransformers, ...external].filter(
    (name, idx, arr) => arr.indexOf(name) === idx
  );
  return merged;
});
const hasItems = computed(() => scopeConfigs.value.length > 0);

// 检查指定作用域是否重复（完全相同的才算重复，排除 "none"）
function isScopeDuplicate(scope: string): boolean {
  if (scope === "none") return false;
  const count = scopeConfigs.value.filter(
    (config) => config.scope === scope
  ).length;
  return count > 1;
}
const scopeSelectOptions = computed<SelectOption[]>(() => [
  { label: "None", value: "none" },
  { label: "全局 (use)", value: "use" },
  ...availableModels.value.map((model) => ({
    label: `模型 (${model})`,
    value: model,
  })),
]);
const typeSelectOptions = computed<SelectOption[]>(() =>
  typeOptions.value.map((t) => ({ label: t, value: t }))
);

watch(
  () => [props.modelValue, props.models],
  () => {
    // 如果是内部更新触发的，跳过重新加载
    if (isInternalUpdate.value) {
      isInternalUpdate.value = false;
      return;
    }
    loadFromConfig(props.modelValue);
  },
  { immediate: true, deep: true }
);

function loadFromConfig(config?: TransformerConfig) {
  const scopeMap = new Map<string, FlatConfigItem[]>();
  const models = new Set<string>(props.models ?? []);
  if (config) {
    Object.keys(config).forEach((key) => {
      if (key !== "use") models.add(key);
    });
  }

  let id = 1;

  const pushItems = (scope: string, transformers?: TransformerConfigItem[]) => {
    if (!Array.isArray(transformers) || transformers.length === 0) return;
    if (!scopeMap.has(scope)) {
      scopeMap.set(scope, []);
    }
    transformers.forEach((t) => {
      const { type, params } = normalizeItem(t);
      scopeMap.get(scope)!.push({ id: id++, scope, type, params });
    });
  };

  if (config?.use && Array.isArray(config.use) && config.use.length > 0) {
    pushItems("use", config.use);
  }

  models.forEach((model) => {
    const value = config ? (config as any)[model] : undefined;
    if (Array.isArray(value) && value.length > 0) {
      pushItems(model, value);
    } else if (
      value &&
      typeof value === "object" &&
      "use" in value &&
      Array.isArray((value as any).use) &&
      (value as any).use.length > 0
    ) {
      // 对象模式也统一转换为数组模式处理
      pushItems(model, (value as any).use);
    }
  });

  availableModels.value = Array.from(models);

  // 如果没有配置项，添加一个默认的 None 作用域配置
  if (scopeMap.size === 0) {
    scopeMap.set("none", [
      {
        id: id++,
        scope: "none",
        type: "",
        params: {},
      },
    ]);
  }

  // 转换为数组格式
  scopeConfigs.value = Array.from(scopeMap.entries()).map(
    ([scope, transformers]) => ({
      scope,
      transformers,
    })
  );

  const allItems = Array.from(scopeMap.values()).flat();
  nextId.value =
    allItems.length > 0 ? Math.max(...allItems.map((i) => i.id)) + 1 : 1;

  // 保留现有的折叠状态，只为新项设置默认值
  const existingCollapsed = { ...collapsedParams.value };
  allItems.forEach((i) => {
    if (existingCollapsed[i.id] === undefined) {
      existingCollapsed[i.id] = true; // 新项默认折叠
    }
  });
  collapsedParams.value = existingCollapsed;
}

function normalizeItem(item: TransformerConfigItem): {
  type: string;
  params: Record<string, any>;
} {
  let type = "";
  let params: Record<string, any> = {};

  if (typeof item === "string") {
    type = item;
    params = {};
  } else if (Array.isArray(item)) {
    const [t, cfg] = item;
    type = t;
    params = cfg && typeof cfg === "object" ? { ...cfg } : {};
  }

  // 将后端 key 转换为前端显示名称
  type = toFrontendName(type);

  // 为固定参数创建条目（如果不存在）
  if (type) {
    const schema = getSchema(type);
    if (schema.params && schema.params.length > 0) {
      schema.params.forEach((field) => {
        if (params[field.key] === undefined) {
          // 根据类型设置合适的初始值
          if (field.type === "boolean") {
            params[field.key] = false;
          } else {
            params[field.key] = "";
          }
        }
      });
    }
  }

  return { type, params };
}

function rebuildConfig(): TransformerConfig {
  const grouped: Record<string, TransformerConfigItem[]> = {};

  scopeConfigs.value.forEach((scopeConfig) => {
    if (scopeConfig.scope === "none") return;
    const transformers: TransformerConfigItem[] = [];
    scopeConfig.transformers.forEach((item) => {
      if (!item.type.trim()) return;
      const params = sanitizeParams(item.params);
      // 将前端显示名称转换为后端 key
      const backendKey = toBackendKey(item.type.trim());
      const transformer: TransformerConfigItem =
        params && Object.keys(params).length > 0
          ? [backendKey, params]
          : backendKey;
      transformers.push(transformer);
    });
    if (transformers.length > 0) {
      grouped[scopeConfig.scope] = transformers;
    }
  });

  const result: TransformerConfig = {};
  if (grouped.use?.length) {
    result.use = grouped.use;
  }

  // 模型特定配置使用对象模式，嵌套 use 字段
  availableModels.value.forEach((model) => {
    const list = grouped[model];
    if (!list?.length) return;
    result[model] = { use: list };
  });

  return result;
}

function emitChange() {
  isInternalUpdate.value = true;
  emit("update:modelValue", rebuildConfig());
}

function addScope(scope?: string) {
  // 如果没有指定作用域，默认使用 "none"
  // 作用域允许重复，直接使用传入的作用域
  const targetScope = scope ?? "none";

  scopeConfigs.value.push({
    scope: targetScope,
    transformers: [
      {
        id: nextId.value++,
        scope: targetScope,
        type: "",
        params: {},
      },
    ],
  });
  collapsedParams.value[nextId.value - 1] = true;
  emitChange();
}

function removeScope(scope: string) {
  const idx = scopeConfigs.value.findIndex((sc) => sc.scope === scope);
  if (idx === -1) return;

  const scopeConfig = scopeConfigs.value[idx];
  if (!scopeConfig) return;

  // 删除该 scope 下所有 transformer 的 collapsed 状态
  scopeConfig.transformers.forEach((t) => {
    delete collapsedParams.value[t.id];
  });
  scopeConfigs.value.splice(idx, 1);
  // 如果删除后没有配置项，添加一个默认的 None 作用域配置
  if (scopeConfigs.value.length === 0) {
    addScope("none");
  } else {
    emitChange();
  }
}

function duplicateScope(scopeConfig: ScopeConfig) {
  // 直接使用原来的作用域名称（允许重复）
  const newScope = scopeConfig.scope;

  // 复制转换器配置
  const newTransformers = scopeConfig.transformers.map((t) => ({
    id: nextId.value++,
    scope: newScope,
    type: t.type,
    params: JSON.parse(JSON.stringify(t.params)),
  }));

  // 添加新的作用域配置
  scopeConfigs.value.push({
    scope: newScope,
    transformers: newTransformers,
  });

  // 设置折叠状态
  newTransformers.forEach((t) => {
    collapsedParams.value[t.id] = true;
  });

  emitChange();
}

function handleScopeChange(scopeConfig: ScopeConfig, value: string) {
  if (value === scopeConfig.scope) return;

  // 检查 props.modelValue 中是否有该模型的配置
  const existingConfig = props.modelValue?.[value];
  let transformersToLoad: TransformerConfigItem[] | undefined;

  // 支持数组模式和对象模式（嵌套 use）
  if (Array.isArray(existingConfig)) {
    transformersToLoad = existingConfig;
  } else if (
    existingConfig &&
    typeof existingConfig === "object" &&
    "use" in existingConfig
  ) {
    transformersToLoad = (existingConfig as any).use;
  }

  if (transformersToLoad && transformersToLoad.length > 0) {
    // 如果存在配置，加载该配置而不是使用当前配置
    const newTransformers: FlatConfigItem[] = [];

    transformersToLoad.forEach((item) => {
      const { type, params } = normalizeItem(item);
      newTransformers.push({
        id: nextId.value++,
        scope: value,
        type,
        params,
      });
    });

    // 删除旧的 transformers 的 collapsed 状态
    scopeConfig.transformers.forEach((t) => {
      delete collapsedParams.value[t.id];
    });
    // 设置新的 transformers
    scopeConfig.transformers = newTransformers;
    scopeConfig.scope = value;

    // 为新项设置默认折叠状态
    newTransformers.forEach((t) => {
      if (collapsedParams.value[t.id] === undefined) {
        collapsedParams.value[t.id] = true;
      }
    });
  } else {
    // 如果不存在配置，直接更新 scope
    scopeConfig.scope = value;
    scopeConfig.transformers.forEach((t) => {
      t.scope = value;
    });
  }
  emitChange();
}

function addTransformer(scopeConfig: ScopeConfig, afterItem?: FlatConfigItem) {
  const newItem: FlatConfigItem = {
    id: nextId.value++,
    scope: scopeConfig.scope,
    type: typeOptions.value[0] ?? "",
    params: {},
  };
  if (afterItem) {
    const idx = scopeConfig.transformers.findIndex(
      (t) => t.id === afterItem.id
    );
    if (idx !== -1) {
      scopeConfig.transformers.splice(idx + 1, 0, newItem);
    } else {
      scopeConfig.transformers.push(newItem);
    }
  } else {
    scopeConfig.transformers.push(newItem);
  }
  collapsedParams.value[newItem.id] = false;
  emitChange();
}

function removeTransformer(scopeConfig: ScopeConfig, item: FlatConfigItem) {
  const idx = scopeConfig.transformers.findIndex((t) => t.id === item.id);
  if (idx !== -1) {
    scopeConfig.transformers.splice(idx, 1);
    delete collapsedParams.value[item.id];
    // 如果该 scope 下没有转换器了，删除该 scope
    if (scopeConfig.transformers.length === 0) {
      removeScope(scopeConfig.scope);
    } else {
      emitChange();
    }
  }
}

function hasAnyParams(item: FlatConfigItem) {
  // 检查是否有固定参数定义（即使值为空也算有参数，需要显示参数输入框）
  const schema = getSchema(item.type);
  const hasFixedParams = (schema.params?.length ?? 0) > 0;

  // CustomParamsTransformer 即使没有参数也应该显示折叠按钮（因为可以添加参数）
  const isCustomParamsTransformer = item.type === "CustomParamsTransformer";

  // 检查是否有自定义参数值（只有 CustomParamsTransformer 才允许）
  const hasCustomParams =
    item.type === "CustomParamsTransformer" &&
    Object.keys(item.params || {}).some((key) => {
      // 排除固定参数的 key
      const fixedKeys = new Set(schema.params?.map((p) => p.key) ?? []);
      return (
        !fixedKeys.has(key) &&
        item.params[key] !== undefined &&
        item.params[key] !== ""
      );
    });

  return hasFixedParams || isCustomParamsTransformer || hasCustomParams;
}

function toggleParams(id: number) {
  collapsedParams.value[id] = !collapsedParams.value[id];
}

function handleTransformerTypeChange(item: FlatConfigItem, newType: string) {
  const oldType = item.type;
  const oldParams = { ...item.params }; // 保存旧参数

  if (!newType) {
    // 如果清空了类型，清空所有参数
    item.type = "";
    item.params = {};
    // 关闭折叠（因为不支持参数了）
    collapsedParams.value[item.id] = true;
    emitChange();
    return;
  }

  if (oldType === newType) {
    // 类型没变，不需要处理
    return;
  }

  item.type = newType;

  // 获取新旧转换器的 schema
  const oldSchema = getSchema(oldType);
  const newSchema = getSchema(newType);
  const oldFixedKeys = new Set(oldSchema.params?.map((p) => p.key) ?? []);
  const newFixedKeys = new Set(newSchema.params?.map((p) => p.key) ?? []);

  // 清理参数：只保留新转换器支持的固定参数和自定义参数（如果支持）
  const cleanedParams: Record<string, any> = {};

  // 1. 为新转换器的所有固定参数创建条目（即使值为空也要显示）
  if (newSchema.params && newSchema.params.length > 0) {
    newSchema.params.forEach((field) => {
      if (oldParams[field.key] !== undefined) {
        // 如果旧参数中存在，保留现有值，但可能需要类型转换
        const oldValue = oldParams[field.key];
        cleanedParams[field.key] = coerceByType(oldValue, field.type);
      } else {
        // 如果旧参数中不存在，创建空条目以便显示参数字段
        // 根据类型设置合适的初始值
        if (field.type === "boolean") {
          cleanedParams[field.key] = false;
        } else if (field.type === "number") {
          cleanedParams[field.key] = "";
        } else if (field.type === "json") {
          cleanedParams[field.key] = "";
        } else {
          // string 类型
          cleanedParams[field.key] = "";
        }
      }
    });
  }

  // 2. 如果新转换器是 CustomParamsTransformer，保留旧的自定义参数
  if (newType === "CustomParamsTransformer") {
    Object.entries(oldParams).forEach(([key, value]) => {
      // 如果这个 key 是旧的自定义参数（不在旧固定参数中，也不在新固定参数中），就保留
      const isOldCustomParam = !oldFixedKeys.has(key);
      const isNewFixedParam = newFixedKeys.has(key);

      // 如果是旧的自定义参数，且不是新的固定参数，则保留
      if (isOldCustomParam && !isNewFixedParam) {
        cleanedParams[key] = value;
      }
    });
  }
  // 3. 如果新转换器不是 CustomParamsTransformer，不保留自定义参数（上面的逻辑已经处理）

  item.params = cleanedParams;

  // 4. 设置折叠状态
  const hasParams = hasAnyParams({
    ...item,
    type: newType,
    params: cleanedParams,
  });
  if (hasParams) {
    // 如果有参数，默认展开（特别是 CustomParamsTransformer，方便用户添加参数）
    if (collapsedParams.value[item.id] === undefined) {
      collapsedParams.value[item.id] = false;
    }
  } else {
    // 如果没有参数，关闭折叠状态
    collapsedParams.value[item.id] = true;
  }

  emitChange();
}

function sanitizeParams(params: Record<string, any>) {
  const cleaned: Record<string, any> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (k.trim() === "") return;
    cleaned[k] = v;
  });
  return cleaned;
}

function getSchema(type: string): TransformerSchema {
  // 只有 CustomParamsTransformer 才允许自定义参数
  const defaultAllowCustom = type === "CustomParamsTransformer";
  return (
    transformerSchemas[type] ?? { allowCustom: defaultAllowCustom, params: [] }
  );
}

function coerceByType(value: string | boolean, kind: ParamKind) {
  if (kind === "boolean") return Boolean(value === true || value === "true");
  if (kind === "number") {
    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }
  if (kind === "json") {
    const text = String(value);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return value;
}

function getReadonlyKeys(item: FlatConfigItem): string[] {
  return getSchema(item.type).params?.map((p) => p.key) ?? [];
}
</script>

<template>
  <div class="w-full space-y-1">
    <div v-if="hasItems" class="space-y-1">
      <div
        v-for="scopeConfig in scopeConfigs"
        :key="scopeConfig.scope"
        class="rounded-md border border-slate-300 bg-white/90 transition group"
      >
        <div class="p-1.5 flex flex-col gap-1.5">
          <!-- 作用域行 -->
          <div class="flex items-center gap-0.5">
            <label class="text-xs font-medium text-slate-600 shrink-0 whitespace-nowrap"
              >作用域：</label
            >
            <div class="w-48 max-w-48">
              <BaseSelect
                class="w-full select-bordered"
                :model-value="scopeConfig.scope"
                :options="scopeSelectOptions"
                :disabled="disabled"
                :searchable="false"
                :clearable="false"
                :dropdown-min-width="220"
                placeholder="选择作用域"
                @update:model-value="(val) => handleScopeChange(scopeConfig, val as string)"
              />
            </div>
            <div
              v-if="isScopeDuplicate(scopeConfig.scope)"
              class="flex items-center gap-0.5 px-1 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 shrink-0"
              title="此作用域存在重复"
            >
              <AlertTriangle class="w-3 h-3" />
              <span class="text-[10px] font-medium">作用域重复</span>
            </div>
            <div class="flex items-center gap-0.5 flex-1 justify-end">
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-sky-600 transition rounded"
                title="复制配置"
                @click="duplicateScope(scopeConfig)"
                :disabled="disabled"
              >
                <Copy class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-sky-600 transition rounded"
                title="添加作用域"
                @click="addScope()"
                :disabled="disabled"
              >
                <Plus class="w-3 h-3" />
              </button>
              <button
                type="button"
                class="p-1 text-slate-400 hover:text-red-500 transition rounded"
                title="删除配置"
                @click="removeScope(scopeConfig.scope)"
                :disabled="disabled"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>

          <!-- 转换器列表 -->
          <div class="space-y-0.5" v-if="scopeConfig.scope !== 'none'">
            <div
              v-for="item in scopeConfig.transformers"
              :key="item.id"
              class="rounded border border-slate-200/60 bg-slate-50/40 p-1 space-y-0.5"
            >
              <!-- 模型转换名称行 -->
              <div class="flex items-center gap-0.5">
                <button
                  type="button"
                  class="p-0.5 text-slate-400 hover:text-slate-600 transition rounded shrink-0"
                  @click="toggleParams(item.id)"
                  :disabled="disabled"
                >
                  <div class="w-3 h-3">
                    <ChevronDown
                      v-if="hasAnyParams(item)"
                      class="w-full h-full transition-transform"
                      :class="collapsedParams[item.id] ? '-rotate-90' : ''"
                    />
                  </div>
                </button>
                <label
                  class="text-[10px] font-medium text-slate-500 shrink-0 whitespace-nowrap"
                  :class="{ 'cursor-pointer': hasAnyParams(item) }"
                  @click="hasAnyParams(item) && toggleParams(item.id)"
                  >转换器：</label
                >
                <div class="w-64 max-w-64">
                  <BaseSelect
                    class="w-full select-bordered"
                    :model-value="item.type"
                    :options="typeSelectOptions"
                    :placeholder="props.placeholder ?? '选择或搜索转换器'"
                    :disabled="disabled || loading"
                    :clearable="true"
                    :searchable="true"
                    :dropdown-min-width="260"
                    :dropdown-max-height="300"
                    @update:model-value="
                      (val) => handleTransformerTypeChange(item, (val as string) || '')
                    "
                  />
                </div>
                <div class="flex items-center gap-0.5 flex-1 justify-end">
                  <button
                    type="button"
                    class="p-1 text-slate-400 hover:text-sky-600 transition rounded"
                    title="添加转换器"
                    @click="addTransformer(scopeConfig, item)"
                    :disabled="disabled"
                  >
                    <Plus class="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    class="p-1 text-slate-400 hover:text-red-500 transition rounded"
                    title="删除转换器"
                    @click="removeTransformer(scopeConfig, item)"
                    :disabled="disabled"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <!-- 参数配置区域 -->
              <div
                v-if="hasAnyParams(item)"
                v-show="!collapsedParams[item.id]"
                class="p-1.5 pl-0! space-y-1 mt-0.5"
              >
                <ParamList
                  :model-value="item.params"
                  :readonly-keys="getReadonlyKeys(item)"
                  :fields="getSchema(item.type).params"
                  :transformer-type="item.type"
                  :disabled="disabled"
                  class="pl-1"
                  @update:model-value="
                    (val) => {
                      item.params = val;
                      emitChange();
                    }
                  "
                />

                <!-- 无需参数提示 -->
                <div
                  v-if="
                    !getSchema(item.type).params?.length &&
                    getSchema(item.type).allowCustom === false &&
                    Object.keys(item.params || {}).length === 0
                  "
                  class="text-[10px] text-slate-400 px-1.5 py-1 rounded bg-slate-50"
                >
                  此转换器无需参数
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-xs text-slate-400 text-center py-4 rounded-md bg-white/60">
      暂无配置项，点击"添加配置"按钮添加
    </div>
  </div>
</template>

<style scoped>
@import "@/style.css";

.btn-primary {
  @apply bg-sky-600 text-white rounded-md font-medium hover:bg-sky-700 transition disabled:opacity-60 disabled:cursor-not-allowed;
}

.select-bordered :deep(.vs__dropdown-toggle) {
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: #ffffff;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}

.select-bordered :deep(.vs__dropdown-menu) {
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(15, 23, 42, 0.1);
}

/* 下拉菜单高度限制已通过 dropdown-max-height 属性设置，无需在此处覆盖 */

/* 下拉框输入框样式 - 参考 style.css 的 .input-base */
.select-bordered :deep(input),
.select-bordered :deep(.vs__search),
.select-bordered :deep(.vs__selected) {
  width: 100% !important;
  height: 32px !important;
  min-height: 24px !important;
  padding: 0 6px !important;
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 0.5rem !important;
  font-size: 11px !important;
  line-height: 1.5 !important;
  color: #0f172a !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02) !important;
  transition: all 0.15s ease !important;
}

.select-bordered :deep(input::placeholder),
.select-bordered :deep(.vs__search::placeholder) {
  color: #94a3b8 !important;
}

.select-bordered :deep(input:focus),
.select-bordered :deep(.vs__search:focus),
.select-bordered :deep(.vs__dropdown-toggle:focus-within) {
  outline: none !important;
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
}

.select-bordered :deep(input:hover),
.select-bordered :deep(.vs__search:hover),
.select-bordered :deep(.vs__dropdown-toggle:hover) {
  outline: none !important;
  border-color: #7d7ff1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
}

.select-bordered :deep(input:disabled),
.select-bordered :deep(.vs__search:disabled) {
  background-color: #f1f5f9 !important;
  cursor: not-allowed !important;
}

/* 调整下拉框内部文字大小 */
.select-bordered :deep(.absolute.inset-y-0.left-3) {
  font-size: 11px !important;
}

/* 调整下拉框右侧图标大小 */
.select-bordered :deep(.absolute.right-2 svg),
.select-bordered :deep(.absolute.right-2 button svg) {
  width: 14px !important;
  height: 14px !important;
}
</style>
