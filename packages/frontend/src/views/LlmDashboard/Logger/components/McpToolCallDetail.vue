<script setup lang="ts">
import { computed, ref } from "vue";
import { CheckCircle2, XCircle, Clock, Server, Wrench } from "lucide-vue-next";
import type { McpToolCall } from "../useMcpToolCalls";
import CodeEditor from "@/components/code/CodeEditor.vue";

const props = defineProps<{
  toolCall: McpToolCall | null;
}>();

const activeTab = ref<"overview" | "result">("overview");

const formattedDate = computed(() => {
  if (!props.toolCall) return "";
  return new Date(props.toolCall.timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
});

const formattedDuration = computed(() => {
  if (!props.toolCall) return "";
  const ms = props.toolCall.duration;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
});

const argumentsJson = computed(() => {
  if (!props.toolCall) return "";
  return JSON.stringify(props.toolCall.arguments, null, 2);
});

const resultJson = computed(() => {
  if (!props.toolCall) return "";
  return JSON.stringify(props.toolCall.result, null, 2);
});

const fullLogJson = computed(() => {
  if (!props.toolCall) return "";
  return JSON.stringify(props.toolCall, null, 2);
});
</script>

<template>
  <div v-if="!toolCall" class="h-full flex items-center justify-center text-slate-400 bg-white">
    <p class="text-sm">请选择一个工具调用查看详情</p>
  </div>
  <div v-else class="h-full w-full flex flex-col bg-white overflow-hidden">
    <!-- Tab 切换 -->
    <div class="flex border-b border-slate-200 bg-slate-50">
      <button @click="activeTab = 'overview'" :class="[
        'px-6 py-3 text-sm font-medium transition-colors relative',
        activeTab === 'overview'
          ? 'text-indigo-600 bg-white'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
      ]">
        <span>概览</span>
        <div v-if="activeTab === 'overview'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
      </button>
      <button @click="activeTab = 'result'" :class="[
        'px-6 py-3 text-sm font-medium transition-colors relative',
        activeTab === 'result'
          ? 'text-indigo-600 bg-white'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
      ]">
        <span>完整日志</span>
        <div v-if="activeTab === 'result'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>
      </button>
    </div>

    <!-- Tab 内容 -->
    <div class="flex-1 overflow-hidden">
      <!-- 概览 Tab -->
      <div v-show="activeTab === 'overview'" class="h-full flex flex-col">
        <!-- 上半部分：状态和基本信息 -->
        <div class="p-6 border-b border-slate-200 bg-slate-50">
          <!-- 状态标识 -->
          <div class="flex items-center gap-3 mb-4">
            <div :class="[
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
              toolCall.success
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700',
            ]">
              <CheckCircle2 v-if="toolCall.success" class="w-5 h-5" />
              <XCircle v-else class="w-5 h-5" />
              <span>{{ toolCall.success ? "执行成功" : "执行失败" }}</span>
            </div>
            <div class="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 text-blue-700 font-medium">
              <Clock class="w-4 h-4" />
              <span>{{ formattedDuration }}</span>
            </div>
          </div>

          <!-- 基本信息 -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex items-start gap-3">
              <Wrench class="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-xs text-slate-500 mb-1">工具名称</div>
                <div class="font-mono text-sm font-bold text-slate-800 wrap-break-word">
                  {{ toolCall.toolName }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <Server class="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-xs text-slate-500 mb-1">服务器</div>
                <div class="font-mono text-sm text-slate-700">
                  {{ toolCall.serverName }}
                </div>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <Clock class="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-xs text-slate-500 mb-1">执行时间</div>
                <div class="text-sm text-slate-700">{{ formattedDate }}</div>
              </div>
            </div>

            <div v-if="toolCall.sessionId" class="flex items-start gap-3">
              <div class="w-5 h-5 shrink-0"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs text-slate-500 mb-1">会话 ID</div>
                <div class="font-mono text-xs text-slate-600 truncate" :title="toolCall.sessionId">
                  {{ toolCall.sessionId }}
                </div>
              </div>
            </div>
          </div>

          <!-- 错误信息（如果有） -->
          <div v-if="!toolCall.success && toolCall.error" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="text-xs text-red-600 font-medium mb-2">错误信息</div>
            <div class="text-sm text-red-700 font-mono mb-2">
              {{ toolCall.error.message }}
            </div>
            <div v-if="toolCall.error.code" class="text-xs text-red-600">
              错误代码: <span class="font-mono">{{ toolCall.error.code }}</span>
            </div>
          </div>
        </div>

        <!-- 下半部分：参数和结果 -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <!-- 参数 (flex-1) -->
          <div class="flex-1 flex flex-col border-b border-slate-200">
            <div class="px-6 py-3 bg-slate-50 border-b border-slate-200">
              <h3 class="text-sm font-semibold text-slate-700">参数 (Arguments)</h3>
            </div>
            <div class="flex-1">
              <CodeEditor :model-value="argumentsJson" language="json" :readonly="true" :options="{
                wordWrap: 'on',
                minimap: { enabled: false },
                lineNumbers: 'on',
              }" />
            </div>
          </div>

          <!-- 结果 (flex-[3]) -->
          <div class="flex-[3] flex flex-col">
            <!-- 成功时显示结果 -->
            <template v-if="toolCall.success && toolCall.result">
              <div class="px-6 py-3 bg-slate-50 border-b border-slate-200">
                <h3 class="text-sm font-semibold text-slate-700">结果 (Result)</h3>
              </div>
              <div class="flex-1">
                <CodeEditor :model-value="resultJson" language="json" :readonly="true" :options="{
                  wordWrap: 'on',
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                }" />
              </div>
            </template>

            <!-- 失败时显示错误堆栈 -->
            <template v-else-if="!toolCall.success && toolCall.error?.stack">
              <div class="px-6 py-3 bg-red-50 border-b border-red-200">
                <h3 class="text-sm font-semibold text-red-700">堆栈跟踪 (Stack Trace)</h3>
              </div>
              <div class="flex-1">
                <CodeEditor :model-value="toolCall.error.stack" language="plaintext" :readonly="true" :options="{
                  wordWrap: 'on',
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                }" />
              </div>
            </template>

            <!-- 没有结果或错误堆栈时显示空状态 -->
            <template v-else>
              <div class="flex-1 flex items-center justify-center text-slate-400">
                <p class="text-sm">无结果数据</p>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 完整日志 Tab -->
      <div v-show="activeTab === 'result'" class="h-full">
        <CodeEditor :model-value="fullLogJson" language="json" :readonly="true" :options="{
          wordWrap: 'on',
          minimap: { enabled: false },
          lineNumbers: 'on',
        }" />
      </div>
    </div>
  </div>
</template>
