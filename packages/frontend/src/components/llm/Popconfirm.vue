<script setup lang="ts">
import { ref } from "vue";
import Dropdown from "./Dropdown.vue";
import { AlertCircle } from "lucide-vue-next";

const props = defineProps<{
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  type?: "warning" | "danger" | "info";
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const show = ref(false);

function handleConfirm() {
  show.value = false;
  emit("confirm");
}

function handleCancel() {
  show.value = false;
  emit("cancel");
}
</script>

<template>
  <Dropdown v-model:show="show" :spacing="10" show-arrow>
    <template #trigger="{ toggle }">
      <slot name="reference" :toggle="toggle" />
    </template>

    <div class="p-4 min-w-[200px] max-w-[300px]">
      <div class="flex items-start gap-3">
        <div
          v-if="type !== 'info'"
          class="shrink-0 mt-0.5"
          :class="type === 'danger' ? 'text-red-500' : 'text-amber-500'"
        >
          <AlertCircle class="w-4 h-4" />
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium text-slate-900 leading-none mb-1">
            {{ title }}
          </div>
          <div v-if="description" class="text-xs text-slate-500 leading-normal">
            {{ description }}
          </div>
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          @click="handleCancel"
          class="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
        >
          {{ cancelText || "取消" }}
        </button>
        <button
          type="button"
          @click="handleConfirm"
          class="px-2.5 py-1.5 text-xs font-medium text-white rounded-md transition-colors"
          :class="
            type === 'danger'
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-indigo-500 hover:bg-indigo-600'
          "
        >
          {{ confirmText || "确定" }}
        </button>
      </div>
    </div>
  </Dropdown>
</template>
