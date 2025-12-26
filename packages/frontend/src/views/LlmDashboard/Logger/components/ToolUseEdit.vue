<script setup lang="ts">
import { computed } from "vue";
import TextDiffViewer from "@/components/llm/TextDiffViewer.vue";
import { EditOutlined, InsertDriveFileOutlined } from "@vicons/material";

interface Props {
  toolData: any;
  isCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false,
});

// 检查是否是编辑类型的工具使用
const isEditOperation = computed(() => {
  return (
    props.toolData?.name === "Edit" ||
    props.toolData?.name?.toLowerCase().includes("edit") ||
    (props.toolData?.input &&
      (props.toolData.input.old_string || props.toolData.input.new_string))
  );
});

// 获取文件路径
const filePath = computed(() => {
  return (
    props.toolData?.input?.path || props.toolData?.input?.file_path || "Unknown file"
  );
});

// 获取旧文本
const oldText = computed(() => {
  return props.toolData?.input?.old_string || "";
});

// 获取新文本
const newText = computed(() => {
  return props.toolData?.input?.new_string || "";
});

// 获取工具名称
const toolName = computed(() => {
  return props.toolData?.name || "Edit";
});

// 获取工具ID
const toolId = computed(() => {
  return props.toolData?.id || "";
});

// 格式化文件路径显示
const displayFilePath = computed(() => {
  const path = filePath.value;
  if (path.length > 50) {
    return "..." + path.substring(path.length - 47);
  }
  return path;
});
</script>

<template>
  <div
    v-if="isEditOperation"
    class="bg-slate-100 border border-slate-200 rounded-lg p-3 mb-1 shadow-sm"
  >
    <!-- 标题区域 -->
    <div class="flex items-center gap-2 mb-2">
      <EditOutlined class="w-4 h-4 text-slate-600" />
      <span class="text-xs font-bold text-slate-600 uppercase">Tool Use:</span>
      <span class="text-xs font-mono text-indigo-600">{{ toolName }}</span>
    </div>

    <!-- 文件路径 -->
    <div
      class="flex items-center gap-2 mb-3 px-2 py-1 bg-gray-200 rounded border border-slate-100"
    >
      <InsertDriveFileOutlined class="w-3.5 h-3.5 text-slate-500" />
      <span class="text-xs font-mono text-slate-700 truncate">{{ displayFilePath }}</span>
    </div>

    <!-- 差异对比区域 -->
    <div
      v-if="oldText || newText"
      class="rounded border border-slate-100 overflow-hidden"
    >
      <!-- 折叠状态 -->
      <template v-if="isCollapsed">
        <div class="p-3 text-xs text-slate-600">
          <div v-if="oldText && newText" class="space-y-1">
            <div class="text-red-600">
              - {{ oldText.trim().substring(0, 100)
              }}{{ oldText.length > 100 ? "..." : "" }}
            </div>
            <div class="text-green-600">
              + {{ newText.trim().substring(0, 100)
              }}{{ newText.length > 100 ? "..." : "" }}
            </div>
          </div>
          <div v-else-if="newText" class="text-green-600">
            + {{ newText.trim().substring(0, 200)
            }}{{ newText.length > 200 ? "..." : "" }}
          </div>
          <div v-else-if="oldText" class="text-red-600">
            - {{ oldText.trim().substring(0, 200)
            }}{{ oldText.length > 200 ? "..." : "" }}
          </div>
        </div>
      </template>
      <!-- 展开状态 - 使用 TextDiffViewer -->
      <template v-else>
        <TextDiffViewer :old-text="oldText" :new-text="newText" />
      </template>
    </div>

    <!-- 工具ID -->
    <div v-if="toolId" class="text-[10px] text-slate-500 mt-2">ID: {{ toolId }}</div>
  </div>

  <!-- 如果不是编辑操作，使用原来的显示方式 -->
  <div v-else class="bg-slate-100 border border-slate-200 rounded-lg p-3 mb-1 shadow-sm">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-xs font-bold text-slate-600 uppercase">Tool Use:</span>
      <span class="text-xs font-mono text-indigo-600">{{ toolName }}</span>
    </div>
    <div v-if="toolData?.input" class="text-xs font-mono text-slate-700">
      <template v-if="isCollapsed">
        <pre class="whitespace-pre-wrap">{{
          JSON.stringify(toolData.input, null, 2).trim().substring(0, 200) + "..."
        }}</pre>
      </template>
      <template v-else>
        <pre class="whitespace-pre-wrap">{{
          JSON.stringify(toolData.input, null, 2).trim()
        }}</pre>
      </template>
    </div>
    <div v-if="toolId" class="text-[10px] text-slate-500 mt-1">ID: {{ toolId }}</div>
  </div>
</template>

<style scoped>
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
