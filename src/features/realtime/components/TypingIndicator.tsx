// src/features/realtime/components/TypingIndicator.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRealtime } from '../hooks/useRealtime';

interface TypingUser {
  userId: string;
  name: string;
}

export function TypingIndicator({ conversationId }: { conversationId: string }) {
  const { onEvent } = useRealtime();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [visible, setVisible] = useState(false);
  const animation = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const unsubscribeStart = onEvent('TYPING_START', (event: any) => {
      if (event.payload?.conversationId === conversationId) {
        setTypingUsers(prev => {
          if (prev.some(u => u.userId === event.payload?.userId)) return prev;
          return [...prev, { userId: event.payload?.userId, name: event.payload?.name || 'Someone' }];
        });
        setVisible(true);
        animateIn();
      }
    });

    const unsubscribeStop = onEvent('TYPING_STOP', (event: any) => {
      if (event.payload?.conversationId === conversationId) {
        setTypingUsers(prev => prev.filter(u => u.userId !== event.payload?.userId));
        if (typingUsers.length <= 1) {
          animateOut();
        }
      }
    });

    return () => {
      unsubscribeStart();
      unsubscribeStop();
    };
  }, [conversationId, onEvent, typingUsers]);

  const animateIn = () => {
    Animated.timing(animation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const animateOut = () => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      if (typingUsers.length === 0) {
        setVisible(false);
      }
    });
  };

  if (!visible && typingUsers.length === 0) return null;

  const getText = () => {
    if (typingUsers.length === 1) {
      const user = typingUsers[0];
      if (user) return `${user.name} is typing...`;
    } else if (typingUsers.length === 2) {
      const user1 = typingUsers[0];
      const user2 = typingUsers[1];
      if (user1 && user2) return `${user1.name} and ${user2.name} are typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: animation,
          transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.dots}>
          <Animated.View style={styles.dot} />
          <Animated.View style={styles.dot} />
          <Animated.View style={styles.dot} />
        </View>
        <Text style={styles.text}>{getText()}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8b949e',
  },
  text: {
    fontSize: 13,
    color: '#8b949e',
    fontStyle: 'italic',
  },
});