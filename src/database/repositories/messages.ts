// src/database/repositories/messages.ts
// Messages repository

import { getDatabase } from '../connection';
import { Message, MessageStatus, SyncStatus } from '../../types';

export class MessagesRepository {
  private static instance: MessagesRepository;

  static getInstance(): MessagesRepository {
    if (!MessagesRepository.instance) {
      MessagesRepository.instance = new MessagesRepository();
    }
    return MessagesRepository.instance;
  }

  async getByConversation(
    conversationId: string,
    limit: number = 50,
    beforeId?: string
  ): Promise<Message[]> {
    const db = await getDatabase();

    let sql = `
      SELECT * FROM messages
      WHERE conversation_id = ? AND deleted_at IS NULL
    `;
    const params: (string | number)[] = [conversationId];

    if (beforeId) {
      sql += ` AND id < ?`;
      params.push(beforeId);
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const result = await db.getAllAsync<Message>(sql, params);
    return result;
  }

  async getAllByUser(userId: string, limit: number = 10000): Promise<Message[]> {
    const db = await getDatabase();
    return db.getAllAsync<Message>(
      `SELECT m.* FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE c.user_id = ? AND m.deleted_at IS NULL
       ORDER BY m.created_at DESC
       LIMIT ?`,
      userId,
      limit
    );
  }

  async getById(id: string): Promise<Message | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Message>('SELECT * FROM messages WHERE id = ?', id);
  }

  async getPendingSync(limit: number = 100): Promise<Message[]> {
    const db = await getDatabase();
    return db.getAllAsync<Message>(
      `SELECT * FROM messages 
       WHERE sync_status != 'SYNCED' AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`,
      limit
    );
  }

  async getFailedSends(limit: number = 50): Promise<Message[]> {
    const db = await getDatabase();
    return db.getAllAsync<Message>(
      `SELECT * FROM messages 
       WHERE status = 'FAILED' AND deleted_at IS NULL
       ORDER BY last_sync_attempt_at ASC
       LIMIT ?`,
      limit
    );
  }

  async create(message: Omit<Message, 'id'> & { id?: string }): Promise<Message> {
    const db = await getDatabase();
    const id = message.id || generateId();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO messages (
        id, conversation_id, sender_device_id, sender_account_id,
        content, content_encrypted, content_type, encryption_algorithm,
        nonce, sender_key_id, status, created_at, sync_status, sync_attempt_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      message.conversationId,
      message.senderDeviceId,
      message.senderAccountId,
      message.content,
      message.contentEncrypted,
      message.contentType,
      message.encryptionAlgorithm,
      message.nonce,
      message.senderKeyId,
      message.status,
      now,
      message.syncStatus,
      message.syncAttemptCount || 0
    );

    const created = await this.getById(id);
    if (!created) throw new Error('Failed to create message');
    return created;
  }

  async updateStatus(id: string, status: MessageStatus, serverMessageId?: string): Promise<void> {
    const db = await getDatabase();
    const updates: string[] = ['status = ?'];
    const params: (string | number)[] = [status];

    if (serverMessageId) {
      updates.push('server_message_id = ?');
      params.push(serverMessageId);
    }

    const now = Date.now();
    if (status === 'RELAYED') {
      updates.push('sent_at = ?');
      params.push(now);
    } else if (status === 'DELIVERED') {
      updates.push('delivered_at = ?');
      params.push(now);
    } else if (status === 'READ') {
      updates.push('read_at = ?');
      params.push(now);
    }

    updates.push('updated_at = ?');
    params.push(now);

    params.push(id);

    await db.runAsync(
      `UPDATE messages SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  async updateSyncStatus(id: string, syncStatus: SyncStatus, attemptCount?: number): Promise<void> {
    const db = await getDatabase();

    if (attemptCount !== undefined) {
      await db.runAsync(
        `UPDATE messages SET sync_status = ?, sync_attempt_count = ?, last_sync_attempt_at = ? WHERE id = ?`,
        syncStatus,
        attemptCount,
        Date.now(),
        id
      );
    } else {
      await db.runAsync(
        `UPDATE messages SET sync_status = ? WHERE id = ?`,
        syncStatus,
        id
      );
    }
  }

  async markSynced(id: string, serverMessageId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE messages SET sync_status = 'SYNCED', server_message_id = ?, last_sync_attempt_at = ? WHERE id = ?`,
      serverMessageId,
      Date.now(),
      id
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE messages SET deleted_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      Date.now(),
      id
    );
  }

  async getUnreadCount(conversationId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM messages 
       WHERE conversation_id = ? AND status != 'READ' AND sender_device_id != (
         SELECT id FROM devices WHERE is_primary = 1 LIMIT 1
       ) AND deleted_at IS NULL`,
      conversationId
    );
    return result?.count || 0;
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

export const messagesRepository = MessagesRepository.getInstance();