// src/features/chat/screens/GroupInfoScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store';
import { conversationsRepository } from '@/database/repositories/conversations';
import { contactsRepository } from '@/database/repositories/contacts';
import { ConversationWithLastMessage, ConversationMember } from '../types';

interface GroupMember extends ConversationMember {
  avatarUrl?: string | null;
  displayName?: string | null;
}
import { Avatar } from '../components/Avatar';
import { formatRelativeTime } from '@/utils/date';

export default function GroupInfoScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuthStore();
  const [conversation, setConversation] = useState<any>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversation = useCallback(async () => {
    if (!conversationId || !user) return;
    setLoading(true);
    try {
      const conv = await conversationsRepository.getById(conversationId);
      if (conv) {
        setConversation({
          ...conv,
          isGroup: conv.type === 'GROUP',
          members: [],
        });
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, user]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  const handleLeaveGroup = useCallback(async () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            Alert.alert('Left Group', 'You have left the group');
            router.back();
          },
        },
      ]
    );
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!conversation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Group not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <TouchableOpacity style={styles.avatarPicker} activeOpacity={0.7}>
            <View style={styles.avatarPreview}>
              <Avatar
                source={conversation.avatarUrl ? { uri: conversation.avatarUrl } : undefined}
                name={conversation.title || 'Group'}
                size={80}
              />
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera-outline" size={24} color="#f2f2f2" />
              </View>
            </View>
          </TouchableOpacity>
          <Text style={styles.groupName}>{conversation.title || 'Unnamed Group'}</Text>
          <Text style={styles.memberCount}>{members.length} members</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Members</Text>
          {members.map((member) => (
            <TouchableOpacity key={member.id} style={styles.memberItem} activeOpacity={0.7}>
              <Avatar
                source={member.avatarUrl ? { uri: member.avatarUrl } : undefined}
                name={member.displayName || member.accountId}
                size={48}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.displayName || member.accountId}</Text>
                <Text style={styles.memberId}>{member.accountId}</Text>
              </View>
              {member.role === 'ADMIN' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminText}>Admin</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.leaveButton} onPress={handleLeaveGroup} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color="#ff453a" />
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  avatarPicker: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatarPreview: {
    position: 'relative',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#101010',
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f2f2f2',
    textAlign: 'center',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b949e',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  memberId: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: 'rgba(0, 217, 146, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  adminText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00d992',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff453a',
    marginLeft: 10,
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
  errorText: {
    fontSize: 16,
    color: '#ff453a',
  },
});