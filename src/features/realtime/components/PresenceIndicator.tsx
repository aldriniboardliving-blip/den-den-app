// src/features/realtime/components/PresenceIndicator.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRealtime, RealtimeEvent } from '../hooks/useRealtime';

interface PresenceIndicatorProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

const SIZE_MAP = {
  small: { dot: 8, text: 11 },
  medium: { dot: 12, text: 13 },
  large: { dot: 16, text: 15 },
};

export function PresenceIndicator({ userId, size = 'medium', showText = false }: PresenceIndicatorProps) {
  const { onEvent } = useRealtime();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribeOnline = onEvent('PRESENCE_ONLINE', (event: any) => {
      if (event.payload?.userId === userId) {
        setIsOnline(true);
      }
    });

    const unsubscribeOffline = onEvent('PRESENCE_OFFLINE', (event: any) => {
      if (event.payload?.userId === userId) {
        setIsOnline(false);
        setLastSeen(event.payload?.lastSeen || Date.now());
      }
    });

    // Initial presence check would be done via API
    // For now, we'll just listen for updates

    return () => {
      unsubscribeOnline();
      unsubscribeOffline();
    };
  }, [userId, onEvent]);

  const { dot, text } = SIZE_MAP[size];
  const color = isOnline ? '#00d992' : '#8b949e';

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { width: dot, height: dot, backgroundColor: color }]} />
      {showText && (
        <Text style={[styles.text, { fontSize: text, color }]}>
          {isOnline ? 'Online' : lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : 'Offline'}
        </Text>
      )}
    </View>
  );
}

function formatLastSeen(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    borderRadius: 9999,
  },
  text: {
    fontWeight: '500',
  },
});