<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

interface Props {
  class?: HTMLAttributes["class"];
}

const props = defineProps<Props>();
</script>

<template>
  <div
    :class="
      cn(
        // 預設訊息內容佔滿可用寬度；只有使用者訊息才縮到內容寬度
        'is-user:dark flex flex-col gap-2 text-sm w-full group-[.is-user]:w-fit',
        'group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground',
        'group-[.is-assistant]:text-foreground',
        props.class
      )
    "
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>
