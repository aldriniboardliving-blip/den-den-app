// src/features/chat/components/MessageInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { MessageInputProps } from '../types';

export function MessageInput({
  conversationId,
  onSend,
  disabled = false,
  placeholder = 'Message',
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [height, setHeight] = useState(44);
  const textInputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    setHeight(44);
    textInputRef.current?.blur();
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  const handleContentSizeChange = (e: any) => {
    const newHeight = Math.min(e.nativeEvent.contentSize.height, 120);
    setHeight(Math.max(newHeight, 44));
  };

  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.inputWrapper}>
        <TextInput
          ref={textInputRef}
          style={[
            styles.input,
            { height: Math.min(height, 120), paddingVertical: Platform.OS === 'ios' ? 8 : 10 },
            !disabled && styles.inputDisabled,
          ]}
          value={text}
          onChangeText={handleTextChange}
          onContentSizeChange={handleContentSizeChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          placeholderTextColor="#8b949e"
          multiline
          maxLength={4000}
          autoFocus={false}
          returnKeyType="send"
          blurOnSubmit={false}
          editable={!disabled}
          textAlignVertical="top"
        />
      </View>
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!text.trim() || disabled) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        activeOpacity={0.7}
      >
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#101010',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    minHeight: 60,
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    color: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: '#1a1a1a',
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#00d992',
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#3d3a39',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
});