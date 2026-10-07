// src/database/schema.ts
// Database schema types and constants

export const TABLES = {
  USERS: 'users',
  DEVICES: 'devices',
  CONTACTS: 'contacts',
  CONVERSATIONS: 'conversations',
  CONVERSATION_MEMBERS: 'conversation_members',
  MESSAGES: 'messages',
  MESSAGE_RECIPIENTS: 'message_recipients',
  ATTACHMENTS: 'attachments',
  ENCRYPTION_KEYS: 'encryption_keys',
  SYNC_QUEUE: 'sync_queue',
  SETTINGS: 'settings',
  BACKUPS: 'backups',
  SCHEMA_MIGRATIONS: 'schema_migrations',
} as const;

export const SYNC_STATUS = {
  SYNCED: 'SYNCED',
  PENDING: 'PENDING',
  CONFLICT: 'CONFLICT',
} as const;

export const MESSAGE_STATUS = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  UPLOADING: 'UPLOADING',
  RELAYED: 'RELAYED',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
} as const;

export const MESSAGE_CONTENT_TYPE = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  FILE: 'FILE',
  SYSTEM: 'SYSTEM',
} as const;

export const SYNC_OPERATION = {
  MESSAGE_CREATE: 'MESSAGE_CREATE',
  MESSAGE_SEND: 'MESSAGE_SEND',
  MESSAGE_ACK: 'MESSAGE_ACK',
  MESSAGE_READ: 'MESSAGE_READ',
  ATTACHMENT_UPLOAD: 'ATTACHMENT_UPLOAD',
  ATTACHMENT_DOWNLOAD: 'ATTACHMENT_DOWNLOAD',
  CONTACT_SYNC: 'CONTACT_SYNC',
  CONVERSATION_SYNC: 'CONVERSATION_SYNC',
  DEVICE_SYNC: 'DEVICE_SYNC',
  KEY_ROTATION: 'KEY_ROTATION',
  BACKUP_CREATE: 'BACKUP_CREATE',
  BACKUP_RESTORE: 'BACKUP_RESTORE',
} as const;

export const SYNC_ENTITY_TYPE = {
  MESSAGES: 'messages',
  MESSAGE_RECIPIENTS: 'message_recipients',
  ATTACHMENTS: 'attachments',
  CONTACTS: 'contacts',
  CONVERSATIONS: 'conversations',
  DEVICES: 'devices',
  ENCRYPTION_KEYS: 'encryption_keys',
} as const;

export const SYNC_QUEUE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export const ATTACHMENT_UPLOAD_STATUS = {
  PENDING: 'PENDING',
  UPLOADING: 'UPLOADING',
  UPLOADED: 'UPLOADED',
  FAILED: 'FAILED',
} as const;

export const ATTACHMENT_DOWNLOAD_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  DOWNLOADING: 'DOWNLOADING',
  DOWNLOADED: 'DOWNLOADED',
  FAILED: 'FAILED',
} as const;

export const CONTACT_VERIFICATION_STATUS = {
  UNVERIFIED: 'UNVERIFIED',
  VERIFIED: 'VERIFIED',
  BLOCKED: 'BLOCKED',
} as const;

export const CONVERSATION_TYPE = {
  DIRECT: 'DIRECT',
  GROUP: 'GROUP',
} as const;

export const DEVICE_PLATFORM = {
  IOS: 'ios',
  ANDROID: 'android',
  WEB: 'web',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];
export type MessageStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];
export type MessageContentType = (typeof MESSAGE_CONTENT_TYPE)[keyof typeof MESSAGE_CONTENT_TYPE];
export type SyncOperation = (typeof SYNC_OPERATION)[keyof typeof SYNC_OPERATION];
export type SyncEntityType = (typeof SYNC_ENTITY_TYPE)[keyof typeof SYNC_ENTITY_TYPE];
export type SyncQueueStatus = (typeof SYNC_QUEUE_STATUS)[keyof typeof SYNC_QUEUE_STATUS];
export type AttachmentUploadStatus =
  (typeof ATTACHMENT_UPLOAD_STATUS)[keyof typeof ATTACHMENT_UPLOAD_STATUS];
export type AttachmentDownloadStatus =
  (typeof ATTACHMENT_DOWNLOAD_STATUS)[keyof typeof ATTACHMENT_DOWNLOAD_STATUS];
export type ContactVerificationStatus =
  (typeof CONTACT_VERIFICATION_STATUS)[keyof typeof CONTACT_VERIFICATION_STATUS];
export type ConversationType = (typeof CONVERSATION_TYPE)[keyof typeof CONVERSATION_TYPE];
export type DevicePlatform = (typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM];
