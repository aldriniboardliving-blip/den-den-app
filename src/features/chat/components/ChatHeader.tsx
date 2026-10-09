// src/features/chat/components/ChatHeader.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ChatHeaderProps } from '../types';
import { Avatar } from './Avatar';
import { Ionicons } from '@expo/vector-icons';
import { DisappearingTimerDuration } from '@/types';

const TIMER_LABELS: Record<number, string> = {
  0: 'Off',
  86400000: '24h',
  604800000: '7d',
  7776000000: '90d',
};

export function ChatHeader({
  title,
  subtitle,
  avatar,
  onPress,
  actions,
  disappearingMessagesTimer,
}: ChatHeaderProps & { disappearingMessagesTimer?: DisappearingTimerDuration }) {
  const timerLabel = disappearingMessagesTimer ? TIMER_LABELS[disappearingMessagesTimer] : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerContent}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Avatar
          source={avatar ? { uri: avatar } : undefined}
          name={title}
          size={36}
        />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {disappearingMessagesTimer && disappearingMessagesTimer > 0 && (
            <View style={styles.timerBadge}>
              <Ionicons name="timer-outline" size={12} color="#ff9f0a" />
              <Text style={styles.timerText}>{TIMER_LABELS[disappearingMessagesTimer]}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  titleContainer: {
    marginLeft: 10,
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
    maxWidth: '100%',
  },
  subtitle: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff9f0a',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff9f0a',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});