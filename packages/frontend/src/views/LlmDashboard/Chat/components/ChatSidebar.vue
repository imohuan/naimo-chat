<script setup lang="ts">
import {
  ChatBubbleOutlineRound,
  DeleteForeverRound,
  MenuRound,
  SearchRound,
  AddRound,
} from "@vicons/material";
import { onMounted, onBeforeUnmount } from "vue";

type ConversationItem = {
  id: string;
  title: string;
};

const props = defineProps<{
  sidebarCollapsed: boolean;
  conversations: ConversationItem[];
  activeConversationId?: string | null;
}>();

const emit = defineEmits<{
  "toggle:sidebar": [];
  "conversation:create": [];
  "conversation:select": [id: string];
  "conversation:delete": [id: string];
}>();

function handleToggleSidebar() {
  emit("toggle:sidebar");
}

function handleCreateConversation() {
  emit("conversation:create");
}

function handleSelectConversation(id: string) {
  emit("conversation:select", id);
}

function handleDeleteConversation(id: string) {
  emit("conversation:delete", id);
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === "Tab") {
    event.preventDefault();
    emit("toggle:sidebar");
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});
</script>

<template>
  <aside
    class="h-full bg-white border-r border-gray-200 dark:bg-slate-950/50 flex flex-col transition-all duration-200"
    :class="sidebarCollapsed ? 'w-16' : 'w-72'"
  >
    <!-- 折叠状态：仅显示图标按钮 -->
    <template v-if="sidebarCollapsed">
      <div
        class="flex flex-col items-center gap-4 py-3 text-slate-600 dark:text-slate-200"
      >
        <button
          class="inline-flex items-center justify-center rounded-full p-2 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors"
          type="button"
          @click="handleToggleSidebar"
        >
          <MenuRound class="w-5 h-5" />
        </button>
        <button
          class="inline-flex items-center justify-center rounded-full p-2 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors"
          type="button"
          @click="handleCreateConversation"
        >
          <AddRound class="w-5 h-5" />
        </button>
      </div>
    </template>

    <!-- 展开状态：顶部工具栏 + 对话列表 -->
    <template v-else>
      <div class="flex items-center justify-between px-3 py-2 dark:bg-slate-950/60">
        <div class="flex items-center gap-3">
          <button
            class="inline-flex items-center justify-center rounded-full p-2 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-200"
            type="button"
            @click="handleToggleSidebar"
          >
            <MenuRound class="w-5 h-5" />
          </button>
          <!-- <span class="text-xs font-semibold text-slate-600 dark:text-slate-200">
            对话列表
          </span> -->
        </div>

        <button
          class="inline-flex items-center justify-center rounded-full p-2 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-300"
          type="button"
        >
          <SearchRound class="w-4 h-4" />
        </button>
      </div>

      <div class="px-2">
        <button
          class="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:bg-slate-800 transition-colors"
          type="button"
          @click="handleCreateConversation"
        >
          <AddRound class="w-4 h-4" />
          <span class="whitespace-nowrap">发起新对话</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <ul class="space-y-0.5 px-2 pb-3 pt-2">
          <li
            v-for="c in conversations"
            :key="c.id"
            class="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors"
            :class="
              c.id === activeConversationId
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-900/70 dark:text-slate-50'
                : 'text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-900/60'
            "
            @click="handleSelectConversation(c.id)"
          >
            <ChatBubbleOutlineRound
              class="w-4 h-4 shrink-0 text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-200"
            />
            <span class="line-clamp-1 flex-1 text-left">
              {{ c.title || "新对话" }}
            </span>
            <button
              class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
              type="button"
              @click.stop="handleDeleteConversation(c.id)"
            >
              <DeleteForeverRound class="w-3.5 h-3.5" />
            </button>
          </li>
        </ul>
      </div>
    </template>
  </aside>
</template>
