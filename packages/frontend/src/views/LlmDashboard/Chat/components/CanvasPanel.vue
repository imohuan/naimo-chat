<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { X } from "lucide-vue-next";
import { ImmersiveCode } from "@/components/immersive-code";
import type { CodeHistory } from "@/views/LlmDashboard/Chat/types";

const props = defineProps<{
  show: boolean;
  readonly?: boolean;
  codeHistory?: CodeHistory;
  codeVersion?: number; // codeHistory 的版本号，用于判断 codeHistory 是否已加载
}>();

const emit = defineEmits<{
  "update:show": [show: boolean];
  error: [message: string];
  "element-selected": [selector: string, data?: any];
  "ctrl-i-pressed": [
    data: {
      code: string;
      startLine: number;
      endLine: number;
      fileName?: string;
    }
  ];
  "diff-exited": [code: string, recordId?: string];
}>();

const immersiveCodeRef = ref<InstanceType<typeof ImmersiveCode> | null>(null);

// 监听 codeVersion 和 codeHistory 的变化，恢复代码历史
watch(
  () => [props.codeVersion, props.codeHistory] as const,
  async ([codeVersion, codeHistory]) => {
    // 只有当 codeVersion 存在（表示已加载）且有 codeHistory 数据时才处理
    if (codeVersion === undefined || !codeHistory || !immersiveCodeRef.value) return;

    // 检查 codeHistory 是否有 versions
    const hasCodeHistory = codeHistory.versions && codeHistory.versions.length > 0;

    if (hasCodeHistory) {
      try {
        await nextTick();
        immersiveCodeRef.value.setHistory(codeHistory);
        await nextTick();
      } catch (error) {
        console.error("恢复代码历史失败:", error);
        emit("error", error instanceof Error ? error.message : "恢复代码历史失败");
      }
    }
  },
  { immediate: true, deep: true }
);

// 监听组件挂载，如果当前有代码历史，自动恢复
watch(
  immersiveCodeRef,
  async (newRef, oldRef) => {
    // 只在组件从 null 变为非 null 时执行（组件刚挂载）
    if (!newRef || oldRef !== null) return;

    // 只有当 codeVersion 存在（表示已加载）且有 codeHistory 数据时才处理
    if (props.codeVersion === undefined || !props.codeHistory) return;

    const hasCodeHistory =
      props.codeHistory.versions && props.codeHistory.versions.length > 0;

    if (!hasCodeHistory) return;

    // 组件挂载后，恢复代码历史
    try {
      await nextTick();
      newRef.setHistory(props.codeHistory);
      await nextTick();
    } catch (error) {
      console.error("恢复代码历史失败:", error);
      emit("error", error instanceof Error ? error.message : "恢复代码历史失败");
    }
  },
  { immediate: false }
);

function handleError(message: string) {
  emit("error", message);
}

function handleElementSelected(selector: string, data?: any) {
  emit("element-selected", selector, data);
}

function handleCtrlIPressed(data: {
  code: string;
  startLine: number;
  endLine: number;
  fileName?: string;
}) {
  emit("ctrl-i-pressed", data);
}

function handleDiffExited(code: string, recordId?: string) {
  emit("diff-exited", code, recordId);
}

function handleClose() {
  emit("update:show", false);
}

// 暴露 ref 供父组件使用
defineExpose({
  immersiveCodeRef,
  getCurrentCode: () => immersiveCodeRef.value?.getCurrentCode() || "",
  getHistory: () => immersiveCodeRef.value?.getHistory(),
  setHistory: (history: CodeHistory) => {
    if (immersiveCodeRef.value) {
      immersiveCodeRef.value.setHistory(history);
    }
  },
});
</script>

<template>
  <div v-if="show" class="shrink-0 w-2/3 h-full flex flex-col overflow-hidden p-2">
    <div class="h-full w-full">
      <ImmersiveCode
        ref="immersiveCodeRef"
        :enable-share="false"
        :readonly="readonly"
        :initial-code="''"
        @error="handleError"
        @element-selected="handleElementSelected"
        @ctrl-i-pressed="handleCtrlIPressed"
        @diff-exited="handleDiffExited"
        class="immersive-code-full-height"
      >
        <template #right-actions>
          <button
            @click="handleClose"
            class="p-1.5 text-slate-400 hover:text-slate-600 transition rounded"
            title="折叠画布"
          >
            <X class="w-4 h-4" />
          </button>
        </template>
      </ImmersiveCode>
    </div>
  </div>
</template>

<style scoped>
.immersive-code-full-height {
  height: 100%;
}
</style>
