<script setup lang="ts">
import { ref } from "vue";
import type { LlmProvider } from "@/interface";
import { InfoOutlined, EditOutlined, DeleteOutlined } from "@vicons/material";
import Popconfirm from "@/components/llm/Popconfirm.vue";
import { useToasts } from "@/hooks/useToasts";

const props = defineProps<{
  providers: LlmProvider[];
  defaultVisibleModelCount?: number;
}>();

const emit = defineEmits<{
  edit: [provider: LlmProvider];
  remove: [provider: LlmProvider];
  toggle: [provider: LlmProvider];
  copyModelTag: [providerName: string, modelName: string];
}>();

const { pushToast } = useToasts();

// 展开状态：存储已展开的 provider 的 key
const expandedProviders = ref<Set<string>>(new Set());

function isProviderExpanded(providerKey: string): boolean {
  return expandedProviders.value.has(providerKey);
}

function toggleProviderExpanded(providerKey: string) {
  if (expandedProviders.value.has(providerKey)) {
    expandedProviders.value.delete(providerKey);
  } else {
    expandedProviders.value.add(providerKey);
  }
}

// 复制模型标识
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
  <div class="space-y-1">
    <div
      v-for="provider in providers"
      :key="provider.id || provider.name"
      class="bg-white rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-shadow group"
    >
      <div class="flex items-center justify-between gap-3">
        <!-- 左侧：Provider 信息 -->
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-slate-800 text-sm truncate">
                {{ provider.name }}
              </h3>
              <div class="flex items-center gap-1.5">
                <span
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="provider.enabled === false ? 'bg-slate-300' : 'bg-green-500'"
                ></span>
                <span class="text-xs text-slate-500 shrink-0">{{
                  provider.enabled === false ? "已禁用" : "运行中"
                }}</span>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-1 text-xs text-slate-500">
              <div class="flex items-center gap-1 truncate">
                <InfoOutlined class="w-3 h-3 shrink-0" />
                <span class="truncate font-mono">{{ provider.baseUrl }}</span>
              </div>
              <span
                class="shrink-0"
                v-if="provider.limit !== 0 && provider.limit !== undefined"
                >速率限制: {{ provider.limit ?? "无限制" }}</span
              >
            </div>
          </div>
        </div>

        <!-- 中间：模型列表 -->
        <!-- <div class="flex-1 min-w-0 hidden lg:block">
          <div
            class="flex flex-wrap gap-1.5 content-start"
            :class="isProviderExpanded(provider.id || provider.name || '') ? '' : 'overflow-hidden'"
          >
            <span
              v-for="m in isProviderExpanded(provider.id || provider.name || '')
                ? provider.models || []
                : (provider.models || []).slice(0, defaultVisibleModelCount || 3)"
              :key="m"
              class="text-[10px] px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600 font-mono cursor-pointer hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 transition-colors"
              :title="`点击复制: ${provider.name},${m}`"
              @click="handleCopyModelTag(provider.name, m)"
            >
              {{ m }}
            </span>
            <span
              v-if="(provider.models || []).length > (defaultVisibleModelCount || 3)"
              class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono cursor-pointer hover:bg-slate-200 hover:text-slate-700 transition-colors"
              :title="
                isProviderExpanded(provider.id || provider.name || '')
                  ? '点击收起'
                  : `点击展开全部 ${provider.models.length} 个模型`
              "
              @click="toggleProviderExpanded(provider.id || provider.name || '')"
            >
              {{
                isProviderExpanded(provider.id || provider.name || '')
                  ? "收起"
                  : `+${provider.models.length - (defaultVisibleModelCount || 3)}`
              }}
            </span>
          </div>
        </div> -->

        <!-- 右侧：操作按钮 -->
        <div class="flex items-center gap-2 shrink-0">
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

          <button
            class="text-xs font-medium px-2.5 py-1 rounded-md transition-colors shrink-0"
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

      <!-- 移动端：模型列表（单独一行） -->
      <div class="lg:hidden mt-2 pt-2 border-t border-slate-100">
        <div
          class="flex flex-wrap gap-1.5 content-start"
          :class="
            isProviderExpanded(provider.id || provider.name || '')
              ? ''
              : 'overflow-hidden'
          "
        >
          <span
            v-for="m in isProviderExpanded(provider.id || provider.name || '')
              ? provider.models || []
              : (provider.models || []).slice(0, defaultVisibleModelCount || 3)"
            :key="m"
            class="text-[10px] px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600 font-mono cursor-pointer hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 transition-colors"
            :title="`点击复制: ${provider.name},${m}`"
            @click="handleCopyModelTag(provider.name, m)"
          >
            {{ m }}
          </span>
          <span
            v-if="(provider.models || []).length > (defaultVisibleModelCount || 3)"
            class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-mono cursor-pointer hover:bg-slate-200 hover:text-slate-700 transition-colors"
            :title="
              isProviderExpanded(provider.id || provider.name || '')
                ? '点击收起'
                : `点击展开全部 ${provider.models.length} 个模型`
            "
            @click="toggleProviderExpanded(provider.id || provider.name || '')"
          >
            {{
              isProviderExpanded(provider.id || provider.name || "")
                ? "收起"
                : `+${provider.models.length - (defaultVisibleModelCount || 3)}`
            }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
