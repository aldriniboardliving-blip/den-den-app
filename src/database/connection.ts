// src/database/connection.ts
// Expo SQLite database connection and initialization

import { SQLiteDatabase, openDatabaseAsync, SQLiteOpenOptions } from 'expo-sqlite';

const DATABASE_NAME = 'denden.db';
const CURRENT_SCHEMA_VERSION = 4;

let db: SQLiteDatabase | null = null;

const MIGRATIONS: Array<{ version: number; name: string; sql: string }> = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      -- Users table
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL UNIQUE,
        display_name TEXT,
        avatar_url TEXT,
        auth_token TEXT,
        refresh_token TEXT,
        token_expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        last_synced_at INTEGER,
        server_version INTEGER DEFAULT 0
      );
      CREATE INDEX idx_users_account_id ON users(account_id);

      -- Devices table
      CREATE TABLE devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_name TEXT,
        platform TEXT NOT NULL,
        platform_version TEXT,
        app_version TEXT,
        identity_key_public TEXT NOT NULL,
        identity_key_private TEXT NOT NULL,
        signed_prekey_public TEXT NOT NULL,
        signed_prekey_private TEXT NOT NULL,
        signed_prekey_signature TEXT NOT NULL,
        signed_prekey_created_at INTEGER NOT NULL,
        onetime_prekeys TEXT NOT NULL DEFAULT '[]',
        registered_at INTEGER NOT NULL,
        last_active_at INTEGER,
        is_primary INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        last_synced_at INTEGER,
        server_version INTEGER DEFAULT 0
      );
      CREATE INDEX idx_devices_user_id ON devices(user_id);
      CREATE INDEX idx_devices_is_primary ON devices(user_id, is_primary);

      -- Contacts table
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contact_account_id TEXT NOT NULL,
        contact_device_id TEXT,
        display_name TEXT,
        avatar_url TEXT,
        identity_key_public TEXT NOT NULL,
        signed_prekey_public TEXT,
        signed_prekey_signature TEXT,
        verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
        verified_at INTEGER,
        safety_number TEXT,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        last_synced_at INTEGER,
        server_version INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        UNIQUE(user_id, contact_account_id)
      );
      CREATE INDEX idx_contacts_user_id ON contacts(user_id);
      CREATE INDEX idx_contacts_account_id ON contacts(contact_account_id);

      -- Conversations table
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'DIRECT',
        title TEXT,
        avatar_url TEXT,
        created_by TEXT REFERENCES devices(id),
        admin_device_ids TEXT NOT NULL DEFAULT '[]',
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        mute_until INTEGER,
        last_message_id TEXT,
        last_message_at INTEGER,
        last_message_sender_id TEXT,
        unread_count INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        last_synced_at INTEGER,
        server_version INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE INDEX idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
      CREATE INDEX idx_conversations_unread ON conversations(user_id, unread_count) WHERE unread_count > 0;

      -- Conversation members table
      CREATE TABLE conversation_members (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        sender_key_public TEXT,
        sender_key_private TEXT,
        joined_at INTEGER NOT NULL,
        left_at INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        last_synced_at INTEGER,
        server_version INTEGER DEFAULT 0,
        UNIQUE(conversation_id, device_id)
      );
      CREATE INDEX idx_conversation_members_conversation ON conversation_members(conversation_id);
      CREATE INDEX idx_conversation_members_device ON conversation_members(device_id);

      -- Messages table
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_device_id TEXT NOT NULL,
        sender_account_id TEXT NOT NULL,
        content TEXT,
        content_encrypted TEXT,
        content_type TEXT NOT NULL DEFAULT 'TEXT',
        encryption_algorithm TEXT,
        nonce TEXT,
        sender_key_id TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        created_at INTEGER NOT NULL,
        sent_at INTEGER,
        delivered_at INTEGER,
        read_at INTEGER,
        edited_at INTEGER,
        deleted_at INTEGER,
        sync_status TEXT NOT NULL DEFAULT 'PENDING',
        server_message_id TEXT,
        last_sync_attempt_at INTEGER,
        sync_attempt_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
      CREATE INDEX idx_messages_status ON messages(status) WHERE status IN ('PENDING', 'UPLOADING', 'FAILED');
      CREATE INDEX idx_messages_sender ON messages(sender_device_id);
      CREATE INDEX idx_messages_sync ON messages(sync_status) WHERE sync_status != 'SYNCED';

      -- Message recipients table
      CREATE TABLE message_recipients (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        recipient_device_id TEXT NOT NULL,
        recipient_account_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        sender_key_id TEXT,
        relayed_at INTEGER,
        delivered_at INTEGER,
        read_at INTEGER,
        ack_sent_at INTEGER,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at INTEGER,
        error_message TEXT
      );
      CREATE INDEX idx_message_recipients_message ON message_recipients(message_id);
      CREATE INDEX idx_message_recipients_status ON message_recipients(status) WHERE status != 'READ';
      CREATE INDEX idx_message_recipients_device ON message_recipients(recipient_device_id);

      -- Attachments table
      CREATE TABLE attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        local_path TEXT,
        local_thumbnail_path TEXT,
        encryption_key TEXT NOT NULL,
        encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
        nonce TEXT NOT NULL,
        remote_url TEXT,
        remote_key TEXT,
        upload_status TEXT NOT NULL DEFAULT 'PENDING',
        download_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
        width INTEGER,
        height INTEGER,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL,
        uploaded_at INTEGER,
        downloaded_at INTEGER,
        deleted_at INTEGER
      );
      CREATE INDEX idx_attachments_message ON attachments(message_id);
      CREATE INDEX idx_attachments_upload ON attachments(upload_status) WHERE upload_status IN ('PENDING', 'UPLOADING');
      CREATE INDEX idx_attachments_download ON attachments(download_status) WHERE download_status = 'DOWNLOADING';

      -- Settings table
      CREATE TABLE settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        last_synced_at INTEGER,
        server_version INTEGER DEFAULT 0,
        UNIQUE(user_id, key)
      );

      -- Triggers for updated_at
      CREATE TRIGGER trigger_users_updated_at
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
      END;

      CREATE TRIGGER trigger_contacts_updated_at
      AFTER UPDATE ON contacts
      BEGIN
        UPDATE contacts SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
      END;

      CREATE TRIGGER trigger_conversations_updated_at
      AFTER UPDATE ON conversations
      BEGIN
        UPDATE conversations SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
      END;

      CREATE TRIGGER trigger_settings_updated_at
      AFTER UPDATE ON settings
      BEGIN
        UPDATE settings SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
      END;
    `,
  },
  {
    version: 2,
    name: 'add_sync_queue',
    sql: `
      -- Sync queue table
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        priority INTEGER NOT NULL DEFAULT 0,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 10,
        last_attempt_at INTEGER,
        next_attempt_at INTEGER NOT NULL,
        backoff_base_ms INTEGER NOT NULL DEFAULT 1000,
        backoff_max_ms INTEGER NOT NULL DEFAULT 300000,
        last_error TEXT,
        error_code TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        idempotency_key TEXT UNIQUE
      );
      CREATE INDEX idx_sync_queue_user ON sync_queue(user_id, status, next_attempt_at);
      CREATE INDEX idx_sync_queue_status ON sync_queue(status) WHERE status IN ('PENDING', 'PROCESSING');
      CREATE INDEX idx_sync_queue_idempotency ON sync_queue(idempotency_key) WHERE idempotency_key IS NOT NULL;
    `,
  },
  {
    version: 3,
    name: 'add_encryption_keys',
    sql: `
      -- Encryption keys table
      CREATE TABLE encryption_keys (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
        key_type TEXT NOT NULL,
        key_id INTEGER,
        public_key TEXT,
        private_key_encrypted TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        used_at INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_encryption_keys_device ON encryption_keys(device_id);
      CREATE INDEX idx_encryption_keys_conversation ON encryption_keys(conversation_id);
      CREATE INDEX idx_encryption_keys_type ON encryption_keys(key_type, is_active);
    `,
  },
  {
    version: 4,
    name: 'add_backups',
    sql: `
      -- Backups table
      CREATE TABLE backups (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
        kdf_algorithm TEXT NOT NULL DEFAULT 'ARGON2ID',
        kdf_params TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        tables_included TEXT NOT NULL,
        record_counts TEXT NOT NULL,
        date_range_start INTEGER,
        date_range_end INTEGER,
        status TEXT NOT NULL DEFAULT 'CREATED',
        verification_hash TEXT,
        created_at INTEGER NOT NULL,
        verified_at INTEGER,
        exported_at INTEGER,
        imported_at INTEGER
      );
      CREATE INDEX idx_backups_user ON backups(user_id, created_at DESC);
    `,
  },
];

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (db) return db;

  const options: SQLiteOpenOptions = {
    useNewConnection: true,
  };

  db = await openDatabaseAsync(DATABASE_NAME, options);

  // Configure SQLite pragmas
  await configureDatabase(db);

  // Run migrations
  await runMigrations(db);

  return db;
}

async function configureDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA temp_store = MEMORY;
    PRAGMA mmap_size = 268435456;
    PRAGMA page_size = 4096;
    PRAGMA auto_vacuum = INCREMENTAL;
  `);
}

async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Create schema_migrations table if not exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      checksum TEXT NOT NULL
    );
  `);

  const appliedMigrations = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(appliedMigrations.map(m => m.version));

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);

      await db.withTransactionAsync(async () => {
        await db.execAsync(migration.sql);

        // Calculate checksum
        const checksum = await computeChecksum(migration.sql);

        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
          migration.version,
          migration.name,
          checksum
        );
      });

      console.log(`Migration ${migration.version} applied successfully`);
    }
  }
}

async function computeChecksum(sql: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(sql);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}

export function generateId(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestampHex}-${randomHex}`;
}