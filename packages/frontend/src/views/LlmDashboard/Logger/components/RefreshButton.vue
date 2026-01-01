<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from "vue";
import { RefreshOutlined, ExpandMoreOutlined } from "@vicons/material";
import Dropdown from "@/components/llm/Dropdown.vue";
import Input from "@/components/llm/Input.vue";

const props = defineProps<{
  isRefreshing?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

// 下拉菜单状态
const dropdownOpen = ref(false);

// 自动刷新相关状态
const autoRefreshEnabled = ref(false);
const refreshInterval = ref(5); // 默认 5 秒
const forceOverwrite = ref(false); // 是否强制覆盖数据

// 自动刷新定时器
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

// 格式化间隔时间显示
const formattedInterval = computed(() => {
  return `${refreshInterval.value} 秒`;
});

// 清理定时器
function clearAutoRefreshTimer() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}

// 启动自动刷新
function startAutoRefresh() {
  clearAutoRefreshTimer();
  if (autoRefreshEnabled.value && refreshInterval.value > 0) {
    autoRefreshTimer = setInterval(() => {
      if (!props.isRefreshing && !props.disabled) {
        emit("refresh");
      }
    }, refreshInterval.value * 1000);
  }
}

// 停止自动刷新
function stopAutoRefresh() {
  clearAutoRefreshTimer();
}

// 监听自动刷新开关
watch(autoRefreshEnabled, (enabled) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// 监听刷新间隔变化
watch(refreshInterval, () => {
  if (autoRefreshEnabled.value) {
    startAutoRefresh();
  }
});

// 监听组件卸载，清理定时器
onUnmounted(() => {
  clearAutoRefreshTimer();
});

// 手动刷新
function handleRefresh() {
  emit("refresh");
}

// 切换自动刷新
function toggleAutoRefresh() {
  autoRefreshEnabled.value = !autoRefreshEnabled.value;
}

// 切换强制覆盖
function toggleForceOverwrite() {
  forceOverwrite.value = !forceOverwrite.value;
}

// 验证并更新刷新间隔
function updateRefreshInterval(value: string) {
  const num = parseInt(value, 10);
  if (!isNaN(num) && num > 0) {
    refreshInterval.value = Math.max(1, Math.min(300, num)); // 限制在 1-300 秒之间
  }
}
</script>

<template>
  <div class="flex items-center">
    <!-- 按钮组：刷新按钮 + 折叠图标 -->
    <div class="flex items-center border border-slate-200 rounded-md shadow-sm overflow-hidden bg-white">
      <!-- 刷新按钮（左侧） -->
      <button
        @click="handleRefresh"
        type="button"
        :disabled="disabled"
        class="px-3 py-1.5 hover:bg-slate-50 transition-all text-xs font-medium flex items-center gap-1.5 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="disabled ? '' : 'text-slate-700'"
        title="刷新"
      >
        <RefreshOutlined
          :class="[
            'w-3.5 h-3.5',
            { 'animate-spin': isRefreshing },
            disabled ? 'text-slate-400' : 'text-slate-600',
          ]"
        />
        <span>刷新</span>
      </button>

      <!-- 分隔线 -->
      <div class="h-6 w-px bg-slate-200"></div>

      <!-- 折叠图标按钮（右侧） -->
      <div class="relative" @click.stop>
        <Dropdown v-model:show="dropdownOpen" :spacing="8" position="bottom">
          <template #trigger>
            <button
              type="button"
              :disabled="disabled"
              class="px-2 py-1.5 hover:bg-slate-50 transition-all h-8 disabled:opacity-50 disabled:cursor-not-allowed"
              :class="disabled ? '' : 'text-slate-700'"
              title="刷新设置"
              @click.stop="dropdownOpen = !dropdownOpen"
            >
              <ExpandMoreOutlined
                :class="[
                  'w-3.5 h-3.5 transition-transform',
                  dropdownOpen ? 'rotate-180' : '',
                  disabled ? 'text-slate-400' : 'text-slate-600',
                ]"
              />
            </button>
          </template>

          <!-- 下拉菜单内容 -->
          <div class="p-4 min-w-[280px]">
            <!-- 自动刷新开关 -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex-1">
                <div class="text-sm font-medium text-slate-900 mb-0.5">
                  自动刷新
                </div>
                <div class="text-xs text-slate-500">
                  开启后，将按设定间隔自动刷新
                </div>
              </div>
              <button
                type="button"
                @click="toggleAutoRefresh"
                :disabled="disabled"
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                :class="
                  autoRefreshEnabled
                    ? 'bg-indigo-500'
                    : 'bg-slate-200'
                "
                role="switch"
                :aria-checked="autoRefreshEnabled"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="
                    autoRefreshEnabled ? 'translate-x-4' : 'translate-x-0'
                  "
                />
              </button>
            </div>

            <!-- 刷新间隔时间 -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-slate-900 mb-1.5">
                刷新间隔（秒）
              </label>
              <div class="flex items-center gap-2">
                <Input
                  :model-value="refreshInterval.toString()"
                  @update:model-value="updateRefreshInterval"
                  type="number"
                  :min="1"
                  :max="300"
                  class="flex-1"
                  :disabled="disabled || !autoRefreshEnabled"
                  placeholder="5"
                />
                <span class="text-xs text-slate-500 whitespace-nowrap">
                  {{ formattedInterval }}
                </span>
              </div>
            </div>

            <!-- 强制覆盖数据开关 -->
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="text-sm font-medium text-slate-900 mb-0.5">
                  强制覆盖数据
                </div>
                <div class="text-xs text-slate-500">
                  刷新时强制覆盖，不保持当前选中项
                </div>
              </div>
              <button
                type="button"
                @click="toggleForceOverwrite"
                :disabled="disabled"
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                :class="
                  forceOverwrite
                    ? 'bg-indigo-500'
                    : 'bg-slate-200'
                "
                role="switch"
                :aria-checked="forceOverwrite"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  :class="
                    forceOverwrite ? 'translate-x-4' : 'translate-x-0'
                  "
                />
              </button>
            </div>
          </div>
        </Dropdown>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>

