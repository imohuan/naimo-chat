<script setup lang="ts">
import { ref } from "vue";
import { ImmersiveCode } from "@/components/immersive-code";
import { useToasts } from "@/hooks/useToasts";

const immersiveRef = ref();
const enableShare = ref(false);
const readonly = ref(false);
const { pushToast } = useToasts();

function handleError(message: string) {
  pushToast(`错误: ${message}`, "error");
}

function handleElementSelected(selector: string, data?: any) {
  console.log("=== 选中元素信息 ===");
  console.log("选择器 (Selector):", selector);

  if (data) {
    console.log("标签名 (Tag):", data.tagName);
    console.log("ID:", data.id || "(无)");
    console.log(
      "类名 (Classes):",
      data.classList.length > 0 ? data.classList : "(无)"
    );
    console.log("文本内容 (Text):", data.textContent || "(无)");
    console.log("位置信息 (Position):", data.position);
    console.log("样式信息 (Styles):", data.styles);
    console.log("属性 (Attributes):", data.attributes);
    console.log("完整数据对象:", data);
  } else {
    console.log("完整数据:", {
      selector: selector,
      timestamp: new Date().toISOString(),
      type: "element-selected",
    });
  }

  console.log("===================");

  // 显示一个提示
  const displayText = data?.tagName
    ? `${data.tagName}${data.id ? "#" + data.id : ""}${
        data.classList.length > 0 ? "." + data.classList.join(".") : ""
      }`
    : selector;
  pushToast(`已选中元素: ${displayText}`, "success");
}

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
<h1 class="text-3xl font-bold text-gray-900 mb-2">测试UI</h1>
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

// 流式写入示例
async function handleStreamWrite() {
  if (!immersiveRef.value) return;

  const editor = immersiveRef.value;
  const baseCode = editor.getCurrentCode();

  // 模拟流式写入的代码片段
  const codeChunks = [
    baseCode.substring(0, 100),
    baseCode.substring(0, 200),
    baseCode.substring(0, 300),
    baseCode.substring(0, 400),
    baseCode.substring(0, 500),
    baseCode, // 完整代码
  ];

  pushToast("开始流式写入...", "info");

  // 开始流式写入模式
  editor.startStreaming();

  try {
    // 模拟逐字符/逐块写入
    for (let i = 0; i < codeChunks.length; i++) {
      editor.streamWrite(codeChunks[i]);
      pushToast(`流式写入中... ${i + 1}/${codeChunks.length}`, "info");
      // 等待一段时间模拟流式效果
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    pushToast("流式写入完成！", "success");
  } catch (error) {
    console.error("流式写入错误:", error);
    pushToast("流式写入失败", "error");
  } finally {
    // 结束流式写入，记录最终状态
    editor.endStreaming();
  }
}

// 流式写入示例 - 模拟 AI 代码生成
async function handleStreamWriteAI() {
  if (!immersiveRef.value) return;

  const editor = immersiveRef.value;
  const template =
    `<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>AI 生成的页面<\/title>\n  <script src="https://cdn.tailwindcss.com"><\/script>\n<\/head>\n<body class="bg-gradient-to-br from-purple-400 to-pink-400 min-h-screen flex items-center justify-center">\n  <div class="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">\n    <h1 class="text-3xl font-bold text-gray-800 mb-4">欢迎使用<\/h1>\n    <p class="text-gray-600 mb-6">这是一个由 AI 流式生成的页面<\/p>\n    <button class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition">\n      开始体验<\/button>  <\/div>\n<\/body>\n<\/html>`
      .trim()
      .replace(/\n/g, "");

  pushToast("开始 AI 流式生成代码...", "info");

  editor.startStreaming();

  try {
    // 模拟逐字符流式写入
    let currentCode = "";
    for (let i = 0; i < template.length; i++) {
      currentCode += template[i];
      editor.streamWrite(currentCode);

      // 每 10 个字符更新一次，模拟真实的流式效果
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    pushToast("AI 代码生成完成！", "success");
  } catch (error) {
    console.error("AI 流式写入错误:", error);
    pushToast("AI 代码生成失败", "error");
  } finally {
    editor.endStreaming();
  }
}

// 流式写入示例 - 增量更新
async function handleStreamWriteIncremental() {
  if (!immersiveRef.value) return;

  const editor = immersiveRef.value;
  const currentCode = editor.getCurrentCode();

  // 模拟增量添加内容
  const additions = [
    "\n<!-- 这是第一行注释 -->",
    "\n<!-- 这是第二行注释 -->",
    "\n<div class='new-section'>",
    "\n  <p>新增的内容</p>",
    "\n</div>",
  ];

  pushToast("开始增量流式写入...", "info");

  editor.startStreaming();

  try {
    let code = currentCode;
    for (let i = 0; i < additions.length; i++) {
      code += additions[i];
      editor.streamWrite(code);
      pushToast(`添加第 ${i + 1} 个片段...`, "info");
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    pushToast("增量写入完成！", "success");
  } catch (error) {
    console.error("增量流式写入错误:", error);
    pushToast("增量写入失败", "error");
  } finally {
    editor.endStreaming();
  }
}
</script>

<template>
  <div class="w-full h-screen bg-slate-100 flex flex-col overflow-hidden">
    <div class="w-full max-w-[100vw] flex-1 flex flex-col min-h-0 px-4 py-4">
      <!-- Header Section -->
      <div class="mb-4 shrink-0">
        <div class="mb-3">
          <h1 class="text-2xl font-bold text-slate-800">
            Immersive Code Component Test
          </h1>
          <p class="text-slate-500 text-sm">
            Testing the history, preview, and console integration.
          </p>
        </div>

        <!-- Test Controls - 使用網格布局，響應式設計 -->
        <div class="space-y-3">
          <!-- 第一行：基本設置 -->
          <div
            class="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
          >
            <label
              class="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap"
            >
              <input
                type="checkbox"
                v-model="enableShare"
                class="rounded text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span>Enable Share</span>
            </label>

            <label
              class="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap"
            >
              <input
                type="checkbox"
                v-model="readonly"
                class="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>只读模式</span>
            </label>

            <div class="h-4 w-px bg-slate-200"></div>

            <button
              @click="handleAddMajorVersion"
              class="px-3 py-1.5 text-sm bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition font-medium whitespace-nowrap min-w-fit"
            >
              Add Major Version
            </button>

            <button
              @click="handleGetCode"
              class="px-3 py-1.5 text-sm bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition font-medium whitespace-nowrap min-w-fit"
            >
              Get Current Code
            </button>
          </div>

          <!-- 第二行：Diff 測試 -->
          <div
            class="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
          >
            <span class="text-sm font-semibold text-slate-700 whitespace-nowrap"
              >Diff 測試：</span
            >
            <button
              @click="handleApplyDiff"
              class="px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded hover:bg-green-100 transition font-medium whitespace-nowrap min-w-fit"
            >
              应用单处 Diff
            </button>

            <button
              @click="handleApplyMultipleDiff"
              class="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition font-medium whitespace-nowrap min-w-fit"
            >
              应用多处 Diff
            </button>
          </div>

          <!-- 第三行：流式写入测试 -->
          <div
            class="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
          >
            <span class="text-sm font-semibold text-slate-700 whitespace-nowrap"
              >流式写入测试：</span
            >

            <button
              @click="handleStreamWrite"
              class="px-3 py-1.5 text-sm bg-cyan-50 text-cyan-600 rounded hover:bg-cyan-100 transition font-medium whitespace-nowrap min-w-fit"
            >
              基础流式写入
            </button>

            <button
              @click="handleStreamWriteAI"
              class="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition font-medium whitespace-nowrap min-w-fit"
            >
              AI 流式生成
            </button>

            <button
              @click="handleStreamWriteIncremental"
              class="px-3 py-1.5 text-sm bg-teal-50 text-teal-600 rounded hover:bg-teal-100 transition font-medium whitespace-nowrap min-w-fit"
            >
              增量流式写入
            </button>
          </div>
        </div>
      </div>

      <!-- ImmersiveCode Component - 使用 flex-1 確保佔滿剩餘空間 -->
      <div class="flex-1 min-h-0">
        <ImmersiveCode
          ref="immersiveRef"
          :enable-share="enableShare"
          :readonly="readonly"
          @error="handleError"
          @element-selected="handleElementSelected"
        />
      </div>
    </div>
  </div>
</template>
