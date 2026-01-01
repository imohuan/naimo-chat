<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import templateData from "./template.json";

interface Template {
  name: string;
  api_base_url: string;
  api_key: string;
  models: string[];
  transformer?: any;
}

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  apply: [template: Template];
}>();

const templates = ref<Template[]>(templateData as Template[]);
const selectedTemplate = ref<string | undefined>(undefined);
const searchQuery = ref("");

// 根据搜索关键词过滤模板
const filteredTemplates = computed(() => {
  if (!searchQuery.value.trim()) {
    return templates.value;
  }
  const query = searchQuery.value.trim().toLowerCase();
  return templates.value.filter((t) => t.name.toLowerCase().includes(query));
});

watch(selectedTemplate, (value) => {
  if (!value) return;

  const template = templates.value.find((t) => t.name === value);
  if (template) {
    emit("apply", template);
    // 选择后清空选择，方便再次选择同一个模板
    setTimeout(() => {
      selectedTemplate.value = undefined;
      searchQuery.value = "";
    }, 100);
  }
});
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-xs text-slate-500 whitespace-nowrap">模板：</span>
    <div class="w-40">
      <Select v-model="selectedTemplate" :disabled="disabled">
        <SelectTrigger size="sm" class="h-6 text-xs px-2 w-full">
          <SelectValue placeholder="选择模板" />
        </SelectTrigger>
        <SelectContent class="min-w-[240px]">
          <div class="p-2 border-b">
            <Input
              v-model="searchQuery"
              placeholder="搜索模板..."
              class="h-7 text-xs"
              @click.stop
            />
          </div>
          <div class="max-h-[200px] overflow-y-auto">
            <SelectItem
              v-for="template in filteredTemplates"
              :key="template.name"
              :value="template.name"
            >
              {{ template.name }}
            </SelectItem>
            <div
              v-if="filteredTemplates.length === 0"
              class="px-2 py-1.5 text-xs text-slate-400 text-center"
            >
              无匹配结果
            </div>
          </div>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>

<style scoped></style>
