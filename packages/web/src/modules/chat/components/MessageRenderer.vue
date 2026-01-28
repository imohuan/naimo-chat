<script setup lang="ts">
import type { MessageGroup, ChatMessage } from '@/types';
import { TextCard, ToolCard, ToolEditCard, PermissionCard, SubagentCard, TodoListCard } from './MessageCard';

defineProps<{
  group: MessageGroup;
  isSubagent?: boolean;
  isCollapsed: (itemId: string, isSubagent?: boolean) => boolean;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  'toggle-collapse': [item: ChatMessage];
  'approve-permission': [item: ChatMessage];
  'deny-permission': [item: ChatMessage];
  'open-subagent': [item: ChatMessage];
}>();

const trimSW = (text: string) => text.replace(/^"|"$/g, '');

// 判断是否是编辑类型的工具
const isEditTool = (item: ChatMessage) => {
  return (
    item.name === 'Edit' ||
    item.name === 'strReplace' ||
    item.name?.toLowerCase().includes('edit') ||
    (item.input && (item.input.old_string || item.input.new_string || item.input.oldStr || item.input.newStr))
  );
};
</script>

<template>
  <div>
    <!-- 用户消息 -->
    <div v-if="group.role === 'user'" class="flex gap-4 max-w-4xl mx-auto flex-row-reverse">
      <div class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-1 bg-blue-600 text-white">
        <i class="fa-solid fa-user"></i>
      </div>
      <div class="flex-1 flex flex-col gap-2 items-end">
        <div class="prose prose-slate max-w-full px-4 py-3 rounded-2xl shadow-sm bg-blue-600 text-white prose-invert"
          v-html="trimSW(group.html || '')"></div>
        <span class="text-[10px] text-slate-400 px-1">{{ group.time }}</span>
      </div>
    </div>

    <!-- AI 消息组 -->
    <div v-if="group.role === 'assistant'" class="flex gap-4 max-w-4xl mx-auto">
      <div class="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-linear-to-br text-white shadow-sm"
        :class="isSubagent ? 'from-purple-500 to-purple-600' : 'from-blue-500 to-blue-600'">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="flex-1 bg-white shadow-xs rounded-xl p-4 space-y-3 overflow-hidden">
        <template v-for="item in group.items" :key="item.id">
          <TextCard v-if="item.kind === 'text'" :item="item" />

          <ToolEditCard v-else-if="item.kind === 'tool' && isEditTool(item)" :item="item"
            :is-collapsed="isCollapsed(item.id, isSubagent)" :is-subagent="isSubagent"
            @toggle-collapse="emit('toggle-collapse', item)" />

          <ToolCard v-else-if="item.kind === 'tool'" :item="item" :is-collapsed="isCollapsed(item.id, isSubagent)"
            :is-subagent="isSubagent" @toggle-collapse="emit('toggle-collapse', item)" />

          <PermissionCard v-else-if="item.kind === 'permission_request'" :item="item"
            @approve="emit('approve-permission', item)" @deny="emit('deny-permission', item)" />

          <SubagentCard v-else-if="item.kind === 'subagent'" :item="item"
            :is-collapsed="isCollapsed(item.id, isSubagent)" :is-subagent="isSubagent"
            @toggle-collapse="emit('toggle-collapse', item)" @open-subagent="emit('open-subagent', item)" />

          <TodoListCard v-else-if="item.kind === 'todo_list'" :item="item"
            :is-collapsed="isCollapsed(item.id, isSubagent)" :is-subagent="isSubagent"
            @toggle-collapse="emit('toggle-collapse', item)" />

          <TextCard v-else :item="item" />
        </template>

        <!-- 时间戳 -->
        <div class="text-[10px] text-slate-400 pt-1 flex items-center gap-2">
          <span>{{ group.time }}</span>
          <!-- 加载状态指示器 -->
          <div v-if="isLoading" class="flex items-center">
            <span class="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></span>
          </div>
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 
 * MessageRenderer 组件样式
 * 大部分样式已移至全局样式文件: @/modules/chat/styles/chat.css
 * 这里只保留组件特定的样式覆盖（如果需要）
 */
</style>
