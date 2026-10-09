import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createId } from '../utils/id';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: varchar('identifier', { length: 255 }).notNull().unique(),
    identifierType: varchar('identifier_type', { length: 20 }).notNull(), // 'email' | 'phone' | 'username'
    displayName: varchar('display_name', { length: 100 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    identifierIdx: uniqueIndex('users_identifier_idx').on(t.identifier),
    deletedAtIdx: index('users_deleted_at_idx').on(t.deletedAt),
  }),
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceName: varchar('device_name', { length: 100 }),
    platform: varchar('platform', { length: 20 }).notNull(), // 'ios' | 'android' | 'web'
    platformVersion: varchar('platform_version', { length: 50 }),
    appVersion: varchar('app_version', { length: 20 }),
    identityKeyPublic: varchar('identity_key_public', { length: 64 }).notNull(), // X25519 base64
    signingKeyPublic: varchar('signing_key_public', { length: 64 }).notNull(), // Ed25519 base64
    signedPreKeyPublic: varchar('signed_prekey_public', { length: 64 }).notNull(), // X25519 base64
    signedPreKeySignature: varchar('signed_prekey_signature', { length: 88 }).notNull(), // base64
    signedPreKeyId: integer('signed_prekey_id').notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({
    userIdIdx: index('devices_user_id_idx').on(t.userId),
    identityKeyIdx: uniqueIndex('devices_identity_key_idx').on(t.identityKeyPublic),
    revokedAtIdx: index('devices_revoked_at_idx').on(t.revokedAt),
  }),
);

export const deviceOneTimePreKeys = pgTable(
  'device_one_time_prekeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    keyId: integer('key_id').notNull(),
    publicKey: varchar('public_key', { length: 64 }).notNull(), // X25519 base64
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceIdKeyIdIdx: uniqueIndex('otp_device_key_idx').on(t.deviceId, t.keyId),
    deviceIdIdx: index('otp_device_id_idx').on(t.deviceId),
    usedAtIdx: index('otp_used_at_idx').on(t.usedAt),
  }),
);

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    contactUserId: uuid('contact_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    alias: varchar('alias', { length: 100 }),
    verificationStatus: varchar('verification_status', { length: 20 }).notNull().default('UNVERIFIED'), // UNVERIFIED | VERIFIED | BLOCKED | PENDING
    safetyNumber: varchar('safety_number', { length: 60 }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userContactIdx: uniqueIndex('contacts_user_contact_idx').on(t.userId, t.contactUserId),
    userIdIdx: index('contacts_user_id_idx').on(t.userId),
    contactUserIdIdx: index('contacts_contact_user_id_idx').on(t.contactUserId),
    statusIdx: index('contacts_status_idx').on(t.verificationStatus),
  }),
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 20 }).notNull(), // 'DIRECT' | 'GROUP'
    title: varchar('title', { length: 100 }),
    avatarUrl: text('avatar_url'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    disappearingTimerMs: integer('disappearing_timer_ms').default(0),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    typeIdx: index('conversations_type_idx').on(t.type),
    createdByIdx: index('conversations_created_by_idx').on(t.createdById),
    lastMessageIdx: index('conversations_last_message_idx').on(t.lastMessageAt),
    deletedAtIdx: index('conversations_deleted_at_idx').on(t.deletedAt),
  }),
);

export const conversationMembers = pgTable(
  'conversation_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('MEMBER'), // 'ADMIN' | 'MEMBER'
    senderKey: varchar('sender_key', { length: 64 }), // base64 encoded 32-byte key for group messages
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }),
    unreadCount: integer('unread_count').default(0),
    lastReadMessageId: uuid('last_read_message_id'),
    notificationsMuted: boolean('notifications_muted').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    conversationDeviceIdx: uniqueIndex('conv_members_conv_device_idx').on(t.conversationId, t.deviceId),
    conversationIdIdx: index('conv_members_conv_id_idx').on(t.conversationId),
    userIdIdx: index('conv_members_user_id_idx').on(t.userId),
    deviceIdIdx: index('conv_members_device_id_idx').on(t.deviceId),
    leftAtIdx: index('conv_members_left_at_idx').on(t.leftAt),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderDeviceId: uuid('sender_device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    clientMessageId: varchar('client_message_id', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).notNull().default('TEXT'),
    content: text('content'),
    contentHash: varchar('content_hash', { length: 64 }),
    editOfMessageId: uuid('edit_of_message_id'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    conversationSentIdx: index('messages_conv_sent_idx').on(t.conversationId, t.sentAt),
    senderDeviceIdx: index('messages_sender_device_idx').on(t.senderDeviceId),
    clientMsgIdIdx: uniqueIndex('messages_client_msg_id_idx').on(t.clientMessageId),
    editOfIdx: index('messages_edit_of_idx').on(t.editOfMessageId),
    deletedAtIdx: index('messages_deleted_at_idx').on(t.deletedAt),
  }),
);

export const messageRecipients = pgTable(
  'message_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    recipientDeviceId: uuid('recipient_device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING | RELAYED | DELIVERED | READ | FAILED
    relayMessageId: uuid('relay_message_id'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    messageRecipientIdx: uniqueIndex('msg_recipients_msg_recipient_idx').on(t.messageId, t.recipientDeviceId),
    messageIdIdx: index('msg_recipients_msg_id_idx').on(t.messageId),
    recipientDeviceIdx: index('msg_recipients_recipient_device_idx').on(t.recipientDeviceId),
    statusIdx: index('msg_recipients_status_idx').on(t.status),
    relayMsgIdIdx: index('msg_recipients_relay_msg_id_idx').on(t.relayMessageId),
  }),
);

export const relayMessages = pgTable(
  'relay_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    recipientDeviceId: uuid('recipient_device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    envelope: jsonb('envelope').notNull(), // Full encrypted envelope
    attempts: integer('attempts').default(0),
    maxAttempts: integer('max_attempts').default(10),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }).defaultNow().notNull(),
    ackedAt: timestamp('acked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // TTL for cleanup (30 days)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    messageRecipientIdx: uniqueIndex('relay_msg_message_recipient_idx').on(t.messageId, t.recipientDeviceId),
    recipientDeviceIdx: index('relay_msg_recipient_device_idx').on(t.recipientDeviceId),
    nextRetryIdx: index('relay_msg_next_retry_idx').on(t.nextRetryAt),
    expiresAtIdx: index('relay_msg_expires_at_idx').on(t.expiresAt),
    ackedAtIdx: index('relay_msg_acked_at_idx').on(t.ackedAt),
  }),
);

export const encryptionKeys = pgTable(
  'encryption_keys',
  {
    id: varchar('id', { length: 255 }).primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    keyType: varchar('key_type', { length: 50 }).notNull(),
    keyId: integer('key_id'),
    publicKey: text('public_key'),
    privateKeyEncrypted: text('private_key_encrypted'),
    signature: text('signature'),
    record: text('record'),
    isActive: boolean('is_active').default(true),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceIdIdx: index('encryption_keys_device_id_idx').on(t.deviceId),
    keyTypeIdx: index('encryption_keys_key_type_idx').on(t.keyType),
    keyIdIdx: index('encryption_keys_key_id_idx').on(t.keyId),
    isActiveIdx: index('encryption_keys_is_active_idx').on(t.isActive),
  }),
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'cascade' }),
    uploaderDeviceId: uuid('uploader_device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    encryptedKey: varchar('encrypted_key', { length: 88 }).notNull(),
    nonce: varchar('nonce', { length: 24 }).notNull(),
    storageUrl: text('storage_url'),
    storageProvider: varchar('storage_provider', { length: 20 }).default('s3'),
    uploadStatus: varchar('upload_status', { length: 20 }).default('PENDING'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    messageIdIdx: index('attachments_message_id_idx').on(t.messageId),
    uploaderDeviceIdx: index('attachments_uploader_device_idx').on(t.uploaderDeviceId),
    uploadStatusIdx: index('attachments_upload_status_idx').on(t.uploadStatus),
    expiresAtIdx: index('attachments_expires_at_idx').on(t.expiresAt),
  }),
);

export const pushTokens = pgTable(
  'push_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: varchar('platform', { length: 20 }).notNull(), // 'expo' | 'fcm' | 'apns'
    active: boolean('active').default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deviceTokenIdx: uniqueIndex('push_tokens_device_token_idx').on(t.deviceId, t.token),
    deviceIdIdx: index('push_tokens_device_id_idx').on(t.deviceId),
    activeIdx: index('push_tokens_active_idx').on(t.active),
  }),
);

export const syncOperations = pgTable(
  'sync_operations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    operationType: varchar('operation_type', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    payload: jsonb('payload').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING | PROCESSING | COMPLETED | FAILED | CONFLICT
    attempts: integer('attempts').default(0),
    maxAttempts: integer('max_attempts').default(5),
    lastError: text('last_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userDeviceIdx: index('sync_ops_user_device_idx').on(t.userId, t.deviceId),
    idempotencyKeyIdx: uniqueIndex('sync_ops_idempotency_key_idx').on(t.idempotencyKey),
    statusIdx: index('sync_ops_status_idx').on(t.status),
    entityIdx: index('sync_ops_entity_idx').on(t.entityType, t.entityId),
    createdAtIdx: index('sync_ops_created_at_idx').on(t.createdAt),
  }),
);

export const settings = pgTable(
  'settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 100 }).notNull(),
    value: jsonb('value').notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userKeyIdx: uniqueIndex('settings_user_key_idx').on(t.userId, t.key),
    userIdIdx: index('settings_user_id_idx').on(t.userId),
  }),
);

export const backups = pgTable(
  'backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 255 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    checksum: varchar('checksum', { length: 64 }).notNull(), // SHA-256
    storageUrl: text('storage_url'),
    status: varchar('status', { length: 20 }).notNull().default('CREATING'), // CREATING | COMPLETED | FAILED | EXPIRED
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdIdx: index('backups_user_id_idx').on(t.userId),
    deviceIdIdx: index('backups_device_id_idx').on(t.deviceId),
    statusIdx: index('backups_status_idx').on(t.status),
    expiresAtIdx: index('backups_expires_at_idx').on(t.expiresAt),
  }),
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
  contacts: many(contacts),
  contactOf: many(contacts, { relationName: 'contactOf' }),
  conversationsCreated: many(conversations),
  conversationMembers: many(conversationMembers),
  sentMessages: many(messages),
  pushTokens: many(pushTokens),
  syncOperations: many(syncOperations),
  settings: many(settings),
  backups: many(backups),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, { fields: [devices.userId], references: [users.id] }),
  oneTimePreKeys: many(deviceOneTimePreKeys),
  conversationMembers: many(conversationMembers),
  sentMessages: many(messages),
  messageRecipients: many(messageRecipients),
  relayMessages: many(relayMessages),
  attachments: many(attachments),
  pushTokens: many(pushTokens),
  syncOperations: many(syncOperations),
  backups: many(backups),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  createdBy: one(users, { fields: [conversations.createdById], references: [users.id] }),
  members: many(conversationMembers),
  messages: many(messages),
}));

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
  conversation: one(conversations, { fields: [conversationMembers.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [conversationMembers.userId], references: [users.id] }),
  device: one(devices, { fields: [conversationMembers.deviceId], references: [devices.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  senderDevice: one(devices, { fields: [messages.senderDeviceId], references: [devices.id] }),
  editOf: one(messages, { fields: [messages.editOfMessageId], references: [messages.id], relationName: 'edits' }),
  edits: many(messages, { relationName: 'edits' }),
  recipients: many(messageRecipients),
  relayMessages: many(relayMessages),
  attachments: many(attachments),
}));

export const messageRecipientsRelations = relations(messageRecipients, ({ one }) => ({
  message: one(messages, { fields: [messageRecipients.messageId], references: [messages.id] }),
  recipientDevice: one(devices, { fields: [messageRecipients.recipientDeviceId], references: [devices.id] }),
  relayMessage: one(relayMessages, { fields: [messageRecipients.relayMessageId], references: [relayMessages.id] }),
}));

export const relayMessagesRelations = relations(relayMessages, ({ one }) => ({
  message: one(messages, { fields: [relayMessages.messageId], references: [messages.id] }),
  recipientDevice: one(devices, { fields: [relayMessages.recipientDeviceId], references: [devices.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
  uploaderDevice: one(devices, { fields: [attachments.uploaderDeviceId], references: [devices.id] }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  device: one(devices, { fields: [pushTokens.deviceId], references: [devices.id] }),
}));

export const syncOperationsRelations = relations(syncOperations, ({ one }) => ({
  user: one(users, { fields: [syncOperations.userId], references: [users.id] }),
  device: one(devices, { fields: [syncOperations.deviceId], references: [devices.id] }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, { fields: [settings.userId], references: [users.id] }),
}));

export const backupsRelations = relations(backups, ({ one }) => ({
  user: one(users, { fields: [backups.userId], references: [users.id] }),
  device: one(devices, { fields: [backups.deviceId], references: [devices.id] }),
}));

export const encryptionKeysRelations = relations(encryptionKeys, ({ one }) => ({
  device: one(devices, { fields: [encryptionKeys.deviceId], references: [devices.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DeviceOneTimePreKey = typeof deviceOneTimePreKeys.$inferSelect;
export type NewDeviceOneTimePreKey = typeof deviceOneTimePreKeys.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type NewConversationMember = typeof conversationMembers.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageRecipient = typeof messageRecipients.$inferSelect;
export type NewMessageRecipient = typeof messageRecipients.$inferInsert;
export type RelayMessage = typeof relayMessages.$inferSelect;
export type NewRelayMessage = typeof relayMessages.$inferInsert;
export type EncryptionKey = typeof encryptionKeys.$inferSelect;
export type NewEncryptionKey = typeof encryptionKeys.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
export type SyncOperation = typeof syncOperations.$inferSelect;
export type NewSyncOperation = typeof syncOperations.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type Backup = typeof backups.$inferSelect;
export type NewBackup = typeof backups.$inferInsert;