<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface QueueListProps {
  class?: HTMLAttributes["class"];
  maxHeight?: string | null; // 如果为 null，则不限制高度
}

const props = withDefaults(defineProps<QueueListProps>(), {
  maxHeight: "max-h-40",
});
</script>

<template>
  <ScrollArea :class="cn('-mb-1 mt-2', props.class)" v-bind="$attrs">
    <div :class="[props.maxHeight, 'pr-4']">
      <ul>
        <slot />
      </ul>
    </div>
  </ScrollArea>
</template>
