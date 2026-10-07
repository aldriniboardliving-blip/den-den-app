// src/hooks/useChat.ts
// Chat hook

import { useChatStore } from '../store/chat';
import type { Message } from '../types';

export function useChat(conversationId: string | null) {
  const {
    conversations,
    messages,
    activeConversationId,
    isLoading,
    setActiveConversation,
    addMessage,
    updateMessage,
    sendMessage,
  } = useChatStore();

  const conversationMessages = conversationId ? messages.get(conversationId) || [] : [];

  return {
    conversations,
    messages: conversationMessages,
    activeConversationId,
    isLoading,
    setActiveConversation,
    sendMessage: (content: string) =>
      conversationId
        ? sendMessage(conversationId, content)
        : Promise.reject(new Error('No active conversation')),
    addMessage,
    updateMessage: (messageId: string, updates: Partial<Message>) =>
      conversationId ? updateMessage(conversationId, messageId, updates) : undefined,
  };
}

export function useConversations() {
  const {
    conversations,
    setConversations,
    addConversation,
    updateConversation,
    removeConversation,
    isLoading,
  } = useChatStore();

  return {
    conversations,
    isLoading,
    setConversations,
    addConversation,
    updateConversation,
    removeConversation,
  };
}
