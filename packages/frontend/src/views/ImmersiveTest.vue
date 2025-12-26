<script setup lang="ts">
import { ImmersiveCode } from "@/components/immersive-code";
</script>

<template>
  <div class="w-full h-screen p-8 bg-slate-100 flex flex-col items-center">
    <div class="w-full max-w-5xl">
      <div class="mb-4">
        <h1 class="text-2xl font-bold text-slate-800">
          Immersive Code Component Test
        </h1>
        <p class="text-slate-500">
          Testing the history, preview, and console integration.
        </p>
      </div>
      <ImmersiveCode />
    </div>
  </div>
</template>
