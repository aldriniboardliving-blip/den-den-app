// src/features/chat/components/MessageReactions.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ChatMessage, ReactionEmoji } from '@/features/chat/types';
import { REACTION_EMOJIS } from './ReactionPicker';

interface MessageReactionsProps {
  message: ChatMessage;
  currentUserId: string;
  onAddReaction: (messageId: string, emoji: ReactionEmoji) => void;
  onRemoveReaction: (messageId: string, emoji: ReactionEmoji) => void;
  readOnly?: boolean;
}

const DEFAULT_EMOJIS: ReactionEmoji[] = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🙏', '👎'];

export function MessageReactions({
  message,
  currentUserId,
  onAddReaction,
  onRemoveReaction,
  readOnly = false,
}: MessageReactionsProps) {
  const reactions = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    
    const grouped = new Map<string, { emoji: string; count: number; users: string[]; hasCurrentUser: boolean }>();
    
    message.reactions.forEach(r => {
      const existing = grouped.get(r.emoji) || { emoji: r.emoji, count: 0, users: [], hasCurrentUser: false };
      existing.count += 1;
      existing.users.push(r.userAccountId);
      if (r.userId === currentUserId) existing.hasCurrentUser = true;
      grouped.set(r.emoji, existing);
    });
    
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [message.reactions, currentUserId]);

  const [showPicker, setShowPicker] = useState(false);
  const animation = React.useRef(new Animated.Value(0)).current;

  const handleEmojiPress = (emoji: string) => {
    const reaction = reactions.find(r => r.emoji === emoji);
    if (reaction?.hasCurrentUser) {
      onRemoveReaction(message.id, emoji as ReactionEmoji);
    } else {
      onAddReaction(message.id, emoji as ReactionEmoji);
    }
  };

  const togglePicker = () => {
    if (readOnly) return;
    const next = !showPicker;
    setShowPicker(next);
    Animated.timing(animation, {
      toValue: next ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  if (reactions.length === 0 && !showPicker && !readOnly) {
    return (
      <TouchableOpacity
        style={styles.addReactionButton}
        onPress={togglePicker}
        activeOpacity={0.7}
      >
        <Animated.Text style={styles.addReactionText}>+</Animated.Text>
      </TouchableOpacity>
    );
  }

  const mainContent = (
    <View style={styles.container}>
      <View style={styles.reactionsRow}>
        {reactions.map(({ emoji, count, hasCurrentUser }) => (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionBubble,
              hasCurrentUser && styles.reactionBubbleActive,
            ]}
            onPress={() => !readOnly && handleEmojiPress(emoji)}
            activeOpacity={0.7}
            accessibilityLabel={`${emoji} reaction, ${count} ${count === 1 ? 'person' : 'people'}`}
          >
            <Animated.Text style={styles.reactionEmoji}>{emoji}</Animated.Text>
            <Animated.Text style={[
              styles.reactionCount,
              hasCurrentUser && styles.reactionCountActive,
            ]}>
              {count}
            </Animated.Text>
          </TouchableOpacity>
        ))}
        
        {!readOnly && (
          <TouchableOpacity
            style={styles.addReactionButton}
            onPress={togglePicker}
            activeOpacity={0.7}
          >
            <Animated.Text style={styles.addReactionText}>+</Animated.Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const pickerContent = (
    <Animated.View
      style={[
        styles.pickerContainer,
        {
          opacity: animation,
          transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <View style={styles.pickerRow}>
        {DEFAULT_EMOJIS.map(emoji => (
          <TouchableOpacity
            key={emoji}
            style={styles.pickerEmojiButton}
            onPress={() => {
              handleEmojiPress(emoji);
              setShowPicker(false);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.pickerEmoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {mainContent}
      {showPicker && pickerContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    paddingHorizontal: 8,
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#3d3a39',
    minWidth: 36,
    height: 28,
    justifyContent: 'center',
  },
  reactionBubbleActive: {
    backgroundColor: 'rgba(0, 217, 146, 0.2)',
    borderColor: '#00d992',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8b949e',
  },
  reactionCountActive: {
    color: '#00d992',
  },
  addReactionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#3d3a39',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReactionText: {
    fontSize: 16,
    color: '#8b949e',
    fontWeight: '600',
  },
  pickerContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 8,
    right: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3d3a39',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  pickerEmojiButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  pickerEmoji: {
    fontSize: 20,
  },
});