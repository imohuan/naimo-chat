<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import type { InputGroupVariants } from ".";
import { cn } from "@/lib/utils";
import { inputGroupAddonVariants } from ".";

const props = withDefaults(
  defineProps<{
    align?: InputGroupVariants["align"];
    class?: HTMLAttributes["class"];
  }>(),
  {
    align: "inline-start",
  }
);

function handleInputGroupAddonClick(e: MouseEvent) {
  const currentTarget = e.currentTarget as HTMLElement | null;
  const target = e.target as HTMLElement | null;
  if (target && target.closest("button")) {
    return;
  }
  if (currentTarget && currentTarget?.parentElement) {
    // 查找 input，但排除 RouterModelSelect 中的 input（通过类名识别）
    const input = currentTarget.parentElement.querySelector(
      "input:not(.router-model-select__input)"
    ) as HTMLInputElement | null;
    if (input) {
      input.focus();
    }
  }
}
</script>

<template>
  <div
    role="group"
    data-slot="input-group-addon"
    :data-align="props.align"
    :class="cn(inputGroupAddonVariants({ align: props.align }), props.class)"
    @click="handleInputGroupAddonClick"
  >
    <slot />
  </div>
</template>
