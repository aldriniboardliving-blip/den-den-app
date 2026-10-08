// src/features/chat/hooks/useMessageSearch.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { messagesRepository } from '@/database/repositories/messages';
import { ChatMessage } from '../types';

export function useMessageSearch(conversationId: string | null) {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useCallback(async (searchQuery: string) => {
    if (!conversationId || !user || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const userId = user.id;
      const results = await messagesRepository.searchMessages(conversationId, userId, searchQuery.trim());
      setResults(results as ChatMessage[]);
    } catch (error) {
      console.error('Failed to search messages:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  // Trigger search when debounced query changes
  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    clearSearch,
  };
}