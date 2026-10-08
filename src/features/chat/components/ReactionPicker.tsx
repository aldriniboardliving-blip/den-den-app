// src/features/chat/components/ReactionPicker.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { ReactionEmoji } from '../types';

export const REACTION_EMOJIS: ReactionEmoji[] = [
  '👍', '❤️', '😂', '😮', '😢', '🎉', '🙏', '👎',
];

interface ReactionPickerProps {
  isVisible: boolean;
  onEmojiSelect: (emoji: ReactionEmoji) => void;
  onClose: () => void;
  anchorPosition?: { x: number; y: number };
}

export function ReactionPicker({
  isVisible,
  onEmojiSelect,
  onClose,
}: ReactionPickerProps) {
  const animation = React.useRef(new Animated.Value(0)).current;
  const emojiAnimations = React.useMemo(
    () => REACTION_EMOJIS.map(() => new Animated.Value(0)),
    []
  );

  React.useEffect(() => {
    if (isVisible) {
      Animated.timing(animation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
      
      emojiAnimations.forEach((anim, index) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 200,
          delay: index * 30,
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start(() => {
        emojiAnimations.forEach(anim => anim.setValue(0));
      });
    }
  }, [isVisible, animation, emojiAnimations]);

  // Use a ref to track if animation has ever started
  const hasAnimatedRef = React.useRef(false);
  if (isVisible) hasAnimatedRef.current = true;

  // Don't render if never visible and animation hasn't started
  if (!hasAnimatedRef.current) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: animation,
          transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.backdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View
        style={[
          styles.container,
          {
            opacity: animation,
            transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}
      >
        <View style={styles.row}>
{REACTION_EMOJIS.map((emoji, index) => {
            const anim = emojiAnimations[index];
            if (!anim) return null;
            return (
              <Animated.View
                key={emoji}
                style={[
                  styles.emojiButton,
                  {
                    opacity: anim,
                    transform: [
                      { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                    ],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.emojiButtonInner}
                  onPress={() => onEmojiSelect(emoji as ReactionEmoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              </Animated.View>
          );
        })}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#3d3a39',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  emojiButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
});