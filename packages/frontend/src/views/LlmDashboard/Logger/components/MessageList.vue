<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { Trash2, CheckSquare, Square } from "lucide-vue-next";
import type { MessageListItem, TimeRange } from "../types";
import TimeRangePicker from "./TimeRangePicker.vue";
import Popconfirm from "@/components/llm/Popconfirm.vue";
import { useLlmApi } from "@/hooks/useLlmApi";

const props = defineProps<{
  messages: MessageListItem[];
  selectedMessageId: string | null;
  searchQuery: string;
  filterTag: "all" | "completed" | "pending" | "error";
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedMessageId": [id: string | null];
  "update:filterTag": [tag: "all" | "completed" | "pending" | "error"];
  "update:searchQuery": [query: string];
  refresh: [];
}>();

const { deleteMessages: apiDeleteMessages } = useLlmApi();

// 多选模式
const isMultiSelectMode = ref(false);

// 选中的消息 ID 集合
const selectedIds = ref<Set<string>>(new Set());
const isDeleting = ref(false);

// Shift 范围选择的起始索引
const lastSelectedIndex = ref<number | null>(null);

// 切换多选模式
function toggleMultiSelectMode() {
  isMultiSelectMode.value = !isMultiSelectMode.value;
  // 关闭多选模式时，清空选中状态
  if (!isMultiSelectMode.value) {
    selectedIds.value.clear();
    lastSelectedIndex.value = null;
  }
}

// 全选状态
const isAllSelected = computed(() => {
  return (
    filteredMessages.value.length > 0 &&
    filteredMessages.value.every((msg) => selectedIds.value.has(msg.requestId))
  );
});

// 是否有选中的消息
const hasSelected = computed(() => selectedIds.value.size > 0);

// 切换单个消息的选中状态
function toggleSelect(requestId: string, event?: Event) {
  if (event) {
    event.stopPropagation();
  }
  if (selectedIds.value.has(requestId)) {
    selectedIds.value.delete(requestId);
  } else {
    selectedIds.value.add(requestId);
  }
  // 多选模式下，选中或取消选中时都更新详情显示
  if (isMultiSelectMode.value) {
    emit("update:selectedMessageId", requestId);
  }
}

// 处理消息项点击（支持多选模式和 Shift 范围选择）
function handleItemClick(requestId: string, index: number, event: MouseEvent) {
  if (!isMultiSelectMode.value) {
    // 非多选模式，正常选择消息
    emit("update:selectedMessageId", requestId);
    return;
  }

  // 多选模式
  if (event.shiftKey && lastSelectedIndex.value !== null) {
    // Shift + 点击：范围选择
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    const lastMsg = filteredMessages.value[lastSelectedIndex.value];
    if (!lastMsg) {
      lastSelectedIndex.value = index;
      toggleSelect(requestId);
      return;
    }
    const isLastSelected = selectedIds.value.has(lastMsg.requestId);

    // 将范围内的所有项设置为与起始项相同的状态
    for (let i = start; i <= end; i++) {
      const msg = filteredMessages.value[i];
      if (msg) {
        if (isLastSelected) {
          selectedIds.value.add(msg.requestId);
        } else {
          selectedIds.value.delete(msg.requestId);
        }
      }
    }
    // Shift 范围选择后，更新详情显示为当前点击的项
    emit("update:selectedMessageId", requestId);
  } else {
    // 普通点击：切换选中状态
    toggleSelect(requestId);
    lastSelectedIndex.value = index;
    // toggleSelect 内部已经会更新 selectedMessageId
  }
}

// 全选
function selectAll() {
  filteredMessages.value.forEach((msg) => {
    selectedIds.value.add(msg.requestId);
  });
}

// 取消全选
function deselectAll() {
  filteredMessages.value.forEach((msg) => {
    selectedIds.value.delete(msg.requestId);
  });
}

// 反选
function invertSelection() {
  filteredMessages.value.forEach((msg) => {
    if (selectedIds.value.has(msg.requestId)) {
      selectedIds.value.delete(msg.requestId);
    } else {
      selectedIds.value.add(msg.requestId);
    }
  });
}

// 全选/取消全选（切换）
function toggleSelectAll() {
  if (isAllSelected.value) {
    deselectAll();
  } else {
    selectAll();
  }
}

// 删除选中的消息
async function handleDelete() {
  if (!hasSelected.value || isDeleting.value) return;

  const idsToDelete = Array.from(selectedIds.value);
  isDeleting.value = true;

  try {
    const result = await apiDeleteMessages(idsToDelete);
    if (result.success) {
      // 清空选中状态
      selectedIds.value.clear();
      // 如果当前选中的消息被删除，清空选中状态
      if (
        props.selectedMessageId &&
        idsToDelete.includes(props.selectedMessageId)
      ) {
        emit("update:selectedMessageId", null);
      }
      // 通知父组件刷新列表
      emit("refresh");
    } else {
      console.error("删除消息失败:", result.message);
    }
  } catch (error) {
    console.error("删除消息失败:", error);
  } finally {
    isDeleting.value = false;
  }
}

// 时间范围选择
const timeRange = ref<TimeRange>({ start: null, end: null });

// 用于触发时间更新的响应式变量
const now = ref(Date.now());

// 定时更新当前时间，使相对时间能够实时更新
let intervalId: number | null = null;
onMounted(() => {
  intervalId = window.setInterval(() => {
    now.value = Date.now();
  }, 60000); // 每分钟更新一次
});

onUnmounted(() => {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
});

const filteredMessages = computed(() => {
  let filtered = props.messages;

  // 搜索过滤
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase();
    filtered = filtered.filter((msg) => {
      return (
        msg.requestId.toLowerCase().includes(q) ||
        (msg.model && msg.model.toLowerCase().includes(q)) ||
        (msg.timestamp && msg.timestamp.toLowerCase().includes(q))
      );
    });
  }

  // 时间范围过滤
  if (timeRange.value.start || timeRange.value.end) {
    filtered = filtered.filter((msg) => {
      if (!msg.timestamp) return false;

      try {
        const msgTime = new Date(msg.timestamp).getTime();
        if (isNaN(msgTime)) return false;

        const startTime = timeRange.value.start?.getTime() ?? null;
        const endTime = timeRange.value.end?.getTime() ?? null;

        // 如果有开始时间，消息时间必须 >= 开始时间
        if (startTime !== null && msgTime < startTime) {
          return false;
        }

        // 如果有结束时间，消息时间必须 <= 结束时间
        if (endTime !== null && msgTime > endTime) {
          return false;
        }

        return true;
      } catch {
        return false;
      }
    });
  }

  // TODO: 根据实际数据结构实现标签过滤
  // if (props.filterTag !== "all") {
  //   filtered = filtered.filter((msg) => {
  //     // 根据消息内容判断类型
  //   });
  // }

  return filtered;
});

// 格式化相对时间
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return "";

    const diffMs = now.value - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffSecs < 10) return "刚刚";
    if (diffSecs < 60) return `${diffSecs}秒前`;
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  } catch {
    return "";
  }
}
</script>

<template>
  <div class="h-full flex flex-col bg-white border-r border-slate-200">
    <!-- 头部 -->
    <div class="p-4 border-b border-slate-200 bg-slate-50">
      <!-- 时间范围选择器和多选切换 -->
      <div class="mb-3 flex items-center gap-2">
        <div class="flex-1">
          <!-- 操作栏：选择操作和删除 -->
          <div
            v-if="isMultiSelectMode"
            class="h-[38px] pl-3 flex items-center justify-between border border-slate-200 rounded-md bg-white"
          >
            <div class="flex items-center gap-2 flex-wrap py-1">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="isAllSelected"
                  @change="toggleSelectAll"
                  class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <span class="text-xs text-slate-600 font-medium">全选</span>
              </label>

              <button
                @click="invertSelection"
                type="button"
                class="px-2 py-1 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="反选"
              >
                反选
              </button>
            </div>
            <Popconfirm
              v-if="hasSelected"
              title="删除消息"
              :description="`确定要删除选中的 ${selectedIds.size} 条消息吗？此操作不可撤销。`"
              type="danger"
              confirm-text="删除"
              @confirm="handleDelete"
            >
              <template #reference="{ toggle }">
                <button
                  @click.stop="toggle"
                  type="button"
                  :disabled="isDeleting"
                  class="px-3 py-1 hover:border-red-200 hover:text-red-600 rounded-md transition-all text-xs font-medium flex items-center gap-1.5 h-8 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="删除选中消息"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>({{ selectedIds.size }})</span>
                </button>
              </template>
            </Popconfirm>
          </div>

          <TimeRangePicker v-else v-model="timeRange" />
        </div>
        <button
          @click="toggleMultiSelectMode"
          type="button"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 shadow-sm hover:shadow h-8',
            isMultiSelectMode
              ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100',
          ]"
          :title="isMultiSelectMode ? '退出多选模式' : '进入多选模式'"
        >
          <CheckSquare v-if="isMultiSelectMode" class="w-3.5 h-3.5" />
          <Square v-else class="w-3.5 h-3.5" />
          <span>{{ isMultiSelectMode ? "退出" : "多选" }}</span>
        </button>
      </div>

      <!-- 标签过滤器 -->
      <div class="flex gap-1 flex-wrap">
        <button
          @click="emit('update:filterTag', 'all')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'all'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          全部 ({{ filteredMessages.length }})
        </button>
        <button
          @click="emit('update:filterTag', 'completed')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'completed'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          已完成
        </button>
        <button
          @click="emit('update:filterTag', 'pending')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'pending'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          未完成
        </button>
        <button
          @click="emit('update:filterTag', 'error')"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium border border-slate-200',
            filterTag === 'error'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100',
          ]"
        >
          错误
        </button>
      </div>
    </div>

    <!-- 消息列表 -->
    <div class="flex-1 overflow-y-auto relative">
      <div v-if="isLoading" class="p-8 text-center text-slate-400">
        <p class="text-sm">加载中...</p>
      </div>
      <div
        v-else-if="filteredMessages.length === 0"
        class="p-8 text-center text-slate-400"
      >
        <p class="text-sm">没有找到匹配的对话</p>
      </div>
      <div
        v-else
        v-for="(msg, index) in filteredMessages"
        :key="msg.requestId"
        @click="handleItemClick(msg.requestId, index, $event)"
        :class="[
          'p-4 border-b border-slate-100 cursor-pointer transition-all relative',
          selectedMessageId === msg.requestId
            ? 'bg-indigo-50/50 border-l-4 border-l-indigo-600 shadow-sm'
            : 'border-l-4 border-l-transparent ',
          isMultiSelectMode && selectedIds.has(msg.requestId)
            ? 'bg-indigo-100/50'
            : 'hover:bg-slate-50/80',
        ]"
      >
        <!-- 复选框（仅多选模式显示） -->
        <div
          v-if="isMultiSelectMode"
          class="absolute left-4 top-4 z-10"
          @click.stop="toggleSelect(msg.requestId, $event)"
        >
          <input
            type="checkbox"
            :checked="selectedIds.has(msg.requestId)"
            @change="toggleSelect(msg.requestId, $event)"
            @click.stop
            class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        <!-- 主要内容区域 -->
        <div :class="isMultiSelectMode ? 'pr-16 pl-8' : 'pr-16'">
          <!-- 模型名称（主标题） -->
          <div
            v-if="msg.model"
            class="font-mono text-sm font-bold text-slate-800 mb-2 line-clamp-2 break-words"
            :title="msg.model"
          >
            {{ msg.model }}
          </div>

          <!-- Request ID（可选显示） -->
          <div
            v-if="msg.requestId"
            class="text-xs font-mono text-slate-500 mb-2 truncate"
            :title="msg.requestId"
          >
            {{ msg.requestId }}
          </div>

          <!-- Tags 区域 -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <!-- 请求/响应/流式标签 -->
            <span
              v-if="msg.hasRequest"
              class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r from-green-50 to-green-50/80 text-green-700 border border-green-200/60 shadow-sm whitespace-nowrap"
              >请求</span
            >
            <span
              v-if="msg.hasResponse"
              class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r from-blue-50 to-blue-50/80 text-blue-700 border border-blue-200/60 shadow-sm whitespace-nowrap"
              >响应</span
            >
            <span
              v-if="msg.hasStreamResponse"
              class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gradient-to-r from-purple-50 to-purple-50/80 text-purple-700 border border-purple-200/60 shadow-sm whitespace-nowrap"
              >流式</span
            >
          </div>
        </div>

        <!-- 时间显示在右下角 -->
        <div class="absolute bottom-4 right-4">
          <span class="text-xs text-slate-400 font-medium">{{
            formatRelativeTime(msg.timestamp)
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
