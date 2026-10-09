export interface AttachmentMetadata {
  type: 'image' | 'video' | 'audio' | 'file';
  width?: number;
  height?: number;
  durationMs?: number;
  hasThumbnail: boolean;
  thumbnailKey?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

export interface UploadInitiationData {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  encryptedKey: string;
  nonce: string;
  messageId?: string;
  conversationId?: string;
}

export interface UploadInitiationResult {
  attachmentId: string;
  uploadUrl: string;
  uploadFields?: Record<string, string>;
  expiresAt: Date;
}

export interface ThumbnailGenerationResult {
  thumbnailKey: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'file';

export function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

export const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_IMAGE_DIMENSION = 4096;
export const THUMBNAIL_MAX_DIMENSION = 320;
export const THUMBNAIL_QUALITY = 80;