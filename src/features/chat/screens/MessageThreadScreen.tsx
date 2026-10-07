// src/features/chat/screens/MessageThreadScreen.tsx
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Keyboard,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Link, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMessages } from '../hooks/useConversations';
import { useAuthStore } from '@/features/auth/store';
import { conversationsRepository } from '@/database/repositories/conversations';
import { contactsRepository } from '@/database/repositories/contacts';
import { MessageBubble, MessageInput, ChatHeader, TypingIndicator } from '../components';
import { ChatMessage, ConversationWithLastMessage } from '../types';
import { Contact } from '@/types';
import { formatRelativeTime } from '@/utils/date';

interface MessageThreadScreenProps {
  conversationId: string;
}

export default function MessageThreadScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuthStore();
  const { messages, loading, hasMore, loadMore, sendMessage, retryMessage, refresh } = useMessages(conversationId || null);
  const [conversation, setConversation] = useState<ConversationWithLastMessage | null>(null);
  const [showLoadMore, setShowLoadMore] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!conversationId || !user) return;
    
    const loadConversation = async () => {
      try {
        const conv = await conversationsRepository.getById(conversationId);
        if (conv) {
          let contact: Contact | undefined = undefined;
          if (conv.type === 'DIRECT') {
            const userContacts = await contactsRepository.getAll(user.id);
            // For direct conversations, we need to find the other participant
            // This is a simplified approach - in reality we'd query conversation members
            contact = userContacts[0];
          }
          setConversation({
            ...conv,
            isGroup: conv.type === 'GROUP',
            contact,
            unreadCount: conv.unreadCount || 0,
          });
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    };
    loadConversation();
  }, [conversationId, user]);

  const handleSend = useCallback(async (content: string) => {
    try {
      await sendMessage(content);
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }, [sendMessage]);

  const handleRetry = useCallback((messageId: string) => {
    retryMessage(messageId);
  }, [retryMessage]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  const handleLoadMore = useCallback(async () => {
    if (hasMore && !loading) {
      setShowLoadMore(true);
      await loadMore();
      setShowLoadMore(false);
    }
  }, [hasMore, loading, loadMore]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isOwn = item.senderAccountId === user?.accountId;
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        showAvatar={!isOwn}
        showTimestamp={true}
        onLongPress={() => {}}
        onRetry={handleRetry}
      />
    );
  };

  const getDisplayName = () => {
    if (!conversation) return 'Loading...';
    if (conversation.type === 'GROUP') {
      return conversation.title || 'Group Chat';
    }
    return conversation.contact?.displayName || conversation.contact?.contactAccountId || 'Unknown';
  };

  const getSubtitle = () => {
    if (!conversation) return '';
    if (conversation.type === 'GROUP') {
      return 'Group chat';
    }
    return 'Online'; // TODO: Add actual presence
  };

  const getAvatar = () => {
    if (!conversation) return undefined;
    if (conversation.type === 'GROUP') {
      return undefined;
    }
    return conversation.contact?.avatarUrl ?? undefined;
  };

  if (!conversationId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerWrapper}>
        <ChatHeader
          title={getDisplayName()}
          subtitle={getSubtitle()}
          avatar={getAvatar()}
          onPress={() => {}}
        />
      </View>
      
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          showLoadMore ? (
            <View style={styles.loadMoreIndicator}>
              <Text style={styles.loadMoreText}>Loading earlier messages...</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        inverted={false}
        scrollEventThrottle={16}
      />
      
      <MessageInput
        conversationId={conversationId}
        onSend={handleSend}
        disabled={!user}
        placeholder="Message"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  listContent: {
    paddingBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
  },
  loadMoreIndicator: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    color: '#8b949e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8b949e',
  },
});