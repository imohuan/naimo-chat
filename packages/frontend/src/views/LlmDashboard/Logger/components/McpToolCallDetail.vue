<script setup lang="ts">
import { computed } from "vue";
import { CheckCircle2, XCircle, Clock, Server, Wrench } from "lucide-vue-next";
import type { McpToolCall } from "../useMcpToolCalls";
import CodeEditor from "@/components/code/CodeEditor.vue";

const props = defineProps<{
  toolCall: McpToolCall | null;
}>();

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

const errorJson = computed(() => {
  if (!props.toolCall?.error) return "";
  return JSON.stringify(props.toolCall.error, null, 2);
});
</script>

<template>
  <div v-if="!toolCall" class="h-full flex items-center justify-center text-slate-400">
    <p class="text-sm">请选择一个工具调用查看详情</p>
  </div>
  <div v-else class="h-full flex flex-col bg-white overflow-hidden">
    <!-- 头部信息 -->
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
      <div class="space-y-3">
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
    </div>

    <!-- 详细内容 -->
    <div class="flex-1 overflow-y-auto">
      <!-- 参数 -->
      <div class="border-b border-slate-200">
        <div class="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">参数 (Arguments)</h3>
        </div>
        <div class="h-64">
          <CodeEditor :model-value="argumentsJson" language="json" :readonly="true" :options="{
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
          }" />
        </div>
      </div>

      <!-- 结果或错误 -->
      <div v-if="toolCall.success && toolCall.result" class="border-b border-slate-200">
        <div class="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">结果 (Result)</h3>
        </div>
        <div class="h-96">
          <CodeEditor :model-value="resultJson" language="json" :readonly="true" :options="{
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
          }" />
        </div>
      </div>

      <div v-if="!toolCall.success && toolCall.error" class="border-b border-slate-200">
        <div class="px-6 py-3 bg-red-50 border-b border-red-200">
          <h3 class="text-sm font-semibold text-red-700">错误信息 (Error)</h3>
        </div>
        <div class="p-6 bg-red-50/50">
          <div class="mb-4">
            <div class="text-xs text-red-600 font-medium mb-2">错误消息</div>
            <div class="p-3 bg-white border border-red-200 rounded-md text-sm text-red-700 font-mono">
              {{ toolCall.error.message }}
            </div>
          </div>
          <div v-if="toolCall.error.code" class="mb-4">
            <div class="text-xs text-red-600 font-medium mb-2">错误代码</div>
            <div class="p-3 bg-white border border-red-200 rounded-md text-sm text-red-700 font-mono">
              {{ toolCall.error.code }}
            </div>
          </div>
          <div v-if="toolCall.error.stack">
            <div class="text-xs text-red-600 font-medium mb-2">堆栈跟踪</div>
            <div class="h-64">
              <CodeEditor :model-value="toolCall.error.stack" language="plaintext" :readonly="true" :options="{
                wordWrap: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
              }" />
            </div>
          </div>
        </div>
      </div>

      <!-- 完整 JSON -->
      <div class="border-b border-slate-200">
        <div class="px-6 py-3 bg-slate-50 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-700">完整日志 (Full Log)</h3>
        </div>
        <div class="h-96">
          <CodeEditor :model-value="JSON.stringify(toolCall, null, 2)" language="json" :readonly="true" :options="{
            wordWrap: 'on',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
          }" />
        </div>
      </div>
    </div>
  </div>
</template>
