// src/database/repositories/backups.ts
// Backups repository

import { getDatabase } from '../connection';
import { Backup } from '../../types';

export class BackupsRepository {
  private static instance: BackupsRepository;

  static getInstance(): BackupsRepository {
    if (!BackupsRepository.instance) {
      BackupsRepository.instance = new BackupsRepository();
    }
    return BackupsRepository.instance;
  }

  async getAll(userId: string): Promise<Backup[]> {
    const db = await getDatabase();
    return db.getAllAsync<Backup>(
      `SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC`,
      userId
    );
  }

  async getById(id: string): Promise<Backup | null> {
    const db = await getDatabase();
    return db.getFirstAsync<Backup>(
      `SELECT * FROM backups WHERE id = ?`,
      id
    );
  }

  async create(backup: Omit<Backup, 'id' | 'createdAt'> & { id?: string }): Promise<Backup> {
    const db = await getDatabase();
    const id = backup.id || generateId();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO backups (
        id, user_id, device_id, file_path, file_size_bytes,
        encryption_algorithm, kdf_algorithm, kdf_params,
        schema_version, tables_included, record_counts,
        date_range_start, date_range_end, status,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      backup.userId,
      backup.deviceId,
      backup.filePath,
      backup.fileSizeBytes,
      backup.encryptionAlgorithm,
      backup.kdfAlgorithm,
      backup.kdfParams,
      backup.schemaVersion,
      backup.tablesIncluded,
      backup.recordCounts,
      backup.dateRangeStart ?? 0,
      backup.dateRangeEnd ?? 0,
      backup.status,
      now
    );

    return this.getById(id) as Promise<Backup>;
  }

  async update(id: string, updates: Partial<Backup>): Promise<void> {
    const db = await getDatabase();

    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }
    if (updates.verificationHash !== undefined) { fields.push('verification_hash = ?'); params.push(updates.verificationHash ?? ''); }
    if (updates.verifiedAt !== undefined) { fields.push('verified_at = ?'); params.push(updates.verifiedAt ?? 0); }
    if (updates.exportedAt !== undefined) { fields.push('exported_at = ?'); params.push(updates.exportedAt ?? 0); }
    if (updates.importedAt !== undefined) { fields.push('imported_at = ?'); params.push(updates.importedAt ?? 0); }

    if (fields.length === 0) return;

    params.push(id);

    await db.runAsync(
      `UPDATE backups SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM backups WHERE id = ?`, id);
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

export const backupsRepository = BackupsRepository.getInstance();