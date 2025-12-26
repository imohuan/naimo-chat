<script setup lang="ts">
import { ref } from "vue";
import { ImmersiveCode } from "@/components/immersive-code";

const immersiveRef = ref();
const enableShare = ref(false);

function handleAddMajorVersion() {
  if (immersiveRef.value) {
    immersiveRef.value.addMajorVersion(
      undefined,
      `Major Version ${new Date().toLocaleTimeString()}`
    );
  }
}

function handleGetCode() {
  if (immersiveRef.value) {
    const code = immersiveRef.value.getCurrentCode();
    console.log(code);
    alert("Current Code retrieved! Check console.");
  }
}
</script>

<template>
  <div class="w-full h-screen p-8 bg-slate-100 flex flex-col items-center">
    <div class="w-full max-w-5xl">
      <div class="mb-4 flex items-end justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">
            Immersive Code Component Test
          </h1>
          <p class="text-slate-500">
            Testing the history, preview, and console integration.
          </p>
        </div>

        <!-- Test Controls -->
        <div
          class="flex items-center space-x-4 bg-white p-2 rounded-lg border border-slate-200"
        >
          <label
            class="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer"
          >
            <input
              type="checkbox"
              v-model="enableShare"
              class="rounded text-purple-600 focus:ring-purple-500"
            />
            <span>Enable Share</span>
          </label>

          <div class="h-4 w-px bg-slate-200"></div>

          <button
            @click="handleAddMajorVersion"
            class="px-3 py-1 text-sm bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition font-medium"
          >
            Add Major Version
          </button>

          <button
            @click="handleGetCode"
            class="px-3 py-1 text-sm bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition font-medium"
          >
            Get Current Code
          </button>
        </div>
      </div>

      <ImmersiveCode ref="immersiveRef" :enable-share="enableShare" />
    </div>
  </div>
</template>
