// src/types/index.ts

export interface User {
  id: string;
  accountId: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Device {
  id: string;
  userId: string;
  deviceName: string | null;
  platform: 'ios' | 'android' | 'web';
  platformVersion: string | null;
  appVersion: string | null;
  identityKeyPublic: string;
  identityKeyPrivate: string;
  signedPrekeyPublic: string;
  signedPrekeyPrivate: string;
  signedPrekeySignature: string;
  signedPrekeyCreatedAt: number;
  onetimePrekeys: OnetimePrekey[];
  registeredAt: number;
  lastActiveAt: number | null;
  isPrimary: boolean;
  pushToken: string | null;
  pushTokenUpdatedAt: number | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  lastSyncedAt: number | null;
  serverVersion: number;
}

export interface OnetimePrekey {
  id: number;
  publicKey: string;
  createdAt: number;
  usedAt: number | null;
}

export interface KeyBundle {
  deviceId: string;
  identityKeyPublic: string;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  signedPrekeyId: number;
  onetimePrekeyPublic: string | null;
  onetimePrekeyId: number | null;
}

export type DisappearingTimerDuration = 0 | 86400000 | 604800000 | 7776000000; // 0 = off, 24h, 7d, 90d in ms

export interface Conversation {
  id: string;
  userId: string;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  adminDeviceIds: string[];
  isArchived: boolean;
  isPinned: boolean;
  muteUntil: number | null;
  disappearingMessagesTimer: DisappearingTimerDuration;
  disappearingMessagesStartAt: number | null;
  lastMessageId: string | null;
  lastMessageAt: number | null;
  lastMessageSenderId: string | null;
  unreadCount: number;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  lastSyncedAt: number | null;
  serverVersion: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  deviceId: string;
  accountId: string;
  role: 'ADMIN' | 'MEMBER';
  senderKeyPublic: string | null;
  senderKeyPrivate: string | null;
  joinedAt: number;
  leftAt: number | null;
  isActive: boolean;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  lastSyncedAt: number | null;
  serverVersion: number;
}

export type MessageStatus =
  'DRAFT' | 'PENDING' | 'UPLOADING' | 'RELAYED' | 'DELIVERED' | 'READ' | 'FAILED';

export type MessageContentType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';

export interface Message {
  id: string;
  conversationId: string;
  senderDeviceId: string;
  senderAccountId: string;
  content: string | null;
  contentEncrypted: string | null;
  contentType: MessageContentType;
  encryptionAlgorithm: string | null;
  nonce: string | null;
  senderKeyId: number | null;
  status: MessageStatus;
  createdAt: number;
  sentAt: number | null;
  deliveredAt: number | null;
  readAt: number | null;
  editedAt: number | null;
  editedBy: string | null;
  deletedAt: number | null;
  syncStatus: 'PENDING' | 'SYNCED' | 'CONFLICT';
  serverMessageId: string | null;
  lastSyncAttemptAt: number | null;
  syncAttemptCount: number;
  reactions?: MessageReaction[];
  replyToMessageId?: string;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  userAccountId: string;
  createdAt: number;
}

export type ReactionEmoji = '👍' | '👎' | '❤️' | '😂' | '😮' | '😢' | '🎉' | '🙏';

export interface MessageRecipient {
  id: string;
  messageId: string;
  recipientDeviceId: string;
  recipientAccountId: string;
  status: 'PENDING' | 'RELAYED' | 'DELIVERED' | 'READ' | 'FAILED';
  ciphertext: string;
  nonce: string;
  senderKeyId: number | null;
  relayedAt: number | null;
  deliveredAt: number | null;
  readAt: number | null;
  ackSentAt: number | null;
  attemptCount: number;
  lastAttemptAt: number | null;
  errorMessage: string | null;
}

export interface Attachment {
  id: string;
  messageId: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  localPath: string | null;
  localThumbnailPath: string | null;
  encryptionKey: string;
  encryptionAlgorithm: string;
  nonce: string;
  remoteUrl: string | null;
  remoteKey: string | null;
  uploadStatus: 'PENDING' | 'UPLOADING' | 'UPLOADED' | 'FAILED';
  downloadStatus: 'NOT_STARTED' | 'DOWNLOADING' | 'DOWNLOADED' | 'FAILED';
  width: number | null;
  height: number | null;
  durationMs: number | null;
  createdAt: number;
  uploadedAt: number | null;
  downloadedAt: number | null;
  deletedAt: number | null;
}

export interface Contact {
  id: string;
  userId: string;
  contactAccountId: string;
  contactDeviceId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  identityKeyPublic: string;
  signedPrekeyPublic: string | null;
  signedPrekeySignature: string | null;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'BLOCKED' | 'PENDING';
  verifiedAt: number | null;
  safetyNumber: string | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  lastSyncedAt: number | null;
  serverVersion: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type SyncOperationType =
  | 'MESSAGE_CREATE'
  | 'MESSAGE_SEND'
  | 'MESSAGE_ACK'
  | 'MESSAGE_READ'
  | 'ATTACHMENT_UPLOAD'
  | 'ATTACHMENT_DOWNLOAD'
  | 'CONTACT_SYNC'
  | 'CONVERSATION_SYNC'
  | 'DEVICE_SYNC'
  | 'KEY_ROTATION'
  | 'BACKUP_CREATE'
  | 'BACKUP_RESTORE';

export type SyncEntityType =
  | 'messages'
  | 'message_recipients'
  | 'attachments'
  | 'contacts'
  | 'conversations'
  | 'devices'
  | 'encryption_keys';

export type SyncStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Alias for sync queue status
export type SyncQueueStatus = SyncStatus;

export interface SyncOperation {
  id: string;
  userId: string;
  operation: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: string | null;
  status: SyncStatus;
  priority: number;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: number | null;
  nextAttemptAt: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  lastError: string | null;
  errorCode: string | null;
  createdAt: number;
  completedAt: number | null;
  idempotencyKey: string | null;
}

export interface Setting {
  id: string;
  userId: string;
  key: string;
  value: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  lastSyncedAt: number | null;
  serverVersion: number;
}

export interface Backup {
  id: string;
  userId: string;
  deviceId: string;
  filePath: string;
  fileSizeBytes: number;
  encryptionAlgorithm: string;
  kdfAlgorithm: string;
  kdfParams: string;
  schemaVersion: number;
  tablesIncluded: string;
  recordCounts: string;
  dateRangeStart: number | null;
  dateRangeEnd: number | null;
  status: 'CREATED' | 'VERIFIED' | 'EXPORTED' | 'IMPORTED' | 'FAILED';
  verificationHash: string | null;
  createdAt: number;
  verifiedAt: number | null;
  exportedAt: number | null;
  importedAt: number | null;
}

export interface EncryptionKey {
  id: string;
  deviceId: string;
  conversationId: string | null;
  keyType:
    'IDENTITY' | 'SIGNED_PREKEY' | 'ONETIME_PREKEY' | 'SENDER_KEY' | 'CHAIN_KEY' | 'MESSAGE_KEY';
  keyId: number | null;
  publicKey: string | null;
  privateKeyEncrypted: string | null;
  createdAt: number;
  expiresAt: number | null;
  usedAt: number | null;
  isActive: boolean;
}

export interface MessageEnvelope {
  messageId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  conversationId: string;
  ciphertext: string;
  nonce: string;
  ephemeralPublic: string;
  signedPreKeyId: number;
  onetimePreKeyId: number | null;
  encryptionAlgorithm: string;
  contentType: MessageContentType;
  createdAt: number;
}

export interface DeliveryReceipt {
  serverMessageId: string;
  recipientDeviceId: string;
  status: 'RECEIVED_BY_DEVICE' | 'PERSISTED_LOCALLY' | 'ACKNOWLEDGED';
  receivedAt: number;
  acknowledgedAt: number | null;
}

export interface PushNotificationPayload {
  type: 'MESSAGE_NEW' | 'SYNC_REQUIRED';
  conversationId: string;
  senderId: string;
  messageType: MessageContentType;
}

export interface SafetyNumber {
  number: string;
  qrCode: string;
}

export type { ConversationWithLastMessage } from '../features/chat/types';
