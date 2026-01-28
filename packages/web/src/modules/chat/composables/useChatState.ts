import { reactive, computed } from 'vue';
import type { ChatMessage, ModelOption } from '@/types';

export interface ChatState {
  message: string;
  isStarting: boolean;
  isRefreshing: boolean;
  streamingId: string;
  session: string;
  status: string;
  selectedEvent: string;
  dropdownOpen: boolean;
  selectedModel: string;
  modelDropdownOpen: boolean;
  currentCwd: string;
  cwdList: string[];
  cwdDropdownOpen: boolean;
  uploadedImages: ImageData[];
  showSaveModal: boolean;
  saveEventName: string;
  isSaving: boolean;
  conversationEnded: boolean;
  allEvents: any[];
  selectedHistoryId: string | number | null;
  allCollapsed: boolean;
  showInputArea: boolean;
  inputDisabled: boolean;
  projectPathMissing: boolean;
  subagentView: SubagentView;
  autoRefresh: AutoRefreshState;
}

export interface ImageData {
  id: string;
  src: string;
  name: string;
}

export interface SubagentView {
  active: boolean;
  messages: ChatMessage[];
  description: string;
  scrollPosition: number;
  allCollapsed: boolean;
}

export interface AutoRefreshState {
  enabled: boolean;
  interval: number;
  timerId: number | null;
  lastRefreshTime: Date | null;
  intervalDropdownOpen: boolean;
}

export function useChatState() {
  const state = reactive<ChatState>({
    message: '',
    isStarting: false,
    isRefreshing: false,
    streamingId: '',
    session: '',
    status: '',
    selectedEvent: '',
    dropdownOpen: false,
    selectedModel: 'Claude 3.5 Sonnet',
    modelDropdownOpen: false,
    currentCwd: '',
    cwdList: [],
    cwdDropdownOpen: false,
    uploadedImages: [],
    showSaveModal: false,
    saveEventName: '',
    isSaving: false,
    conversationEnded: false,
    allEvents: [],
    selectedHistoryId: null,
    allCollapsed: false,
    showInputArea: true,
    inputDisabled: false,
    projectPathMissing: false,
    subagentView: {
      active: false,
      messages: [],
      description: '',
      scrollPosition: 0,
      allCollapsed: false
    },
    autoRefresh: {
      enabled: false,
      interval: 5000,
      timerId: null,
      lastRefreshTime: null,
      intervalDropdownOpen: false
    }
  });

  const canSend = computed(() => {
    return ((state.message.trim().length > 0) || (state.uploadedImages.length > 0)) && !state.isStarting;
  });

  const showSaveButton = computed(() => {
    return state.conversationEnded && state.allEvents.length > 0;
  });

  return {
    state,
    canSend,
    showSaveButton
  };
}
