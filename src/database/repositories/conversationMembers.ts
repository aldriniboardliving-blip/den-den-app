// src/database/repositories/conversationMembers.ts
// Conversation members repository

import { getDatabase } from '../connection';
import { ConversationMember } from '../../types';

export class ConversationMembersRepository {
  private static instance: ConversationMembersRepository;

  static getInstance(): ConversationMembersRepository {
    if (!ConversationMembersRepository.instance) {
      ConversationMembersRepository.instance = new ConversationMembersRepository();
    }
    return ConversationMembersRepository.instance;
  }

  async getByConversation(conversationId: string): Promise<ConversationMember[]> {
    const db = await getDatabase();
    return db.getAllAsync<ConversationMember>(
      `SELECT * FROM conversation_members 
       WHERE conversation_id = ? AND is_active = 1
       ORDER BY joined_at ASC`,
      conversationId
    );
  }

  async getByConversationAndAccount(conversationId: string, accountId: string): Promise<ConversationMember | null> {
    const db = await getDatabase();
    return db.getFirstAsync<ConversationMember>(
      `SELECT * FROM conversation_members 
       WHERE conversation_id = ? AND account_id = ? AND is_active = 1`,
      conversationId,
      accountId
    );
  }

  async getById(id: string): Promise<ConversationMember | null> {
    const db = await getDatabase();
    return db.getFirstAsync<ConversationMember>(
      'SELECT * FROM conversation_members WHERE id = ? AND is_active = 1',
      id
    );
  }

  async create(member: Omit<ConversationMember, 'id'> & { id?: string; joinedAt?: number }): Promise<ConversationMember> {
    const db = await getDatabase();
    const id = member.id || generateId();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO conversation_members (
        id, conversation_id, device_id, account_id, role,
        sender_key_public, sender_key_private, joined_at, is_active,
        sync_status, last_synced_at, server_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      member.conversationId,
      member.deviceId,
      member.accountId,
      member.role,
      member.senderKeyPublic ?? '',
      member.senderKeyPrivate ?? '',
      member.joinedAt ?? Date.now(),
      member.isActive ? 1 : 0,
      member.syncStatus ?? 'SYNCED',
      member.lastSyncedAt ?? 0,
      member.serverVersion ?? 0
    );

    return this.getById(id) as Promise<ConversationMember>;
  }

  async update(id: string, updates: Partial<ConversationMember>): Promise<void> {
    const db = await getDatabase();

    const fields: string[] = [];
    const params: (string | number | boolean | null)[] = [];

    if (updates.role !== undefined) { fields.push('role = ?'); params.push(updates.role); }
    if (updates.senderKeyPublic !== undefined) { fields.push('sender_key_public = ?'); params.push(updates.senderKeyPublic ?? null); }
    if (updates.senderKeyPrivate !== undefined) { fields.push('sender_key_private = ?'); params.push(updates.senderKeyPrivate ?? null); }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); params.push(updates.isActive ? 1 : 0); }
    if (updates.leftAt !== undefined) { fields.push('left_at = ?'); params.push(updates.leftAt ?? null); }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    await db.runAsync(
      `UPDATE conversation_members SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async addMember(
    conversationId: string,
    deviceId: string,
    accountId: string,
    role: 'ADMIN' | 'MEMBER' = 'MEMBER',
    senderKeyPublic?: string,
    senderKeyPrivate?: string
  ): Promise<ConversationMember> {
    const existing = await this.getByConversationAndAccount(conversationId, accountId);
    if (existing) {
      // Reactivate if previously left
      if (!existing.isActive) {
        await this.update(existing.id, { isActive: true, leftAt: null });
        return this.getById(existing.id) as Promise<ConversationMember>;
      }
      return existing;
    }

    return this.create({
      conversationId,
      deviceId,
      accountId,
      role,
      senderKeyPublic: senderKeyPublic ?? null,
      senderKeyPrivate: senderKeyPrivate ?? null,
      joinedAt: Date.now(),
      isActive: true,
      syncStatus: 'SYNCED',
      lastSyncedAt: Date.now(),
      serverVersion: 1,
      leftAt: null,
    });
  }

  async removeMember(conversationId: string, accountId: string): Promise<void> {
    const member = await this.getByConversationAndAccount(conversationId, accountId);
    if (member) {
      await this.update(member.id, { isActive: false, leftAt: Date.now() });
    }
  }

  async updateRole(conversationId: string, accountId: string, role: 'ADMIN' | 'MEMBER'): Promise<void> {
    const member = await this.getByConversationAndAccount(conversationId, accountId);
    if (member) {
      await this.update(member.id, { role });
    }
  }

  async getAdmins(conversationId: string): Promise<ConversationMember[]> {
    const db = await getDatabase();
    return db.getAllAsync<ConversationMember>(
      `SELECT * FROM conversation_members 
       WHERE conversation_id = ? AND role = 'ADMIN' AND is_active = 1`,
      conversationId
    );
  }

  async getMemberCount(conversationId: string): Promise<number> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM conversation_members 
       WHERE conversation_id = ? AND is_active = 1`,
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

export const conversationMembersRepository = ConversationMembersRepository.getInstance();