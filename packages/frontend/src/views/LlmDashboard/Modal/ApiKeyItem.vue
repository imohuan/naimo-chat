<script setup lang="ts">
import { computed, ref } from "vue";
import {
  CloseOutlined,
  CheckCircleOutlined,
  ErrorOutlined,
  RefreshOutlined,
  PlayArrowOutlined,
} from "@vicons/material";
import { useLlmApi } from "@/hooks/useLlmApi";

export type TestStatus = "idle" | "loading" | "success" | "error";

export interface KeyTestStatus {
  status: TestStatus;
  message?: string;
}

interface Props {
  apiKey: string;
  baseUrl: string;
  models: string[];
  providerName: string; // Provider 名称，用于构建模型标识符
  disabled?: boolean; // 是否禁用测试（批量测试时）
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

const emit = defineEmits<{
  remove: [];
  "test-complete": [status: KeyTestStatus];
}>();

const { sendMessage, tempApiKey } = useLlmApi();

// 测试状态
const testStatus = ref<KeyTestStatus | null>(null);

// 是否正在测试
const isTesting = computed(() => testStatus.value?.status === "loading");

/**
 * 测试 API 密钥
 */
async function testKey() {
  if (!props.apiKey?.trim()) {
    return;
  }

  // 需要 providerName 才能测试
  if (!props.providerName?.trim()) {
    testStatus.value = {
      status: "error",
      message: "请先填写 Provider 名称",
    };
    emit("test-complete", testStatus.value);
    return;
  }

  // 需要 baseUrl 和至少一个模型才能测试
  if (!props.baseUrl?.trim()) {
    testStatus.value = {
      status: "error",
      message: "请先填写基础地址",
    };
    emit("test-complete", testStatus.value);
    return;
  }

  if (props.models.length === 0) {
    testStatus.value = {
      status: "error",
      message: "请先添加至少一个模型",
    };
    emit("test-complete", testStatus.value);
    return;
  }

  // 设置加载状态
  testStatus.value = { status: "loading" };

  try {
    // 使用第一个模型进行测试
    const testModel = props.models[0];
    if (!testModel) {
      testStatus.value = {
        status: "error",
        message: "请先添加至少一个模型",
      };
      emit("test-complete", testStatus.value);
      return;
    }

    // 构建模型标识符：provider,model
    const modelIdentifier = `${props.providerName.trim()},${testModel}`;

    const testMessages = [
      { role: "user" as const, content: "测试对话，你只需要返回数字 1" },
    ];

    // 调用 API 测试密钥，使用 tempApiKey 通过路由服务认证
    await sendMessage(
      testMessages,
      modelIdentifier, // 使用 provider,model 格式
      tempApiKey.value || undefined, // 路由服务 key（放在 header）
      props.apiKey?.trim() || undefined // 模型服务商的真实 key（放在 body）
    );

    // 测试成功
    testStatus.value = {
      status: "success",
      message: "测试成功",
    };
    emit("test-complete", testStatus.value);

    // 3 秒后清除成功状态
    setTimeout(() => {
      if (testStatus.value?.status === "success") {
        testStatus.value = null;
      }
    }, 3000);
  } catch (error) {
    // 测试失败
    const errorMessage =
      error instanceof Error ? error.message : "测试失败，请检查密钥和配置";
    testStatus.value = {
      status: "error",
      message: errorMessage,
    };
    emit("test-complete", testStatus.value);
  }
}

/**
 * 获取测试状态图标
 */
const statusIcon = computed(() => {
  if (!testStatus.value) return null;

  switch (testStatus.value.status) {
    case "loading":
      return RefreshOutlined;
    case "success":
      return CheckCircleOutlined;
    case "error":
      return ErrorOutlined;
    default:
      return null;
  }
});

/**
 * 获取测试状态颜色类
 */
const statusColorClass = computed(() => {
  if (!testStatus.value) return "";

  switch (testStatus.value.status) {
    case "loading":
      return "text-blue-500";
    case "success":
      return "text-green-500";
    case "error":
      return "text-red-500";
    default:
      return "";
  }
});

/**
 * 获取容器样式类
 */
const containerClass = computed(() => {
  const baseClass =
    "flex justify-between items-center bg-slate-50 px-2 py-1 rounded text-xs border border-slate-100 group";
  if (testStatus.value?.status === "success") {
    return `${baseClass} border-green-200 bg-green-50/50`;
  }
  if (testStatus.value?.status === "error") {
    return `${baseClass} border-red-200 bg-red-50/50`;
  }
  return baseClass;
});

// 暴露测试方法，供父组件调用
defineExpose({
  testKey,
  testStatus: computed(() => testStatus.value),
});
</script>

<template>
  <div :class="containerClass">
    <div class="flex items-center flex-1 min-w-0">
      <span class="truncate font-mono text-slate-600">{{ apiKey }}</span>
    </div>
    <div class="flex items-center gap-2 ml-2 shrink-0">
      <div
        v-if="testStatus && !isTesting"
        class="flex items-center gap-1 shrink-0"
        :class="statusColorClass"
        :title="testStatus.message"
      >
        <component
          :is="statusIcon"
          :class="['w-3 h-3', testStatus.status === 'loading' ? 'animate-spin' : '']"
        />
        <span v-if="testStatus.message" class="text-xs truncate max-w-[200px]">
          {{ testStatus.message }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <button
          class="text-slate-400 hover:text-blue-500 transition-colors"
          :disabled="isTesting || disabled"
          :title="isTesting ? '测试中...' : '测试此密钥'"
          @click="testKey"
        >
          <RefreshOutlined v-if="isTesting" class="w-3 h-3 animate-spin" />
          <PlayArrowOutlined v-else class="w-3 h-3" />
        </button>
        <button
          class="text-slate-400 hover:text-red-500 transition-colors"
          @click="emit('remove')"
          title="删除此密钥"
        >
          <CloseOutlined class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</template>
