import { defineStore } from "pinia";
import type { ChatStatus } from "ai";

export interface ChatState {
  status: ChatStatus;
  // requestId -> AbortController
  activeRequests: Record<string, AbortController>;
  hasCreatedEmptyVersion: boolean;
}

export const useChatStateStore = defineStore("chatState", {
  state: () => ({
    chatStates: {} as Record<string, ChatState>,
  }),
  actions: {
    getOrCreateState(conversationId: string): ChatState {
      if (!this.chatStates[conversationId]) {
        this.chatStates[conversationId] = {
          status: "ready",
          activeRequests: {},
          hasCreatedEmptyVersion: false,
        };
      }
      return this.chatStates[conversationId]!;
    },
    updateState(conversationId: string, partialState: Partial<ChatState>) {
      const state = this.getOrCreateState(conversationId);
      Object.assign(state, partialState);
    },
    addRequest(
      conversationId: string,
      requestId: string,
      controller: AbortController
    ) {
      const state = this.getOrCreateState(conversationId);
      state.activeRequests[requestId] = controller;
      state.status = "streaming";
    },
    removeRequest(conversationId: string, requestId: string) {
      const state = this.getOrCreateState(conversationId);
      if (state.activeRequests[requestId]) {
        delete state.activeRequests[requestId];
      }
      // If no more requests, set status to ready
      if (Object.keys(state.activeRequests).length === 0) {
        state.status = "ready";
      }
    },
    clearRequests(conversationId: string) {
      const state = this.getOrCreateState(conversationId);
      state.activeRequests = {};
      state.status = "ready";
    },
  },
});
