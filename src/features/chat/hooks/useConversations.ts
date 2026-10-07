// src/features/chat/hooks/useConversations.ts
import { useCallback, useEffect, useState } from 'react';
import { useChatStore } from '@/store/chat';
import { useAuthStore } from '@/features/auth/store';
import { conversationsRepository } from '@/database/repositories/conversations';
import { messagesRepository } from '@/database/repositories/messages';
import { contactsRepository } from '@/database/repositories/contacts';
import { ConversationWithLastMessage, ChatMessage } from '../types';
import { Contact } from '@/types';

export function useConversations() {
  const { conversations, setConversations, isLoading, setLoading } = useChatStore();
  const { user } = useAuthStore();
  const [refreshed, setRefreshed] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userId = user.id;
      const conversationsList = await conversationsRepository.getAll(userId);
      // Transform to ConversationWithLastMessage
      const enriched = conversationsList.map(conv => ({
        ...conv,
        isGroup: conv.type === 'GROUP',
        unreadCount: conv.unreadCount,
        lastMessage: undefined,
        contact: undefined,
      })) as ConversationWithLastMessage[];
      setConversations(enriched);
      setRefreshed(true);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [user, setConversations, setLoading]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const refresh = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    refreshed,
    refresh,
    loadConversations,
  };
}

export function useMessages(conversationId: string | null) {
  const { messages, setMessages, addMessage, updateMessage, removeMessage } = useChatStore();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const conversationMessages = conversationId
    ? (messages.get(conversationId) || []) as ChatMessage[]
    : [];

  const loadMessages = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    if (!conversationId || !user) return;
    setLoading(true);
    try {
      const userId = user.id;
      const msgs = await messagesRepository.getByConversation(conversationId, PAGE_SIZE);
      const chatMessages = msgs.map(m => ({ ...m, isOptimistic: false })) as ChatMessage[];
      
      if (append) {
        setMessages(conversationId, [...conversationMessages, ...chatMessages]);
      } else {
        setMessages(conversationId, chatMessages);
      }
      setHasMore(chatMessages.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user, conversationMessages, setMessages]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    await loadMessages(page + 1, true);
  }, [loading, hasMore, page, loadMessages]);

  const sendMessage = useCallback(async (content: string, contentType: ChatMessage['contentType'] = 'TEXT') => {
    if (!conversationId || !user) return;
    
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = Date.now();

    const optimisticMessage: ChatMessage = {
      id: messageId,
      conversationId,
      senderDeviceId: 'local-device',
      senderAccountId: user.accountId,
      content,
      contentEncrypted: null,
      contentType,
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
      isOptimistic: true,
      isSending: true,
    };

    addMessage(optimisticMessage);

    try {
      // TODO: Integrate with encryption and sync queue
      // For now, just mark as sent locally
      updateMessage(conversationId, messageId, {
        status: 'RELAYED',
        sentAt: Date.now(),
        syncStatus: 'SYNCED',
      });
    } catch (error) {
      updateMessage(conversationId, messageId, {
        status: 'FAILED',
      });
      throw error;
    }
  }, [conversationId, user, addMessage, updateMessage]);

  const retryMessage = useCallback(async (messageId: string) => {
    if (!conversationId) return;
    const message = conversationMessages.find(m => m.id === messageId);
    if (!message) return;

    // isSending is a ChatMessage property, not in Message type
    // We don't need to update it in the store for now
    
    try {
      // TODO: Retry sending
      updateMessage(conversationId, messageId, {
        status: 'RELAYED',
        sentAt: Date.now(),
        syncStatus: 'SYNCED',
      });
    } catch (error) {
      // Error handling without isSending
    }
  }, [conversationId, conversationMessages, updateMessage]);

  useEffect(() => {
    if (conversationId) {
      loadMessages(0, false);
    }
  }, [conversationId, loadMessages]);

  return {
    messages: conversationMessages,
    loading,
    hasMore,
    loadMore,
    sendMessage,
    retryMessage,
    refresh: () => loadMessages(0, false),
  };
}

export function useNewChat() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userContacts = await contactsRepository.getAll(user.id);
      setContacts(userContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = contacts.filter(c =>
    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactAccountId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return {
    contacts: filteredContacts,
    allContacts: contacts,
    loading,
    searchQuery,
    setSearchQuery,
    refresh: loadContacts,
  };
}