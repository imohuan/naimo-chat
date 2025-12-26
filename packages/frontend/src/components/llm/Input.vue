<template>
  <!-- 带小眼睛的密码输入 -->
  <div v-if="passwordToggle" class="relative">
    <input
      ref="el"
      :type="innerType"
      class="input-base pr-10"
      v-model="modelValue"
      :placeholder="placeholder"
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 px-2 flex items-center text-slate-400 hover:text-primary transition-colors"
      @click="toggleVisible"
    >
      <VisibilityOutlined v-if="!visible" class="w-4 h-4" />
      <VisibilityOffOutlined v-else class="w-4 h-4" />
    </button>
  </div>

  <!-- 默认文本输入，保持原有行为 -->
  <input
    v-else
    ref="el"
    :type="type"
    class="input-base"
    v-model="modelValue"
    :placeholder="placeholder"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useTemplateRef } from "vue";
import { VisibilityOutlined, VisibilityOffOutlined } from "@vicons/material";

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    type?: string;
    // 是否显示“眼睛”按钮，用于密码显示/隐藏
    passwordToggle?: boolean;
  }>(),
  {
    type: "text",
    passwordToggle: false,
  }
);

const el = useTemplateRef("el");
const modelValue = defineModel<string>();

const visible = ref(false);

const innerType = computed(() => {
  if (!props.passwordToggle) return props.type;
  return visible.value ? "text" : "password";
});

function toggleVisible() {
  visible.value = !visible.value;
}

defineExpose({ el });
</script>
