export { default as ChatPage } from './pages/ChatPage.vue';
export { default as ChatSidebar } from './components/ChatSidebar.vue';
export { default as ChatHeader } from './components/ChatHeader.vue';
export { default as ChatInput } from './components/ChatInput.vue';
export { default as MessageRenderer } from './components/MessageRenderer.vue';
export { default as ScrollButtons } from './components/ScrollButtons.vue';

export { useChatState } from './composables/useChatState';
export { useChatMessages } from './composables/useChatMessages';
export { useStreamHandler } from './composables/useStreamHandler';
export { useSmartScroll } from './composables/useSmartScroll';

export { chatService } from './services/chat.service';
