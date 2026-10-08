// src/features/chat/screens/MessageSearchScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useMessageSearch } from '../hooks/useMessageSearch';
import { MessageBubble } from '../components';
import { ChatMessage } from '../types';
import { formatRelativeTime } from '@/utils/date';

export default function MessageSearchScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { query, setQuery, results, loading, clearSearch } = useMessageSearch(conversationId || null);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelectResult = useCallback((message: ChatMessage) => {
    clearSearch();
    router.push(`/chat/${conversationId}?scrollTo=${message.id}`);
  }, [conversationId, clearSearch]);

  const handleCancel = useCallback(() => {
    clearSearch();
    router.back();
  }, [clearSearch]);

  const handleTextChange = useCallback((text: string) => {
    setQuery(text);
    setShowResults(text.length > 0);
  }, [setQuery]);

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectResult(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultContent}>
        <Text style={styles.resultTime}>{formatRelativeTime(item.createdAt)}</Text>
        <Text style={styles.resultPreview} numberOfLines={2}>
          {item.content || (item.contentType === 'IMAGE' ? '📷 Photo' : 'Attachment')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="#8b949e"
          value={query}
          onChangeText={handleTextChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={true}
          clearButtonMode="while-editing"
        />
        {query && (
          <TouchableOpacity style={styles.clearButton} onPress={clearSearch} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#8b949e" />
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#00d992" size="large" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!loading && showResults && (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#3d3a39" />
              <Text style={styles.emptyTitle}>No messages found</Text>
              <Text style={styles.emptySubtitle}>
                No messages match "{query}"
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#3d3a39',
    marginRight: 12,
  },
  clearButton: {
    padding: 8,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  resultContent: {
    flex: 1,
  },
  resultTime: {
    fontSize: 12,
    color: '#8b949e',
    marginBottom: 4,
  },
  resultPreview: {
    fontSize: 15,
    color: '#f2f2f2',
    lineHeight: 21,
  },
  separator: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginLeft: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f2f2f2',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8b949e',
    marginTop: 16,
  },
});