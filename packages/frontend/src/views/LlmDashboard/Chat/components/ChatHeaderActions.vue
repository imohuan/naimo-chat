<script setup lang="ts">
import { Trash2 } from "lucide-vue-next";
import Popconfirm from "@/components/llm/Popconfirm.vue";

const props = defineProps<{
  currentTab: string;
  hasMessages: boolean;
}>();

const emit = defineEmits<{
  clear: [];
}>();
</script>

<template>
  <Teleport defer to="#header-right-target" :disabled="currentTab !== 'chat'">
    <div class="flex items-center gap-2">
      <Popconfirm
        v-if="hasMessages"
        title="清空对话"
        description="确定要清空当前所有对话记录吗？此操作不可撤销。"
        type="danger"
        confirm-text="清空"
        @confirm="emit('clear')"
      >
        <template #reference="{ toggle }">
          <button
            @click="toggle"
            type="button"
            class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-md transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm hover:shadow h-8 text-slate-600"
            title="清空对话"
          >
            <Trash2 class="w-3.5 h-3.5" />
            <span>清空对话</span>
          </button>
        </template>
      </Popconfirm>
    </div>
  </Teleport>
</template>
