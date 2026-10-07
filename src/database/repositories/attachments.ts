// src/database/repositories/attachments.ts
// Attachments repository

import { getDatabase } from '../connection';
import { Attachment } from '../../types';

export class AttachmentsRepository {
  private static instance: AttachmentsRepository;

  static getInstance(): AttachmentsRepository {
    if (!AttachmentsRepository.instance) {
      AttachmentsRepository.instance = new AttachmentsRepository();
    }
    return AttachmentsRepository.instance;
  }

  async getByMessage(messageId: string): Promise<Attachment[]> {
    const db = await getDatabase();
    return db.getAllAsync<Attachment>(
      `SELECT * FROM attachments WHERE message_id = ? AND deleted_at IS NULL`,
      messageId
    );
  }

  async getById(id: string): Promise<Attachment | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Attachment>(
      `SELECT * FROM attachments WHERE id = ? AND deleted_at IS NULL`,
      id
    );
  }

  async create(attachment: Omit<Attachment, 'id' | 'createdAt'> & { id?: string }): Promise<Attachment> {
    const db = await getDatabase();
    const id = attachment.id || generateId();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO attachments (
        id, message_id, filename, mime_type, size_bytes,
        local_path, local_thumbnail_path, encryption_key,
        encryption_algorithm, nonce, remote_url, remote_key,
        upload_status, download_status, width, height, duration_ms,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      attachment.messageId ?? '',
      attachment.filename,
      attachment.mimeType,
      attachment.sizeBytes,
      attachment.localPath ?? '',
      attachment.localThumbnailPath ?? '',
      attachment.encryptionKey,
      attachment.encryptionAlgorithm,
      attachment.nonce,
      attachment.remoteUrl ?? '',
      attachment.remoteKey ?? '',
      attachment.uploadStatus,
      attachment.downloadStatus,
      attachment.width ?? 0,
      attachment.height ?? 0,
      attachment.durationMs ?? 0,
      now
    );

    return this.getById(id) as Promise<Attachment>;
  }

  async update(id: string, updates: Partial<Attachment>): Promise<void> {
    const db = await getDatabase();

    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (updates.messageId !== undefined) { fields.push('message_id = ?'); params.push(updates.messageId ?? ''); }
    if (updates.localPath !== undefined) { fields.push('local_path = ?'); params.push(updates.localPath ?? ''); }
    if (updates.localThumbnailPath !== undefined) { fields.push('local_thumbnail_path = ?'); params.push(updates.localThumbnailPath ?? ''); }
    if (updates.remoteUrl !== undefined) { fields.push('remote_url = ?'); params.push(updates.remoteUrl ?? ''); }
    if (updates.remoteKey !== undefined) { fields.push('remote_key = ?'); params.push(updates.remoteKey ?? ''); }
    if (updates.uploadStatus !== undefined) { fields.push('upload_status = ?'); params.push(updates.uploadStatus); }
    if (updates.downloadStatus !== undefined) { fields.push('download_status = ?'); params.push(updates.downloadStatus); }
    if (updates.uploadedAt !== undefined) { fields.push('uploaded_at = ?'); params.push(updates.uploadedAt ?? 0); }
    if (updates.downloadedAt !== undefined) { fields.push('downloaded_at = ?'); params.push(updates.downloadedAt ?? 0); }

    if (fields.length === 0) return;

    params.push(id);

    await db.runAsync(
      `UPDATE attachments SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async getPendingUpload(limit: number = 10): Promise<Attachment[]> {
    const db = await getDatabase();
    return db.getAllAsync<Attachment>(
      `SELECT * FROM attachments 
       WHERE upload_status IN ('PENDING', 'UPLOADING') AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`,
      limit
    );
  }

  async getPendingDownload(limit: number = 10): Promise<Attachment[]> {
    const db = await getDatabase();
    return db.getAllAsync<Attachment>(
      `SELECT * FROM attachments 
       WHERE download_status = 'DOWNLOADING' AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`,
      limit
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE attachments SET deleted_at = ? WHERE id = ?`,
      Date.now(),
      id
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

export const attachmentsRepository = AttachmentsRepository.getInstance();