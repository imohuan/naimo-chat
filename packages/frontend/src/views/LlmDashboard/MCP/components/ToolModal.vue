<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import BaseSelect from "@/components/llm/BaseSelect.vue";
import { useVModel, useLocalStorage } from "@vueuse/core";
import type { McpTool } from "@/interface";
import { CloseOutlined, PlayArrowOutlined, AutorenewOutlined } from "@vicons/material";
import { useLlmApi } from "@/hooks/useLlmApi";
import { TaskQueue } from "@/lib/taskQueue";
import type { ChatMessage } from "@/interface";
import { useToasts } from "@/hooks/useToasts";

const props = defineProps<{
  show: boolean;
  tool: McpTool | null;
  serverName: string;
  executionResult?: any;
  executionError?: string | null;
  isExecuting?: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  execute: [tool: McpTool, args: Record<string, any>];
}>();

const show = useVModel(props, "show", emit);
const toolArgs = ref<Record<string, any>>({});
const translatedData = ref<{
  name?: string;
  description?: string;
  props: Record<
    string,
    {
      label?: string;
      description?: string;
      placeholder?: string;
    }
  >;
} | null>(null);
const isTranslating = ref(false);
const translateError = ref<string | null>(null);
const showTranslation = ref(false);
const translateProgress = ref({ completed: 0, total: 0 });
const lastAutoTranslateToolId = ref<string | null>(null);
const translateRunId = ref<string | null>(null);
const translatingFields = ref<Set<string>>(new Set());

function isFieldLoading(id: string): boolean {
  return isTranslating.value && translatingFields.value.has(id);
}

const { pushToast } = useToasts();

// 获取翻译相关的 API
const { sendMessage, translationModel, tempApiKey, autoTranslate } = useLlmApi();
// 并发数量配置（可以根据需要调整）
const TRANSLATE_CONCURRENCY = 5;

// 翻译缓存：使用文本内容的 hash 作为 key
// 格式: { [textHash]: translatedText }
const translationCache = useLocalStorage<Record<string, string>>(
  "mcp_tool_translation_cache",
  {}
);

/**
 * 生成文本的缓存 key（使用简单 hash）
 */
function getTextCacheKey(text: string): string {
  // 使用文本内容作为 key，添加前缀以避免冲突
  return `text_${text}`;
}

/**
 * 从缓存获取翻译结果
 */
function getCachedTranslation(text: string): string | null {
  const key = getTextCacheKey(text);
  return translationCache.value[key] || null;
}

/**
 * 将翻译结果存入缓存
 */
function setCachedTranslation(text: string, translated: string): void {
  const key = getTextCacheKey(text);
  translationCache.value[key] = translated;
}

// 获取工具的参数定义
const toolProperties = computed(() => {
  if (!props.tool) return {};
  const schema = props.tool.inputSchema || props.tool.annotations;
  return schema?.properties || {};
});

const toolRequired = computed(() => {
  if (!props.tool) return [];
  const schema = props.tool.inputSchema || props.tool.annotations;
  return schema?.required || [];
});

const translatedProps = computed(() =>
  showTranslation.value ? translatedData.value?.props || {} : {}
);
const displayName = computed(() => props.tool?.name || "");
const displayDescription = computed(() =>
  showTranslation.value
    ? translatedData.value?.description || props.tool?.description || ""
    : props.tool?.description || ""
);

// 初始化参数值
watch(
  () => props.tool,
  (tool) => {
    translatedData.value = null;
    translateError.value = null;
    isTranslating.value = false;
    showTranslation.value = false;
    translateRunId.value = null;
    translatingFields.value = new Set();
    // 重置自动翻译追踪，确保新工具可以触发自动翻译
    lastAutoTranslateToolId.value = null;

    if (tool && show.value) {
      toolArgs.value = {};

      // 根据属性定义初始化默认值
      const properties = toolProperties.value;
      Object.keys(properties).forEach((key) => {
        const prop = properties[key];
        // 仅在 schema 提供了明确的默认值时赋值，避免额外注入默认值
        if (prop.default !== undefined) {
          toolArgs.value[key] = prop.default;
        }
      });
    }
  },
  { immediate: true }
);

// 监听工具和显示状态的组合，自动触发翻译（首次打开也触发）
watch(
  [
    () => props.tool?.name,
    () => show.value,
    () => autoTranslate.value,
    () => translationModel.value,
  ],
  ([toolName, isVisible, autoTrans, model]) => {
    const currentToolId = toolName || null;

    const shouldTrigger =
      isVisible &&
      currentToolId &&
      autoTrans &&
      model &&
      !isTranslating.value &&
      currentToolId !== lastAutoTranslateToolId.value;

    if (shouldTrigger) {
      lastAutoTranslateToolId.value = currentToolId;
      // 直接触发，保证首次打开也能自动翻译
      handleTranslate();
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

function resolvePlaceholder(key: string, prop: any) {
  if (showTranslation.value) {
    const translated = translatedProps.value[key]?.placeholder;
    if (translated) return translated;
  }

  if (prop.type === "array") return `["item1", "item2"]`;
  if (prop.type === "object") return `{"key": "value"}`;
  return prop.description || key;
}

/**
 * 使用 LLM API 翻译文本（带缓存）
 */
async function translateText(
  text: string | null | undefined,
  model: string,
  apiKey?: string
): Promise<string> {
  if (!text || !text.trim()) {
    return text || "";
  }

  // 先检查缓存
  const cached = getCachedTranslation(text);
  if (cached) {
    return cached;
  }

  if (!model) {
    throw new Error("未配置翻译模型，请在设置中配置翻译模型");
  }

  const messages: ChatMessage[] = [
    {
      role: "user",
      content: `请将以下文本内容翻译成中文，只返回翻译结果，不要添加任何解释或前缀：\n\n${text}`,
    },
  ];

  const response = await sendMessage(
    messages,
    model,
    tempApiKey.value || undefined,
    apiKey
  );

  const translated = response.content.trim() || text;

  // 存入缓存
  setCachedTranslation(text, translated);

  return translated;
}

async function handleTranslate() {
  if (!props.tool) return;
  if (isTranslating.value) return;
  // 已有翻译结果时支持原文/译文切换
  if (translatedData.value) {
    showTranslation.value = !showTranslation.value;
    return;
  }
  // 执行翻译
  await executeTranslate();
}

async function executeTranslate() {
  // 检查是否配置了翻译模型
  if (!translationModel.value) {
    const message = "未配置翻译模型，请在设置中配置翻译模型";
    translateError.value = message;
    pushToast(message, "error");
    return;
  }
  if (!props.tool) {
    const message = "当前无可翻译的工具";
    translateError.value = message;
    pushToast(message, "error");
    return;
  }

  isTranslating.value = true;
  translateError.value = null;
  translateProgress.value = { completed: 0, total: 0 };
  translateRunId.value = `${Date.now()}_${props.tool.name}`;
  translatingFields.value = new Set();
  // 预置译文容器，便于单任务完成后实时更新 UI
  translatedData.value = {
    name: props.tool.name,
    description: props.tool.description,
    props: {},
  };
  showTranslation.value = true;

  try {
    const properties = toolProperties.value;
    const entries = Object.entries(properties);

    // 创建任务队列
    const resultMap = new Map<string, string>();
    const translatedPropsMap: Record<
      string,
      { label?: string; description?: string; placeholder?: string }
    > = {};

    const applyTaskResult = (id: string, value?: string) => {
      if (!props.tool) return;
      if (!translateRunId.value || translateRunId.value !== currentRunId) return;
      if (value) {
        resultMap.set(id, value);
      }
      translatingFields.value.delete(id);

      // 更新描述
      const updatedDescription = resultMap.get("description") ?? props.tool.description;

      // 更新属性译文，按 key 颗粒度实时刷新
      for (const [key] of entries) {
        const translatedKey = resultMap.get(`prop_key_${key}`) || key;
        const translatedDesc =
          resultMap.get(`prop_desc_${key}`) || properties[key].description;
        translatedPropsMap[key] = {
          label: translatedKey,
          description: translatedDesc,
          placeholder: translatedDesc || translatedKey || key,
        };
      }

      translatedData.value = {
        name: props.tool.name,
        description: updatedDescription,
        props: { ...translatedPropsMap },
      };
    };

    const queue = new TaskQueue<string>({
      concurrency: TRANSLATE_CONCURRENCY,
      onProgress: (completed, total) => {
        translateProgress.value = { completed, total };
      },
      onTaskComplete: (result) => {
        if (!result.success) {
          const message = result.error?.message || "翻译过程中出现错误";
          translateError.value = message;
          pushToast(message, "error");
          translatingFields.value.delete(String(result.id));
          return;
        }
        applyTaskResult(String(result.id), result.result);
      },
    });
    const currentRunId = translateRunId.value;

    // 逐个添加任务到队列
    const tool = props.tool;

    // 工具描述
    if (tool.description && tool.description.trim()) {
      translatingFields.value.add("description");
      queue.addTask({
        id: "description",
        executor: () =>
          translateText(tool.description, translationModel.value, undefined),
      });
    }

    // 属性相关的文本
    for (const [key, prop] of entries) {
      // 属性描述
      if (prop.description && prop.description.trim()) {
        const desc = prop.description;
        translatingFields.value.add(`prop_desc_${key}`);
        queue.addTask({
          id: `prop_desc_${key}`,
          executor: () => translateText(desc, translationModel.value, undefined),
        });
      }
    }

    // 等待所有任务完成；此时译文已在 onTaskComplete 中逐步更新
    await queue.waitAll();
  } catch (error: any) {
    const message = error?.message || "翻译失败，请稍后重试";
    translateError.value = message;
    pushToast(message, "error");
  } finally {
    isTranslating.value = false;
    translateProgress.value = { completed: 0, total: 0 };
  }
}

function handleExecute() {
  if (!props.tool) return;

  // 只传递有值的参数
  const args: Record<string, any> = {};
  Object.keys(toolArgs.value).forEach((key) => {
    const value = toolArgs.value[key];
    if (value !== null && value !== undefined && value !== "") {
      args[key] = value;
    }
  });

  emit("execute", props.tool, args);
}

function closeModal() {
  show.value = false;
}
</script>

<template>
  <transition name="fade">
    <div
      v-if="show && tool"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
        @click.stop
      >
        <button
          class="btn-icon absolute right-3 top-3 bg-white/80 hover:bg-white"
          @click="closeModal"
        >
          <CloseOutlined class="w-5 h-5" />
        </button>

        <!-- Header -->
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0"
        >
          <div>
            <h3 class="font-bold text-slate-800 text-lg">
              工具
              <span
                class="text-slate-500 text-base font-mono ml-2 px-2 py-1 rounded bg-gray-200"
                >{{ displayName || "未命名工具" }}</span
              >
            </h3>
            <p v-if="displayDescription" class="text-sm text-slate-500 mt-1">
              <span
                :class="{
                  'loading-dots': isTranslating && isFieldLoading('description'),
                }"
              >
                {{ displayDescription }}
              </span>
            </p>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- 参数输入 -->
          <div v-if="Object.keys(toolProperties).length > 0">
            <h4 class="text-sm font-semibold text-slate-700 mb-4">参数</h4>
            <div class="space-y-4">
              <div v-for="(prop, key) in toolProperties" :key="key" class="space-y-2">
                <label class="label-base flex items-center gap-2">
                  <span class="flex items-center gap-1">
                    <span>{{ key }}</span>
                  </span>
                  <span v-if="toolRequired.includes(key)" class="text-red-500 text-xs">
                    *
                  </span>
                </label>
                <p
                  v-if="
                    (showTranslation && translatedProps[key]?.description) ||
                    prop.description
                  "
                  class="text-xs text-slate-500 -mt-1"
                  :class="{
                    'loading-dots':
                      isTranslating &&
                      (isFieldLoading(`prop_desc_${key}`) ||
                        isFieldLoading(`prop_key_${key}`)),
                  }"
                >
                  {{
                    showTranslation
                      ? translatedProps[key]?.description || prop.description
                      : prop.description
                  }}
                </p>

                <!-- 字符串输入 -->
                <input
                  v-if="prop.type === 'string' && !prop.enum"
                  v-model="toolArgs[key]"
                  type="text"
                  class="input-base"
                  :placeholder="resolvePlaceholder(key, prop)"
                />

                <!-- 枚举选择 -->
                <BaseSelect
                  v-else-if="prop.type === 'string' && prop.enum"
                  class="w-full"
                  :model-value="toolArgs[key]"
                  :options="prop.enum.map((option: string | number) => ({ label: String(option), value: option }))"
                  placeholder="请选择..."
                  :searchable="false"
                  :clearable="false"
                  @update:model-value="(val) => (toolArgs[key] = val)"
                />

                <!-- 数字输入 -->
                <input
                  v-else-if="prop.type === 'number'"
                  v-model.number="toolArgs[key]"
                  type="number"
                  class="input-base"
                  :placeholder="resolvePlaceholder(key, prop)"
                />

                <!-- 布尔值 -->
                <label
                  v-else-if="prop.type === 'boolean'"
                  class="inline-flex items-center gap-3 cursor-pointer"
                >
                  <input
                    v-model="toolArgs[key]"
                    type="checkbox"
                    class="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span class="text-sm text-slate-700">
                    {{ translatedProps[key]?.description || prop.description || key }}
                  </span>
                </label>

                <!-- 数组输入（JSON） -->
                <textarea
                  v-else-if="prop.type === 'array'"
                  v-model="toolArgs[key]"
                  class="input-base font-mono text-sm"
                  rows="3"
                  :placeholder="resolvePlaceholder(key, prop)"
                />

                <!-- 对象输入（JSON） -->
                <textarea
                  v-else-if="prop.type === 'object'"
                  v-model="toolArgs[key]"
                  class="input-base font-mono text-sm"
                  rows="5"
                  :placeholder="resolvePlaceholder(key, prop)"
                />

                <!-- 默认文本输入 -->
                <input
                  v-else
                  v-model="toolArgs[key]"
                  type="text"
                  class="input-base"
                  :placeholder="resolvePlaceholder(key, prop)"
                />
              </div>
            </div>
          </div>

          <div v-else class="text-sm text-slate-500 text-center py-8">
            此工具不需要参数
          </div>

          <!-- 执行结果 -->
          <div v-if="props.executionResult || props.executionError">
            <h4 class="text-sm font-semibold text-slate-700 mb-4">执行结果</h4>
            <div
              v-if="props.executionError"
              class="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-mono whitespace-pre-wrap"
            >
              {{ props.executionError }}
            </div>
            <div
              v-else-if="props.executionResult"
              class="p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-sm font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
            >
              {{ JSON.stringify(props.executionResult, null, 2) }}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center shrink-0"
        >
          <button class="btn-secondary" @click="closeModal">关闭</button>
          <div class="flex items-center gap-3">
            <button
              class="btn-secondary"
              :disabled="isTranslating || props.isExecuting"
              @click="handleTranslate"
            >
              <AutorenewOutlined v-if="isTranslating" class="w-4 h-4 animate-spin" />
              <span v-else class="w-4 h-4 inline-flex items-center justify-center">
                {{ showTranslation ? "原" : "译" }}
              </span>
              {{
                isTranslating
                  ? `翻译中 (${translateProgress.completed}/${translateProgress.total})`
                  : showTranslation
                  ? "查看原文"
                  : "翻译"
              }}
            </button>
            <button
              class="btn-primary"
              :disabled="props.isExecuting"
              @click="handleExecute"
            >
              <AutorenewOutlined v-if="props.isExecuting" class="w-4 h-4 animate-spin" />
              <PlayArrowOutlined v-else class="w-4 h-4" />
              {{ props.isExecuting ? "执行中..." : "执行" }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.loading-dots::after {
  content: " ...";
  animation: dots 1.2s steps(3, end) infinite;
}

@keyframes dots {
  0% {
    content: " .";
  }
  33% {
    content: " ..";
  }
  66% {
    content: " ...";
  }
  100% {
    content: " ...";
  }
}
</style>
