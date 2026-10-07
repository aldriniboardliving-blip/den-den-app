// src/database/repositories/contacts.ts
// Contacts repository

import { getDatabase } from '../connection';
import { Contact } from '../../types';

export class ContactsRepository {
  private static instance: ContactsRepository;

  static getInstance(): ContactsRepository {
    if (!ContactsRepository.instance) {
      ContactsRepository.instance = new ContactsRepository();
    }
    return ContactsRepository.instance;
  }

  async getAll(userId: string): Promise<Contact[]> {
    const db = await getDatabase();
    return db.getAllAsync<Contact>(
      `SELECT * FROM contacts 
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY display_name ASC`,
      userId
    );
  }

  async getById(id: string): Promise<Contact | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Contact>('SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL', id);
  }

  async getByAccountId(userId: string, accountId: string): Promise<Contact | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Contact>(
      `SELECT * FROM contacts WHERE user_id = ? AND contact_account_id = ? AND deleted_at IS NULL`,
      userId,
      accountId
    );
  }

  async create(contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Contact> {
    const db = await getDatabase();
    const id = contact.id || generateId();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO contacts (
        id, user_id, contact_account_id, contact_device_id,
        display_name, avatar_url, identity_key_public,
        signed_prekey_public, signed_prekey_signature,
        verification_status, sync_status, last_synced_at, server_version,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      contact.userId,
      contact.contactAccountId,
      contact.contactDeviceId ?? '',
      contact.displayName ?? '',
      contact.avatarUrl ?? '',
      contact.identityKeyPublic,
      contact.signedPrekeyPublic ?? '',
      contact.signedPrekeySignature ?? '',
      contact.verificationStatus,
      contact.syncStatus,
      contact.lastSyncedAt ?? 0,
      contact.serverVersion,
      now,
      now
    );

    return this.getById(id) as Promise<Contact>;
  }

  async update(id: string, updates: Partial<Contact>): Promise<void> {
    const db = await getDatabase();

    const fields: string[] = [];
    const params: (string | number | boolean)[] = [];

    if (updates.displayName !== undefined) { fields.push('display_name = ?'); params.push(updates.displayName ?? ''); }
    if (updates.avatarUrl !== undefined) { fields.push('avatar_url = ?'); params.push(updates.avatarUrl ?? ''); }
    if (updates.contactDeviceId !== undefined) { fields.push('contact_device_id = ?'); params.push(updates.contactDeviceId ?? ''); }
    if (updates.identityKeyPublic !== undefined) { fields.push('identity_key_public = ?'); params.push(updates.identityKeyPublic); }
    if (updates.signedPrekeyPublic !== undefined) { fields.push('signed_prekey_public = ?'); params.push(updates.signedPrekeyPublic ?? ''); }
    if (updates.signedPrekeySignature !== undefined) { fields.push('signed_prekey_signature = ?'); params.push(updates.signedPrekeySignature ?? ''); }
    if (updates.verificationStatus !== undefined) { fields.push('verification_status = ?'); params.push(updates.verificationStatus); }
    if (updates.verifiedAt !== undefined) { fields.push('verified_at = ?'); params.push(updates.verifiedAt ?? 0); }
    if (updates.safetyNumber !== undefined) { fields.push('safety_number = ?'); params.push(updates.safetyNumber ?? ''); }
    if (updates.syncStatus !== undefined) { fields.push('sync_status = ?'); params.push(updates.syncStatus); }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    await db.runAsync(
      `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async verify(id: string, safetyNumber: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE contacts SET 
        verification_status = 'VERIFIED',
        verified_at = ?,
        safety_number = ?,
        updated_at = ?
      WHERE id = ?`,
      Date.now(),
      safetyNumber,
      Date.now(),
      id
    );
  }

  async block(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE contacts SET 
        verification_status = 'BLOCKED',
        updated_at = ?
      WHERE id = ?`,
      Date.now(),
      id
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE contacts SET deleted_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      Date.now(),
      id
    );
  }

  async search(userId: string, query: string): Promise<Contact[]> {
    const db = await getDatabase();
    return db.getAllAsync<Contact>(
      `SELECT * FROM contacts 
       WHERE user_id = ? AND deleted_at IS NULL
       AND (display_name LIKE ? OR contact_account_id LIKE ?)
       ORDER BY display_name ASC
       LIMIT 20`,
      userId,
      `%${query}%`,
      `%${query}%`
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

export const contactsRepository = ContactsRepository.getInstance();