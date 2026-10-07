// src/store/chat.ts
// Chat store using Zustand

import { create } from 'zustand';
import type { Message, Conversation, ConversationWithLastMessage } from '../types';

interface ChatState {
  conversations: ConversationWithLastMessage[];
  messages: Map<string, Message[]>;
  activeConversationId: string | null;
  isLoading: boolean;

  setConversations: (conversations: ConversationWithLastMessage[]) => void;
  addConversation: (conversation: ConversationWithLastMessage) => void;
  updateConversation: (id: string, updates: Partial<ConversationWithLastMessage>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Omit<Message, 'id'>>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  setLoading: (loading: boolean) => void;

  sendMessage: (conversationId: string, content: string) => Promise<string>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: new Map(),
  activeConversationId: null,
  isLoading: false,

  setConversations: conversations => set({ conversations }),

  addConversation: conversation =>
    set(state => ({
      conversations: [conversation, ...state.conversations],
    })),

  updateConversation: (id, updates) =>
    set(state => ({
      conversations: state.conversations.map(c => (c.id === id ? { ...c, ...updates } : c)),
    })),

  removeConversation: id =>
    set(state => ({
      conversations: state.conversations.filter(c => c.id !== id),
    })),

  setActiveConversation: id => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set(state => {
      const newMessages = new Map(state.messages);
      newMessages.set(conversationId, messages);
      return { messages: newMessages };
    }),

  addMessage: message =>
    set(state => {
      const conversationMessages = state.messages.get(message.conversationId) || [];
      if (conversationMessages.some(m => m.id === message.id)) return state;

      const newMessages = new Map(state.messages);
      newMessages.set(message.conversationId, [message, ...conversationMessages]);
      return { messages: newMessages };
    }),

  updateMessage: (conversationId: string, messageId: string, updates: Partial<Omit<Message, 'id'>>) =>
    set(state => {
      const conversationMessages = state.messages.get(conversationId) || [];
      const index = conversationMessages.findIndex(m => m.id === messageId);
      if (index === -1) return state;

      const newMessages = new Map(state.messages);
      const updated = [...conversationMessages];
      // Explicitly construct the updated message to preserve id
      const currentMessage = updated[index];
      if (!currentMessage) return state;
      const updatedMessage: Message = {
        ...currentMessage,
        ...updates,
        id: currentMessage.id,
        conversationId: currentMessage.conversationId,
        senderDeviceId: currentMessage.senderDeviceId,
        senderAccountId: currentMessage.senderAccountId,
        contentType: currentMessage.contentType,
        status: currentMessage.status,
        createdAt: currentMessage.createdAt,
        syncStatus: currentMessage.syncStatus,
        syncAttemptCount: currentMessage.syncAttemptCount,
      };
      updated[index] = updatedMessage;
      newMessages.set(conversationId, updated);
      return { messages: newMessages };
    }),

  removeMessage: (conversationId, messageId) =>
    set(state => {
      const conversationMessages = state.messages.get(conversationId) || [];
      const newMessages = new Map(state.messages);
      newMessages.set(
        conversationId,
        conversationMessages.filter(m => m.id !== messageId)
      );
      return { messages: newMessages };
    }),

  setLoading: loading => set({ isLoading: loading }),

  sendMessage: async (conversationId, content) => {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    const optimisticMessage: Message = {
      id: messageId,
      conversationId,
      senderDeviceId: 'local-device',
      senderAccountId: 'local-account',
      content,
      contentEncrypted: null,
      contentType: 'TEXT',
      encryptionAlgorithm: null,
      nonce: null,
      senderKeyId: null,
      status: 'PENDING',
      createdAt: now,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      editedAt: null,
      deletedAt: null,
      syncStatus: 'PENDING',
      serverMessageId: null,
      lastSyncAttemptAt: null,
      syncAttemptCount: 0,
    };

    get().addMessage(optimisticMessage);
    return messageId;
  },
}));