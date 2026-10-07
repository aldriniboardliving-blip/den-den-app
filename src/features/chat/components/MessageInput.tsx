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
  Alert,
  Image,
} from 'react-native';
import { MessageInputProps } from '../types';
import { Ionicons } from '@expo/vector-icons';

export function MessageInput({
  conversationId,
  onSend,
  disabled = false,
  placeholder = 'Message',
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [height, setHeight] = useState(44);
  const [attachments, setAttachments] = useState<string[]>([]);
  const textInputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0 || disabled) return;
    onSend(trimmed, attachments);
    setText('');
    setAttachments([]);
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

  const handleAddAttachment = () => {
    Alert.alert(
      'Add Attachment',
      'Choose attachment type',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Photo Library', onPress: () => pickImage() },
        { text: 'Camera', onPress: () => takePhoto() },
        { text: 'File', onPress: () => pickFile() },
      ]
    );
  };

  const pickImage = () => {
    // TODO: Implement with expo-image-picker
    Alert.alert('Not implemented', 'Photo library picker coming soon');
  };

  const takePhoto = () => {
    // TODO: Implement with expo-camera/expo-image-picker
    Alert.alert('Not implemented', 'Camera coming soon');
  };

  const pickFile = () => {
    // TODO: Implement with expo-document-picker
    Alert.alert('Not implemented', 'File picker coming soon');
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <View style={[styles.container, { height }]}>
      {attachments.length > 0 && (
        <View style={styles.attachmentsPreview}>
          {attachments.map((uri, index) => (
            <View key={index} style={styles.attachmentItem}>
              <Image source={{ uri }} style={styles.attachmentThumbnail} />
              <TouchableOpacity
                style={styles.removeAttachmentButton}
                onPress={() => removeAttachment(index)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={16} color="#f2f2f2" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
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
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handleAddAttachment}
          disabled={disabled}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#8b949e" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[
          styles.sendButton,
          ((!text.trim() && attachments.length === 0) || disabled) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={(!text.trim() && attachments.length === 0) || disabled}
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
  attachmentsPreview: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  attachmentItem: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attachmentThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeAttachmentButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ff453a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButton: {
    padding: 10,
    marginLeft: 8,
  },
});