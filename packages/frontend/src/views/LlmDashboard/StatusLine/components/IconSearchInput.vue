<script setup lang="ts">
import { ref, watch, computed, onMounted, nextTick } from "vue";
import { onClickOutside } from "@vueuse/core";
import Input from "@/components/llm/Input.vue";

interface IconData {
  id: string;
  unicode: string;
  char: string;
}

// 使用 emoji 文字图标，参考 icon.html
const EMOJI_ICONS: string[] = [
  // 情绪
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "🥲",
  "😊",
  "😇",
  "🙂",
  "😉",
  "😌",
  "😍",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😜",
  "🤪",
  "😝",
  "🤗",
  "🤭",
  "🤫",
  "🤔",
  "🫡",
  "😮",
  "😴",
  "🤒",
  "🤕",
  "🤯",
  "🥳",
  "😎",
  // 食物与饮品
  "🍎",
  "🍊",
  "🍋",
  "🍌",
  "🍉",
  "🍇",
  "🍓",
  "🥝",
  "🍅",
  "🍆",
  "🌶️",
  "🌽",
  "🍄",
  "🌰",
  "🍞",
  "🥐",
  "🥨",
  "🥯",
  "🧇",
  "🧀",
  "🥩",
  "🍗",
  "🍔",
  "🍟",
  "🍕",
  "🌭",
  "🥪",
  "🌮",
  "🌯",
  "🍜",
  "🍲",
  "🍛",
  "🍣",
  "🍤",
  "🍚",
  "🍙",
  "🎂",
  "🍰",
  "🧁",
  "🍩",
  "🍪",
  "🍬",
  "🍭",
  "🍫",
  "🍯",
  "🥛",
  "☕",
  "🍵",
  "🍺",
  "🥂",
  "🍾",
  "🍷",
  "🍹",
  "🍸",
  "🧉",
  "🧊",
  "🥄",
  "🍴",
  "🍽️",
  "🥡",
  // 建筑与地点
  "🏠",
  "🏢",
  "🏭",
  "🏥",
  "🏦",
  "🏨",
  "🏫",
  "🏬",
  "🏟️",
  "🗼",
  "🗽",
  "🕌",
  "⛪",
  "🕍",
  "⛩️",
  "🕋",
  "⛲",
  "⛺",
  "🏞️",
  "🌅",
  "🌄",
  "🌇",
  "🌉",
  "🌃",
  // 交通与旅行
  "🚗",
  "🚕",
  "🚙",
  "🚌",
  "🚎",
  "🏎️",
  "🚓",
  "🚑",
  "🚒",
  "🚐",
  "🛻",
  "🚚",
  "🚢",
  "✈️",
  "🚀",
  "🛰️",
  "🚁",
  "🚂",
  "🚆",
  "🚇",
  "🚊",
  "🚋",
  "🚲",
  "🛴",
  "🚦",
  "🚧",
  "🚨",
  "⛽",
  "🗺️",
  "📍",
  "🧭",
  "⚓",
  "🛟",
  "⛵",
  "🛶",
  "🚤",
  // 符号与抽象
  "⭐",
  "✨",
  "🔥",
  "🌈",
  "☀️",
  "🌙",
  "🌧️",
  "⚡",
  "❄️",
  "🌊",
  "🔔",
  "💡",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🤎",
  "🖤",
  "🤍",
  "💔",
  "💯",
  "✅",
  "❓",
  "❗",
  "ℹ️",
  "➕",
  "➖",
  "✖️",
  "➗",
  "🔗",
  "🔒",
  "🔑",
  "♻️",
  "☢️",
  "⚠️",
  "🛑",
  "🚫",
  "🅿️",
  "♿",
  "🈳",
  "🈶",
  "🈚",
  "🈸",
  "㊙️",
  "㊗️",
  "🉐",
  "💰",
  "💳",
  "💱",
  "💲",
  "🧾",
  "🪙",
  "⚖️",
  "📅",
  "🗓️",
  "📆",
  "📁",
  "📄",
  "📝",
  "✏️",
  "🖍️",
  "🖌️",
  "✂️",
  "📌",
  "📎",
  "📏",
  "📐",
  "📘",
  "📗",
  "📙",
  "📚",
  "📖",
  "📰",
  "🔖",
  "🏷️",
  "📣",
  "📢",
  "🎙️",
  "🎧",
  "📻",
  "📹",
  "📷",
  "💻",
  "📱",
  "⌚",
  "📺",
  "🖱️",
  "💿",
  "💾",
  "💽",
  "🌐",
  "📧",
  "📥",
  "📤",
  // 动物与自然
  "🐕",
  "🐈",
  "🐒",
  "🐘",
  "🐅",
  "🐟",
  "🐢",
  "🐍",
  "🐥",
  "🦉",
  "🦋",
  "🐞",
  "🐻",
  "🐼",
  "🦊",
  "🦁",
  "🐴",
  "🦌",
  "🦅",
  "🦢",
  "🐬",
  "🐳",
  "🦀",
  "🦐",
  "🌴",
  "🌲",
  "🌳",
  "🌿",
  "☘️",
  "🌾",
  "🌸",
  "🌷",
  "🌹",
  "🌻",
  "🌼",
  "🌵",
  // 活动与体育
  "⚽",
  "🏀",
  "🏈",
  "🎾",
  "🎲",
  "🧩",
  "🎮",
  "🕹️",
  "🎯",
  "🎱",
  "🎳",
  "⛸️",
  "⛷️",
  "🏂",
  "🏄",
  "🚣",
  "🏊",
  "🏋️",
  "🏃",
  "🚶",
  "💃",
  "🧗",
  "🧘",
  "🎤",
  // 手势与人物（重点行 383-412）
  "👍",
  "👎",
  "👏",
  "🙏",
  "👀",
  "👤",
  "👥",
  "🫂",
  "🖐️",
  "✊",
  "🤞",
  "🤟",
  "🤘",
  "🤙",
  "🤚",
  "🤛",
  "🤜",
  "☝️",
  "👇",
  "👈",
  "👉",
  "👆",
  "⬇️",
  "➡️",
];

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const inputValue = ref(props.modelValue || "");
const isOpen = ref(false);
const icons = ref<IconData[]>([]);
const filteredIcons = ref<IconData[]>([]);
const isLoading = ref(false);
const searchTerm = ref("");
const inputWrapperRef = ref<HTMLElement | null>(null);
const inputEl = computed(
  () => inputWrapperRef.value?.querySelector("input") as HTMLInputElement | null
);
const containerRef = ref<HTMLElement | null>(null);

watch(
  () => props.modelValue,
  (val) => {
    inputValue.value = val || "";
    searchTerm.value = val || "";
  },
  { immediate: true }
);

watch(inputValue, (val) => {
  emit("update:modelValue", val);
});

// 加载图标数据
async function loadIcons() {
  if (icons.value.length > 0) return;
  isLoading.value = true;
  const iconData: IconData[] = EMOJI_ICONS.filter(
    (char) => !!char && char.trim() !== ""
  ).map((char, idx) => {
    const code = char.codePointAt(0);
    const unicode = code ? code.toString(16).toUpperCase() : "";
    return {
      id: `${unicode}-${idx}`,
      unicode,
      char,
    };
  });
  icons.value = iconData;
  filteredIcons.value = iconData;
  isLoading.value = false;
}

// 不做搜索过滤，输入仅用于自定义展示
watch(
  icons,
  () => {
    filteredIcons.value = icons.value;
  },
  { immediate: true }
);

function handleInputChange(e: Event) {
  const newValue = (e.target as HTMLInputElement).value;
  inputValue.value = newValue;
  searchTerm.value = newValue;
  if (icons.value.length === 0) {
    loadIcons();
  }
}

function handlePaste(e: ClipboardEvent) {
  const pastedText = e.clipboardData?.getData("text");
  if (pastedText && pastedText.length === 1) {
    inputValue.value = pastedText;
    searchTerm.value = pastedText;
  }
}

function handleEnter() {
  emit("update:modelValue", inputValue.value);
  isOpen.value = false;
  nextTick(() => {
    inputEl.value?.blur();
  });
}

function handleIconSelect(iconChar: string) {
  inputValue.value = iconChar;
  searchTerm.value = iconChar;
  emit("update:modelValue", iconChar);
  isOpen.value = false;
  nextTick(() => {
    inputEl.value?.blur();
  });
}

function toggleDropdown() {
  isOpen.value = !isOpen.value;
}

function handleFocus() {
  isOpen.value = true;
  if (icons.value.length === 0) {
    loadIcons();
  }
}

function handleBlur(event: FocusEvent) {
  const next = event.relatedTarget as Node | null;
  if (next && containerRef.value?.contains(next)) return;
  setTimeout(() => {
    if (!containerRef.value?.contains(document.activeElement)) {
      isOpen.value = false;
    }
  }, 0);
}


onMounted(() => {
  loadIcons();
});

onClickOutside(containerRef, () => {
  isOpen.value = false;
});
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <!-- 输入框和按钮组合 -->
    <div ref="inputWrapperRef" class="relative flex items-center text-2xl">
      <Input
        :model-value="inputValue"
        class="h-12 pr-10 flex-1"
        placeholder="输入或粘贴图标..."
        @input="handleInputChange"
        @focus="handleFocus"
        @blur="handleBlur"
        @paste="handlePaste"
        @keydown.enter.prevent="handleEnter"
      />
      <!-- 下拉箭头按钮 -->
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
        @click.stop="toggleDropdown"
      >
        <svg
          class="w-5 h-5 transform transition-transform duration-200"
          :class="{ 'rotate-180': isOpen }"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    <!-- 图标下拉面板 -->
    <div
      class="absolute z-10 mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 p-2 max-h-96 overflow-y-auto transform origin-top transition-transform duration-200"
      :class="
        isOpen ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0 pointer-events-none'
      "
      aria-expanded="false"
      aria-hidden="true"
    >
      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex items-center justify-center p-8">
        <div
          class="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent"
        ></div>
        <span class="ml-2 text-sm text-slate-500">加载图标中...</span>
      </div>

      <!-- 图标网格 -->
      <div
        v-else-if="filteredIcons.length > 0"
        class="grid gap-2"
        style="grid-template-columns: repeat(auto-fit, minmax(35px, 1fr))"
      >
        <div
          v-for="icon in filteredIcons"
          :key="icon.id"
          class="flex items-center justify-center p-2 min-w-[48px] h-12 aspect-square cursor-pointer text-2xl rounded-md hover:bg-blue-100 transition duration-100 ease-in-out"
          :title="`U+${icon.unicode}`"
          @mousedown.prevent
          @click="handleIconSelect(icon.char)"
        >
          <span
            v-if="icon.char && icon.char.trim() !== '' && icon.char !== ' '"
            class="leading-none"
          >
            {{ icon.char }}
          </span>
          <span v-else class="text-[10px] text-slate-400 leading-none"
            >U+{{ icon.unicode }}</span
          >
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="flex flex-col items-center justify-center p-8 text-slate-400">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="mb-2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <div class="text-sm">
          {{
            searchTerm
              ? `未找到图标 "${searchTerm}"`
              : isLoading
              ? "加载中..."
              : "暂无可用图标"
          }}
        </div>
      </div>
    </div>
  </div>
</template>
