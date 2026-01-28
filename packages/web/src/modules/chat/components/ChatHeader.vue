<script setup lang="ts">
import type { EventItem, IntervalOption } from '@/types';

defineProps<{
  selectedEvent: string;
  dropdownOpen: boolean;
  eventsList: EventItem[];
  isStarting: boolean;
  session: string;
  streamingId: string;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number;
  intervalDropdownOpen: boolean;
  intervalOptions: IntervalOption[];
  isRefreshing: boolean;
  allCollapsed: boolean;
}>();

const emit = defineEmits<{
  'toggle-dropdown': [];
  'select-event': [eventName: string];
  'delete-event': [eventName: string];
  'send-test': [];
  'copy-session': [];
  'toggle-auto-refresh': [];
  'toggle-interval-dropdown': [];
  'select-interval': [value: number];
  'manual-refresh': [];
  'toggle-all-collapse': [];
  'clear-chat': [];
}>();

const getIntervalLabel = (value: number) => {
  const option = [
    { value: 500, label: '0.5秒' },
    { value: 1000, label: '1秒' },
    { value: 2000, label: '2秒' },
    { value: 3000, label: '3秒' },
    { value: 5000, label: '5秒' },
    { value: 10000, label: '10秒' },
    { value: 30000, label: '30秒' },
    { value: 60000, label: '1分钟' }
  ].find(opt => opt.value === value);
  return option ? option.label : '5秒';
};
</script>

<template>
  <header
    class="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
    <div class="flex items-center gap-2">
      <!-- 测试场景下拉框 -->
      <div class="custom-dropdown relative">
        <div class="dropdown-header" :class="{ disabled: isStarting }">
          <div class="dropdown-trigger" :class="{ disabled: isStarting }"
            @click="!isStarting && emit('toggle-dropdown')">
            <span class="dropdown-trigger-text">{{ selectedEvent || '测试场景' }}</span>
            <i class="fa-solid fa-chevron-down text-slate-400 dropdown-chevron" :class="{ open: dropdownOpen }"></i>
          </div>
          <div class="dropdown-run-btn" :class="{ disabled: !selectedEvent || isStarting }"
            @click.stop="emit('send-test')" :title="selectedEvent ? '运行测试' : '请先选择测试场景'">
            <i class="fa-solid fa-play"></i>
          </div>
        </div>

        <div v-if="dropdownOpen" class="dropdown-menu">
          <div v-for="event in eventsList" :key="event.name" class="dropdown-item-wrapper"
            :class="{ selected: selectedEvent === event.name }">
            <div class="dropdown-item" @click="emit('select-event', event.name)">{{ event.name }}</div>
            <button @click.stop="emit('delete-event', event.name)" class="dropdown-delete-btn" title="删除此事件">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
          <div v-if="eventsList.length === 0" class="dropdown-item text-slate-400 cursor-default">暂无测试场景</div>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-4 text-sm">
      <!-- Session ID -->
      <div v-if="session || streamingId" class="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
        :class="streamingId ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'">
        <i class="fa-solid fa-link" :class="streamingId ? 'text-green-600' : 'text-blue-600'"></i>
        <span class="text-xs font-medium" :class="streamingId ? 'text-green-700' : 'text-blue-700'">
          {{ streamingId ? 'Streaming' : 'Session' }}: {{ (streamingId || session).substring(0, 8) }}...
        </span>
        <button @click="emit('copy-session')" class="transition"
          :class="streamingId ? 'text-green-600 hover:text-green-800' : 'text-blue-600 hover:text-blue-800'"
          title="复制完整 Session ID">
          <i class="fa-solid fa-copy text-xs"></i>
        </button>
      </div>

      <!-- 连接状态 -->
      <!-- <div v-if=" " class="flex items-center gap-2 text-green-600 font-medium">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        已连接: {{ streamingId }}
      </div> -->

      <!-- 自动刷新控制 -->
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors"
        :class="autoRefreshEnabled ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'">
        <button @click="emit('toggle-auto-refresh')" class="flex items-center gap-1.5 transition-colors"
          :class="autoRefreshEnabled ? 'text-green-600 hover:text-green-700' : 'text-slate-500 hover:text-slate-700'">
          <i class="fa-solid" :class="autoRefreshEnabled ? 'fa-rotate animate-spin' : 'fa-rotate'"></i>
          <span class="text-xs font-medium">{{ autoRefreshEnabled ? '自动刷新' : '手动' }}</span>
        </button>
        <div class="h-4 w-px bg-slate-300"></div>

        <div class="relative">
          <button @click="emit('toggle-interval-dropdown')"
            class="flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors px-2 py-1 rounded hover:bg-slate-100"
            :class="autoRefreshEnabled ? 'text-green-600' : 'text-slate-600'">
            <span>{{ getIntervalLabel(autoRefreshInterval) }}</span>
            <i class="fa-solid fa-chevron-down text-[10px] transition-transform"
              :class="{ 'rotate-180': intervalDropdownOpen }"></i>
          </button>

          <div v-if="intervalDropdownOpen"
            class="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[100px]">
            <div v-for="option in intervalOptions" :key="option.value" @click="emit('select-interval', option.value)"
              class="px-3 py-2 text-xs cursor-pointer transition-colors flex items-center justify-between"
              :class="autoRefreshInterval === option.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-slate-700 hover:bg-slate-50'">
              <span>{{ option.label }}</span>
              <i v-if="autoRefreshInterval === option.value" class="fa-solid fa-check text-blue-600 text-[10px]"></i>
            </div>
          </div>
        </div>
      </div>

      <button @click="emit('manual-refresh')"
        class="text-slate-500 hover:text-blue-500 transition flex items-center gap-1.5" title="立即刷新"
        :disabled="isRefreshing">
        <i class="fa-solid fa-arrows-rotate" :class="{ 'animate-spin': isRefreshing }"></i>
        刷新
      </button>

      <button @click="emit('toggle-all-collapse')"
        class="text-slate-500 hover:text-blue-500 transition flex items-center gap-1.5">
        <i class="fa-solid" :class="allCollapsed ? 'fa-angles-down' : 'fa-angles-up'"></i>
        {{ allCollapsed ? '全部展开' : '全部折叠' }}
      </button>

      <button @click="emit('clear-chat')"
        class="hidden text-slate-500 hover:text-red-500 transition flex items-center gap-1.5">
        <i class="fa-solid fa-trash"></i>
        清空对话
      </button>
    </div>
  </header>
</template>

<style scoped>
.custom-dropdown {
  width: 180px;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  transition: all 0.2s;
  overflow: hidden;
  height: 38px;
}

.dropdown-trigger {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  cursor: pointer;
  user-select: none;
}

.dropdown-trigger-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  color: #334155;
  font-weight: 500;
}

.dropdown-run-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.dropdown-run-btn:hover:not(.disabled) {
  background: #2563eb;
}

.dropdown-run-btn.disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  max-height: 240px;
  overflow-y: auto;
  z-index: 50;
}

.dropdown-item-wrapper {
  display: flex;
  align-items: center;
  transition: background 0.15s;
}

.dropdown-item-wrapper:hover {
  background: #f1f5f9;
}

.dropdown-item {
  flex: 1;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #334155;
}

.dropdown-delete-btn {
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  color: #94a3b8;
  background: transparent;
  border: none;
  opacity: 0;
  font-size: 0.75rem;
}

.dropdown-item-wrapper:hover .dropdown-delete-btn {
  opacity: 1;
}

.dropdown-delete-btn:hover {
  color: #ef4444;
}

.dropdown-chevron {
  transition: transform 0.2s;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.dropdown-chevron.open {
  transform: rotate(180deg);
}
</style>
