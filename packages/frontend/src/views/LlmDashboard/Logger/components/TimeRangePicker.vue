<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { TimeRange } from "../types";

const props = defineProps<{
  modelValue?: TimeRange;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: TimeRange];
}>();

const isOpen = ref(false);
const currentViewDate = ref(new Date()); // 当前视图的基准日期（左侧日历月份）
const selectedStartDate = ref<Date | null>(null);
const selectedEndDate = ref<Date | null>(null);
const startTime = ref<string>("00:00");
const endTime = ref<string>("23:59");
const activeQuickOption = ref<string | null>(null);
const dropdownStyle = ref<{ top: string; left: string; width: string }>({
  top: "0px",
  left: "0px",
  width: "100%",
});
const triggerRef = ref<HTMLElement | null>(null);

// 快捷选项类型
interface QuickOption {
  key: string;
  label: string;
  getRange: () => { start: Date; end: Date | null };
}

// 快捷选项列表
const quickOptions: QuickOption[] = [
  {
    key: "hour",
    label: "最近一小时",
    getRange: () => {
      const now = new Date();
      return {
        start: new Date(now.getTime() - 60 * 60 * 1000),
        end: now,
      };
    },
  },
  {
    key: "today",
    label: "今天",
    getRange: () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );
      return {
        start: today,
        end: todayEnd,
      };
    },
  },
  {
    key: "week",
    label: "最近 7 天",
    getRange: () => {
      const now = new Date();
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      };
    },
  },
  {
    key: "month",
    label: "最近一个月",
    getRange: () => {
      const now = new Date();
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      };
    },
  },
  {
    key: "now",
    label: "从现在开始",
    getRange: () => {
      const now = new Date();
      return {
        start: now,
        end: null,
      };
    },
  },
];

// 从 props 初始化本地状态
function initializeFromProps() {
  if (props.modelValue?.start) {
    selectedStartDate.value = new Date(
      props.modelValue.start.getFullYear(),
      props.modelValue.start.getMonth(),
      props.modelValue.start.getDate()
    );
    const hours = String(props.modelValue.start.getHours()).padStart(2, "0");
    const minutes = String(props.modelValue.start.getMinutes()).padStart(
      2,
      "0"
    );
    startTime.value = `${hours}:${minutes}`;
  } else {
    selectedStartDate.value = null;
    startTime.value = "00:00";
  }

  if (props.modelValue?.end) {
    selectedEndDate.value = new Date(
      props.modelValue.end.getFullYear(),
      props.modelValue.end.getMonth(),
      props.modelValue.end.getDate()
    );
    const hours = String(props.modelValue.end.getHours()).padStart(2, "0");
    const minutes = String(props.modelValue.end.getMinutes()).padStart(2, "0");
    endTime.value = `${hours}:${minutes}`;
  } else {
    selectedEndDate.value = null;
    endTime.value = "23:59";
  }

  // 检查是否匹配快捷选项
  activeQuickOption.value = null;
  if (props.modelValue?.start) {
    for (const option of quickOptions) {
      const range = option.getRange();
      if (
        formatDateKey(props.modelValue.start) === formatDateKey(range.start) &&
        (!props.modelValue.end ||
          !range.end ||
          formatDateKey(props.modelValue.end) === formatDateKey(range.end))
      ) {
        activeQuickOption.value = option.key;
        break;
      }
    }
  }
}

// 监听 props 变化
watch(
  () => props.modelValue,
  () => {
    initializeFromProps();
  },
  { deep: true, immediate: true }
);

// 格式化日期为键值
function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

// 判断日期是否被选中
function isDateSelected(date: Date): boolean {
  if (!selectedStartDate.value) return false;
  const dateStr = formatDateKey(date);
  const startStr = formatDateKey(selectedStartDate.value);
  if (selectedEndDate.value) {
    const endStr = formatDateKey(selectedEndDate.value);
    return dateStr >= startStr && dateStr <= endStr;
  }
  return dateStr === startStr;
}

// 判断是否是开始日期
function isStartDate(date: Date): boolean {
  if (!selectedStartDate.value) return false;
  return formatDateKey(date) === formatDateKey(selectedStartDate.value);
}

// 判断是否是结束日期
function isEndDate(date: Date): boolean {
  if (!selectedEndDate.value) return false;
  return formatDateKey(date) === formatDateKey(selectedEndDate.value);
}

// 获取左侧日历的月份
const leftMonth = computed(() => {
  return new Date(
    currentViewDate.value.getFullYear(),
    currentViewDate.value.getMonth(),
    1
  );
});

// 获取右侧日历的月份
const rightMonth = computed(() => {
  return new Date(
    currentViewDate.value.getFullYear(),
    currentViewDate.value.getMonth() + 1,
    1
  );
});

// 渲染月份数据
function getMonthDays(
  date: Date
): Array<{ date: Date; isCurrentMonth: boolean }> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const prevLastDay = new Date(year, month, 0).getDate();

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // 填充上月末尾
  for (let i = firstDay; i > 0; i--) {
    const dayDate = new Date(year, month - 1, prevLastDay - i + 1);
    days.push({ date: dayDate, isCurrentMonth: false });
  }

  // 填充本月
  for (let d = 1; d <= lastDay; d++) {
    const dayDate = new Date(year, month, d);
    days.push({ date: dayDate, isCurrentMonth: true });
  }

  // 填充下月初，保持 6 行（42天）
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const dayDate = new Date(year, month + 1, i);
    days.push({ date: dayDate, isCurrentMonth: false });
  }

  return days;
}

// 左侧日历天数
const leftCalendarDays = computed(() => getMonthDays(leftMonth.value));

// 右侧日历天数
const rightCalendarDays = computed(() => getMonthDays(rightMonth.value));

// 左侧月份文本
const leftMonthText = computed(() => {
  const year = leftMonth.value.getFullYear();
  const month = leftMonth.value.getMonth() + 1;
  return `${year}年 ${month}月`;
});

// 右侧月份文本
const rightMonthText = computed(() => {
  const year = rightMonth.value.getFullYear();
  const month = rightMonth.value.getMonth() + 1;
  return `${year}年 ${month}月`;
});

// 星期标题
const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

// 选择日期
function selectDate(date: Date) {
  if (
    !selectedStartDate.value ||
    (selectedEndDate.value && date < selectedStartDate.value)
  ) {
    // 选择开始日期
    selectedStartDate.value = new Date(date);
    selectedEndDate.value = null;
    activeQuickOption.value = null;
  } else if (!selectedEndDate.value || date >= selectedStartDate.value) {
    // 选择结束日期
    selectedEndDate.value = new Date(date);
    activeQuickOption.value = null;
  } else {
    // 如果选择的日期早于开始日期，交换它们
    selectedEndDate.value = selectedStartDate.value;
    selectedStartDate.value = new Date(date);
    activeQuickOption.value = null;
  }
}

// 改变月份
function changeMonth(offset: number) {
  const newDate = new Date(currentViewDate.value);
  newDate.setMonth(newDate.getMonth() + offset);
  currentViewDate.value = newDate;
}

// 选择快捷选项
function selectQuickOption(option: QuickOption) {
  const range = option.getRange();
  selectedStartDate.value = new Date(
    range.start.getFullYear(),
    range.start.getMonth(),
    range.start.getDate()
  );
  const startHours = String(range.start.getHours()).padStart(2, "0");
  const startMinutes = String(range.start.getMinutes()).padStart(2, "0");
  startTime.value = `${startHours}:${startMinutes}`;

  if (range.end) {
    selectedEndDate.value = new Date(
      range.end.getFullYear(),
      range.end.getMonth(),
      range.end.getDate()
    );
    const endHours = String(range.end.getHours()).padStart(2, "0");
    const endMinutes = String(range.end.getMinutes()).padStart(2, "0");
    endTime.value = `${endHours}:${endMinutes}`;
  } else {
    selectedEndDate.value = null;
    endTime.value = "23:59";
  }

  activeQuickOption.value = option.key;

  // 更新视图日期到开始日期
  currentViewDate.value = new Date(range.start);

  // 不关闭弹出框，让用户可以继续调整时间
  // applyTimeRange();
}

// 应用时间范围
function applyTimeRange() {
  if (!selectedStartDate.value) return;

  const startTimeParts = startTime.value.split(":").map(Number);
  const startHour = startTimeParts[0] ?? 0;
  const startMinute = startTimeParts[1] ?? 0;
  const start = new Date(selectedStartDate.value);
  start.setHours(startHour, startMinute, 0, 0);

  let end: Date | null = null;
  if (selectedEndDate.value) {
    const endTimeParts = endTime.value.split(":").map(Number);
    const endHour = endTimeParts[0] ?? 23;
    const endMinute = endTimeParts[1] ?? 59;
    end = new Date(selectedEndDate.value);
    end.setHours(endHour, endMinute, 59, 999);
  }

  emit("update:modelValue", { start, end });
  isOpen.value = false;
}

// 取消选择
function cancelSelection() {
  isOpen.value = false;
}

// 清除时间范围
function clearTimeRange() {
  selectedStartDate.value = null;
  selectedEndDate.value = null;
  startTime.value = "00:00";
  endTime.value = "23:59";
  activeQuickOption.value = null;
  emit("update:modelValue", { start: null, end: null });
  isOpen.value = false;
}

// 判断两个日期是否是同一天
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// 格式化只显示时间
function formatTimeOnly(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// 格式化只显示日期
function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 格式化显示文本（完整日期时间，用于没有结束时间的情况）
function formatDisplayDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 计算显示文本
const displayText = computed(() => {
  if (!props.modelValue?.start) {
    return "选择时间范围";
  }

  const start = props.modelValue.start;

  if (!props.modelValue?.end) {
    return `从 ${formatDisplayDateTime(start)}`;
  }

  const end = props.modelValue.end;

  // 如果是同一天，只显示时间
  if (isSameDay(start, end)) {
    const startTimeStr = formatTimeOnly(start);
    const endTimeStr = formatTimeOnly(end);
    return `${startTimeStr} - ${endTimeStr}`;
  }

  // 如果不是同一天，只显示日期
  const startDateStr = formatDateOnly(start);
  const endDateStr = formatDateOnly(end);
  return `${startDateStr} - ${endDateStr}`;
});

// 计算下拉面板位置
function updateDropdownPosition() {
  if (!triggerRef.value || !isOpen.value) return;

  const rect = triggerRef.value.getBoundingClientRect();
  const margin = 16; // 屏幕边缘边距
  const dropdownWidth = 800; // 下拉面板宽度
  const viewportWidth = window.innerWidth;

  // 计算左侧位置，确保有边距
  let left = rect.left + window.scrollX;

  // 如果下拉面板会超出右边缘，调整位置
  if (left + dropdownWidth + margin > viewportWidth + window.scrollX) {
    left = viewportWidth + window.scrollX - dropdownWidth - margin;
  }

  // 确保左侧也有边距
  if (left < window.scrollX + margin) {
    left = window.scrollX + margin;
  }

  // 计算顶部位置，确保有边距
  const topMargin = 8;
  let top = rect.bottom + window.scrollY + topMargin;

  // 如果下方空间不够，显示在上方
  const viewportHeight = window.innerHeight;
  const dropdownHeight = 500; // 估算下拉面板高度
  if (rect.bottom + dropdownHeight + margin > viewportHeight) {
    top = rect.top + window.scrollY - dropdownHeight - topMargin;
    // 如果上方也不够，至少确保顶部有边距
    if (top < window.scrollY + margin) {
      top = window.scrollY + margin;
    }
  }

  dropdownStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${Math.min(dropdownWidth, viewportWidth - margin * 2)}px`,
  };
}

// 监听窗口大小和滚动
watch(isOpen, async (newVal) => {
  if (newVal) {
    await nextTick();
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
  } else {
    window.removeEventListener("resize", updateDropdownPosition);
    window.removeEventListener("scroll", updateDropdownPosition, true);
  }
});

// 点击外部关闭
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest(".time-range-picker")) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  initializeFromProps();
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <div class="relative time-range-picker">
    <!-- 触发按钮 -->
    <button
      ref="triggerRef"
      @click.stop="isOpen = !isOpen"
      type="button"
      class="w-full bg-white border border-slate-200 text-sm rounded-lg pl-9 pr-4 py-2 text-left focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:border-slate-300"
      :class="{
        'text-slate-900': modelValue?.start,
        'text-slate-400': !modelValue?.start,
      }"
    >
      <svg
        class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span class="block truncate text-xs">{{ displayText }}</span>
    </button>

    <!-- 下拉面板 -->
    <Teleport to="body" v-if="isOpen">
      <div
        @click.stop
        class="fixed bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col md:flex-row"
        :style="{
          top: dropdownStyle.top,
          left: dropdownStyle.left,
          width: dropdownStyle.width,
          zIndex: 9999,
        }"
      >
        <!-- 左侧快捷栏 -->
        <div
          class="w-full md:w-40 bg-slate-50 p-4 border-b md:border-b-0 md:border-r border-slate-200 space-y-1"
        >
          <p
            class="text-[11px] font-bold text-slate-400 mb-3 uppercase tracking-wider px-2"
          >
            快捷方案
          </p>
          <button
            v-for="option in quickOptions"
            :key="option.key"
            @click="selectQuickOption(option)"
            type="button"
            class="w-full text-left px-3 py-1.5 text-xs transition-all relative"
            :class="{
              'text-indigo-600 bg-white font-semibold':
                activeQuickOption === option.key,
              'text-slate-600 hover:bg-white': activeQuickOption !== option.key,
            }"
          >
            <span
              v-if="activeQuickOption === option.key"
              class="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-600"
            ></span>
            {{ option.label }}
          </button>
        </div>

        <!-- 中间双日历区域 -->
        <div class="p-6 flex flex-col gap-6 flex-1">
          <div class="flex flex-col sm:flex-row gap-8">
            <!-- 开始日期日历 (左) -->
            <div class="w-64">
              <div class="flex items-center justify-between mb-4">
                <button
                  @click="changeMonth(-1)"
                  type="button"
                  class="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M15 19l-7-7 7-7"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <span class="text-sm font-bold text-slate-700">{{
                  leftMonthText
                }}</span>
                <div class="w-6"></div>
              </div>

              <div
                class="grid grid-cols-7 text-[10px] font-bold text-slate-400 mb-2 text-center"
              >
                <div v-for="day in weekDays" :key="day">{{ day }}</div>
              </div>
              <div
                class="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-lg overflow-hidden text-xs"
              >
                <button
                  v-for="(day, index) in leftCalendarDays"
                  :key="index"
                  @click="selectDate(day.date)"
                  type="button"
                  :class="[
                    'py-2 text-center transition-colors',
                    {
                      'bg-white text-slate-200': !day.isCurrentMonth,
                      'bg-white text-slate-700 hover:bg-indigo-50 cursor-pointer':
                        day.isCurrentMonth &&
                        !isDateSelected(day.date) &&
                        !isStartDate(day.date) &&
                        !isEndDate(day.date),
                      'bg-indigo-600 text-white font-bold':
                        isStartDate(day.date) || isEndDate(day.date),
                      'bg-indigo-50 text-indigo-700 cursor-pointer':
                        isDateSelected(day.date) &&
                        !isStartDate(day.date) &&
                        !isEndDate(day.date),
                    },
                  ]"
                >
                  {{ day.date.getDate() }}
                </button>
              </div>
            </div>

            <!-- 结束日期日历 (右) -->
            <div class="w-64">
              <div class="flex items-center justify-between mb-4">
                <div class="w-6"></div>
                <span class="text-sm font-bold text-slate-700">{{
                  rightMonthText
                }}</span>
                <button
                  @click="changeMonth(1)"
                  type="button"
                  class="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                >
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 5l7 7-7 7"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <div
                class="grid grid-cols-7 text-[10px] font-bold text-slate-400 mb-2 text-center"
              >
                <div v-for="day in weekDays" :key="day">{{ day }}</div>
              </div>
              <div
                class="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-lg overflow-hidden text-xs"
              >
                <button
                  v-for="(day, index) in rightCalendarDays"
                  :key="index"
                  @click="selectDate(day.date)"
                  type="button"
                  :class="[
                    'py-2 text-center transition-colors',
                    {
                      'bg-white text-slate-200': !day.isCurrentMonth,
                      'bg-white text-slate-700 hover:bg-indigo-50 cursor-pointer':
                        day.isCurrentMonth &&
                        !isDateSelected(day.date) &&
                        !isStartDate(day.date) &&
                        !isEndDate(day.date),
                      'bg-indigo-600 text-white font-bold':
                        isStartDate(day.date) || isEndDate(day.date),
                      'bg-indigo-50 text-indigo-700 cursor-pointer':
                        isDateSelected(day.date) &&
                        !isStartDate(day.date) &&
                        !isEndDate(day.date),
                    },
                  ]"
                >
                  {{ day.date.getDate() }}
                </button>
              </div>
            </div>
          </div>

          <!-- 底部时间与操作 -->
          <div
            class="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-slate-100 gap-4"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex items-center bg-slate-100 rounded-lg px-3 py-1.5"
              >
                <span
                  class="text-[10px] font-bold text-slate-400 mr-2 uppercase"
                  >From</span
                >
                <input
                  v-model="startTime"
                  type="time"
                  class="bg-transparent text-sm font-medium outline-none text-slate-700"
                />
              </div>
              <span class="text-slate-300">—</span>
              <div
                class="flex items-center bg-slate-100 rounded-lg px-3 py-1.5"
              >
                <span
                  class="text-[10px] font-bold text-slate-400 mr-2 uppercase"
                  >To</span
                >
                <input
                  v-model="endTime"
                  type="time"
                  class="bg-transparent text-sm font-medium outline-none text-slate-700"
                />
              </div>
            </div>

            <div class="flex items-center gap-3 w-full sm:w-auto">
              <button
                @click="cancelSelection"
                type="button"
                class="flex-1 sm:flex-none px-6 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                @click="applyTimeRange"
                type="button"
                :disabled="!selectedStartDate"
                class="flex-1 sm:flex-none px-8 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(0.5);
  cursor: pointer;
}
</style>
