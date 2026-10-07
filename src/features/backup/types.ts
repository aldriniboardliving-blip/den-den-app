// src/features/backup/types.ts
import { Backup } from '@/types';

export interface BackupWithStatus extends Backup {
  isVerified: boolean;
  canRestore: boolean;
  sizeFormatted: string;
  createdAtFormatted: string;
}

export interface CreateBackupParams {
  password: string;
  confirmPassword: string;
  includeMedia?: boolean;
}

export interface RestoreBackupParams {
  password: string;
  fileUri: string;
}

export interface BackupProgress {
  stage: 'idle' | 'dumping' | 'encrypting' | 'saving' | 'uploading' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface BackupExportResult {
  fileUri: string;
  fileName: string;
  size: number;
}

export interface BackupImportResult {
  success: boolean;
  restoredConversations: number;
  restoredMessages: number;
  restoredContacts: number;
  error?: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'daily' | 'weekly' | 'monthly';
  autoBackupTime: string; // HH:mm format
  backupToCloud: boolean;
  cloudProvider?: 'google_drive' | 'icloud' | 'onedrive';
  lastBackupAt?: number;
  nextBackupAt?: number;
}

export interface BackupListScreenProps {
  onBackupSelected?: (backup: BackupWithStatus) => void;
}

export interface CreateBackupScreenProps {
  onSuccess: (backup: BackupWithStatus) => void;
  onCancel: () => void;
}

export interface RestoreBackupScreenProps {
  onSuccess: () => void;
  onCancel: () => void;
}