// src/features/chat/components/TypingIndicator.tsx
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TypingIndicatorProps } from '../types';

export function TypingIndicator({ userName }: TypingIndicatorProps) {
  const [animIndex, setAnimIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setAnimIndex(prev => (prev + 1) % 3);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.dotsContainer}>
        {[0, 1, 2].map(i => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: animIndex === i ? 1 : 0.4,
                transform: [
                  { scale: animIndex === i ? 1.2 : 1 },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.text}>
        {userName} is typing
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8b949e',
  },
  text: {
    fontSize: 14,
    color: '#8b949e',
    fontStyle: 'italic',
  },
});