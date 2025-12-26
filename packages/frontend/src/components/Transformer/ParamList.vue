<script setup lang="ts">
import { computed } from "vue";
import { Plus } from "lucide-vue-next";
import ParamItem from "./ParamItem.vue";
import type { ParamField } from "./TransformerConfigList.vue";

interface ParamEntry {
  key: string;
  value: any;
  field: ParamField | undefined;
}

interface Props {
  modelValue: Record<string, any>;
  readonlyKeys?: string[];
  fields?: ParamField[];
  transformerType?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  readonlyKeys: () => [],
  fields: () => [],
  transformerType: "",
  disabled: false,
});

// 只有 CustomParamsTransformer 才允许添加自定义参数
const allowCustom = computed(() => props.transformerType === "CustomParamsTransformer");

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, any>];
}>();

// 创建字段映射
const fieldMap = computed(() => {
  const map = new Map<string, ParamField>();
  props.fields?.forEach((field) => {
    map.set(field.key, field);
  });
  return map;
});

const entries = computed({
  get: () => {
    // 显示所有参数（包括固定参数和自定义参数）
    return Object.entries(props.modelValue || {}).map(([key, value]) => {
      const field = fieldMap.value.get(key);
      return {
        key,
        value,
        field,
      };
    });
  },
  set: (newEntries: ParamEntry[]) => {
    const newValue: Record<string, any> = {};
    newEntries.forEach((entry) => {
      if (entry.key && entry.key.trim()) {
        newValue[entry.key] = entry.value;
      }
    });
    emit("update:modelValue", newValue);
  },
});

function addParam() {
  const allKeys = Object.keys(props.modelValue || {});
  let newKey = "param";
  let i = 1;
  while (allKeys.includes(newKey)) {
    newKey = `param_${i++}`;
  }
  const newEntries: ParamEntry[] = [
    ...entries.value,
    { key: newKey, value: "", field: undefined },
  ];
  entries.value = newEntries;
}

function updateParam(index: number, value: ParamEntry) {
  const newEntries = [...entries.value];
  newEntries[index] = value;
  entries.value = newEntries;
}

function removeParam(index: number) {
  const newEntries = entries.value.filter((_, i) => i !== index);
  entries.value = newEntries;
}

const hasParams = computed(() => entries.value.length > 0);
</script>

<template>
  <div class="space-y-1 relative">
    <div class="absolute top-0 left-0 w-[4px] h-full bg-gray-300"></div>

    <div
      v-for="(entry, index) in entries"
      :key="`${entry.key}-${index}`"
      class="param-item-wrapper"
    >
      <ParamItem
        :model-value="entry"
        :key-readonly="readonlyKeys.includes(entry.key)"
        :field="entry.field"
        :disabled="disabled"
        @update:model-value="(val) => updateParam(index, val)"
        @delete="removeParam(index)"
      />
    </div>

    <div
      v-if="!hasParams"
      class="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-50"
    >
      暂无参数，可点击添加
    </div>

    <button
      v-if="!disabled && allowCustom"
      class="text-[10px] text-sky-600 hover:text-sky-800 font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded transition"
      type="button"
      @click="addParam"
      :disabled="disabled"
    >
      <Plus class="w-2.5 h-2.5" />
      添加参数
    </button>
  </div>
</template>
