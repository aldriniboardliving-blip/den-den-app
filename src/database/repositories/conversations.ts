// src/database/repositories/conversations.ts
// Conversations repository

import { getDatabase } from '../connection';
import { Conversation } from '../../types';

export class ConversationsRepository {
  private static instance: ConversationsRepository;

  static getInstance(): ConversationsRepository {
    if (!ConversationsRepository.instance) {
      ConversationsRepository.instance = new ConversationsRepository();
    }
    return ConversationsRepository.instance;
  }

  async getAll(userId: string, includeArchived: boolean = false): Promise<Conversation[]> {
    const db = await getDatabase();

    let sql = `
      SELECT * FROM conversations
      WHERE user_id = ? AND deleted_at IS NULL
    `;

    if (!includeArchived) {
      sql += ` AND is_archived = 0`;
    }

    sql += ` ORDER BY 
      CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END,
      last_message_at DESC NULLS LAST`;

    return db.getAllAsync<Conversation>(sql, userId);
  }

  async getAllWithDisappearingTimer(userId: string): Promise<Conversation[]> {
    const db = await getDatabase();

    return db.getAllAsync<Conversation>(
      `SELECT * FROM conversations
       WHERE user_id = ? AND deleted_at IS NULL AND disappearing_messages_timer > 0`,
      userId
    );
  }

  async getAllWithDisappearingTimerGlobal(): Promise<Conversation[]> {
    const db = await getDatabase();

    return db.getAllAsync<Conversation>(
      `SELECT * FROM conversations
       WHERE deleted_at IS NULL AND disappearing_messages_timer > 0`
    );
  }

  async getById(id: string): Promise<Conversation | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Conversation>('SELECT * FROM conversations WHERE id = ? AND deleted_at IS NULL', id);
  }

  async create(conversation: Omit<Conversation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Conversation> {
    const db = await getDatabase();
    const id = conversation.id || generateId();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO conversations (
        id, user_id, type, title, avatar_url, created_by,
        admin_device_ids, is_archived, is_pinned, mute_until,
        unread_count, sync_status, last_synced_at, server_version,
        disappearing_messages_timer, disappearing_messages_start_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      conversation.userId,
      conversation.type,
      conversation.title ?? '',
      conversation.avatarUrl ?? '',
      conversation.createdBy ?? '',
      JSON.stringify(conversation.adminDeviceIds),
      conversation.isArchived ? 1 : 0,
      conversation.isPinned ? 1 : 0,
      conversation.muteUntil ?? 0,
      conversation.unreadCount,
      conversation.syncStatus,
      conversation.lastSyncedAt ?? 0,
      conversation.serverVersion,
      conversation.disappearingMessagesTimer ?? 0,
      conversation.disappearingMessagesStartAt ?? null,
      now,
      now
    );

    return this.getById(id) as Promise<Conversation>;
  }

  async update(id: string, updates: Partial<Conversation>): Promise<void> {
    const db = await getDatabase();

    const fields: string[] = [];
    const params: (string | number | boolean)[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title ?? ''); }
    if (updates.avatarUrl !== undefined) { fields.push('avatar_url = ?'); params.push(updates.avatarUrl ?? ''); }
    if (updates.isArchived !== undefined) { fields.push('is_archived = ?'); params.push(updates.isArchived ? 1 : 0); }
    if (updates.isPinned !== undefined) { fields.push('is_pinned = ?'); params.push(updates.isPinned ? 1 : 0); }
    if (updates.muteUntil !== undefined) { fields.push('mute_until = ?'); params.push(updates.muteUntil ?? 0); }
    if (updates.disappearingMessagesTimer !== undefined) { fields.push('disappearing_messages_timer = ?'); params.push(updates.disappearingMessagesTimer); }
    if (updates.disappearingMessagesStartAt !== undefined) { fields.push('disappearing_messages_start_at = ?'); params.push(updates.disappearingMessagesStartAt ?? 0); }
    if (updates.unreadCount !== undefined) { fields.push('unread_count = ?'); params.push(updates.unreadCount); }
    if (updates.lastMessageId !== undefined) { fields.push('last_message_id = ?'); params.push(updates.lastMessageId ?? ''); }
    if (updates.lastMessageAt !== undefined) { fields.push('last_message_at = ?'); params.push(updates.lastMessageAt ?? 0); }
    if (updates.lastMessageSenderId !== undefined) { fields.push('last_message_sender_id = ?'); params.push(updates.lastMessageSenderId ?? ''); }
    if (updates.syncStatus !== undefined) { fields.push('sync_status = ?'); params.push(updates.syncStatus); }
    if (updates.adminDeviceIds !== undefined) { fields.push('admin_device_ids = ?'); params.push(JSON.stringify(updates.adminDeviceIds)); }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    await db.runAsync(
      `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async updateLastMessage(conversationId: string, messageId: string, senderDeviceId: string, timestamp: number): Promise<void> {
    const db = await getDatabase();

    // Get current user's primary device to determine if unread should increment
    const primaryDevice = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM devices WHERE is_primary = 1 LIMIT 1`
    );

    const isFromSelf = primaryDevice?.id === senderDeviceId;

    await db.runAsync(
      `UPDATE conversations SET
        last_message_id = ?,
        last_message_at = ?,
        last_message_sender_id = ?,
        unread_count = unread_count + ?,
        updated_at = ?
      WHERE id = ?`,
      messageId,
      timestamp,
      senderDeviceId,
      isFromSelf ? 0 : 1,
      timestamp,
      conversationId
    );
  }

  async incrementUnread(conversationId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE conversations SET unread_count = unread_count + 1, updated_at = ? WHERE id = ?`,
      Date.now(),
      conversationId
    );
  }

  async markAsRead(conversationId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE conversations SET unread_count = 0, updated_at = ? WHERE id = ?`,
      Date.now(),
      conversationId
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE conversations SET deleted_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      Date.now(),
      id
    );
  }

  async getDirectConversation(userId: string, otherAccountId: string): Promise<Conversation | null> {
    const db = await getDatabase();

    // Find direct conversation with this contact
    return db.getFirstAsync<Conversation>(
      `SELECT c.* FROM conversations c
       JOIN conversation_members cm ON c.id = cm.conversation_id
       WHERE c.user_id = ? 
       AND c.type = 'DIRECT'
       AND c.deleted_at IS NULL
       AND cm.account_id = ?
       AND cm.is_active = 1`,
      userId,
      otherAccountId
    );
  }
}

function generateId(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestampHex}-${randomHex}`;
}

export const conversationsRepository = ConversationsRepository.getInstance();