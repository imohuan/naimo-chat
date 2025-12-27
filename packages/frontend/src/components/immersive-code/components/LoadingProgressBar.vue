<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    isLoading?: boolean;
    isError?: boolean;
  }>(),
  {
    isLoading: false,
    isError: false,
  }
);

const progressClass = computed(() => {
  if (props.isError) {
    return "bg-red-500";
  }
  return "bg-blue-500";
});

const showProgress = computed(() => {
  return props.isLoading || props.isError;
});
</script>

<template>
  <div
    :class="[
      'h-0.5 w-full transition-all duration-300 overflow-hidden',
      showProgress ? 'opacity-100' : 'opacity-0',
    ]"
  >
    <div
      :class="[
        'h-full transition-all duration-300',
        progressClass,
        showProgress ? 'w-full' : 'w-0',
      ]"
    ></div>
  </div>
</template>
