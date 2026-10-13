import React, { useState, useEffect } from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Attachment, getAttachmentType, formatFileSize, formatDuration } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_PREVIEW_WIDTH = SCREEN_WIDTH * 0.7;

interface AttachmentPreviewProps {
  attachment: Attachment;
  onPress?: () => void;
  onLongPress?: () => void;
  showThumbnail?: boolean;
  maxWidth?: number;
  showFileInfo?: boolean;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
  onPress,
  onLongPress,
  showThumbnail = true,
  maxWidth = MAX_PREVIEW_WIDTH,
  showFileInfo = true,
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const attachmentType = attachment.metadata?.type || getAttachmentType(attachment.mimeType);

  useEffect(() => {
    loadThumbnail();
  }, [attachment]);

  const loadThumbnail = async () => {
    if (!showThumbnail || attachmentType !== 'image') {
      setLoading(false);
      return;
    }

    if (attachment.metadata?.thumbnailKey) {
      try {
        // In a real app, you'd fetch the thumbnail URL
        // For now, we'll use the main image as thumbnail
        setThumbnail(attachment.storageUrl || '');
      } catch (error) {
        console.error('Failed to load thumbnail:', error);
      }
    }
    setLoading(false);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (attachmentType === 'image') {
      setShowFullscreen(true);
    } else if (attachmentType === 'video') {
      // Open video player
      console.log('Play video:', attachment.storageUrl);
    } else {
      // Download and open file
      handleDownload();
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // In a real app, this would use the download URL API
      // const { downloadUrl } = await api.getDownloadUrl(attachment.id, deviceId);
      // For now, we'll use the storage URL directly if available
      if (attachment.storageUrl) {
        // In a real app, you'd use the download URL from the API
        console.log('Downloading:', attachment.storageUrl);
      }
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = () => {
    switch (attachmentType) {
      case 'image':
        return 'image-outline';
      case 'video':
        return 'videocam-outline';
      case 'audio':
        return 'musical-note-outline';
      default:
        return 'document-outline';
    }
  };

  const renderImagePreview = () => {
    if (attachmentType !== 'image') return null;
    
    const imageUri = attachment.storageUrl || thumbnail;
    
    return (
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onLongPress}
        activeOpacity={0.8}
        style={styles.imageContainer}
      >
        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#00d992" />
          </View>
        ) : (
          <Image
            source={{ uri: imageUri || undefined }}
            style={styles.image}
            resizeMode="contain"
          />
        )}
        {downloading && (
          <View style={styles.downloadingOverlay}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.downloadingText}>Downloading...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderVideoPreview = () => {
    if (attachmentType !== 'video') return null;
    
    return (
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onLongPress}
        activeOpacity={0.8}
        style={styles.videoContainer}
      >
        <View style={styles.videoPlaceholder}>
          <Ionicons name="videocam-outline" size={48} color="#8b949e" />
          <Text style={styles.videoInfo}>
            {attachment.filename}
            {'\n'}
            {formatFileSize(attachment.sizeBytes)}
            {attachment.metadata?.durationMs && ` • ${formatDuration(attachment.metadata.durationMs)}`}
          </Text>
          <Ionicons name="play-circle-outline" size={64} color="#00d992" style={styles.playButton} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderAudioPreview = () => {
    if (attachmentType !== 'audio') return null;
    
    return (
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onLongPress}
        activeOpacity={0.8}
        style={styles.audioContainer}
      >
        <View style={styles.audioContent}>
          <Ionicons name="musical-note-outline" size={32} color="#00d992" style={styles.audioIcon} />
          <View style={styles.audioInfo}>
            <Text style={styles.audioTitle} numberOfLines={1}>{attachment.filename}</Text>
            <Text style={styles.audioMeta}>
              {formatFileSize(attachment.sizeBytes)}
              {attachment.metadata?.durationMs && ` • ${formatDuration(attachment.metadata.durationMs)}`}
            </Text>
          </View>
          <Ionicons name="play-circle-outline" size={40} color="#00d992" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilePreview = () => {
    if (attachmentType !== 'file') return null;
    
    return (
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={onLongPress}
        activeOpacity={0.8}
        style={styles.fileContainer}
      >
        <View style={styles.fileContent}>
          <Ionicons name="document-outline" size={32} color="#8b949e" style={styles.fileIcon} />
          <View style={styles.fileInfo}>
            <Text style={styles.fileTitle} numberOfLines={1}>{attachment.filename}</Text>
            <Text style={styles.fileMeta}>{formatFileSize(attachment.sizeBytes)}</Text>
          </View>
          <Ionicons name="download-outline" size={24} color="#00d992" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {renderImagePreview()}
      {renderVideoPreview()}
      {renderAudioPreview()}
      {renderFilePreview()}
      
      {/* Fullscreen image modal */}
      {showFullscreen && attachmentType === 'image' && (
        <Modal visible={showFullscreen} animationType="fade" onRequestClose={() => setShowFullscreen(false)}>
          <View style={styles.fullscreenContainer}>
            <TouchableOpacity
              onPress={() => setShowFullscreen(false)}
              style={styles.fullscreenClose}
            >
              <Ionicons name="close-outline" size={28} color="white" />
            </TouchableOpacity>
            <Image
              source={{ uri: attachment.storageUrl || thumbnail || undefined }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
            {showFileInfo && (
              <View style={styles.fullscreenInfo}>
                <Text style={styles.fullscreenTitle}>{attachment.filename}</Text>
                <Text style={styles.fullscreenMeta}>
                  {formatFileSize(attachment.sizeBytes)}
                  {attachment.metadata?.width && attachment.metadata?.height && ` • ${attachment.metadata.width}×${attachment.metadata.height}`}
                </Text>
              </View>
            )}
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    maxWidth: MAX_PREVIEW_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  image: {
    width: '100%',
    maxHeight: 300,
  },
  videoContainer: {
    maxWidth: MAX_PREVIEW_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  videoPlaceholder: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  videoInfo: {
    textAlign: 'center',
    color: '#8b949e',
    fontSize: 14,
    marginTop: 12,
  },
  playButton: {
    marginTop: 16,
  },
  audioContainer: {
    maxWidth: MAX_PREVIEW_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  audioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  audioIcon: {
    backgroundColor: 'rgba(0, 217, 146, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  audioInfo: {
    flex: 1,
    minWidth: 0,
  },
  audioTitle: {
    color: '#f2f2f2',
    fontSize: 15,
    fontWeight: '600',
  },
  audioMeta: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 2,
  },
  fileContainer: {
    maxWidth: MAX_PREVIEW_WIDTH,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  fileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIcon: {
    backgroundColor: '#1a1a1a',
    padding: 8,
    borderRadius: 8,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileTitle: {
    color: '#f2f2f2',
    fontSize: 15,
    fontWeight: '600',
  },
  fileMeta: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  downloadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  downloadingText: {
    color: 'white',
    marginTop: 8,
    fontSize: 14,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  fullscreenTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  fullscreenMeta: {
    color: '#8b949e',
    fontSize: 13,
    marginTop: 4,
  },
});