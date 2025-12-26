<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { CloseOutlined, CodeOutlined, RefreshOutlined } from "@vicons/material";
import CodeEditor from "@/components/code/CodeEditor.vue";

const props = defineProps<{
  show: boolean;
  jsonValue: string;
  error: string;
  isSaving?: boolean;
  title?: string;
  description?: string;
  saveButtonText?: string;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  "update:jsonValue": [value: string];
  save: [];
}>();

const show = useVModel(props, "show", emit);
const jsonValue = useVModel(props, "jsonValue", emit);

const defaultTitle = "编辑配置 JSON";
const defaultDescription = "编辑完整的配置 JSON，保存后将立即重启服务。";
const defaultSaveButtonText = "保存重启";
</script>

<template>
  <transition name="fade">
    <div
      v-if="show"
      class="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-7xl flex flex-col h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        <div
          class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50"
        >
          <h3 class="font-bold text-lg text-slate-800 flex items-center gap-3">
            <CodeOutlined class="w-7 h-7" />
            <span>{{ title || defaultTitle }}</span>
          </h3>
          <button class="btn-icon" @click="show = false">
            <CloseOutlined class="w-5 h-5" />
          </button>
        </div>
        <div class="flex-1 overflow-hidden bg-slate-50">
          <CodeEditor
            v-model="jsonValue"
            language="json"
            theme="vs"
            class="w-full h-full"
          />
        </div>
        <div
          class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-4"
        >
          <span v-if="error" class="text-sm text-red-600 truncate">{{ error }}</span>
          <span v-else class="text-xs text-slate-500">
            {{ description || defaultDescription }}
          </span>
          <div class="flex gap-2">
            <button class="btn-secondary" :disabled="isSaving" @click="show = false">
              取消
            </button>
            <button class="btn-primary" :disabled="isSaving" @click="emit('save')">
              <RefreshOutlined class="w-4 h-4" :class="{ 'animate-spin': isSaving }" />
              {{ isSaving ? "保存中..." : saveButtonText || defaultSaveButtonText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
