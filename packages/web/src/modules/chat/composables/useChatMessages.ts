import { ref, computed, nextTick } from 'vue';
import { marked } from 'marked';
import { useCollapseStore } from '../stores/collapseStore';
import type { ChatMessage, MessageGroup } from '@/types';

export function useChatMessages() {
  const chatItems = ref<ChatMessage[]>([]);
  const collapseStore = useCollapseStore();

  const groupedMessages = computed<MessageGroup[]>(() => {
    const groups: MessageGroup[] = [];
    let currentGroup: MessageGroup | null = null;

    chatItems.value.forEach(item => {
      if (item.role === 'user') {
        groups.push({
          id: item.id,
          role: 'user',
          html: item.html || item.rawText || '',
          time: item.time
        });
        currentGroup = null;
      } else if (item.role === 'assistant') {
        if (!currentGroup || currentGroup.role !== 'assistant') {
          currentGroup = {
            id: `group-${item.id}`,
            role: 'assistant',
            items: [],
            time: item.time
          };
          groups.push(currentGroup);
        }

        // 直接使用 item，不要重新处理 html
        // html 已经在 updateTextContent 中处理过了
        currentGroup.items!.push(item);
        currentGroup.time = item.time;
      }
    });

    return groups;
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const addChatItem = (item: Partial<ChatMessage>) => {
    const id = item.id || Math.random().toString(36).substr(2, 9);
    const newItem = { ...item, id, time: formatTime(new Date()) } as ChatMessage;
    chatItems.value.push(newItem);

    // 如果是可折叠的项目，注册到 store
    if (newItem.kind === 'tool' || newItem.kind === 'subagent' || newItem.kind === 'todo_list') {
      collapseStore.registerItem(id);
    }
  };

  const toggleToolCollapse = (itemId: string) => {
    collapseStore.toggleCollapse(itemId);
  };

  const isCollapsed = (itemId: string) => {
    return collapseStore.isCollapsed(itemId);
  };

  const toggleAllCollapse = (newState: boolean) => {
    // 先确保所有可折叠项目都已注册
    chatItems.value.forEach(item => {
      if (item.kind === 'tool' || item.kind === 'subagent' || item.kind === 'todo_list') {
        collapseStore.registerItem(item.id);
      }
    });

    // 然后设置全部折叠状态
    collapseStore.setAllCollapsed(newState);
  };

  const clearMessages = () => {
    chatItems.value = [];
    collapseStore.clearAll();
  };

  return {
    chatItems,
    groupedMessages,
    addChatItem,
    toggleToolCollapse,
    isCollapsed,
    toggleAllCollapse,
    clearMessages
  };
}
