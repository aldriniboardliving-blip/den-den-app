// src/features/attachments/components/MessageAttachments.tsx
import React from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { AttachmentPreview } from './AttachmentPreview';
import { Attachment } from '../types';

interface MessageAttachmentsProps {
  attachments: Attachment[];
  maxInline?: number;
  onPress?: (attachment: Attachment) => void;
  onLongPress?: (attachment: Attachment) => void;
}

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
  attachments,
  maxInline = 4,
  onPress,
  onLongPress,
}) => {
  if (!attachments || attachments.length === 0) return null;

  const displayAttachments = attachments.slice(0, maxInline);
  const remaining = attachments.length - maxInline;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayAttachments.map((attachment) => (
          <AttachmentPreview
            key={attachment.id}
            attachment={attachment}
            onPress={() => onPress?.(attachment)}
            onLongPress={() => onLongPress?.(attachment)}
            showThumbnail={true}
            showFileInfo={true}
          />
        ))}
        {remaining > 0 && (
          <View style={styles.moreIndicator}>
            <View style={styles.moreCircle}>
              <Text style={styles.moreText}>+{remaining}</Text>
            </View>
            <Text style={styles.moreText}>more</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 4,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
    paddingBottom: 8,
  },
  moreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  moreCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00d992',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: '#8b949e',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default MessageAttachments;