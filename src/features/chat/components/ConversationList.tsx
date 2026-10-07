// src/features/chat/components/ConversationList.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { ConversationWithLastMessage, ConversationListProps } from '../types';
import { formatRelativeTime } from '@/utils/date';
import { Avatar } from './Avatar';

export function ConversationList({
  conversations,
  onSelect,
  onNewChat,
  loading = false,
  refreshing = false,
  onRefresh,
}: ConversationListProps) {
  const renderItem = ({ item }: { item: ConversationWithLastMessage }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onSelect(item.id)}
      activeOpacity={0.7}
    >
      <Avatar
        source={item.avatarUrl ? { uri: item.avatarUrl } : undefined}
        name={item.title || item.contact?.displayName || 'Unknown'}
        size={56}
        isGroup={item.type === 'GROUP'}
      />
      <View style={[styles.content, { flex: 1 }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title || item.contact?.displayName || item.contact?.contactAccountId || 'Unknown'}
          </Text>
          {item.lastMessage?.createdAt && (
            <Text style={styles.timestamp}>
              {formatRelativeTime(item.lastMessage.createdAt)}
            </Text>
          )}
        </View>
        <View style={styles.previewRow}>
          <Text
            style={[
              styles.preview,
              item.unreadCount > 0 && styles.previewUnread,
            ]}
            numberOfLines={1}
          >
            {item.lastMessage?.content
              ? item.lastMessage.contentType === 'IMAGE'
                ? '📷 Photo'
                : item.lastMessage.contentType === 'SYSTEM'
                ? item.lastMessage.content
                : item.lastMessage.content
              : 'No messages yet'}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <TouchableOpacity style={styles.emptyButton} onPress={onNewChat}>
        <Text style={styles.emptyButtonText}>Start a new chat</Text>
      </TouchableOpacity>
      <Text style={styles.emptyText}>No conversations yet</Text>
    </View>
  );

  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  if (conversations.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        {renderEmpty()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={renderSeparator}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#00d992']}
            progressBackgroundColor="#101010"
          />
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator color="#00d992" size="small" />
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 13,
    color: '#8b949e',
    fontWeight: '400',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    fontSize: 15,
    color: '#8b949e',
    flex: 1,
    marginRight: 8,
  },
  previewUnread: {
    fontWeight: '600',
    color: '#f2f2f2',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#101010',
  },
  separator: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginLeft: 76,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyButton: {
    marginBottom: 16,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d992',
  },
  emptyText: {
    fontSize: 15,
    color: '#8b949e',
    textAlign: 'center',
  },
  loadingFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});