<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { X, Check, CheckSquare, Square, Eye, EyeOff } from "lucide-vue-next";
import type { McpServer, McpTool } from "@/interface";

const props = defineProps<{
  server: McpServer;
  tools: McpTool[];
  selectedToolNames: string[];
  show: boolean;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  "update:selectedToolNames": [toolNames: string[]];
}>();

// 本地选中的工具名称（用于编辑）
const localSelectedToolNames = ref<string[]>([...props.selectedToolNames]);

// 是否显示详情
const showDetails = ref(false);

// 监听 props 变化，同步到本地
watch(
  () => props.selectedToolNames,
  (newValue) => {
    localSelectedToolNames.value = [...newValue];
  },
  { immediate: true }
);

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      // 打开时重置为 props 的值
      localSelectedToolNames.value = [...props.selectedToolNames];
    }
  }
);

// 计算已选择数量
const selectedCount = computed(() => localSelectedToolNames.value.length);
const totalCount = computed(() => props.tools.length);

// 是否全选
const isAllSelected = computed(
  () =>
    props.tools.length > 0 && localSelectedToolNames.value.length === props.tools.length
);

// 是否部分选中
const isIndeterminate = computed(
  () =>
    localSelectedToolNames.value.length > 0 &&
    localSelectedToolNames.value.length < props.tools.length
);

// 切换单个工具
function toggleTool(toolName: string) {
  const index = localSelectedToolNames.value.indexOf(toolName);
  if (index > -1) {
    localSelectedToolNames.value.splice(index, 1);
  } else {
    localSelectedToolNames.value.push(toolName);
  }
}

// 全选
function selectAll() {
  localSelectedToolNames.value = props.tools.map((tool) => tool.name);
}

// 反选
function invertSelection() {
  const allToolNames = props.tools.map((tool) => tool.name);
  localSelectedToolNames.value = allToolNames.filter(
    (name) => !localSelectedToolNames.value.includes(name)
  );
}

// 取消
function handleCancel() {
  // 恢复为原始值
  localSelectedToolNames.value = [...props.selectedToolNames];
  emit("update:show", false);
}

// 确认
function handleConfirm() {
  emit("update:selectedToolNames", [...localSelectedToolNames.value]);
  emit("update:show", false);
}

// 检查工具是否被选中
function isToolSelected(toolName: string) {
  return localSelectedToolNames.value.includes(toolName);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        @click.self="handleCancel"
      >
        <div
          class="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl max-h-[80vh] flex flex-col"
          @click.stop
        >
          <!-- Header -->
          <div
            class="px-6 py-4 border-b border-slate-200 flex items-center justify-between"
          >
            <h2 class="text-lg font-bold text-slate-800">
              MCP 工具选择 - {{ server.name }}
            </h2>
            <button
              @click="handleCancel"
              class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Toolbar -->
          <div
            class="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <button
                @click="selectAll"
                class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-indigo-300 transition-colors flex items-center gap-1.5"
                :disabled="tools.length === 0"
              >
                <CheckSquare v-if="isAllSelected" class="w-3.5 h-3.5" />
                <Square v-else-if="isIndeterminate" class="w-3.5 h-3.5" />
                <Square v-else class="w-3.5 h-3.5" />
                全选
              </button>
              <button
                @click="invertSelection"
                class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-indigo-300 transition-colors"
                :disabled="tools.length === 0"
              >
                反选
              </button>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-xs text-slate-600">
                已选择:
                <span class="font-bold text-indigo-600"
                  >{{ selectedCount }}/{{ totalCount }}</span
                >
              </div>
              <button
                @click="showDetails = !showDetails"
                class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:border-indigo-300 transition-colors flex items-center gap-1.5"
                :title="showDetails ? '隐藏详情' : '显示详情'"
              >
                <Eye v-if="showDetails" class="w-3.5 h-3.5" />
                <EyeOff v-else class="w-3.5 h-3.5" />
                <span>{{ showDetails ? "隐藏详情" : "显示详情" }}</span>
              </button>
            </div>
          </div>

          <!-- Tools List -->
          <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
            <div v-if="tools.length === 0" class="text-center py-8 text-slate-400">
              <p class="text-sm">暂无可用工具</p>
            </div>
            <div v-else class="space-y-2">
              <label
                v-for="tool in tools"
                :key="tool.name"
                class="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-all group"
                :class="{
                  'border-indigo-400 bg-indigo-50/50': isToolSelected(tool.name),
                }"
              >
                <div class="mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    :checked="isToolSelected(tool.name)"
                    @change="toggleTool(tool.name)"
                    class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="text-sm font-semibold text-slate-800 font-mono"
                      :class="{
                        'text-indigo-700': isToolSelected(tool.name),
                      }"
                    >
                      {{ tool.name }}
                    </span>
                  </div>
                  <p
                    v-if="showDetails && tool.description"
                    class="text-xs text-slate-500 leading-relaxed"
                    :class="{
                      'text-indigo-600/70': isToolSelected(tool.name),
                    }"
                  >
                    {{ tool.description }}
                  </p>
                </div>
                <div
                  v-if="isToolSelected(tool.name)"
                  class="shrink-0 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Check class="w-4 h-4" />
                </div>
              </label>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3"
          >
            <button
              @click="handleCancel"
              class="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              @click="handleConfirm"
              class="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
            >
              确认
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95);
  opacity: 0;
}
</style>
