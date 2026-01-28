import { ref, computed, nextTick } from 'vue';
import { marked } from 'marked';
import type { ChatMessage, MessageGroup } from '@/types';

export function useChatMessages() {
  const chatItems = ref<ChatMessage[]>([]);
  const collapseStateMap = new Map<string, boolean>();

  const groupedMessages = computed<MessageGroup[]>(() => {
    const groups: MessageGroup[] = [];
    let currentGroup: MessageGroup | null = null;

    chatItems.value.forEach(item => {
      if (item.role === 'user') {
        groups.push({
          id: item.id,
          role: 'user',
          html: item.html || item.rawText,
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

        const processedItem = { ...item };
        if (item.kind === 'text' && !item.html && item.rawText) {
          processedItem.html = marked.parse(item.rawText) as string;
        }

        currentGroup.items!.push(processedItem);
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
    chatItems.value.push({ ...item, id, time: formatTime(new Date()) } as ChatMessage);
  };

  const toggleToolCollapse = (itemId: string) => {
    const currentState = collapseStateMap.get(itemId) || false;
    collapseStateMap.set(itemId, !currentState);
  };

  const isCollapsed = (itemId: string) => {
    return collapseStateMap.get(itemId) || false;
  };

  const toggleAllCollapse = (newState: boolean) => {
    chatItems.value.forEach(item => {
      if (item.kind === 'tool' || item.kind === 'subagent' || item.kind === 'todo_list') {
        collapseStateMap.set(item.id, newState);
      }
    });
  };

  const clearMessages = () => {
    chatItems.value = [];
    collapseStateMap.clear();
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
