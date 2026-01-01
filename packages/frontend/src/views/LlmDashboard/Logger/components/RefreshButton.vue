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
const refreshIntervalStr = ref("5"); // 用于输入框的字符串值

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

// 监听刷新间隔字符串变化
watch(refreshIntervalStr, (value) => {
  const num = parseInt(value, 10);
  if (!isNaN(num) && num > 0) {
    const clampedValue = Math.max(1, Math.min(300, num));
    refreshInterval.value = clampedValue;
    // 如果值被限制，更新字符串显示
    if (clampedValue !== num) {
      refreshIntervalStr.value = clampedValue.toString();
    }
  }
});

// 监听刷新间隔变化（用于重启自动刷新）
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
        class="px-3 py-1.5 transition-all text-xs font-medium flex items-center gap-1.5 h-8 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="[
          autoRefreshEnabled
            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
            : 'hover:bg-slate-50 text-slate-700',
        ]"
        title="刷新"
      >
        <RefreshOutlined
          :class="[
            'w-3.5 h-3.5',
            {
              'animate-spin': isRefreshing,
              'auto-refresh-pulse': autoRefreshEnabled && !isRefreshing,
            },
            disabled
              ? 'text-slate-400'
              : autoRefreshEnabled
                ? 'text-indigo-600'
                : 'text-slate-600',
          ]"
        />
        <span>刷新</span>
      </button>

      <!-- 分隔线 -->
      <div
        class="h-6 w-px"
        :class="autoRefreshEnabled ? 'bg-indigo-200' : 'bg-slate-200'"
      ></div>

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
            <div>
              <label class="block text-sm font-medium text-slate-900 mb-1.5">
                刷新间隔（秒）
              </label>
              <div class="flex items-center gap-2">
                <Input
                  v-model="refreshIntervalStr"
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

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.auto-refresh-pulse {
  animation: pulse 2s ease-in-out infinite;
}
</style>

