<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useChatState } from '../composables/useChatState';
import { useChatMessages } from '../composables/useChatMessages';
import { useStreamHandler } from '../composables/useStreamHandler';
import { useImagePreview } from '../composables/useImagePreview';
import { useSubagentView } from '../composables/useSubagentView';
import { useCollapseStore } from '../stores/collapseStore';
import { chatService } from '../services/chat.service';
import ChatSidebar from '../components/ChatSidebar.vue';
import ChatHeader from '../components/ChatHeader.vue';
import ChatInput from '../components/ChatInput.vue';
import MessageRenderer from '../components/MessageRenderer.vue';
import ImageViewer from '../components/ImageViewer.vue';
import ScrollButtons from '../components/ScrollButtons.vue';
import type { ChatHistory, EventItem, IntervalOption, ChatMessage } from '@/types';

const { state, canSend, showSaveButton } = useChatState();
const { chatItems, groupedMessages, addChatItem, toggleToolCollapse, isCollapsed, toggleAllCollapse, clearMessages } = useChatMessages();
const { startStream, stopStream, isStreaming } = useStreamHandler(addChatItem, chatItems, () => {
  // 流结束时清除 streamingId
  state.streamingId = '';
  state.isStarting = false;
}, state);
const collapseStore = useCollapseStore();
const {
  images: uploadedImages,
  viewerVisible,
  viewerSrc,
  addImage,
  removeImage: removeImagePreview,
  clearImages,
  openViewer,
  closeViewer,
  handleFileSelect: handleImageFileSelect,
  handlePaste: handleImagePaste
} = useImagePreview();

// 子代理视图
const {
  isActive: subagentViewActive,
  messages: subagentMessages,
  description: subagentDescription,
  allCollapsed: subagentAllCollapsed,
  messageCount: subagentMessageCount,
  openSubagent,
  closeSubagent,
  toggleAllCollapse: toggleAllCollapseSubagent,
  isCollapsed: isSubagentCollapsed,
  toggleCollapse: toggleSubagentCollapse
} = useSubagentView();

// 子代理消息分组
const subagentGroupedMessages = computed(() => {
  const groups: any[] = [];
  let currentGroup: any = null;

  subagentMessages.value.forEach((item: any) => {
    if (item.role === 'user') {
      groups.push({
        id: item.id,
        role: 'user',
        items: [item]
      });
      currentGroup = null;
    } else if (item.role === 'assistant') {
      if (!currentGroup || currentGroup.role !== 'assistant') {
        currentGroup = {
          id: item.id,
          role: 'assistant',
          items: []
        };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    }
  });

  return groups;
});

const chatHistory = ref<ChatHistory[]>([]);
const eventsList = ref<EventItem[]>([]);

// 滚动相关
const chatContainerRef = ref<HTMLElement | null>(null);
const subagentContainerRef = ref<HTMLElement | null>(null);
const isNearBottom = ref(true); // 是否接近底部

// 滚动到底部
const scrollToBottom = (smooth = true) => {
  const container = subagentViewActive.value ? subagentContainerRef.value : chatContainerRef.value;
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
};

// 检查是否接近底部
const checkIfNearBottom = () => {
  const container = subagentViewActive.value ? subagentContainerRef.value : chatContainerRef.value;
  if (!container) return;

  const { scrollTop, scrollHeight, clientHeight } = container;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  isNearBottom.value = distanceFromBottom < 100; // 距离底部小于100px认为是接近底部
};

// 监听滚动事件
const handleScroll = () => {
  checkIfNearBottom();
};

// 监听消息变化，自动滚动
watch(() => chatItems.value.length, () => {
  if (isNearBottom.value) {
    nextTick(() => scrollToBottom(true));
  }
}, { flush: 'post' });

watch(() => subagentMessages.value.length, () => {
  if (isNearBottom.value && subagentViewActive.value) {
    nextTick(() => scrollToBottom(true));
  }
}, { flush: 'post' });

const intervalOptions: IntervalOption[] = [
  { value: 500, label: '0.5秒' },
  { value: 1000, label: '1秒' },
  { value: 2000, label: '2秒' },
  { value: 3000, label: '3秒' },
  { value: 5000, label: '5秒' },
  { value: 10000, label: '10秒' },
  { value: 30000, label: '30秒' },
  { value: 60000, label: '1分钟' }
];

// 加载事件列表
const loadEventsList = async () => {
  try {
    const data = await chatService.loadEvents();
    eventsList.value = data.events || [];
    if (eventsList.value.length > 0 && !state.selectedEvent) {
      state.selectedEvent = eventsList.value[0]!.name;
    }
  } catch (e) {
    console.error('Failed to load events list:', e);
  }
};

// 发送消息
const startSession = async () => {
  const msg = state.message.trim();
  if (!canSend.value) return;

  addChatItem({ role: 'user', kind: 'text', html: msg || '(附带图片)' });
  state.message = '';
  clearImages(); // 使用 useImagePreview 的 clearImages
  state.isStarting = true;

  // 发送消息后立即滚动到底部
  nextTick(() => scrollToBottom(true));

  try {
    const data = await chatService.startSession({
      message: msg,
      mock: false,
      ...(state.session && { session: state.session }),
      ...(state.currentCwd && !state.session && { cwd: state.currentCwd })
    });

    if (data.session) {
      state.session = data.session;
    }
    startStream(data.streamingId, data.streamUrl, (sessionId) => {
      state.session = sessionId;
      manualRefresh();
    });
    state.streamingId = data.streamingId;
    state.isStarting = false; // 流开始后重置 isStarting
  } catch (e) {
    console.error('Failed to start session:', e);
    state.isStarting = false;
  }
};

// 中断会话
const abortSession = async () => {
  if (!state.streamingId) return;

  try {
    await chatService.abortSession(state.streamingId);
    stopStream();
    state.streamingId = '';
  } catch (e) {
    console.error('Failed to abort session:', e);
  }
};

// 发送测试请求
const sendTestRequest = async () => {
  if (state.isStarting || !state.selectedEvent) return;

  const testMessage = `测试场景: ${state.selectedEvent}`;
  addChatItem({ role: 'user', kind: 'text', html: testMessage });
  state.isStarting = true;

  // 发送消息后立即滚动到底部
  nextTick(() => scrollToBottom(true));

  try {
    const data = await chatService.startSession({
      message: testMessage,
      mock: true,
      eventName: state.selectedEvent
    });

    startStream(data.streamingId, data.streamUrl);
    state.streamingId = data.streamingId;
    state.isStarting = false; // 流开始后重置 isStarting
  } catch (e) {
    console.error('Failed to send test request:', e);
    state.isStarting = false;
  }
};

// 权限处理
const approvePermission = async (item: ChatMessage) => {
  try {
    if (!item.requestId) return;
    await chatService.approvePermission(item.requestId);

    // 根据当前视图选择对应的消息列表
    if (subagentViewActive.value) {
      // 从子代理消息中移除
      const index = subagentMessages.value.findIndex((i: any) => i.id === item.id);
      if (index !== -1) {
        subagentMessages.value.splice(index, 1);
      }
    } else {
      // 从主消息列表中移除
      chatItems.value = chatItems.value.filter(i => i.id !== item.id);
    }
  } catch (e) {
    console.error('Failed to approve permission:', e);
  }
};

const denyPermission = async (item: ChatMessage) => {
  try {
    if (!item.requestId) return;
    await chatService.denyPermission(item.requestId);

    // 根据当前视图选择对应的消息列表
    if (subagentViewActive.value) {
      // 从子代理消息中移除
      const index = subagentMessages.value.findIndex((i: any) => i.id === item.id);
      if (index !== -1) {
        subagentMessages.value.splice(index, 1);
      }
    } else {
      // 从主消息列表中移除
      chatItems.value = chatItems.value.filter(i => i.id !== item.id);
    }
  } catch (e) {
    console.error('Failed to deny permission:', e);
  }
};

// 清空对话
const clearChat = () => {
  clearMessages();
  state.allEvents = [];
  state.conversationEnded = false;
  state.session = '';
  stopStream();
};

// 重置对话
const resetChat = () => {
  clearChat();
  state.selectedHistoryId = null;
  state.showInputArea = true;
  state.inputDisabled = false;
  state.projectPathMissing = false;
};

// 复制 Session ID
const copySessionId = async () => {
  try {
    await navigator.clipboard.writeText(state.session);
    state.status = '✓ Session ID 已复制';
    setTimeout(() => {
      state.status = '';
    }, 2000);
  } catch (err) {
    console.error('复制失败:', err);
  }
};

// 保存事件
const openSaveModal = () => {
  state.showSaveModal = true;
};

const closeSaveModal = () => {
  state.showSaveModal = false;
  state.saveEventName = '';
};

const saveEvents = async () => {
  const name = state.saveEventName.trim();
  if (!name) return;

  state.isSaving = true;
  try {
    await chatService.saveEvents(name, state.allEvents);
    state.status = `✓ 事件已保存: ${name}`;
    closeSaveModal();
    // 重新加载事件列表
    await loadEventsList();
    // 自动选中刚保存的事件
    state.selectedEvent = name;
    setTimeout(() => {
      state.status = '';
    }, 2000);
  } catch (e: any) {
    console.error('保存失败:', e);
    state.status = `✗ 保存失败: ${e.message}`;
    alert(`保存失败: ${e.message}`);
  } finally {
    state.isSaving = false;
  }
};

// 加载项目列表
const loadProjects = async () => {
  try {
    const data = await chatService.loadProjects();
    if (data.projects && data.projects.length > 0) {
      chatHistory.value = [];
      data.projects.forEach((project: { id: string; projectPath: string, sessions?: Array<{ id: string; title?: string; createdAt?: string; modifiedAt?: string }> }) => {
        if (project.sessions && project.sessions.length > 0) {
          project.sessions.forEach((session) => {
            chatHistory.value.push({
              id: `${project.id}/${session.id}`,
              title: session.title || session.id,
              projectPath: project.projectPath,
              isRemote: true,
              projectId: project.id,
              sessionId: session.id,
              messages: [],
              createdAt: session.createdAt,
              modifiedAt: session.modifiedAt,
            });
          });
        }
      });

      chatHistory.value.sort((a, b) => {
        const timeA = new Date(a.modifiedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.modifiedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    }
  } catch (error) {
    console.error('加载项目列表失败:', error);
  }
};

// 加载历史对话
const loadHistoryConversation = async (historyItem: ChatHistory, silent = false) => {
  if (historyItem.isRemote && historyItem.projectId && historyItem.sessionId) {
    try {
      const data = await chatService.loadSession(historyItem.projectId, historyItem.sessionId);
      if (data.conversation && data.conversation.length > 0) {
        // 如果是静默刷新，比较内容是否有变化
        if (silent) {
          const hasChanged = JSON.stringify(chatItems.value) !== JSON.stringify(data.conversation);
          if (!hasChanged) {
            // 内容没有变化，不更新UI
            return;
          }
        }

        chatItems.value = data.conversation;
        state.session = historyItem.sessionId;
        state.currentCwd = data.projectPath || '';
        state.projectPathMissing = !data.projectPathExists;
        state.showInputArea = true;
        state.inputDisabled = true;
        state.selectedHistoryId = historyItem.id;
      }
    } catch (error) {
      console.error('加载会话失败:', error);
    }
  }
};

// 删除会话
const deleteSession = async (sessionId: string) => {
  if (!confirm(`确定要删除会话 "${sessionId}" 吗？`)) return;

  try {
    await chatService.deleteSession(sessionId);
    await loadProjects();
    if (chatHistory.value.length > 0 && chatHistory.value[0]) {
      await loadHistoryConversation(chatHistory.value[0]);
    }
  } catch (error) {
    console.error('删除会话失败:', error);
  }
};

// 自动刷新
const manualRefresh = async (silent = false) => {
  if (state.isRefreshing || state.isStarting) return;

  // 静默刷新时不显示刷新状态
  if (!silent) {
    state.isRefreshing = true;
  }

  try {
    // 刷新左侧历史列表
    await loadProjects();

    // 如果当前有选中的会话，重新加载该会话内容（刷新右侧预览区域）
    if (state.selectedHistoryId) {
      const currentHistory = chatHistory.value.find(h => h.id === state.selectedHistoryId);
      if (currentHistory) {
        await loadHistoryConversation(currentHistory, silent);
      }
    }
  } catch (error) {
    console.error('刷新失败:', error);
  } finally {
    if (!silent) {
      state.isRefreshing = false;
    }
  }
};

// 自动刷新定时器
let autoRefreshTimer: number | null = null;

// 启动自动刷新
const startAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }

  if (state.autoRefresh.enabled) {
    autoRefreshTimer = window.setInterval(() => {
      manualRefresh(true); // 自动刷新时使用静默模式
    }, state.autoRefresh.interval);
  }
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
};

// 监听自动刷新开关和间隔变化
watch(() => state.autoRefresh.enabled, (enabled) => {
  if (enabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

watch(() => state.autoRefresh.interval, () => {
  if (state.autoRefresh.enabled) {
    startAutoRefresh(); // 重启定时器以应用新的间隔
  }
});

// 工作目录管理
const loadCwdList = () => {
  try {
    const saved = localStorage.getItem('cwdList');
    if (saved) {
      state.cwdList = JSON.parse(saved);
      if (state.cwdList.length > 0) {
        const lastCwd = state.cwdList[state.cwdList.length - 1];
        if (lastCwd) {
          state.currentCwd = lastCwd;
        }
      }
    }
  } catch (e) {
    console.error('加载工作目录列表失败', e);
  }
};

const saveCwdList = () => {
  try {
    localStorage.setItem('cwdList', JSON.stringify(state.cwdList));
  } catch (e) {
    console.error('保存工作目录列表失败', e);
  }
};

const selectCwd = (cwd: string) => {
  state.currentCwd = cwd;
  state.cwdDropdownOpen = false;
};

const removeCwd = (index: number) => {
  state.cwdList.splice(index, 1);
  saveCwdList();
};

// 图片处理
const handleFileSelect = async (files: FileList) => {
  await handleImageFileSelect({ target: { files, value: '' } } as any);
};

const removeImage = (imageId: string) => {
  removeImagePreview(imageId);
};

const handlePaste = async (event: ClipboardEvent) => {
  await handleImagePaste(event);
};

onMounted(() => {
  loadEventsList();
  loadCwdList();
  loadProjects().then(() => {
    if (chatHistory.value.length > 0 && chatHistory.value[0]) {
      loadHistoryConversation(chatHistory.value[0]);
    }
  });

  // 获取容器引用并添加滚动监听
  nextTick(() => {
    chatContainerRef.value = document.getElementById('chat-container');
    subagentContainerRef.value = document.getElementById('subagent-messages-container');

    if (chatContainerRef.value) {
      chatContainerRef.value.addEventListener('scroll', handleScroll);
      checkIfNearBottom();
    }
    if (subagentContainerRef.value) {
      subagentContainerRef.value.addEventListener('scroll', handleScroll);
    }
  });
});

onBeforeUnmount(() => {
  stopStream();
  stopAutoRefresh(); // 清理自动刷新定时器

  // 移除滚动监听
  if (chatContainerRef.value) {
    chatContainerRef.value.removeEventListener('scroll', handleScroll);
  }
  if (subagentContainerRef.value) {
    subagentContainerRef.value.removeEventListener('scroll', handleScroll);
  }
});
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- 侧边栏 -->
    <ChatSidebar :chat-history="chatHistory" :selected-history-id="state.selectedHistoryId" @reset-chat="resetChat"
      @load-history="loadHistoryConversation" @delete-session="deleteSession" />

    <!-- 主界面 -->
    <main class="flex-1 h-full relative flex flex-col overflow-hidden">
      <!-- 子代理视图覆盖层 -->
      <div v-if="subagentViewActive" class="absolute inset-0 bg-white z-50 flex flex-col">
        <!-- 子代理顶部导航 -->
        <header class="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <button @click="closeSubagent"
              class="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
              <i class="fa-solid fa-arrow-left text-slate-700"></i>
            </button>
            <div>
              <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i class="fa-solid fa-robot text-purple-600"></i>
                子代理对话
              </h2>
              <p class="text-xs text-slate-500">{{ subagentDescription }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <button @click="toggleAllCollapseSubagent"
              class="text-slate-500 hover:text-purple-500 transition flex items-center gap-1.5" title="全部折叠/展开">
              <i class="fa-solid" :class="subagentAllCollapsed ? 'fa-angles-down' : 'fa-angles-up'"></i>
              {{ subagentAllCollapsed ? '全部展开' : '全部折叠' }}
            </button>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <i class="fa-solid fa-layer-group"></i>
              <span>{{ subagentMessageCount }} 条消息</span>
            </div>
          </div>
        </header>

        <!-- 子代理对话内容 -->
        <div id="subagent-messages-container" class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-slate-50">
          <template v-if="subagentGroupedMessages.length > 0">
            <div v-for="(group, index) in subagentGroupedMessages" :key="group.id" class="mb-4">
              <MessageRenderer :group="group" :is-subagent="true"
                :is-loading="isStreaming && index === subagentGroupedMessages.length - 1 && group.role === 'assistant'"
                :is-collapsed="(itemId) => isSubagentCollapsed(itemId)"
                @toggle-collapse="(item) => toggleSubagentCollapse(item.id)" @approve-permission="approvePermission"
                @deny-permission="denyPermission" @open-subagent="openSubagent" />
            </div>
          </template>
          <div v-else class="h-full flex items-center justify-center text-slate-400">
            <div class="text-center">
              <i class="fa-solid fa-inbox text-4xl mb-3"></i>
              <p>暂无子代理消息</p>
            </div>
          </div>
        </div>

        <!-- 滚动按钮组件 -->
        <ScrollButtons container-id="subagent-messages-container" />
      </div>

      <!-- 主对话视图 -->
      <div class="w-full h-full flex flex-col overflow-hidden" v-show="!subagentViewActive">
        <!-- 顶部导航 -->
        <ChatHeader :selected-event="state.selectedEvent" :dropdown-open="state.dropdownOpen" :events-list="eventsList"
          :is-starting="state.isStarting" :session="state.session" :streaming-id="state.streamingId"
          :auto-refresh-enabled="state.autoRefresh.enabled" :auto-refresh-interval="state.autoRefresh.interval"
          :interval-dropdown-open="state.autoRefresh.intervalDropdownOpen" :interval-options="intervalOptions"
          :is-refreshing="state.isRefreshing" :all-collapsed="collapseStore.allCollapsed"
          @toggle-dropdown="state.dropdownOpen = !state.dropdownOpen"
          @select-event="(name) => { state.selectedEvent = name; state.dropdownOpen = false; }"
          @delete-event="(name) => chatService.deleteEvent(name).then(() => loadEventsList())"
          @send-test="sendTestRequest" @copy-session="copySessionId"
          @toggle-auto-refresh="state.autoRefresh.enabled = !state.autoRefresh.enabled"
          @toggle-interval-dropdown="state.autoRefresh.intervalDropdownOpen = !state.autoRefresh.intervalDropdownOpen"
          @select-interval="(val) => { state.autoRefresh.interval = val; state.autoRefresh.intervalDropdownOpen = false; }"
          @manual-refresh="manualRefresh"
          @toggle-all-collapse="() => { collapseStore.toggleAllCollapse(); toggleAllCollapse(collapseStore.allCollapsed); }"
          @clear-chat="clearChat" />

        <!-- 对话内容区域 -->
        <div id="chat-container" class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
          <div v-if="chatItems.length === 0"
            class="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div
              class="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <i class="fa-solid fa-wand-magic-sparkles text-3xl"></i>
            </div>
            <h2 class="text-2xl font-bold text-slate-800 mb-2">今天能帮您做点什么？</h2>
            <p class="text-slate-500">我可以帮您编写代码、分析数据或回答问题。请在下方输入您的需求。</p>
          </div>

          <!-- 分组渲染消息 -->
          <template v-if="groupedMessages.length > 0">
            <div v-for="(group, index) in groupedMessages" :key="group.id" class="mb-4">
              <MessageRenderer :group="group" :is-subagent="false" :is-collapsed="isCollapsed"
                :is-loading="isStreaming && index === groupedMessages.length - 1 && group.role === 'assistant'"
                @toggle-collapse="(item) => toggleToolCollapse(item.id)" @approve-permission="approvePermission"
                @deny-permission="denyPermission" @open-subagent="openSubagent">
                <template #actions v-if="showSaveButton && index === groupedMessages.length - 1">
                  <button @click="openSaveModal"
                    class="save-icon-btn text-slate-400 hover:text-blue-600 transition-colors" title="保存对话事件">
                    <i class="fa-solid fa-floppy-disk text-xs"></i>
                  </button>
                </template>
              </MessageRenderer>
            </div>
          </template>
        </div>

        <!-- 输入区域 -->
        <ChatInput :message="state.message" :can-send="canSend" :streaming-id="state.streamingId"
          :is-starting="state.isStarting" :current-cwd="state.currentCwd" :cwd-list="state.cwdList"
          :cwd-dropdown-open="state.cwdDropdownOpen" :input-disabled="state.inputDisabled"
          :project-path-missing="state.projectPathMissing" :uploaded-images="uploadedImages"
          @update:message="state.message = $event" @update:current-cwd="state.currentCwd = $event" @send="startSession"
          @abort="abortSession" @toggle-cwd-dropdown="state.cwdDropdownOpen = !state.cwdDropdownOpen"
          @select-cwd="selectCwd" @remove-cwd="removeCwd" @file-select="handleFileSelect" @paste="handlePaste"
          @remove-image="removeImage" @preview-image="openViewer" />

        <!-- 滚动按钮组件 -->
        <ScrollButtons container-id="chat-container" />
      </div>
    </main>

    <!-- 图片查看器 -->
    <ImageViewer :src="viewerSrc" :visible="viewerVisible" @close="closeViewer" />

    <!-- 保存事件 Modal -->
    <div v-if="state.showSaveModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      @click.self="closeSaveModal">
      <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h3 class="text-xl font-bold text-slate-800 mb-4">保存对话事件</h3>
        <p class="text-sm text-slate-600 mb-4">请输入事件名称，用于后续测试场景选择</p>
        <input v-model="state.saveEventName" @keydown.enter="saveEvents" type="text" placeholder="例如: test-scenario-1"
          class="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4">
        <div class="flex gap-3 justify-end">
          <button @click="closeSaveModal"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition">
            取消
          </button>
          <button @click="saveEvents" :disabled="!state.saveEventName.trim()"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <i v-if="!state.isSaving" class="fa-solid fa-check"></i>
            <span v-if="state.isSaving"
              class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            {{ state.isSaving ? '保存中...' : '确认保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
  border: 2px solid #f1f5f9;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.save-icon-btn {
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.save-icon-btn:hover {
  background: rgba(59, 130, 246, 0.1);
}
</style>
