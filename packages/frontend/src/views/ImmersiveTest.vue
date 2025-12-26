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

// 单处 diff 示例
function handleApplyDiff() {
  if (immersiveRef.value) {
    const diffContent = `------- SEARCH
<p class="font-mono text-sm">Hello World</p>
=======
<p class="font-mono text-sm">Hello Immersive World</p>
<p class="text-xs text-gray-300 mt-2">Power by Naimo</p>
+++++++ REPLACE
`;
    const result = immersiveRef.value.diff(diffContent);
    if (result.success) {
      // Alert is optional now as UI opens, but helpful for confirmation
      console.log("Diff UI Opened");
    } else {
      alert(`Diff 失败：${result.message}`);
    }
  }
}

// 多处 diff 示例
function handleApplyMultipleDiff() {
  if (immersiveRef.value) {
    const diffContent = `------- SEARCH
<h1 class="text-4xl font-bold mb-4">Code Immersive</h1>
=======
<h1 class="text-4xl font-bold mb-4">代码沉浸式编辑器</h1>
+++++++ REPLACE
------- SEARCH
<p class="text-lg opacity-90 mb-8">Edit the code to see live changes!</p>
=======
<p class="text-lg opacity-90 mb-8">编辑代码以查看实时更改！</p>
+++++++ REPLACE
`;
    const result = immersiveRef.value.diff(diffContent);
    if (result.success) {
      console.log("Diff UI Opened for multiple changes");
    } else {
      alert(`多处 Diff 失败：${result.message}`);
    }
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

          <button
            @click="handleApplyDiff"
            class="px-3 py-1 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition font-medium"
          >
            应用单处 Diff
          </button>

          <button
            @click="handleApplyMultipleDiff"
            class="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition font-medium"
          >
            应用多处 Diff
          </button>
        </div>
      </div>

      <ImmersiveCode ref="immersiveRef" :enable-share="enableShare" />
    </div>
  </div>
</template>
