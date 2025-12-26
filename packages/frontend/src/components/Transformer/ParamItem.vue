<script setup lang="ts">
import { computed } from "vue";
import { Trash2 } from "lucide-vue-next";

type ParamKind = "string" | "number" | "boolean" | "json";

interface ParamField {
  key: string;
  label: string;
  type: ParamKind;
  placeholder?: string;
  helper?: string;
}

interface Props {
  modelValue: { key: string; value: any; field?: ParamField };
  keyReadonly?: boolean;
  field?: ParamField;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  keyReadonly: false,
  field: undefined,
  disabled: false,
});

const emit = defineEmits<{
  "update:modelValue": [
    value: { key: string; value: any; field: ParamField | undefined }
  ];
  delete: [];
}>();

// 使用传入的 field 或 modelValue 中的 field
const paramField = computed(() => props.field || props.modelValue.field);
const paramType = computed(() => paramField.value?.type || "string");

const localKey = computed({
  get: () => props.modelValue.key,
  set: (val: string) => {
    if (props.keyReadonly) return;
    emit("update:modelValue", { ...props.modelValue, field: paramField.value, key: val });
  },
});

const localValue = computed({
  get: () => {
    return formatValue(props.modelValue.value);
  },
  set: (val: string) => {
    const parsedValue = parseValue(val);
    emit("update:modelValue", {
      ...props.modelValue,
      field: paramField.value,
      value: parsedValue,
    });
  },
});

function formatValue(value: any): string {
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value ?? "");
}

function parseValue(value: string): any {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      return value;
    }
  }
  if (trimmed.toLowerCase() === "true") return true;
  if (trimmed.toLowerCase() === "false") return false;
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== "") return num;
  return value;
}
</script>

<template>
  <div class="rounded bg-white px-1.5">
    <div class="flex items-center gap-1">
      <!-- Key 输入框 -->
      <div class="w-28 flex items-end gap-1 font-mono">
        <div
          v-if="keyReadonly"
          class="text-[10px] text-slate-700 whitespace-nowrap font-bold"
        >
          {{ paramField?.label || localKey }}
        </div>
        <input
          v-else
          class="param-input text-[11px] font-mono"
          :value="localKey"
          @input="(e) => (localKey = (e.target as HTMLInputElement).value)"
          placeholder="key"
          :disabled="disabled"
        />
        <span
          v-if="keyReadonly && paramField"
          class="text-[6px] uppercase tracking-wide text-slate-400 whitespace-nowrap truncate"
        >
          {{ paramType }}
        </span>
      </div>
      <!-- Value 输入框 -->
      <input
        :type="paramType === 'number' ? 'number' : 'text'"
        class="param-input text-[11px] flex-1 font-mono"
        :placeholder="paramField?.placeholder || '值 (JSON / number / boolean / string)'"
        :value="localValue"
        @input="(e) => (localValue = (e.target as HTMLInputElement).value)"
        :disabled="disabled"
      />
      <!-- 删除按钮 -->
      <button
        v-if="!keyReadonly"
        class="text-slate-400 hover:text-red-500 transition px-0.5 h-5 w-5 flex items-center justify-center rounded shrink-0"
        type="button"
        @click="emit('delete')"
        :disabled="disabled"
        title="移除参数"
      >
        <Trash2 class="w-3 h-3" />
      </button>
    </div>
    <p v-if="paramField?.helper" class="text-[9px] text-slate-400 mt-0.5">
      {{ paramField.helper }}
    </p>
  </div>
</template>

<style scoped>
@import "@/style.css";

.param-input {
  width: 100% !important;
  height: 26px !important;
  min-height: 26px !important;
  padding: 0 6px !important;
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 0.2rem !important;
  font-size: 11px !important;
  line-height: 1.5 !important;
  color: #0f172a !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02) !important;
  transition: all 0.15s ease !important;
}

.param-input::placeholder {
  color: #94a3b8 !important;
}

.param-input:focus {
  outline: none !important;
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
}

.param-input:hover {
  outline: none !important;
  border-color: #7d7ff1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
}

.param-input:disabled {
  background-color: #f1f5f9 !important;
  cursor: not-allowed !important;
}
</style>
