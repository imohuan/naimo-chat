<script setup lang="ts">
import type { MessageGroup, ChatMessage } from '@/types';

defineProps<{
  group: MessageGroup;
  isSubagent?: boolean;
  isCollapsed: (itemId: string, isSubagent?: boolean) => boolean;
}>();

const emit = defineEmits<{
  'toggle-collapse': [item: ChatMessage];
  'approve-permission': [item: ChatMessage];
  'deny-permission': [item: ChatMessage];
  'open-subagent': [item: ChatMessage];
}>();

const trimSW = (text: string) => text.replace(/^"|"$/g, '');
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
      <div
        class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center bg-gradient-to-br text-white shadow-sm"
        :class="isSubagent ? 'from-purple-500 to-purple-600' : 'from-blue-500 to-blue-600'">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="flex-1 bg-white shadow-xs rounded-xl p-4 space-y-3 overflow-hidden">
        <template v-for="item in group.items" :key="item.id">
          <!-- 文本内容 -->
          <div v-if="item.kind === 'text'" class="assistant-text text-slate-800" v-html="item.html"></div>

          <!-- 工具调用卡片 -->
          <div v-if="item.kind === 'tool'" class="w-full">
            <div class="bg-white border rounded-lg shadow-sm overflow-hidden" :class="[
              isCollapsed(item.id, isSubagent) ? 'tool-collapsed' : '',
              item.isError ? 'border-red-300 bg-red-50' : 'border-slate-200'
            ]">
              <div @click="emit('toggle-collapse', item)"
                class="px-4 py-2.5 border-b flex justify-between items-center cursor-pointer transition select-none"
                :class="item.isError ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <i class="fa-solid fa-chevron-down tool-collapse-btn flex-shrink-0"
                    :class="item.isError ? 'text-red-400' : 'text-slate-400'"></i>
                  <span class="text-xs font-semibold flex-shrink-0"
                    :class="item.isError ? 'text-red-700' : 'text-slate-700'">{{ item.name }}</span>
                  <span v-if="isCollapsed(item.id, isSubagent) && item.name === 'Bash' && item.input?.command"
                    class="text-xs font-mono truncate max-w-md"
                    :class="item.isError ? 'text-red-600' : 'text-slate-500'">
                    {{ item.input.command }}
                  </span>
                  <span v-else-if="item.input?.path || item.input?.file_path"
                    class="text-[10px] font-mono truncate max-w-md"
                    :class="item.isError ? 'text-red-500' : 'text-slate-400'">
                    {{ item.input.path || item.input.file_path }}
                  </span>
                  <span
                    v-if="isCollapsed(item.id, isSubagent) && item.name !== 'Bash' && item.input && Object.keys(item.input).length > 0"
                    class="text-[10px] font-mono truncate max-w-md"
                    :class="item.isError ? 'text-red-500' : 'text-slate-400'">
                    {{ item.input }}
                  </span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span v-if="item.isError"
                    class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
                    <i class="fa-solid fa-circle-exclamation"></i> ERROR
                  </span>
                  <span v-else-if="item.result"
                    class="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
                    <i class="fa-solid fa-circle-check"></i> SUCCESS
                  </span>
                  <span v-else class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">TOOL</span>
                </div>
              </div>

              <div v-show="!isCollapsed(item.id, isSubagent)">
                <div class="px-3 font-mono text-xs border-b"
                  :class="item.isError ? 'bg-red-100 text-red-800 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'">
                  <div v-if="item.name === 'Bash'" class="py-3"
                    :class="item.isError ? 'text-red-900' : 'text-slate-800'">{{ item.input?.command }}</div>
                  <div v-else-if="item.name === 'Write'"></div>
                  <div v-else class="py-3">{{ JSON.stringify(item.input) }}</div>
                </div>

                <div class="p-3 text-xs font-mono max-h-64 overflow-y-auto custom-scrollbar"
                  :class="item.isError ? 'bg-red-50' : 'bg-white'">
                  <div v-if="item.isError"
                    class="bg-red-100 border-l-4 border-red-600 px-3 py-2 mb-2 rounded flex items-start gap-2">
                    <i class="fa-solid fa-circle-xmark text-red-700 flex-shrink-0 mt-0.5"></i>
                    <span class="text-red-800 font-semibold">执行错误</span>
                  </div>
                  <div v-if="item.diffLines">
                    <div v-for="(line, idx) in item.diffLines" :key="idx"
                      :class="line.type === 'add' ? 'diff-added' : line.type === 'rem' ? 'diff-removed' : 'text-slate-500'"
                      class="px-2 py-0.5">
                      {{ line.content }}
                    </div>
                  </div>
                  <pre v-else
                    :class="item.isError ? 'text-red-700' : 'text-slate-600'">{{ item.result || '执行中...' }}</pre>
                </div>
              </div>
            </div>
          </div>

          <!-- 权限审批 UI -->
          <div v-if="item.kind === 'permission_request'" class="w-full">
            <div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div class="flex gap-3">
                <div
                  class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 flex-shrink-0">
                  <i class="fa-solid fa-shield-halved text-lg"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <i class="fa-solid fa-lock"></i>
                    操作权限请求: {{ item.toolName }}
                  </h4>
                  <div
                    class="bg-white/50 rounded p-2 mt-2 font-mono text-[10px] text-slate-600 border border-amber-100 max-h-64 overflow-auto custom-scrollbar">
                    <pre
                      class="whitespace-pre-wrap break-words">{{ JSON.stringify(item.toolInput || item.payload, null, 2) }}</pre>
                  </div>
                  <div class="mt-4 flex gap-2">
                    <button @click="emit('approve-permission', item)"
                      class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                      <i class="fa-solid fa-check"></i> 允许执行
                    </button>
                    <button @click="emit('deny-permission', item)"
                      class="px-4 py-2 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                      <i class="fa-solid fa-xmark"></i> 拒绝
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 子代理卡片 -->
          <div v-if="item.kind === 'subagent'" class="w-full">
            <div class="bg-white border rounded-lg shadow-sm overflow-hidden" :class="[
              isCollapsed(item.id, isSubagent) ? 'tool-collapsed' : '',
              item.isError ? 'border-red-300 bg-red-50' : 'border-purple-200'
            ]">
              <div @click="emit('toggle-collapse', item)"
                class="px-4 py-2.5 border-b flex justify-between items-center cursor-pointer transition select-none"
                :class="item.isError ? 'bg-red-50 border-red-200 hover:bg-red-100' : 'bg-purple-50 border-purple-200 hover:bg-purple-100'">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <i class="fa-solid fa-chevron-down tool-collapse-btn flex-shrink-0"
                    :class="item.isError ? 'text-red-400' : 'text-purple-400'"></i>
                  <i class="fa-solid fa-robot flex-shrink-0"
                    :class="item.isError ? 'text-red-600' : 'text-purple-600'"></i>
                  <span class="text-xs font-semibold flex-shrink-0"
                    :class="item.isError ? 'text-red-700' : 'text-purple-700'">Agent</span>
                  <span v-if="isCollapsed(item.id, isSubagent) && item.input?.description"
                    class="text-xs font-mono truncate max-w-md"
                    :class="item.isError ? 'text-red-600' : 'text-purple-600'">
                    {{ item.input.description }}
                  </span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button v-if="item.subagentMessages && item.subagentMessages.length > 0"
                    @click.stop="emit('open-subagent', item)"
                    class="text-xs px-2 py-1 rounded transition flex items-center gap-1"
                    :class="item.isError ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'"
                    title="打开子代理对话">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    <span>打开</span>
                  </button>
                  <span v-if="item.isError"
                    class="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
                    <i class="fa-solid fa-circle-exclamation"></i> ERROR
                  </span>
                  <span v-else-if="item.result"
                    class="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1">
                    <i class="fa-solid fa-circle-check"></i> SUCCESS
                  </span>
                  <span v-else
                    class="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">AGENT</span>
                </div>
              </div>

              <div v-show="!isCollapsed(item.id, isSubagent)">
                <div class="px-3 py-3 font-mono text-xs border-b"
                  :class="item.isError ? 'bg-red-100 text-red-800 border-red-200' : 'bg-purple-50 text-purple-800 border-purple-200'">
                  <div class="mb-2">
                    <span class="font-bold">描述:</span> {{ item.input?.description || 'N/A' }}
                  </div>
                  <div class="mb-2">
                    <span class="font-bold">类型:</span> {{ item.input?.subagent_type || 'N/A' }}
                  </div>
                  <div>
                    <span class="font-bold">提示:</span> {{ item.input?.prompt || 'N/A' }}
                  </div>
                </div>

                <div class="p-3 text-xs font-mono max-h-64 overflow-y-auto custom-scrollbar"
                  :class="item.isError ? 'bg-red-50' : 'bg-white'">
                  <div v-if="item.isError"
                    class="bg-red-100 border-l-4 border-red-600 px-3 py-2 mb-2 rounded flex items-start gap-2">
                    <i class="fa-solid fa-circle-xmark text-red-700 flex-shrink-0 mt-0.5"></i>
                    <span class="text-red-800 font-semibold">执行错误</span>
                  </div>

                  <div v-if="item.subagentMessages && item.subagentMessages.length > 0"
                    class="bg-purple-50 border-l-4 border-purple-500 px-3 py-2 rounded flex items-start gap-2 mb-3">
                    <i class="fa-solid fa-comments text-purple-600 flex-shrink-0 mt-0.5"></i>
                    <div class="flex-1">
                      <div class="text-purple-800 font-semibold mb-1">子代理对话 ({{ item.subagentMessages.length }}
                        条消息)</div>
                      <div class="text-purple-600 text-[11px]">点击上方"打开"按钮查看完整对话</div>
                    </div>
                  </div>

                  <div v-if="item.result">
                    <div class="text-slate-500 font-semibold mb-2 text-[11px] uppercase tracking-wide">返回结果:</div>
                    <pre class="whitespace-pre-wrap break-words"
                      :class="item.isError ? 'text-red-700' : 'text-slate-700'">{{ item.result }}</pre>
                  </div>
                  <div v-else-if="!item.subagentMessages || item.subagentMessages.length === 0">
                    <pre class="text-slate-400">执行中...</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TODO 列表卡片 -->
          <div v-if="item.kind === 'todo_list'" class="w-full">
            <div class="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden"
              :class="{ 'tool-collapsed': isCollapsed(item.id, isSubagent) }">
              <div @click="emit('toggle-collapse', item)"
                class="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition select-none">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  <i class="fa-solid fa-chevron-down text-slate-400 tool-collapse-btn flex-shrink-0"></i>
                  <span class="text-xs font-semibold text-slate-700 flex-shrink-0">任务列表</span>
                  <span class="text-[10px] text-slate-400 font-semibold truncate max-w-md">{{ item.todos?.length || 0 }}
                    项</span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">TOOL</span>
                </div>
              </div>

              <div v-show="!isCollapsed(item.id, isSubagent)">
                <div class="p-3 text-xs max-h-64 overflow-y-auto custom-scrollbar bg-white">
                  <div v-for="todo in item.todos" :key="todo.id" class="mb-2 last:mb-0">
                    <div class="flex items-center gap-2 p-2 rounded hover:bg-slate-50 transition">
                      <span class="w-2 h-2 rounded-full flex-shrink-0"
                        :class="todo.status === 'completed' ? 'bg-green-500' : todo.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'"></span>
                      <div class="font-medium text-slate-800 flex-shrink-0"
                        :class="{ 'line-through text-slate-400': todo.status === 'completed' }">
                        {{ todo.content }}
                      </div>
                      <div v-if="todo.activeForm" class="text-[11px] text-slate-400 truncate flex-1 min-w-0"
                        :title="todo.activeForm">
                        {{ todo.activeForm }}
                      </div>
                      <span class="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ml-auto" :class="{
                        'bg-green-100 text-green-700': todo.status === 'completed',
                        'bg-blue-100 text-blue-700': todo.status === 'in_progress',
                        'bg-slate-100 text-slate-600': todo.status === 'pending'
                      }">
                        {{ todo.status === 'completed' ? '完成' : todo.status === 'in_progress' ? '进行中' : '待处理' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 时间戳 -->
        <div class="text-[10px] text-slate-400 pt-1 flex items-center gap-2">
          <span>{{ group.time }}</span>
          <slot name="actions"></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-collapse-btn {
  transition: transform 0.2s ease;
}

.tool-collapsed .tool-collapse-btn {
  transform: rotate(-90deg);
}

.diff-added {
  background-color: #f0fdf4;
  border-left: 3px solid #22c55e;
}

.diff-removed {
  background-color: #fef2f2;
  border-left: 3px solid #ef4444;
}

.assistant-text {
  color: #1e293b;
  line-height: 1.6;
}

.assistant-text p {
  margin: 0.5rem 0;
}

.assistant-text ul,
.assistant-text ol {
  margin: 0.75rem 0;
  padding-left: 1.5rem;
}

.assistant-text code {
  background: #e2e8f0;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

.assistant-text pre {
  background: #f1f5f9;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 1rem 0;
}
</style>
