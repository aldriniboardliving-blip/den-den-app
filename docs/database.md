# Den Den Database Schema

## Overview

This document defines the SQLite database schema for the Den Den mobile application. The database is the **source of truth** for all local data and operates offline-first.

## Design Principles

1. **Normalized but pragmatic** - Avoid excessive joins for common queries
2. **Explicit status tracking** - Every entity has clear lifecycle states
3. **Globally unique IDs** - UUIDv7 for all primary keys (time-ordered)
4. **Soft deletes** - `deleted_at` timestamp instead of hard deletes
5. **Sync metadata** - Every table tracks sync status for offline operations
6. **Encrypted columns** - Sensitive data encrypted at rest

## SQLite Configuration

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;  -- 256MB
PRAGMA page_size = 4096;
PRAGMA auto_vacuum = INCREMENTAL;
```

## Core Tables

### 1. users
Local representation of the authenticated user.

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    account_id TEXT NOT NULL UNIQUE,        -- Den Den account ID (public)
    display_name TEXT,
    avatar_url TEXT,
    auth_token TEXT,                        -- Encrypted JWT
    refresh_token TEXT,                     -- Encrypted refresh token
    token_expires_at INTEGER,               -- Unix timestamp (ms)
    created_at INTEGER NOT NULL,            -- Unix timestamp (ms)
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'SYNCED',  -- SYNCED, PENDING, CONFLICT
    last_synced_at INTEGER,
    server_version INTEGER DEFAULT 0
);

CREATE INDEX idx_users_account_id ON users(account_id);
```

### 2. devices
Registered devices for the current user (multi-device support).

```sql
CREATE TABLE devices (
    id TEXT PRIMARY KEY,                    -- UUIDv7 (device ID)
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name TEXT,                       -- "iPhone 15", "Pixel 8"
    platform TEXT NOT NULL,                 -- ios, android, web
    platform_version TEXT,
    app_version TEXT,
    -- Cryptographic identity
    identity_key_public TEXT NOT NULL,      -- X25519 public key (base64)
    identity_key_private TEXT NOT NULL,     -- X25519 private key (encrypted)
    signed_prekey_public TEXT NOT NULL,     -- X25519 public key (base64)
    signed_prekey_private TEXT NOT NULL,    -- X25519 private key (encrypted)
    signed_prekey_signature TEXT NOT NULL,  -- Ed25519 signature of prekey
    signed_prekey_created_at INTEGER NOT NULL,
    -- One-time prekeys (stored as JSON array)
    onetime_prekeys TEXT NOT NULL DEFAULT '[]',  -- [{id, public, private_encrypted, used}]
    -- Registration
    registered_at INTEGER NOT NULL,
    last_active_at INTEGER,
    is_primary INTEGER NOT NULL DEFAULT 0,  -- 0 or 1
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'SYNCED',
    last_synced_at INTEGER,
    server_version INTEGER DEFAULT 0
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_is_primary ON devices(user_id, is_primary);
```

### 3. contacts
User's contact list (local cache of server contacts).

```sql
CREATE TABLE contacts (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_account_id TEXT NOT NULL,       -- Den Den account ID of contact
    contact_device_id TEXT,                 -- Primary device ID of contact
    display_name TEXT,                      -- User's name for this contact
    avatar_url TEXT,
    -- Cryptographic
    identity_key_public TEXT NOT NULL,      -- Contact's identity public key
    signed_prekey_public TEXT,              -- Contact's current signed prekey
    signed_prekey_signature TEXT,           -- Signature of signed prekey
    -- Verification
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',  -- UNVERIFIED, VERIFIED, BLOCKED
    verified_at INTEGER,
    safety_number TEXT,                     -- Short auth string for manual verification
    -- Sync metadata
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
```

### 4. conversations
Conversation metadata (no message content).

```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'DIRECT',    -- DIRECT, GROUP
    title TEXT,                             -- Group name (null for direct)
    avatar_url TEXT,
    -- Group management
    created_by TEXT REFERENCES devices(id), -- Device that created conversation
    admin_device_ids TEXT NOT NULL DEFAULT '[]',  -- JSON array of device IDs
    -- State
    is_archived INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    mute_until INTEGER,                     -- Unix timestamp (ms), null = not muted
    -- Last message preview (for sorting)
    last_message_id TEXT,                   -- References messages.id
    last_message_at INTEGER,                -- Unix timestamp (ms)
    last_message_sender_id TEXT,            -- Device ID of last sender
    unread_count INTEGER NOT NULL DEFAULT 0,
    -- Sync metadata
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
```

### 5. conversation_members
Participants in a conversation.

```sql
CREATE TABLE conversation_members (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,                -- Device ID (may not be local)
    account_id TEXT NOT NULL,               -- Account ID of member
    role TEXT NOT NULL DEFAULT 'MEMBER',    -- ADMIN, MEMBER
    -- Encryption keys for this member in this conversation
    sender_key_public TEXT,                 -- Sender key for group messages (base64)
    sender_key_private TEXT,                -- Encrypted private sender key
    -- State
    joined_at INTEGER NOT NULL,
    left_at INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'SYNCED',
    last_synced_at INTEGER,
    server_version INTEGER DEFAULT 0,
    UNIQUE(conversation_id, device_id)
);

CREATE INDEX idx_conversation_members_conversation ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_device ON conversation_members(device_id);
```

### 6. messages
All messages (sent, received, drafts).

```sql
CREATE TABLE messages (
    id TEXT PRIMARY KEY,                    -- UUIDv7 (globally unique)
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_device_id TEXT NOT NULL,         -- Device ID of sender
    sender_account_id TEXT NOT NULL,        -- Account ID of sender
    -- Message content (encrypted for received, plaintext for sent drafts)
    content TEXT,                           -- Plaintext (outgoing drafts only)
    content_encrypted TEXT,                 -- Encrypted content (base64 envelope)
    content_type TEXT NOT NULL DEFAULT 'TEXT',  -- TEXT, IMAGE, VIDEO, AUDIO, FILE, SYSTEM
    -- Encryption metadata
    encryption_algorithm TEXT,              -- X25519-AES256GCM, X25519-CHACHA20POLY1305
    nonce TEXT,                             -- Base64 nonce
    sender_key_id TEXT,                     -- Key ID used for encryption
    -- Delivery status (local perspective)
    status TEXT NOT NULL DEFAULT 'DRAFT',   -- DRAFT, PENDING, UPLOADING, RELAYED, DELIVERED, READ, FAILED
    -- Timestamps
    created_at INTEGER NOT NULL,            -- When message was created locally
    sent_at INTEGER,                        -- When uploaded to server
    delivered_at INTEGER,                   -- When ACK received from recipient
    read_at INTEGER,                        -- When read receipt received
    edited_at INTEGER,                      -- When message was edited
    deleted_at INTEGER,                     -- Soft delete
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, SYNCED, CONFLICT
    server_message_id TEXT,                 -- Server-assigned ID (if different)
    last_sync_attempt_at INTEGER,
    sync_attempt_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_status ON messages(status) WHERE status IN ('PENDING', 'UPLOADING', 'FAILED');
CREATE INDEX idx_messages_sender ON messages(sender_device_id);
CREATE INDEX idx_messages_sync ON messages(sync_status) WHERE sync_status != 'SYNCED';
```

### 7. message_recipients
Per-recipient delivery tracking (for group messages).

```sql
CREATE TABLE message_recipients (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_device_id TEXT NOT NULL,      -- Target device ID
    recipient_account_id TEXT NOT NULL,     -- Target account ID
    -- Delivery status
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RELAYED, DELIVERED, READ, FAILED
    -- Encryption (per-recipient envelope)
    ciphertext TEXT NOT NULL,               -- Encrypted message for this recipient
    nonce TEXT NOT NULL,                    -- Per-recipient nonce
    sender_key_id TEXT,                     -- Key used
    -- Timestamps
    relayed_at INTEGER,                     -- Server received
    delivered_at INTEGER,                   -- Device received
    read_at INTEGER,                        -- User read
    ack_sent_at INTEGER,                    -- ACK sent to server
    -- Retry
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    error_message TEXT
);

CREATE INDEX idx_message_recipients_message ON message_recipients(message_id);
CREATE INDEX idx_message_recipients_status ON message_recipients(status) WHERE status != 'READ';
CREATE INDEX idx_message_recipients_device ON message_recipients(recipient_device_id);
```

### 8. attachments
Media and file attachments.

```sql
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
    -- File info
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    -- Local storage
    local_path TEXT,                        -- File:// path (encrypted file)
    local_thumbnail_path TEXT,              -- Thumbnail for images/videos
    -- Encryption
    encryption_key TEXT NOT NULL,           -- Encrypted AES-256 key (base64)
    encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    nonce TEXT NOT NULL,                    -- Base64 nonce
    -- Remote (server)
    remote_url TEXT,                        -- Download URL (signed, expires)
    remote_key TEXT,                        -- Storage object key
    upload_status TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING, UPLOADING, UPLOADED, FAILED
    download_status TEXT NOT NULL DEFAULT 'NOT_STARTED',  -- NOT_STARTED, DOWNLOADING, DOWNLOADED, FAILED
    -- Metadata
    width INTEGER,                          -- Image/video width
    height INTEGER,                         -- Image/video height
    duration_ms INTEGER,                    -- Audio/video duration
    -- Timestamps
    created_at INTEGER NOT NULL,
    uploaded_at INTEGER,
    downloaded_at INTEGER,
    deleted_at INTEGER
);

CREATE INDEX idx_attachments_message ON attachments(message_id);
CREATE INDEX idx_attachments_upload ON attachments(upload_status) WHERE upload_status IN ('PENDING', 'UPLOADING');
CREATE INDEX idx_attachments_download ON attachments(download_status) WHERE download_status = 'DOWNLOADING';
```

### 9. encryption_keys
Key management for Signal-style double ratchet (future) or simpler key hierarchy.

```sql
CREATE TABLE encryption_keys (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    -- Key types
    key_type TEXT NOT NULL,                 -- IDENTITY, SIGNED_PREKEY, ONETIME_PREKEY, SENDER_KEY, CHAIN_KEY, MESSAGE_KEY
    key_id INTEGER,                         -- Numeric key ID (for prekeys, ratchet steps)
    -- Key material (encrypted at rest)
    public_key TEXT,                        -- Base64 public key
    private_key_encrypted TEXT,             -- Base64 encrypted private key
    -- Metadata
    created_at INTEGER NOT NULL,
    expires_at INTEGER,                     -- For prekeys, rotation
    used_at INTEGER,                        -- When key was used (for onetime)
    is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_encryption_keys_device ON encryption_keys(device_id);
CREATE INDEX idx_encryption_keys_conversation ON encryption_keys(conversation_id);
CREATE INDEX idx_encryption_keys_type ON encryption_keys(key_type, is_active);
```

### 10. sync_queue
Persistent queue for offline operations.

```sql
CREATE TABLE sync_queue (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Operation
    operation TEXT NOT NULL,                -- MESSAGE_CREATE, MESSAGE_SEND, MESSAGE_ACK, MESSAGE_READ, ATTACHMENT_UPLOAD, ATTACHMENT_DOWNLOAD, CONTACT_SYNC, CONVERSATION_SYNC, DEVICE_SYNC, KEY_ROTATION, BACKUP_CREATE, BACKUP_RESTORE
    entity_type TEXT NOT NULL,              -- messages, message_recipients, attachments, contacts, conversations, devices, encryption_keys
    entity_id TEXT NOT NULL,                -- ID of affected entity
    payload TEXT,                           -- JSON payload for operation
    -- Status
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
    priority INTEGER NOT NULL DEFAULT 0,    -- Higher = more urgent
    -- Retry logic
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 10,
    last_attempt_at INTEGER,
    next_attempt_at INTEGER NOT NULL,       -- Scheduled retry time
    backoff_base_ms INTEGER NOT NULL DEFAULT 1000,
    backoff_max_ms INTEGER NOT NULL DEFAULT 300000,  -- 5 minutes
    -- Error tracking
    last_error TEXT,
    error_code TEXT,
    -- Timestamps
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    -- Idempotency
    idempotency_key TEXT UNIQUE             -- Prevents duplicate queue entries
);

CREATE INDEX idx_sync_queue_user ON sync_queue(user_id, status, next_attempt_at);
CREATE INDEX idx_sync_queue_status ON sync_queue(status) WHERE status IN ('PENDING', 'PROCESSING');
CREATE INDEX idx_sync_queue_idempotency ON sync_queue(idempotency_key) WHERE idempotency_key IS NOT NULL;
```

### 11. settings
User preferences and app configuration.

```sql
CREATE TABLE settings (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,                    -- JSON string
    -- Sync metadata
    sync_status TEXT NOT NULL DEFAULT 'SYNCED',
    last_synced_at INTEGER,
    server_version INTEGER DEFAULT 0,
    UNIQUE(user_id, key)
);

-- Default settings keys:
-- 'notifications.enabled' = true
-- 'notifications.sound' = 'default'
-- 'notifications.vibrate' = true
-- 'chat.enter_to_send' = false
-- 'chat.media_auto_download' = 'wifi'  -- never, wifi, always
-- 'chat.backup.auto_enabled' = false
-- 'chat.backup.frequency' = 'daily'  -- daily, weekly, manual
-- 'security.lock_app' = false
-- 'security.lock_timeout' = 300  -- seconds
-- 'appearance.theme' = 'system'  -- light, dark, system
-- 'data.export_path' = null
```

### 12. backups
Metadata for encrypted database backups.

```sql
CREATE TABLE backups (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    -- Backup file
    file_path TEXT NOT NULL,                -- Local path to .dendenbackup file
    file_size_bytes INTEGER NOT NULL,
    -- Encryption
    encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    kdf_algorithm TEXT NOT NULL DEFAULT 'ARGON2ID',
    kdf_params TEXT NOT NULL,               -- JSON: {memory, iterations, parallelism, salt}
    -- Content metadata
    schema_version INTEGER NOT NULL,        -- Database schema version
    tables_included TEXT NOT NULL,          -- JSON array of table names
    record_counts TEXT NOT NULL,            -- JSON: {messages: 1234, contacts: 56, ...}
    date_range_start INTEGER,               -- Oldest message timestamp
    date_range_end INTEGER,                 -- Newest message timestamp
    -- Status
    status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED, VERIFIED, EXPORTED, IMPORTED, FAILED
    verification_hash TEXT,                 -- SHA-256 of decrypted content
    -- Timestamps
    created_at INTEGER NOT NULL,
    verified_at INTEGER,
    exported_at INTEGER,
    imported_at INTEGER
);

CREATE INDEX idx_backups_user ON backups(user_id, created_at DESC);
```

## Triggers

### Auto-update `updated_at` timestamp
```sql
CREATE TRIGGER trigger_users_updated_at
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
END;

-- Repeat for: contacts, conversations, conversation_members, settings, etc.
```

### Auto-update conversation `last_message` on insert
```sql
CREATE TRIGGER trigger_messages_update_conversation
AFTER INSERT ON messages
WHEN NEW.status != 'DRAFT' AND NEW.deleted_at IS NULL
BEGIN
    UPDATE conversations SET
        last_message_id = NEW.id,
        last_message_at = NEW.created_at,
        last_message_sender_id = NEW.sender_device_id,
        unread_count = unread_count + CASE WHEN NEW.sender_device_id != (SELECT id FROM devices WHERE is_primary = 1 LIMIT 1) THEN 1 ELSE 0 END,
        updated_at = strftime('%s', 'now') * 1000
    WHERE id = NEW.conversation_id;
END;
```

### Sync queue cleanup
```sql
CREATE TRIGGER trigger_sync_queue_cleanup
AFTER INSERT ON sync_queue
WHEN (SELECT COUNT(*) FROM sync_queue WHERE status = 'COMPLETED') > 10000
BEGIN
    DELETE FROM sync_queue
    WHERE status = 'COMPLETED'
    AND completed_at < (strftime('%s', 'now') * 1000 - 604800000)  -- 7 days
    AND id IN (
        SELECT id FROM sync_queue
        WHERE status = 'COMPLETED'
        ORDER BY completed_at ASC
        LIMIT 1000
    );
END;
```

## Migration Strategy

### Version Tracking
```sql
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    checksum TEXT NOT NULL  -- SHA-256 of migration SQL
);
```

### Migration Naming
```
001_initial_schema.sql
002_add_sync_queue.sql
003_add_encryption_keys.sql
004_add_backups.sql
005_add_group_conversations.sql
```

### Migration Rules
1. Migrations are **additive only** - no destructive changes
2. Each migration runs in a transaction
3. Migrations include `up` and `down` (for development only)
4. Production only runs `up`
5. Checksums prevent tampering

## Performance Considerations

### Indexing Strategy
- Primary keys: UUIDv7 (time-ordered, good for clustering)
- Foreign keys indexed for JOIN performance
- Partial indexes for common filter conditions (status, sync_status)
- Composite indexes for query patterns (user_id + status + timestamp)

### Query Patterns
| Query | Index Used |
|-------|------------|
| Get conversation messages | `idx_messages_conversation` |
| Pending sync operations | `idx_sync_queue_status` |
| Unread conversations | `idx_conversations_unread` |
| Failed message retries | `idx_messages_status` |
| Contact lookup | `idx_contacts_account_id` |

### Vacuum Schedule
- Auto-vacuum incremental
- Manual `VACUUM` after large deletions (backup import, etc.)
- `PRAGMA optimize` weekly via background task

## Encryption at Rest

### Column-Level Encryption
Sensitive columns encrypted using device-bound key:
- `users.auth_token`, `users.refresh_token`
- `devices.identity_key_private`, `devices.signed_prekey_private`, `devices.onetime_prekeys`
- `contacts.identity_key_public` (not encrypted, but verified)
- `encryption_keys.private_key_encrypted`
- `attachments.encryption_key`
- `sync_queue.payload` (may contain sensitive data)

### Encryption Key Derivation
```
Master Key = PBKDF2(device_passcode, device_salt, 100000, 32, SHA-256)
Column Key = HKDF(Master Key, "column:<table>.<column>", 32)
```

## Backup Schema Versioning

| Version | Description |
|---------|-------------|
| 1 | Initial schema (users, devices, contacts, conversations, messages, attachments, sync_queue, settings) |
| 2 | Added encryption_keys table |
| 3 | Added backups table |
| 4 | Added conversation_members, group support |

## References

- [Architecture](architecture.md)
- [Offline-First Design](offline-first.md)
- [Encryption Design](encryption.md)
- [Backup & Recovery](backup-recovery.md)