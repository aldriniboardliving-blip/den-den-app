// src/features/attachments/hooks/useAttachments.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { api } from '@/api/client';
import { messagesRepository } from '@/database/repositories/messages';
import { conversationsRepository } from '@/database/repositories/conversations';
import { 
  Attachment, 
  AttachmentType, 
  UploadInitiationData, 
  UploadInitiationResult,
  AttachmentUploadProgress,
  getAttachmentType,
  MAX_ATTACHMENT_SIZE,
  isMimeTypeAllowed,
} from '../types';

interface UseAttachmentsOptions {
  onProgress?: (progress: AttachmentUploadProgress) => void;
  onComplete?: (attachment: any) => void;
  onError?: (attachmentId: string, error: Error) => void;
}

export function useAttachments(options: UseAttachmentsOptions = {}) {
  const { user, device } = useAuthStore();
  const [uploads, setUploads] = useState<Map<string, AttachmentUploadProgress>>(new Map());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const updateProgress = useCallback((attachmentId: string, progress: Partial<AttachmentUploadProgress>) => {
    setUploads(prev => {
      const next = new Map(prev);
      const existing = prev.get(attachmentId) || { attachmentId, progress: 0, status: 'pending' };
      next.set(attachmentId, { ...existing, ...progress, attachmentId });
      return next;
    });
    
    if (progress.status === 'completed' || progress.status === 'failed') {
      options.onProgress?.({ attachmentId, ...progress } as AttachmentUploadProgress);
    }
  }, [options]);

  const uploadFile = useCallback(async (file: File, conversationId: string): Promise<Attachment | null> => {
    if (!user || !device) throw new Error('User or device not available');

    // Validate file
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`File size exceeds maximum of ${MAX_ATTACHMENT_SIZE} bytes`);
    }

    if (!isMimeTypeAllowed(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }

    const attachmentType = getAttachmentType(file.type);
    const attachmentId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    
    // Create abort controller for this upload
    const abortController = new AbortController();
    abortControllers.current.set(attachmentId, abortController);

    // Initial progress
    updateProgress(attachmentId, {
      attachmentId,
      progress: 0,
      status: 'pending',
    });

    try {
      // Generate encryption key and nonce for client-side encryption
      const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
      const nonce = crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedKeyB64 = btoa(String.fromCharCode(...encryptionKey));
      const nonceB64 = btoa(String.fromCharCode(...nonce));

      // Encrypt file content
      const fileBuffer = await file.arrayBuffer();
      const encryptedContent = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce },
        await crypto.subtle.importKey('raw', encryptionKey, { name: 'AES-GCM' }, false, ['encrypt']),
        fileBuffer
      );
      
      const encryptedBlob = new Blob([encryptedContent], { type: file.type });

      // Initiate upload - get presigned URL
      updateProgress(attachmentId, { status: 'uploading', progress: 5 });
      
      const initiationData = {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        encryptedKey: encryptedKeyB64,
        nonce: nonceB64,
        messageId: null,
        conversationId,
      };

      const initiationResult = await api.getAttachmentUploadUrl(initiationData);
      
      updateProgress(attachmentId, { progress: 15 });

      // Upload to S3 using presigned URL
      await fetch(initiationResult.uploadUrl, {
        method: 'PUT',
        body: encryptedBlob,
        headers: {
          'Content-Type': file.type,
        },
        signal: abortController.signal,
      }).then(response => {
        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }
      });

      updateProgress(attachmentId, { progress: 90, status: 'completed' });

      // Confirm upload completion
      await api.confirmAttachmentUpload(initiationResult.attachmentId, device.id);
      
      // Process upload (generate thumbnail, etc.)
      await api.processAttachmentUpload(initiationResult.attachmentId, device.id);

      updateProgress(attachmentId, { progress: 100, status: 'completed' });

      // Return attachment object
      return {
        id: initiationResult.attachmentId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        encryptedKey: encryptedKeyB64,
        nonce: nonceB64,
        storageUrl: '',
        uploadStatus: 'COMPLETED',
        metadata: {
          type: getAttachmentType(file.type),
          hasThumbnail: false,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Attachment;
    } catch (error) {
      updateProgress(attachmentId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      options.onError?.(attachmentId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      abortControllers.current.delete(attachmentId);
      // Clean up progress after a delay
      setTimeout(() => {
        setUploads(prev => {
          const next = new Map(prev);
          next.delete(attachmentId);
          return next;
        });
      }, 5000);
    }
  }, [user, device, updateProgress, options]);

  const cancelUpload = useCallback((attachmentId: string) => {
    const controller = abortControllers.current.get(attachmentId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(attachmentId);
      updateProgress(attachmentId, { status: 'failed', error: 'Cancelled by user' });
    }
  }, [updateProgress]);

  const retryUpload = useCallback(async (attachmentId: string) => {
    updateProgress(attachmentId, { status: 'retrying', progress: 0 });
    // Implementation would go here
  }, [updateProgress]);

  const deleteAttachment = useCallback(async (attachmentId: string) => {
    if (!device) return;
    await api.deleteAttachment(attachmentId, device.id);
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, [device]);

  const loadMessageAttachments = useCallback(async (messageId: string) => {
    setLoading(true);
    try {
      const messageAttachments = await api.getMessageAttachments(messageId);
      setAttachments(messageAttachments);
      return messageAttachments;
    } catch (error) {
      console.error('Failed to load attachments:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getDownloadUrl = useCallback(async (attachmentId: string) => {
    if (!device) return null;
    return api.getDownloadUrl(attachmentId, device.id);
  }, [device]);

  return {
    uploads: Array.from(uploads.values()),
    attachments,
    loading,
    uploadFile,
    cancelUpload,
    retryUpload,
    deleteAttachment,
    loadMessageAttachments,
    getDownloadUrl,
    getProgress: (attachmentId: string) => uploads.get(attachmentId),
  };
}

export function useAttachmentPicker() {
  // This would integrate with expo-image-picker or similar
  // For now, return a placeholder
  return {
    pickImage: async () => null,
    pickVideo: async () => null,
    pickDocument: async () => null,
  };
}