<script setup lang="ts">
import type { LlmProvider } from "@/interface";
import {
  InfoOutlined,
  EditOutlined,
  DeleteOutlined,
  DragIndicatorOutlined,
} from "@vicons/material";
import Popconfirm from "@/components/llm/Popconfirm.vue";
import { useToasts } from "@/hooks/useToasts";

const props = defineProps<{
  provider: LlmProvider;
  defaultVisibleModelCount?: number;
  isExpanded?: boolean;
  showDragHandle?: boolean;
}>();

const emit = defineEmits<{
  edit: [provider: LlmProvider];
  remove: [provider: LlmProvider];
  toggle: [provider: LlmProvider];
  toggleExpand: [];
  copyModelTag: [providerName: string, modelName: string];
}>();

const { pushToast } = useToasts();

// 复制模型标识（格式：provider名称,模型名称）
async function handleCopyModelTag(providerName: string, modelName: string) {
  const text = `${providerName},${modelName}`;
  try {
    await navigator.clipboard.writeText(text);
    pushToast(`已复制: ${text}`, "success");
  } catch (err) {
    pushToast(`复制失败: ${(err as Error).message}`, "error");
  }
  emit("copyModelTag", providerName, modelName);
}
</script>

<template>
  <div
    class="bg-white rounded-xl border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow group relative"
  >
    <button
      v-if="showDragHandle"
      class="provider-drag-handle absolute -left-3 top-3 w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-primary-50 hover:text-primary-600 flex items-center justify-center shadow-sm"
      title="拖动以排序"
    >
      <DragIndicatorOutlined class="w-4 h-4" />
    </button>
    <div class="flex justify-between items-start mb-2">
      <div class="flex items-center gap-2">
        <h3 class="font-bold text-slate-800 text-sm">{{ provider.name }}</h3>
        <div class="flex items-center gap-1.5">
          <span
            class="w-2 h-2 rounded-full"
            :class="provider.enabled === false ? 'bg-slate-300' : 'bg-green-500'"
          ></span>
          <span class="text-xs text-slate-500">{{
            provider.enabled === false ? "已禁用" : "运行中"
          }}</span>
        </div>
      </div>
      <div
        class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <button
          class="btn-icon text-slate-400 hover:text-primary-600"
          title="编辑"
          @click="emit('edit', provider)"
        >
          <EditOutlined class="w-4 h-4" />
        </button>
        <Popconfirm
          title="删除 Provider"
          description="确定要删除该 Provider 吗？此操作不可撤销。"
          type="danger"
          confirm-text="删除"
          @confirm="emit('remove', provider)"
        >
          <template #reference="{ toggle }">
            <button
              class="btn-icon text-slate-400 hover:text-red-600"
              title="删除"
              @click="toggle"
            >
              <DeleteOutlined class="w-4 h-4" />
            </button>
          </template>
        </Popconfirm>
      </div>
    </div>

    <div class="space-y-2">
      <div
        class="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 truncate"
      >
        <InfoOutlined class="w-3 h-3 shrink-0" />
        <span class="truncate">{{ provider.baseUrl }}</span>
      </div>

      <div
        class="flex flex-wrap gap-1.5 content-start"
        :class="isExpanded ? '' : 'overflow-hidden'"
      >
        <span
          v-for="m in isExpanded
            ? provider.models || []
            : (provider.models || []).slice(0, defaultVisibleModelCount)"
          :key="m"
          class="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-mono cursor-pointer hover:bg-gray-100 hover:text-primary-700 transition-colors"
          :title="`点击复制: ${provider.name},${m}`"
          @click="handleCopyModelTag(provider.name, m)"
        >
          {{ m }}
        </span>
        <span
          v-if="(provider.models || []).length > (defaultVisibleModelCount || 5)"
          class="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-mono cursor-pointer hover:bg-gray-200 hover:text-slate-700 transition-colors"
          :title="
            isExpanded
              ? '点击收起'
              : `点击展开全部 ${provider.models.length} 个模型`
          "
          @click="emit('toggleExpand')"
        >
          {{
            isExpanded
              ? "收起"
              : `+${provider.models.length - (defaultVisibleModelCount || 5)}`
          }}
        </span>
      </div>
    </div>

    <div
      class="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center"
    >
      <span class="text-xs text-slate-400"
        >速率限制: {{ provider.limit ?? "无限制" }}</span
      >
      <button
        class="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
        :class="
          provider.enabled === false
            ? 'bg-green-50 text-green-600 hover:bg-green-100'
            : 'bg-red-50 text-red-600 hover:bg-red-100'
        "
        @click="emit('toggle', provider)"
      >
        {{ provider.enabled === false ? "启用" : "禁用" }}
      </button>
    </div>
  </div>
</template>
