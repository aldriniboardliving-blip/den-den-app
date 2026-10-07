// src/database/repositories/settings.ts
// Settings repository

import { getDatabase } from '../connection';

export interface Setting {
  id: string;
  userId: string;
  key: string;
  value: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  lastSyncedAt: number | null;
  serverVersion: number;
}

export class SettingsRepository {
  private static instance: SettingsRepository;

  static getInstance(): SettingsRepository {
    if (!SettingsRepository.instance) {
      SettingsRepository.instance = new SettingsRepository();
    }
    return SettingsRepository.instance;
  }

  async getAll(userId: string): Promise<Record<string, string>> {
    const db = await getDatabase();
    const settings = await db.getAllAsync<Setting>(
      `SELECT key, value FROM settings WHERE user_id = ?`,
      userId
    );

    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async get(userId: string, key: string): Promise<string | null> {
    const db = await getDatabase();
    const setting = await db.getFirstAsync<Setting>(
      `SELECT value FROM settings WHERE user_id = ? AND key = ?`,
      userId,
      key
    );
    return setting?.value || null;
  }

  async getTyped<T>(userId: string, key: string, defaultValue: T): Promise<T> {
    const value = await this.get(userId, key);
    if (value === null) return defaultValue;

    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  async set(userId: string, key: string, value: unknown): Promise<void> {
    const db = await getDatabase();
    const id = generateId();
    const now = Date.now();
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    await db.runAsync(
      `INSERT INTO settings (id, user_id, key, value, sync_status, last_synced_at, server_version)
       VALUES (?, ?, ?, ?, 'PENDING', ?, 0)
       ON CONFLICT(user_id, key) DO UPDATE SET
        value = excluded.value,
        sync_status = 'PENDING',
        last_synced_at = ?,
        server_version = server_version + 1`,
      id,
      userId,
      key,
      stringValue,
      now,
      now
    );
  }

  async delete(userId: string, key: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM settings WHERE user_id = ? AND key = ?`,
      userId,
      key
    );
  }

  async getAllForSync(userId: string): Promise<Setting[]> {
    const db = await getDatabase();
    return db.getAllAsync<Setting>(
      `SELECT * FROM settings WHERE user_id = ? AND sync_status = 'PENDING'`,
      userId
    );
  }

  async markSynced(userId: string, key: string, serverVersion: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE settings SET sync_status = 'SYNCED', last_synced_at = ?, server_version = ? 
       WHERE user_id = ? AND key = ?`,
      Date.now(),
      serverVersion,
      userId,
      key
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

// Default settings keys
export const SETTING_KEYS = {
  NOTIFICATIONS_ENABLED: 'notifications.enabled',
  NOTIFICATIONS_SOUND: 'notifications.sound',
  NOTIFICATIONS_VIBRATE: 'notifications.vibrate',
  CHAT_ENTER_TO_SEND: 'chat.enter_to_send',
  CHAT_MEDIA_AUTO_DOWNLOAD: 'chat.media_auto_download',
  CHAT_BACKUP_AUTO_ENABLED: 'chat.backup.auto_enabled',
  CHAT_BACKUP_FREQUENCY: 'chat.backup.frequency',
  SECURITY_LOCK_APP: 'security.lock_app',
  SECURITY_LOCK_TIMEOUT: 'security.lock_timeout',
  APPEARANCE_THEME: 'appearance.theme',
  DATA_EXPORT_PATH: 'data.export_path',
} as const;

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  [SETTING_KEYS.NOTIFICATIONS_ENABLED]: true,
  [SETTING_KEYS.NOTIFICATIONS_SOUND]: 'default',
  [SETTING_KEYS.NOTIFICATIONS_VIBRATE]: true,
  [SETTING_KEYS.CHAT_ENTER_TO_SEND]: false,
  [SETTING_KEYS.CHAT_MEDIA_AUTO_DOWNLOAD]: 'wifi',
  [SETTING_KEYS.CHAT_BACKUP_AUTO_ENABLED]: false,
  [SETTING_KEYS.CHAT_BACKUP_FREQUENCY]: 'daily',
  [SETTING_KEYS.SECURITY_LOCK_APP]: false,
  [SETTING_KEYS.SECURITY_LOCK_TIMEOUT]: 300,
  [SETTING_KEYS.APPEARANCE_THEME]: 'system',
  [SETTING_KEYS.DATA_EXPORT_PATH]: null,
};

export const settingsRepository = SettingsRepository.getInstance();