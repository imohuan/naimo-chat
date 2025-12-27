<script setup lang="ts">
import type { UIMessage } from "ai";
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  from: UIMessage["role"];
  class?: HTMLAttributes["class"];
  maxWidth?: string;
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: "max-w-[80%]",
});
</script>

<template>
  <div
    :class="
      cn(
        'group flex w-full gap-2',
        props.maxWidth,
        props.from === 'user' ? 'is-user ml-auto justify-end' : 'is-assistant',
        props.class
      )
    "
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>
