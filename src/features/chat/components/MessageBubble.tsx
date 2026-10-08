// src/features/chat/components/MessageBubble.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Pressable,
  Animated,
} from 'react-native';
import { ChatMessage, MessageBubbleProps } from '../types';
import { formatTime } from '@/utils/date';
import { MessageReactions } from './MessageReactions';
import { ReactionPicker } from './ReactionPicker';

const MAX_WIDTH = '75%';

export function MessageBubble({
  message,
  isOwn,
  showAvatar = false,
  showTimestamp = true,
  onLongPress,
  onRetry,
}: MessageBubbleProps) {
  const isFailed = message.isFailed;
  const isSending = message.isSending;
  const isPending = message.status === 'PENDING' || message.status === 'RELAYED';
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const handleRetry = () => {
    if (isFailed && onRetry) {
      onRetry(message.id);
    }
  };

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress(message);
    } else {
      setShowReactionPicker(true);
    }
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    setShowReactionPicker(false);
  };

  const handleRemoveReaction = (messageId: string, emoji: string) => {
    setShowReactionPicker(false);
  };

  const bubbleStyle = [
    styles.bubble,
    isOwn ? styles.bubbleOwn : styles.bubbleOther,
    isFailed && styles.bubbleFailed,
  ];

  const textStyle = [
    styles.text,
    isOwn ? styles.textOwn : styles.textOther,
  ];

  const statusIcon = () => {
    if (isFailed) {
      return (
        <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>↻</Text>
        </TouchableOpacity>
      );
    }
    if (isSending || isPending) {
      return (
        <View style={styles.sendingIndicator}>
          <Text style={styles.sendingText}>⏳</Text>
        </View>
      );
    }
    if (message.status === 'DELIVERED') {
      return <Text style={styles.deliveredText}>✓✓</Text>;
    }
    if (message.status === 'READ') {
      return <Text style={styles.readText}>✓✓</Text>;
    }
    return null;
  };

  return (
    <View style={[styles.container, isOwn && styles.containerOwn]}>
      {showAvatar && !isOwn && (
        <View style={styles.avatarContainer}>
          <Image
            source={message.senderAccountId ? { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${message.senderAccountId}` } : undefined}
            style={styles.avatar}
            resizeMode="cover"
          />
        </View>
      )}
      <View style={styles.bubbleWrapper}>
        <Pressable
          style={bubbleStyle}
          onLongPress={handleLongPress}
        >
          {message.contentType === 'SYSTEM' ? (
            <Text style={[styles.systemText, isOwn ? styles.systemTextOwn : styles.systemTextOther]}>
              {message.content}
            </Text>
          ) : message.contentType === 'IMAGE' ? (
            <Image
              source={message.content ? { uri: message.content } : undefined}
              style={styles.imageMessage}
              resizeMode="cover"
            />
          ) : (
            <Text style={textStyle}>{message.content}</Text>
          )}
        </Pressable>
        {isOwn && showTimestamp && (
          <View style={styles.statusRow}>
            <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
            {statusIcon()}
          </View>
        )}
        {!isOwn && showTimestamp && (
          <View style={styles.statusRowOther}>
            <Text style={styles.timestamp}>{formatTime(message.createdAt)}</Text>
          </View>
        )}
        {/* Reactions */}
        <MessageReactions
          message={message}
          currentUserId=""
          onAddReaction={() => {}}
          onRemoveReaction={() => {}}
        />
      </View>
      
      {/* Reaction Picker */}
      <ReactionPicker
        isVisible={showReactionPicker}
        onEmojiSelect={() => setShowReactionPicker(false)}
        onClose={() => setShowReactionPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  containerOwn: {
    flexDirection: 'row-reverse',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginTop: 4,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  avatar: {
    width: 32,
    height: 32,
  },
  bubbleWrapper: {
    maxWidth: MAX_WIDTH,
    flex: 1,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 2,
  },
  bubbleOwn: {
    backgroundColor: '#00d992',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 4,
  },
  bubbleFailed: {
    opacity: 0.7,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  textOwn: {
    color: '#101010',
  },
  textOther: {
    color: '#f2f2f2',
  },
  systemText: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  systemTextOwn: {
    color: '#8b949e',
  },
  systemTextOther: {
    color: '#8b949e',
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 4,
  },
  statusRowOther: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#8b949e',
  },
  sendingIndicator: {
    width: 16,
    height: 16,
  },
  sendingText: {
    fontSize: 12,
  },
  deliveredText: {
    fontSize: 12,
    color: '#8b949e',
  },
  readText: {
    fontSize: 12,
    color: '#00d992',
  },
  retryButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff453a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontSize: 12,
    color: '#f2f2f2',
  },
});

export default MessageBubble;