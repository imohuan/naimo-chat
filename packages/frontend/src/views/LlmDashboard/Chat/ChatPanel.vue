<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { ChatStatus } from "ai";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type { ChatModelConfig, ChatModelExtensionConfig } from "./types";
import { useMcpStore } from "@/stores/mcp";
import { storeToRefs } from "pinia";
import type { LlmProvider } from "@/interface";
import { PanelRightOpen } from "lucide-vue-next";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useConversation } from "@/views/LlmDashboard/Chat/hooks/useConversation";
import { useChatLayout } from "@/views/LlmDashboard/Chat/hooks/useChatLayout";
import { getContext } from "@/core/context";
import { useToasts } from "@/hooks/useToasts";
import { useChatApi } from "@/hooks/useChatApi";
import { useConversationStore } from "@/stores/conversation";
import ChatHeaderActions from "./components/ChatHeaderActions.vue";
import ChatSidebar from "./components/ChatSidebar.vue";
import ChatMessages from "./components/ChatMessages.vue";
import ChatInput from "./components/ChatInput.vue";
import CanvasPanel from "./components/CanvasPanel.vue";
import type { ConversationMode } from "./types";
import { serializeLogicalTagToString } from "./stringTags";

const props = defineProps<{
  providers?: LlmProvider[];
  currentTab?: string;
}>();

const emit = defineEmits<{
  clear: [];
}>();

// 使用新的 hooks
const {
  activeConversation,
  activeMessages,
  sidebarConversations,
  activeConversationId,
  sidebarCollapsed,
  createConversation,
  sendMessage,
  selectConversation,
  deleteConversation,
  toggleSidebar,
  updateMode,
  updateCodeHistory,
  clearActiveConversationMessages,
  clearActiveConversation,
} = useConversation();
const { pushToast } = useToasts();
const { eventBus } = getContext();
const chatApi = useChatApi();
const conversationStore = useConversationStore();

// 本地状态
const selectedMode = ref<ConversationMode>("chat");
const modelId = ref<string>("");
const useWebSearch = ref(false);
const useMicrophone = ref(false);
const status = ref<ChatStatus>("ready");
const showCanvas = ref(false);
const isCanvasReadonly = ref(false);
const refreshImmersiveCode = ref(true);
// 标记当前对话是否已为流式输出创建空版本
const hasCreatedEmptyVersion = ref(false);
// 模型配置（统一管理，通过 v-model 传递给 ModelConfigPanel）
const modelConfig = ref<ChatModelConfig>({
  modelId: modelId.value,
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4096,
  selectedMcpIds: [],
});

// 组件引用
const chatInputRef = ref<InstanceType<typeof ChatInput> | null>(null);
const canvasPanelRef = ref<InstanceType<typeof CanvasPanel> | null>(null);

// 容器引用，用于响应式布局
const chatContainerRef = ref<HTMLElement | null>(null);

// 使用統一的響應式佈局 hooks
const { layoutConfig } = useChatLayout(chatContainerRef);

// SVG 图标字符串（用于标签插入）
const browserIconSvg = `<svg t="1766773646500" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15057"><path d="M693.302681 34.952265c68.210189-34.105094 170.11621-57.637609 242.07796 0 71.961749 57.637609 46.723979 186.350235 30.762795 204.630566 9.071955-27.897967 27.352286-128.576206-41.471795-181.711943-63.162635-48.702075-176.459758-27.284075-247.466564 29.193961a409.329342 409.329342 0 0 1 283.276913 459.532041L666.018606 546.52868l0.06821-0.682102a34.241515 34.241515 0 0 1-6.821019 0.682102h-238.73566v13.642037A122.77834 122.77834 0 0 0 653.19509 614.738868h289.552251a409.397552 409.397552 0 0 1-472.833027 263.632379c-72.3028 76.668252-302.580397 199.173751-376.997713 25.30598-24.964929-58.387921-13.573828-209.337069 54.636361-323.043453 30.421744-50.68017 70.392915-103.543066 115.002378-155.51923 55.045622-74.553736 115.88911-137.37532 182.598675-188.532962 9.344796-8.730904 18.689592-17.257178 27.829757-25.64703L488.808536 205.477736c-129.735779 43.24526-259.403347 132.327766-336.958332 214.793884a409.261132 409.261132 0 0 1 481.495722-344.120401C661.380313 54.73322 682.525472 40.40908 693.302681 34.952265zM188.069814 655.869612l-1.773465 2.933038c-33.150152 56.205195-62.821584 182.121204-38.675177 244.874577 44.200202 114.797747 227.139928 38.879808 314.31255-27.284075A409.943234 409.943234 0 0 1 188.001604 655.937822zM543.240266 273.687925a122.77834 122.77834 0 0 0-122.369078 112.683232l-0.409261 10.095108V410.108302h238.73566c2.387357 0 4.706503 0.272841 6.889229 0.682102V396.466265a122.77834 122.77834 0 0 0-112.751442-122.369079L543.240266 273.687925z" fill="currentColor" p-id="15058"></path></svg>`;
const htmlIconSvg = `<svg t="1766772789014"  viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5023"><path d="M89.088 59.392l62.464 803.84c1.024 12.288 9.216 22.528 20.48 25.6L502.784 993.28c6.144 2.048 12.288 2.048 18.432 0l330.752-104.448c11.264-4.096 19.456-14.336 20.48-25.6l62.464-803.84c1.024-17.408-12.288-31.744-29.696-31.744H118.784c-17.408 0-31.744 14.336-29.696 31.744z" fill="#FC490B" p-id="5024"></path><path d="M774.144 309.248h-409.6l12.288 113.664h388.096l-25.6 325.632-227.328 71.68-227.328-71.68-13.312-169.984h118.784v82.944l124.928 33.792 123.904-33.792 10.24-132.096H267.264L241.664 204.8h540.672z" fill="#FFFFFF" p-id="5025"></path></svg>`;

const suggestions: string[] = [
  "开发一个hello world 的网页，极简",
  "获取 https://yunwu.apifox.cn/llms.txt 的内容",
  "修改标题",
  "完成重构，不使用修改格式，实现一个 hello world的极简页面， 设置一个随机名称的大标题",
];
const hasMessages = computed(() => (activeMessages.value?.length || 0) > 0);

// 监听 modelId 变化，同步到 modelConfig
watch(
  () => modelId.value,
  (newModelId) => {
    if (newModelId && modelConfig.value.modelId !== newModelId) {
      modelConfig.value.modelId = newModelId;
    }
  }
);

// 监听 modelConfig.modelId 变化，同步到 modelId
watch(
  () => modelConfig.value.modelId,
  (newModelId) => {
    if (newModelId && modelId.value !== newModelId) {
      modelId.value = newModelId;
    }
  }
);

// 监听对话切换，恢复模式和代码历史
watch(
  [activeConversationId, activeConversation],
  async ([newId, conversation]) => {
    if (!newId || !conversation) return;

    // 切换对话时重置空版本标记
    hasCreatedEmptyVersion.value = false;

    // 恢复模式
    if (conversation.mode && conversation.mode !== selectedMode.value) {
      selectedMode.value = conversation.mode;
      await nextTick();
    }

    // 恢复代码历史（仅在 canvas 模式下）
    if (selectedMode.value === "canvas" && conversation.codeHistory) {
      const hasCodeHistory =
        conversation.codeHistory.versions &&
        conversation.codeHistory.versions.length > 0;

      if (hasCodeHistory) {
        showCanvas.value = true;
        // 等待 CanvasPanel 组件挂载
        let attempts = 0;
        while (attempts < 50 && !canvasPanelRef.value) {
          await nextTick();
          await new Promise((resolve) => setTimeout(resolve, 50));
          attempts++;
        }
      }
    }
  },
  { immediate: true }
);

// 监听模式变化
watch(selectedMode, async (newMode) => {
  if (newMode === "canvas") {
    refreshImmersiveCode.value = true;
    // 不在这里判断 showCanvas，而是等待 codeVersion 和 codeHistory 的 watch 来处理
  } else {
    showCanvas.value = false;
  }

  // 更新对话模式
  if (activeConversationId.value) {
    updateMode(activeConversationId.value, newMode);
  }
});

// 监听 codeVersion 和 codeHistory 的变化，判断是否显示 canvas
watch(
  () =>
    [
      activeConversation.value?.codeVersion,
      activeConversation.value?.codeHistory,
      selectedMode.value,
    ] as const,
  ([codeVersion, codeHistory, mode]) => {
    // 只在 canvas 模式下处理
    if (mode !== "canvas") return;

    // 只有当 codeVersion 存在（表示已加载）且有 codeHistory 数据时才显示
    if (codeVersion !== undefined && codeHistory) {
      const hasCodeHistory =
        codeHistory.versions && codeHistory.versions.length > 0;
      showCanvas.value = hasCodeHistory || false;
      // 设置侧边栏为折叠状态
      conversationStore.sidebarCollapsed = true;
    } else {
      // 如果 codeVersion 不存在，说明还没有加载，不显示 canvas
      showCanvas.value = false;
    }
  },
  { immediate: true }
);

const mcpStore = useMcpStore();
const { serverTools } = storeToRefs(mcpStore);

// 从 modelConfig 获取配置并转换为扩展配置对象（供 handleSubmit 和 handleRetry 使用）
function getModelConfigExtension(): {
  activeModelId: string;
  extensionConfig: ChatModelExtensionConfig | undefined;
} {
  // 从当前页面的 modelConfig 获取配置
  const config = modelConfig.value;
  const activeModelId = config.modelId || modelId.value;
  const mcpIds = config.selectedMcpIds;

  // 根据 MCP 选择，从 Pinia 中获取对应服务器的工具配置，组装为 tools 列表
  const tools =
    mcpIds && mcpIds.length > 0
      ? mcpIds.flatMap((serverName) => {
          const toolsForServer = serverTools.value[serverName] || [];
          return toolsForServer.map((tool) => ({
            ...tool,
            // 统一使用 mcp__server__tool 的命名规则，便于后端识别
            name: `mcp__${serverName}__${tool.name}`,
          }));
        })
      : undefined;

  // 组装扩展配置对象
  const extensionConfig: ChatModelExtensionConfig | undefined =
    config.temperature !== undefined ||
    config.topP !== undefined ||
    config.maxTokens !== undefined ||
    config.reasoningEffort !== undefined ||
    (mcpIds && mcpIds.length > 0) ||
    (tools && tools.length > 0)
      ? {
          ...(config.temperature !== undefined && {
            temperature: config.temperature,
          }),
          ...(config.topP !== undefined && { topP: config.topP }),
          ...(config.maxTokens !== undefined && {
            maxTokens: config.maxTokens,
          }),
          ...(config.reasoningEffort !== undefined && {
            reasoningEffort: config.reasoningEffort,
          }),
          ...(mcpIds && mcpIds.length > 0 && { mcpIds }),
          ...(tools && tools.length > 0 && { tools }),
        }
      : undefined;

  return {
    activeModelId,
    extensionConfig,
  };
}

// 处理消息提交
async function handleSubmit(message: PromptInputMessage) {
  const text = message.text.trim();
  const hasText = text.length > 0;
  const hasAttachments = message.files.length > 0;

  if (!hasText && !hasAttachments) return;

  const content = hasText ? text : "Sent with attachments";
  const userFiles = message.files.map((f) => ({
    url: f.url,
    filename: f.filename,
    mediaType: f.mediaType,
  }));

  // 从当前页面的 modelConfig 获取配置
  const { activeModelId, extensionConfig } = getModelConfigExtension();

  // 判断是否应该创建新对话：
  // 1. 没有活跃对话ID
  // 2. 活跃对话不在对话列表中（可能已被删除或无效）
  // 3. 活跃对话没有消息（空对话，应该使用创建接口发送第一条消息）
  const shouldCreateNewConversation =
    !activeConversationId.value ||
    !activeConversation.value ||
    (activeMessages.value?.length || 0) === 0;

  if (shouldCreateNewConversation) {
    try {
      status.value = "streaming";
      await createConversation({
        initialInput: content,
        mode: selectedMode.value,
        model: activeModelId,
        files: userFiles,
        config: extensionConfig,
        editorCode:
          selectedMode.value === "canvas"
            ? canvasPanelRef.value?.getCurrentCode()
            : undefined,
      });
      // createConversation 已经处理了第一条消息，直接返回
      return;
    } catch (error) {
      pushToast(
        `创建对话失败: ${error instanceof Error ? error.message : "未知错误"}`,
        "error"
      );
      status.value = "ready";
      return;
    }
  }

  // 如果已有活跃对话且有消息，发送消息
  try {
    status.value = "streaming";
    await sendMessage(activeConversationId.value, {
      content,
      mode: selectedMode.value,
      model: activeModelId,
      files: userFiles,
      config: extensionConfig,
      editorCode:
        selectedMode.value === "canvas"
          ? canvasPanelRef.value?.getCurrentCode()
          : undefined,
    });
  } catch (error) {
    pushToast(
      `发送消息失败: ${error instanceof Error ? error.message : "未知错误"}`,
      "error"
    );
    status.value = "ready";
  } finally {
    status.value = "ready";
  }
}

// 处理重试
function handleRetry(messageKey: string) {
  // 重试按钮显示在助手消息上，所以 messageKey 是助手消息的 key
  const messages = activeMessages.value || [];
  const assistantMessage = messages.find((msg) => msg.key === messageKey);
  if (!assistantMessage || assistantMessage.from !== "assistant") {
    console.warn("重试失败: 找不到助手消息", messageKey);
    return;
  }

  // 找到对应的用户消息（通常是前一条消息）
  const messageIndex = messages.findIndex((msg) => msg.key === messageKey);
  if (messageIndex === -1 || messageIndex === 0) {
    pushToast("重试失败: 找不到对应的用户消息", "error");
    return;
  }

  // 查找前一条用户消息
  let userMessage: (typeof messages)[0] | undefined;
  for (let i = messageIndex - 1; i >= 0 && i < messages.length; i--) {
    const candidate = messages[i];
    if (candidate && candidate.from === "user") {
      userMessage = candidate;
      break;
    }
  }

  if (!userMessage) {
    pushToast("重试失败: 找不到对应的用户消息", "error");
    return;
  }

  const latestVersion = userMessage.versions[userMessage.versions.length - 1];
  if (!latestVersion) {
    pushToast("重试失败: 用户消息没有内容", "error");
    return;
  }

  const userFiles = latestVersion.files?.map((f) => ({
    url: f.url,
    filename: f.filename,
    mediaType: f.mediaType,
  }));

  if (!activeConversationId.value) {
    pushToast("重试失败: 没有活跃对话", "error");
    return;
  }

  // 从当前页面的 modelConfig 获取配置
  const { activeModelId, extensionConfig } = getModelConfigExtension();

  // latestVersion.content
  // 传递助手消息的 messageKey 用于重试（后端会在该助手消息下创建新版本）
  sendMessage(activeConversationId.value, {
    content: latestVersion.contentBlocks
      .map((block) => (block.type === "text" ? block.content : ""))
      .join("\n"),
    mode: selectedMode.value,
    model: activeModelId,
    files: userFiles,
    messageKey, // 传递助手消息的 messageKey 用于重试
    config: extensionConfig,
    editorCode:
      selectedMode.value === "canvas"
        ? canvasPanelRef.value?.getCurrentCode()
        : undefined,
  }).catch((error) => {
    pushToast(
      `重试失败: ${error instanceof Error ? error.message : "未知错误"}`,
      "error"
    );
  });
}

// 处理标签点击（代码引用、元素选择等）
function handleTagClick(data: {
  id: string;
  label: string;
  icon?: string;
  data?: Record<string, any>;
}) {
  // 如果是代码标签，处理代码跳转
  if (data.data?.code && data.data?.startLine && data.data?.endLine) {
    const { code, startLine, endLine } = data.data;
    if (!showCanvas.value) {
      showCanvas.value = true;
    }
    const codeRef = canvasPanelRef.value?.immersiveCodeRef;
    if (
      codeRef &&
      typeof codeRef === "object" &&
      "setCodeAndSelectLines" in codeRef
    ) {
      (codeRef as any).setCodeAndSelectLines(code, startLine, endLine);
    }
  }

  // 如果是浏览器标签（元素选择器标签），处理预览跳转
  if (
    data.data?.type === "browser_selector" ||
    data.data?.selector ||
    (data.icon &&
      typeof data.icon === "string" &&
      data.icon.includes("browser"))
  ) {
    const selector = data.data?.selector || data.data?.text || data.label;
    if (!selector) return;

    if (!showCanvas.value) {
      showCanvas.value = true;
    }
    const codeRef = canvasPanelRef.value?.immersiveCodeRef;
    if (
      codeRef &&
      typeof codeRef === "object" &&
      "selectElementInPreview" in codeRef
    ) {
      (codeRef as any).selectElementInPreview(selector);
    }
  }
}

// 处理 Canvas 元素选择
function handleElementSelected(selector: string, data?: any) {
  // 插入元素选择器标签到输入框
  const editorRef = chatInputRef.value?.promptInputEditorRef;
  if (editorRef && typeof editorRef === "object" && "insertTag" in editorRef) {
    const logicalRaw = serializeLogicalTagToString({
      type: "browser_selector",
      selector,
      label: data?.tagName,
    });
    (editorRef as any).insertTag({
      id: `element-ref-${Date.now()}`,
      label: data?.tagName || "Element",
      icon: browserIconSvg,
      tagType: "browser",
      data: {
        type: "browser_selector",
        selector,
        tagName: data?.tagName,
        raw: logicalRaw,
      },
    });
  }
}

// 处理 Ctrl+I 按下（代码引用）
function handleCtrlIPressed(data: {
  code: string;
  startLine: number;
  endLine: number;
  fileName?: string;
}) {
  // 插入代码引用标签到输入框
  const editorRef = chatInputRef.value?.promptInputEditorRef;
  if (editorRef && typeof editorRef === "object" && "insertTag" in editorRef) {
    const fileName = data.fileName || "index.html";
    const lineInfo =
      data.startLine === data.endLine
        ? `${data.startLine}`
        : `${data.startLine}-${data.endLine}`;
    const logicalRaw = serializeLogicalTagToString({
      type: "code_ref",
      fileName,
      startLine: data.startLine,
      endLine: data.endLine,
    });

    (editorRef as any).insertTag({
      id: `code-ref-${Date.now()}`,
      label: `${fileName}(${lineInfo})`,
      icon: htmlIconSvg,
      data: {
        type: "code_ref",
        raw: logicalRaw,
        code: data.code,
        startLine: data.startLine,
        endLine: data.endLine,
        fileName,
      },
    });
  }
}

// 处理清空对话
function handleClear() {
  clearActiveConversationMessages();
  emit("clear");
}

// 存储当前记录 ID（用于 diff 应用后保存）
const currentRecordId = ref<string | null>(null);
const currentOriginalCode = ref<string | null>(null);

// 监听事件总线事件
onMounted(() => {
  eventBus.on("message:complete", () => {
    status.value = "ready";
    // 消息完成后重置标记，为下一次流式输出做准备
    hasCreatedEmptyVersion.value = false;
  });

  eventBus.on("message:streaming", () => {
    status.value = "streaming";
  });

  // 监听对话加载完成事件，设置 selectedMode
  eventBus.on("conversation:loaded", (data) => {
    if (
      data.conversation.mode &&
      data.conversation.mode !== selectedMode.value
    ) {
      selectedMode.value = data.conversation.mode;
    }
  });

  // Canvas 事件监听
  eventBus.on("canvas:code_delta", (data) => {
    if (data.conversationId !== activeConversationId.value) return;
    if (!canvasPanelRef.value?.immersiveCodeRef) return;

    const immersiveCode = canvasPanelRef.value.immersiveCodeRef;

    // 如果是第一次收到流式输出，先创建一个空版本
    if (
      !hasCreatedEmptyVersion.value &&
      immersiveCode &&
      typeof immersiveCode.addMajorVersion === "function"
    ) {
      immersiveCode.addMajorVersion("", undefined);
      hasCreatedEmptyVersion.value = true;
    }

    // 开始流式写入（如果还没开始，直接调用 startStreaming 会设置内部状态）
    if (immersiveCode && typeof immersiveCode.startStreaming === "function") {
      immersiveCode.startStreaming();
    }
    // 流式写入代码
    if (immersiveCode && typeof immersiveCode.streamWrite === "function") {
      immersiveCode.streamWrite(data.code);
    }
  });

  eventBus.on("canvas:diff_detected", (data) => {
    if (data.conversationId !== activeConversationId.value) return;
    if (!canvasPanelRef.value?.immersiveCodeRef) return;

    const immersiveCode = canvasPanelRef.value.immersiveCodeRef;
    // 保存记录 ID 和原始代码
    currentRecordId.value = data.recordId;
    currentOriginalCode.value = data.originalCode || null;

    // 获取原始代码，用于添加历史记录和diff操作
    const originalCode =
      data.originalCode || immersiveCode.getCurrentCode?.() || "";

    // 在diff操作前添加历史记录，创建一个新的major version，并添加一个使用recordId的记录
    // addMajorDiffVersion 内部会处理 diff 验证和 UI 更新
    if (
      immersiveCode &&
      typeof immersiveCode.addMajorDiffVersion === "function" &&
      data.recordId
    ) {
      immersiveCode.addMajorDiffVersion(originalCode, data.diff, data.recordId);
    }

    // // 显示 diff 编辑器（使用 diff 方法）
    // if (immersiveCode && typeof immersiveCode.diff === "function") {
    //   immersiveCode.diff(data.diff, originalCode);
    // }
  });

  eventBus.on("canvas:show_editor", (data) => {
    if (data.conversationId !== activeConversationId.value) return;
    showCanvas.value = true;
  });

  eventBus.on("canvas:code_complete", (data) => {
    if (data.conversationId !== activeConversationId.value) return;
    if (!canvasPanelRef.value?.immersiveCodeRef) return;

    const immersiveCode = canvasPanelRef.value.immersiveCodeRef;

    if (data.codeType === "full" && data.code) {
      // 完整代码模式：结束流式写入
      immersiveCode.endStreaming();
    }
    // diff 模式：等待用户确认应用

    // 流式输出完成后重置标记，为下一次流式输出做准备
    hasCreatedEmptyVersion.value = false;
  });

  eventBus.on("canvas:record_created", (data) => {
    if (data.conversationId !== activeConversationId.value) return;
    // 记录 ID 已保存，等待 diff 应用后使用
  });
});

// 处理 diff 应用后的保存
async function handleDiffApplied(recordId: string, appliedCode: string) {
  if (!activeConversationId.value || !recordId) return;

  try {
    await chatApi.applyCanvasDiff(
      activeConversationId.value,
      recordId,
      appliedCode
    );
    // 不重新加载对话，避免强制刷新页面和canvas
    // 代码已经在本地更新，后端也已保存，无需重新加载
    // await loadConversation(activeConversationId.value);

    pushToast("代码已保存", "success");
  } catch (error) {
    console.error("保存应用后的代码失败:", error);
    pushToast(
      `保存失败: ${error instanceof Error ? error.message : "未知错误"}`,
      "error"
    );
  }
}

// 处理 diff 退出事件
function handleDiffExited(code: string, recordId?: string) {
  // 优先使用事件传递的 recordId，否则使用 currentRecordId
  const finalRecordId = recordId || currentRecordId.value;

  if (!finalRecordId) {
    console.warn("diff-exited 事件触发，但没有 recordId", {
      eventRecordId: recordId,
      currentRecordId: currentRecordId.value,
    });
    return;
  }

  handleDiffApplied(finalRecordId, code);
}

// 存储当前错误消息
const currentErrorMessage = ref<string | null>(null);

// 修复提示词模板
function getFixPrompt(errorMsg: string | null): string {
  if (!errorMsg) {
    return "Please fix the errors in the current code to ensure it runs correctly.";
  }
  return `Please fix the errors in the current code. The error message is as follows:

<error_message>
${errorMsg}
</error_message>

Please analyze the error message and correct the code to ensure it runs correctly.`;
}

function handleError(msg: string) {
  // 如果正在请求（流式输出），不显示错误
  if (status.value === "streaming") {
    return;
  }

  // 将错误传递给 CanvasPanel 显示
  currentErrorMessage.value = msg;
  if (
    canvasPanelRef.value?.immersiveCodeRef &&
    typeof canvasPanelRef.value.immersiveCodeRef.setError === "function"
  ) {
    canvasPanelRef.value.immersiveCodeRef.setError(msg);
  }
}

// 处理修复功能
function handleFixError() {
  // 获取当前错误消息
  const errorMsg = currentErrorMessage.value;

  // 清除错误消息
  currentErrorMessage.value = null;
  if (
    canvasPanelRef.value?.immersiveCodeRef &&
    typeof canvasPanelRef.value.immersiveCodeRef.setError === "function"
  ) {
    canvasPanelRef.value.immersiveCodeRef.setError(null);
  }

  // 发送修复消息，包含错误信息
  const fixPrompt = getFixPrompt(errorMsg);
  handleSubmit({ text: fixPrompt, files: [] });
}

// 监听对话切换，加载 canvas 数据
watch(
  [activeConversationId, activeConversation],
  async ([newId, conversation]) => {
    if (!newId || !conversation || conversation.mode !== "canvas") return;
    try {
      const canvasData = await chatApi.fetchCanvas(newId);
      // 无论是否有 codeHistory，都更新（用于设置 codeVersion 标记已加载）
      updateCodeHistory(newId, canvasData?.codeHistory);
    } catch (error) {
      console.error("加载 Canvas 数据失败:", error);
      // 即使加载失败，也设置 codeVersion 为已加载状态（但 codeHistory 为 undefined）
      updateCodeHistory(newId, undefined);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  eventBus.off("message:complete");
  eventBus.off("message:streaming");
  eventBus.off("conversation:loaded");
  eventBus.off("canvas:code_delta");
  eventBus.off("canvas:diff_detected");
  eventBus.off("canvas:show_editor");
  eventBus.off("canvas:code_complete");
  eventBus.off("canvas:record_created");
});

// 保存代码历史
function saveCodeHistory() {
  if (!activeConversationId.value || selectedMode.value !== "canvas") return;
  if (!canvasPanelRef.value) return;

  try {
    const history = canvasPanelRef.value.getHistory();
    if (history && history.versions.length > 0) {
      // 过滤历史记录：只保留每个版本中最后一个由流式写入产生的记录
      const filteredVersions = history.versions
        .map((version) => {
          const streamingRecords = version.records.filter(
            (r) => r.isStreamingRecord === true
          );

          if (streamingRecords.length > 0) {
            const lastStreamingRecord =
              streamingRecords[streamingRecords.length - 1];
            if (lastStreamingRecord) {
              return {
                id: version.id,
                timestamp: version.timestamp,
                label: version.label,
                records: [
                  {
                    id: lastStreamingRecord.id,
                    code: lastStreamingRecord.code,
                    diffTarget: lastStreamingRecord.diffTarget,
                    timestamp: lastStreamingRecord.timestamp,
                  },
                ],
                currentIndex: 0,
              };
            }
          }
          return null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const filteredHistory = {
        versions: filteredVersions,
        currentVersionIndex: history.currentVersionIndex,
      };

      if (filteredHistory.versions.length > 0) {
        updateCodeHistory(activeConversationId.value, filteredHistory);
      }
    }
  } catch (error) {
    console.error("获取代码历史失败:", error);
  }
}

// 监听对话切换，保存代码历史
watch(activeConversationId, (_newId, oldId) => {
  if (oldId && selectedMode.value === "canvas") {
    saveCodeHistory();
  }
});
</script>

<template>
  <div class="h-full w-full overflow-hidden flex flex-col">
    <ChatHeaderActions
      :current-tab="currentTab || 'chat'"
      :has-messages="hasMessages"
      @clear="handleClear"
    />

    <div class="flex h-full w-full">
      <!-- 左侧对话列表侧边栏 -->
      <ChatSidebar
        :sidebar-collapsed="sidebarCollapsed"
        :conversations="sidebarConversations"
        :active-conversation-id="activeConversationId"
        @toggle:sidebar="toggleSidebar"
        @conversation:new="clearActiveConversation"
        @conversation:select="selectConversation"
        @conversation:delete="deleteConversation"
      />

      <!-- 右侧主对话区域 -->
      <div class="relative flex h-full w-full flex-1 overflow-hidden">
        <!-- 画布折叠时的右上角悬浮展开按钮 -->
        <button
          v-if="selectedMode === 'canvas' && !showCanvas"
          class="absolute right-6 top-5 z-20 p-1.5 text-slate-400 hover:text-slate-600 transition rounded bg-white/90 shadow-md hover:bg-white"
          title="展开画布"
          @click="showCanvas = true"
        >
          <PanelRightOpen class="w-4 h-4" />
        </button>

        <!-- 左侧对话区域 -->
        <div
          ref="chatContainerRef"
          class="flex h-full w-full py-4 md:py-6 overflow-hidden"
          :class="[
            hasMessages ? 'flex-col' : 'items-center justify-center',
            `model-${selectedMode}`,
          ]"
        >
          <div
            class="relative flex h-full w-full overflow-hidden"
            :class="
              hasMessages ? 'flex-col divide-y' : 'items-center justify-center'
            "
          >
            <!-- 消息列表 -->
            <ChatMessages
              v-if="hasMessages"
              :messages="activeMessages"
              :layout-config="layoutConfig"
              @retry="handleRetry"
              @copy="() => {}"
              @branch-change="() => {}"
            />

            <!-- 建议和输入框 -->
            <div
              :class="[
                'mx-auto w-full',
                layoutConfig.containerMaxWidth,
                hasMessages
                  ? 'grid shrink-0 gap-2'
                  : 'flex flex-col items-center justify-center',
              ]"
            >
              <Suggestions v-if="true || hasMessages" class="px-4 md:px-6 mt-2">
                <Suggestion
                  v-for="suggestion in suggestions"
                  :key="suggestion"
                  :suggestion="suggestion"
                  @click="() => handleSubmit({ text: suggestion, files: [] })"
                />
              </Suggestions>

              <ChatInput
                ref="chatInputRef"
                :mode="selectedMode"
                :model-id="modelId"
                :status="status"
                :use-web-search="useWebSearch"
                :use-microphone="useMicrophone"
                :providers="providers"
                :has-messages="hasMessages"
                :model-config="modelConfig"
                @submit="handleSubmit"
                @update:mode="selectedMode = $event"
                @update:model-id="modelId = $event"
                @update:use-web-search="useWebSearch = $event"
                @update:use-microphone="useMicrophone = $event"
                @update:model-config="modelConfig = $event"
                @tag-click="handleTagClick"
              />
            </div>
          </div>
        </div>

        <!-- <pre class="select-all">
          {{ activeConversation?.codeHistory }}
        </pre> -->

        <!-- 右侧 Canvas 面板 -->
        <CanvasPanel
          v-if="selectedMode === 'canvas' && refreshImmersiveCode"
          ref="canvasPanelRef"
          :show="showCanvas"
          :readonly="isCanvasReadonly"
          :code-history="activeConversation?.codeHistory"
          :code-version="activeConversation?.codeVersion"
          @update:show="showCanvas = $event"
          @error="(msg) => handleError(msg)"
          @error-fix="handleFixError"
          @element-selected="handleElementSelected"
          @ctrl-i-pressed="handleCtrlIPressed"
          @diff-exited="handleDiffExited"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-canvas :deep(.custom-code-block__body) {
  max-height: 100px;
  overflow-y: auto;
  padding: 10px;
  padding-bottom: 0;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

.model-canvas :deep(.custom-code-block__body pre) {
  padding: 0;
  border: none;
  padding-bottom: 10px;
}
</style>
