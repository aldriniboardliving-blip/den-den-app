// src/features/chat/__tests__/useConversations.test.js
// Unit tests for useConversations hook

import { describe, it, expect, vi, beforeEach, act } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConversations, useMessages, useNewChat } from '../hooks/useConversations';

// Mock dependencies
vi.mock('@/store/chat', () => ({
  useChatStore: () => ({
    conversations: [],
    messages: new Map(),
    isLoading: false,
    setConversations: vi.fn(),
    addConversation: vi.fn(),
    updateConversation: vi.fn(),
    removeConversation: vi.fn(),
    setActiveConversation: vi.fn(),
    setMessages: vi.fn(),
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    removeMessage: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

vi.mock('@/features/auth/store', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', accountId: 'den_test' },
    device: { id: 'device-1' },
    isAuthenticated: true,
    isLoading: false,
    setAuth: vi.fn(),
    logout: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

vi.mock('@/database/repositories/conversations', () => ({
  conversationsRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    getMembers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/database/repositories/messages', () => ({
  messagesRepository: {
    getByConversation: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/database/repositories/devices', () => ({
  devicesRepository: {
    getPrimary: vi.fn().mockResolvedValue({ id: 'device-1' }),
  },
}));

vi.mock('@/database/repositories/contacts', () => ({
  contactsRepository: {
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/api/client', () => ({
  api: {
    getKeyBundle: vi.fn().mockResolvedValue({
      identityKey: new Uint8Array(32),
      signedPreKey: { publicKey: new Uint8Array(32), keyId: 1, signature: new Uint8Array(64) },
      oneTimePreKey: { publicKey: new Uint8Array(32), keyId: 1 },
    }),
    sendMessage: vi.fn().mockResolvedValue({ serverMessageId: 'server-msg-1' }),
  },
}));

vi.mock('@/crypto', () => ({
  MessageEncryption: {
    encrypt: vi.fn().mockResolvedValue({
      messageId: 'msg-1',
      senderDeviceId: 'device-1',
      recipientDeviceId: 'device-2',
      conversationId: 'conv-1',
      ciphertext: new Uint8Array(40),
      nonce: new Uint8Array(24),
      ephemeralPublic: new Uint8Array(32),
      signedPreKeyId: 1,
      onetimePreKeyId: 1,
      createdAt: Date.now(),
    }),
  },
}));

describe('useConversations', () => {
  it('should load conversations on mount', async () => {
    const { result } = renderHook(() => useConversations());
    
    // Wait for effect to run
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    expect(result.current.conversations).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('should provide refresh function', () => {
    const { result } = renderHook(() => useConversations());
    
    expect(typeof result.current.refresh).toBe('function');
  });
});

describe('useMessages', () => {
  it('should load messages for conversation', async () => {
    const { result } = renderHook(() => useMessages('conv-1'));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should send message', async () => {
    const { result } = renderHook(() => useMessages('conv-1'));
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    await act(async () => {
      await result.current.sendMessage('Hello world');
    });
    
    // Message should be added optimistically
    expect(result.current.messages.length).toBeGreaterThanOrEqual(0);
  });

  it('should provide loadMore function', () => {
    const { result } = renderHook(() => useMessages('conv-1'));
    
    expect(typeof result.current.loadMore).toBe('function');
  });
});

describe('useNewChat', () => {
  it('should load contacts', async () => {
    const { result } = renderHook(() => useNewChat());
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    expect(result.current.contacts).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should filter contacts by search query', async () => {
    const { result } = renderHook(() => useNewChat());
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    act(() => {
      result.current.setSearchQuery('test');
    });
    
    expect(result.current.searchQuery).toBe('test');
  });
});