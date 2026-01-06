<script setup lang="ts">
import { ref, useTemplateRef, onMounted, onUnmounted, nextTick, watch } from "vue";
import {
  PersonOutlined,
  SettingsOutlined,
  SmartToyOutlined,
  AutoAwesomeOutlined,
  WarningOutlined,
} from "@vicons/material";
import MessageActionButtons from "./MessageActionButtons.vue";
import ToolUseEdit from "./ToolUseEdit.vue";
import ImageDisplay from "@/components/llm/ImageDisplay.vue";
import QueueExample from "./QueueExample.vue";

interface Props {
  item: {
    type: "message" | "full_response" | "error";
    data: any;
  };
  shouldShowCollapse: boolean;
  isCollapsed: boolean;
  collapsedCharCount: number;
  isCopySuccess: boolean;
  wordWrap: boolean;
  formatJson: (obj: any) => string;
  getDisplayContent: (item: any) => string;
  isTodoWrite: (toolData: any) => boolean;
  convertTodosToQueueFormat: (
    todos: any[]
  ) => Array<{
    id: string;
    title: string;
    description?: string;
    status?: "pending" | "completed";
  }>;
}

const props = defineProps<Props>();

interface Emits {
  (e: "toggle-collapse"): void;
  (e: "copy-item"): void;
  (e: "toggle-word-wrap"): void;
}

const emit = defineEmits<Emits>();

// 内容容器引用，用于检测滚动条
const contentRef = useTemplateRef<HTMLElement>("contentRef");
const hasScrollbar = ref(false);

// 检测是否有滚动条
function checkScrollbar() {
  nextTick(() => {
    if (contentRef.value) {
      const element = contentRef.value;
      hasScrollbar.value = element.scrollWidth > element.clientWidth;
    }
  });
}

onMounted(() => {
  checkScrollbar();
  // 监听窗口大小变化
  window.addEventListener("resize", checkScrollbar);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkScrollbar);
});

// 监听内容变化
watch(
  () => [props.item, props.isCollapsed, props.wordWrap],
  () => {
    checkScrollbar();
  },
  { deep: true }
);
</script>

<template>
  <!-- Message Item -->
  <div
    v-if="item.type === 'message'"
    class="flex gap-4 mb-4 last:mb-0 w-10/12 mx-auto"
    :class="{ 'flex-row-reverse': item.data.role === 'user' }"
  >
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md"
      :class="
        item.data.role === 'user'
          ? 'bg-indigo-600'
          : item.data.role === 'system'
          ? 'bg-slate-600'
          : 'bg-orange-600'
      "
    >
      <PersonOutlined v-if="item.data.role === 'user'" class="w-5 h-5 text-white" />
      <SettingsOutlined
        v-else-if="item.data.role === 'system'"
        class="w-5 h-5 text-white"
      />
      <SmartToyOutlined v-else class="w-5 h-5 text-white" />
    </div>

    <div
      class="flex flex-col max-w-[85%]"
      :class="{ 'items-end': item.data.role === 'user' }"
    >
      <div class="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">
        {{ item.data.role }}
      </div>
      <div
        ref="contentRef"
        class="min-w-32 px-4 pt-4 rounded-2xl text-sm leading-relaxed shadow-sm font-mono select-text w-full flex flex-col gap-1 relative overflow-y-visible"
        :class="[
          item.data.role === 'system'
            ? 'bg-slate-100 text-slate-800 border border-slate-200'
            : 'bg-white text-slate-800 border border-slate-200',
          wordWrap ? 'whitespace-pre-wrap wrap-break-word' : 'whitespace-pre ',
        ]"
      >
        <div class="w-full overflow-auto">
          <template v-if="Array.isArray(item.data.content)">
            <div
              v-for="(part, pIdx) in item.data.content"
              :key="pIdx"
              class="mb-1 last:mb-0"
            >
              <!-- Text content -->
              <div
                v-if="part.type === 'text'"
                :class="
                  wordWrap ? 'whitespace-pre-wrap wrap-break-word' : 'whitespace-pre '
                "
              >
                <template v-if="shouldShowCollapse && isCollapsed">
                  {{ (part.text?.trim() || "").substring(0, 200) + "..." }}
                </template>
                <template v-else>
                  {{ part.text?.trim() || "" }}
                </template>
              </div>

              <!-- Tool use content -->
              <div v-else-if="part.type === 'tool_use'">
                <!-- TodoWrite: 使用 QueueExample 组件 -->
                <div v-if="isTodoWrite(part)" class="mb-1">
                  <QueueExample
                    :todos="convertTodosToQueueFormat(part.input.todos)"
                    :show-messages="false"
                    :preview="true"
                  />
                </div>
                <!-- 其他 tool_use: 使用 ToolUseEdit 组件 -->
                <ToolUseEdit
                  v-else
                  :tool-data="part"
                  :is-collapsed="shouldShowCollapse && isCollapsed"
                />
              </div>

              <!-- Tool result content -->
              <div
                v-else-if="part.type === 'tool_result'"
                class="bg-green-50 border border-green-200 rounded-lg p-3 mb-1 shadow-sm"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-bold text-green-600 uppercase"
                    >Tool Result:</span
                  >
                  <span
                    v-if="part.tool_use_id"
                    class="text-xs font-mono text-green-700"
                    >{{ part.tool_use_id }}</span
                  >
                </div>
                <div v-if="part.content" class="text-xs font-mono text-slate-700">
                  <template v-if="shouldShowCollapse && isCollapsed">
                    <pre class="whitespace-pre-wrap">{{
                      (Array.isArray(part.content)
                        ? part.content.join("\n").trim()
                        : part.content?.trim() || ""
                      ).substring(0, 200) + "..."
                    }}</pre>
                  </template>
                  <template v-else>
                    <pre class="whitespace-pre-wrap">{{
                      Array.isArray(part.content)
                        ? part.content.join("\n").trim()
                        : part.content?.trim() || ""
                    }}</pre>
                  </template>
                </div>
                <div v-if="part.is_error" class="text-xs text-red-600 mt-1 font-bold">
                  Error: {{ part.is_error }}
                </div>
              </div>

              <!-- Image content -->
              <div v-else-if="part.type === 'image'" class="mb-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="text-xs font-bold text-purple-700 uppercase">Image:</span>
                </div>
                <ImageDisplay
                  :src="part.source?.data || part.data || ''"
                  :alt="part.alt || 'Generated image'"
                  max-width="250px"
                  max-height="250px"
                  class="inline-block"
                  :debug="false"
                />
                <div v-if="part.detail" class="text-xs text-slate-500 mt-2 ml-2">
                  {{ part.detail }}
                </div>
              </div>

              <!-- Other content types -->
              <div
                v-else
                class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-1 shadow-sm"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-xs font-bold text-yellow-700 uppercase"
                    >{{ part.type }}:</span
                  >
                </div>
                <pre class="text-xs font-mono text-slate-700 whitespace-pre-wrap">
                <template v-if="shouldShowCollapse && isCollapsed">
                  {{ formatJson(part).trim().substring(0, 200) + "..." }}
                </template>
                <template v-else>
                  {{ formatJson(part).trim() }}
                </template>
              </pre>
              </div>
            </div>
          </template>
          <template v-else>
            {{ getDisplayContent(item) }}
          </template>
        </div>

        <!-- 底部按钮组 -->
        <MessageActionButtons
          :item-type="item.type"
          :item-data="item.data"
          :should-show-collapse="shouldShowCollapse"
          :is-collapsed="isCollapsed"
          :collapsed-char-count="collapsedCharCount"
          :is-copy-success="isCopySuccess"
          :has-scrollbar="hasScrollbar"
          @toggle-collapse="emit('toggle-collapse')"
          @copy-item="emit('copy-item')"
          @toggle-word-wrap="emit('toggle-word-wrap')"
        />
      </div>
    </div>
  </div>

  <!-- Full Response Item -->
  <div
    v-else-if="item.type === 'full_response'"
    class="flex gap-4 mb-4 last:mb-0 w-10/12 mx-auto"
  >
    <div
      class="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shrink-0 shadow-md"
    >
      <AutoAwesomeOutlined class="w-5 h-5 text-white" />
    </div>
    <div class="flex flex-col max-w-[85%] w-full">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs text-green-600 font-bold uppercase tracking-wider"
          >Full Response (Reconstructed)</span
        >
        <span class="font-mono text-[10px] opacity-70"
          >Length: {{ item.data.data?.content?.length || 0 }} chars</span
        >
      </div>
      <div
        ref="contentRef"
        class="bg-white text-slate-800 border border-green-200 px-4 pt-4 rounded-2xl rounded-tl-none shadow-sm font-mono select-text flex flex-col gap-1 relative overflow-y-visible"
      >
        <div
          class="text-slate-800 text-xs flex-1 overflow-auto"
          :class="{
            'whitespace-pre-wrap wrap-break-word': wordWrap,
            'whitespace-pre': !wordWrap,
          }"
        >
          {{ getDisplayContent(item) }}
        </div>

        <!-- 底部按钮组 -->
        <MessageActionButtons
          :item-type="item.type"
          :item-data="item.data"
          :should-show-collapse="shouldShowCollapse"
          :is-collapsed="isCollapsed"
          :collapsed-char-count="collapsedCharCount"
          :is-copy-success="isCopySuccess"
          :has-scrollbar="hasScrollbar"
          @toggle-collapse="emit('toggle-collapse')"
          @copy-item="emit('copy-item')"
          @toggle-word-wrap="emit('toggle-word-wrap')"
        />
      </div>
    </div>
  </div>

  <!-- Error Item -->
  <div
    v-else-if="item.type === 'error'"
    class="flex gap-4 mb-4 last:mb-0 w-10/12 mx-auto"
  >
    <div
      class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shrink-0 shadow-md"
    >
      <WarningOutlined class="w-5 h-5 text-white" />
    </div>
    <div class="flex flex-col max-w-[85%] w-full">
      <div class="text-xs text-red-600 mb-1 font-bold uppercase tracking-wider">
        Error
      </div>
      <div
        ref="contentRef"
        class="bg-red-50 border border-red-200 px-4 pt-4 rounded-2xl rounded-tl-none shadow-sm flex flex-col gap-1 relative overflow-y-visible"
      >
        <pre
          class="text-red-600 text-xs select-text flex-1 overflow-auto"
          :class="{
            'whitespace-pre-wrap wrap-break-word': wordWrap,
            'whitespace-pre': !wordWrap,
          }"
          >{{
            isCollapsed && shouldShowCollapse
              ? formatJson(item.data.err).trim().substring(0, 500) + "..."
              : formatJson(item.data.err).trim()
          }}</pre
        >

        <!-- 底部按钮组 -->
        <MessageActionButtons
          :item-type="item.type"
          :item-data="item.data"
          :should-show-collapse="shouldShowCollapse"
          :is-collapsed="isCollapsed"
          :collapsed-char-count="collapsedCharCount"
          :is-copy-success="isCopySuccess"
          :has-scrollbar="hasScrollbar"
          @toggle-collapse="emit('toggle-collapse')"
          @copy-item="emit('copy-item')"
          @toggle-word-wrap="emit('toggle-word-wrap')"
        />
      </div>
    </div>
  </div>
</template>
