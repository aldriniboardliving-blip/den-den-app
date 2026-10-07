// src/features/chat/screens/ConversationListScreen.tsx
import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Link, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useConversations } from '../hooks/useConversations';
import { ConversationList } from '../components';
import { useAuthStore } from '@/features/auth/store';

export default function ConversationListScreen() {
  const { user } = useAuthStore();
  const {
    conversations,
    isLoading,
    refreshed,
    refresh,
  } = useConversations();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleNewChat = () => {
    router.push('/chat/new');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={handleNewChat}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color="#00d992" />
        </TouchableOpacity>
      </View>
      <ConversationList
        conversations={conversations}
        onSelect={conversationId => router.push(`/chat/${conversationId}`)}
        onNewChat={handleNewChat}
        loading={isLoading}
        refreshing={!refreshed && isLoading}
        onRefresh={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  newChatButton: {
    padding: 8,
  },
});