// src/features/backup/hooks/useBackup.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { backupsRepository } from '@/database/repositories/backups';
import { conversationsRepository } from '@/database/repositories/conversations';
import { messagesRepository } from '@/database/repositories/messages';
import { contactsRepository } from '@/database/repositories/contacts';
import { devicesRepository } from '@/database/repositories/devices';
import { settingsRepository } from '@/database/repositories/settings';
import { api } from '@/api/client';
import { BackupEncryption } from '@/crypto/backup';
import { generateId } from '@/utils/id';
import { BackupWithStatus, CreateBackupParams, RestoreBackupParams, BackupProgress, BackupSettings, BackupExportResult, BackupImportResult } from '../types';
import { Backup } from '@/types';

const SETTINGS_KEY = 'backup_settings';

const defaultSettings: BackupSettings = {
  autoBackupEnabled: false,
  autoBackupFrequency: 'weekly',
  autoBackupTime: '02:00',
  backupToCloud: false,
};

interface EnrichedBackup extends BackupWithStatus {
  isVerified: boolean;
  canRestore: boolean;
  sizeFormatted: string;
  createdAtFormatted: string;
}

export function useBackups() {
  const { user } = useAuthStore();
  const [backups, setBackups] = useState<EnrichedBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<BackupProgress>({ stage: 'idle', progress: 0, message: '' });

  const loadBackups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userBackups = await backupsRepository.getAll(user.id);
      const enriched: EnrichedBackup[] = userBackups.map(b => ({
        ...b,
        isVerified: b.verifiedAt !== null && b.verifiedAt !== 0,
        canRestore: b.status === 'CREATED' && b.verificationHash !== null,
        sizeFormatted: formatBytes(b.fileSizeBytes),
        createdAtFormatted: formatDate(b.createdAt),
      }));
      setBackups(enriched);
    } catch (error) {
      console.error('Failed to load backups:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const createBackup = useCallback(async (params: CreateBackupParams): Promise<EnrichedBackup | null> => {
    if (!user || params.password !== params.confirmPassword) return null;

    setProgress({ stage: 'dumping', progress: 10, message: 'Creating database dump...' });

    try {
      const backupId = generateId();
      const now = Date.now();
      const fileName = `den-den-backup-${new Date(now).toISOString().split('T')[0]}-${backupId.slice(0, 8)}.backup`;

      // Create initial backup record
      const initialBackup: Backup = {
        id: backupId,
        userId: user.id,
        deviceId: 'local-device',
        filePath: fileName,
        fileSizeBytes: 0,
        encryptionAlgorithm: 'AES-256-GCM',
        kdfAlgorithm: 'ARGON2ID',
        kdfParams: JSON.stringify({ mem: 65536, iter: 3, parallel: 4 }),
        schemaVersion: 1,
        tablesIncluded: 'conversations,messages,contacts,devices',
        recordCounts: '{}',
        dateRangeStart: null,
        dateRangeEnd: null,
        status: 'CREATED',
        verificationHash: '',
        createdAt: now,
        verifiedAt: null,
        exportedAt: null,
        importedAt: null,
      };

      await backupsRepository.create(initialBackup);
      setBackups(prev => [{ ...initialBackup, isVerified: false, canRestore: false, sizeFormatted: '0 B', createdAtFormatted: formatDate(now) }, ...prev]);

      setProgress({ stage: 'dumping', progress: 30, message: 'Exporting database...' });

      // Create SQL dump
      const sqlDump = await createSQLDump(user.id);

      setProgress({ stage: 'encrypting', progress: 60, message: 'Encrypting backup...' });

      // Encrypt backup
      const encryptedData = await BackupEncryption.encrypt(sqlDump, params.password);

      setProgress({ stage: 'saving', progress: 80, message: 'Saving backup file...' });

      // Save to file system
      const fileUri = await saveBackupFile(fileName, encryptedData);

      // Update backup record
      const updatedBackup: Backup = {
        ...initialBackup,
        fileSizeBytes: encryptedData.length,
        status: 'CREATED',
        verificationHash: await computeVerificationHash(encryptedData),
      };

      await backupsRepository.update(backupId, updatedBackup);

      const enriched: EnrichedBackup = {
        ...updatedBackup,
        isVerified: false,
        canRestore: true,
        sizeFormatted: formatBytes(encryptedData.length),
        createdAtFormatted: formatDate(now),
      };

      setBackups(prev => prev.map(b => b.id === backupId ? enriched : b));
      setProgress({ stage: 'complete', progress: 100, message: 'Backup created successfully!' });

      return enriched;
    } catch (error) {
      console.error('Failed to create backup:', error);
      setProgress({ stage: 'error', progress: 0, message: 'Backup failed', error: String(error) });
      return null;
    }
  }, [user]);

  const restoreBackup = useCallback(async (params: RestoreBackupParams): Promise<BackupImportResult> => {
    if (!user) return { success: false, restoredConversations: 0, restoredMessages: 0, restoredContacts: 0, error: 'Not authenticated' };

    setProgress({ stage: 'dumping', progress: 10, message: 'Reading backup file...' });

    try {
      // Read file
      const fileData = await readBackupFile(params.fileUri);

      setProgress({ stage: 'encrypting', progress: 30, message: 'Decrypting backup...' });

      // Decrypt
      const { sqlDump } = await BackupEncryption.decrypt(fileData, params.password);

      setProgress({ stage: 'saving', progress: 60, message: 'Restoring database...' });

      // Execute SQL dump
      const result = await executeSQLDump(sqlDump);

      setProgress({ stage: 'complete', progress: 100, message: 'Restore complete!' });

      return {
        success: true,
        restoredConversations: result.conversations,
        restoredMessages: result.messages,
        restoredContacts: result.contacts,
      };
    } catch (error) {
      console.error('Failed to restore backup:', error);
      setProgress({ stage: 'error', progress: 0, message: 'Restore failed', error: String(error) });
      return { success: false, restoredConversations: 0, restoredMessages: 0, restoredContacts: 0, error: String(error) };
    }
  }, [user]);

  const deleteBackup = useCallback(async (backupId: string) => {
    try {
      await backupsRepository.delete(backupId);
      setBackups(prev => prev.filter(b => b.id !== backupId));
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  }, []);

  const verifyBackup = useCallback(async (backupId: string) => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) return false;

    try {
      const fileData = await readBackupFile(`file://${backup.filePath}`);
      const hash = await computeVerificationHash(fileData);
      
      if (hash === backup.verificationHash) {
        await backupsRepository.update(backupId, { verifiedAt: Date.now() });
        setBackups(prev => prev.map(b => b.id === backupId ? { ...b, isVerified: true, verifiedAt: Date.now() } : b));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to verify backup:', error);
      return false;
    }
  }, [backups]);

  return {
    backups,
    loading,
    progress,
    createBackup,
    restoreBackup,
    deleteBackup,
    verifyBackup,
    refresh: loadBackups,
  };
}

export function useBackupSettings() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<BackupSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const stored = await settingsRepository.get(user.id, SETTINGS_KEY);
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load backup settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (newSettings: Partial<BackupSettings>) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    try {
      await settingsRepository.set(user.id, SETTINGS_KEY, JSON.stringify(updated));
      setSettings(updated);
    } catch (error) {
      console.error('Failed to save backup settings:', error);
    }
  }, [user, settings]);

  return { settings, loading, updateSettings };
}

// Helper functions
async function createSQLDump(userId: string): Promise<string> {
  const tables = [
    { name: 'conversations', repo: conversationsRepository, method: 'getAll' },
    { name: 'messages', repo: messagesRepository, method: 'getAllByUser' },
    { name: 'contacts', repo: contactsRepository, method: 'getAll' },
    { name: 'devices', repo: devicesRepository, method: 'getAll' },
  ];

  let sql = `-- Den Den Backup\n-- Created: ${new Date().toISOString()}\n-- User: ${userId}\n\n`;

  for (const table of tables) {
    const rows = await (table.repo as any)[table.method](userId);
    if (rows.length === 0) continue;

    sql += `-- Table: ${table.name}\n`;
    const columns = Object.keys(rows[0]).filter(k => k !== 'deletedAt');
    
    for (const row of rows) {
      const values = columns.map(col => {
        const val = (row as Record<string, unknown>)[col];
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'number') return val.toString();
        if (typeof val === 'boolean') return val ? '1' : '0';
        if (val instanceof Uint8Array) return `'${Buffer.from(val).toString('base64')}'`;
        return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
      }).join(', ');
      sql += `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${values});\n`;
    }
    sql += '\n';
  }

  return sql;
}

async function executeSQLDump(sqlDump: string): Promise<{ conversations: number; messages: number; contacts: number }> {
  const db = await getDatabase();
  
  // Clear existing data (except settings and auth)
  await db.execAsync(`DELETE FROM conversations WHERE user_id IN (SELECT id FROM users WHERE id IS NOT NULL);`);
  await db.execAsync(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id IN (SELECT id FROM users WHERE id IS NOT NULL));`);
  await db.execAsync(`DELETE FROM contacts WHERE user_id IN (SELECT id FROM users WHERE id IS NOT NULL);`);
  await db.execAsync(`DELETE FROM devices WHERE user_id IN (SELECT id FROM users WHERE id IS NOT NULL);`);

  const statements = sqlDump.split(';').filter(s => s.trim());
  let conversations = 0, messages = 0, contacts = 0;

  for (const stmt of statements) {
    if (!stmt.trim() || stmt.trim().startsWith('--')) continue;
    try {
      await db.execAsync(stmt + ';');
      if (stmt.includes('INSERT INTO conversations')) conversations++;
      if (stmt.includes('INSERT INTO messages')) messages++;
      if (stmt.includes('INSERT INTO contacts')) contacts++;
    } catch (e) {
      console.warn('Failed to execute statement:', stmt, e);
    }
  }

  return { conversations, messages, contacts };
}

async function computeVerificationHash(data: Uint8Array): Promise<string> {
  const { Verification } = await import('@/crypto/verification');
  const result = await Verification.computeSafetyNumber(data, data);
  return result.number;
}

async function saveBackupFile(fileName: string, data: Uint8Array): Promise<string> {
  // In a real app, this would use expo-file-system to save to DocumentDirectory
  // For now, we'll store as base64 in a mock way
  const base64 = Buffer.from(data).toString('base64');
  return `backup://${fileName}?data=${base64}`;
}

async function readBackupFile(fileUri: string): Promise<Uint8Array> {
  // In a real app, this would use expo-file-system to read from DocumentDirectory
  // For now, extract from mock URI
  if (fileUri.startsWith('backup://')) {
    const base64 = fileUri.split('data=')[1];
    if (!base64) throw new Error('Invalid backup file URI');
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }
  throw new Error('Invalid backup file URI');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Need to import getDatabase
import { getDatabase } from '@/database/connection';