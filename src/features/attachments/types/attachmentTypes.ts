// src/features/attachments/types/attachmentTypes.ts
export interface Attachment {
  id: string;
  messageId: string | null;
  uploaderDeviceId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  encryptedKey: string;
  nonce: string;
  storageUrl: string | null;
  storageProvider: string;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  expiresAt: number;
  uploadedAt: number | null;
  metadata?: AttachmentMetadata;
  createdAt: number;
  updatedAt: number;
}

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

export type AttachmentType = 'image' | 'video' | 'audio' | 'file';

export function getAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

export const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic'],
  video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'],
  file: ['application/pdf', 'text/plain', 'application/zip', 'application/x-zip-compressed'],
} as const;

export function isMimeTypeAllowed(mimeType: string): boolean {
  const allowedTypes = Object.values(ALLOWED_MIME_TYPES).flat() as string[];
  return allowedTypes.includes(mimeType);
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

export interface AttachmentUploadProgress {
  attachmentId: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'retrying';
  error?: string;
}

export interface AttachmentUploadOptions {
  onProgress?: (progress: AttachmentUploadProgress) => void;
  onComplete?: (attachment: any) => void;
  onError?: (attachmentId: string, error: Error) => void;
}