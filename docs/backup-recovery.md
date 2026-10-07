# Den Den Backup & Recovery

## Overview

Den Den supports two backup mechanisms for user data portability and disaster recovery.

---

## A. Manual Encrypted Database Export

### User Flow

```
Settings
  ↓
Backup & Recovery
  ↓
Export Backup
  ↓
Create backup password (min 12 chars, strength meter)
  ↓
Encrypt database
  ↓
Generate .dendenbackup file
  ↓
Share via system share sheet
    → Google Drive, Dropbox, Files, Nearby Share, AirDrop, etc.
```

### Technical Implementation

#### Backup File Format (.dendenbackup)

```
Header (96 bytes, unencrypted):
  Offset  Size  Field
  0       16    Magic: "DENDEN_BACKUP_V1\0\0\0\0\0"
  16      4     Version: 1 (uint32 LE)
  20      1     Algorithm: 1 = AES-256-GCM
  21      1     KDF: 1 = Argon2id
  22      2     Reserved
  24      32    KDF Salt (cryptographically random)
  56      4     KDF Memory (KB, uint32 LE) = 65536 (64 MB)
  60      4     KDF Iterations (uint32 LE) = 3
  64      4     KDF Parallelism (uint32 LE) = 4
  68      12    File Nonce (random, for AES-GCM)
  80      16    Reserved for future

Encrypted Payload:
  - SQLite database dump (SQL text)
  - Schema version
  - Metadata JSON:
    {
      "exportedAt": 1705315800000,
      "exportedByDeviceId": "uuid",
      "schemaVersion": 4,
      "tables": ["users", "devices", "contacts", ...],
      "recordCounts": { "messages": 1234, "contacts": 56, ... },
      "dateRange": { "start": 1700000000000, "end": 1705315800000 }
    }

Authentication Tag (16 bytes, appended):
  - GCM tag covering Header[16:] + Payload
```

#### Key Derivation

```typescript
// src/features/backup/crypto.ts

const KDF_PARAMS = {
  memory: 64 * 1024,  // 64 MB
  iterations: 3,
  parallelism: 4,
  hashLength: 32,
  type: 'argon2id' as const,
};

export async function deriveBackupKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  // Using libsodium's argon2id
  return Sodium.crypto_pwhash(
    KDF_PARAMS.hashLength,
    password,
    salt,
    KDF_PARAMS.iterations,
    KDF_PARAMS.memory,
    KDF_PARAMS.parallelism,
    Sodium.crypto_pwhash_ALG_ARGON2ID13
  );
}

export async function encryptBackup(
  sqlDump: string,
  metadata: BackupMetadata,
  password: string
): Promise<Uint8Array> {
  const salt = Sodium.randombytes_buf(32);
  const fileNonce = Sodium.randombytes_buf(12);
  const backupKey = await deriveBackupKey(password, salt);
  const fileKey = await Sodium.crypto_kdf_derive_from_key(32, 1, 'DenDen Backup File v1', backupKey);
  
  const payload = JSON.stringify({ sqlDump, metadata });
  const payloadBytes = new TextEncoder().encode(payload);
  
  // AAD includes header (except magic) for integrity
  const header = createHeader(salt, fileNonce);
  const aad = header.slice(16);
  
  const ciphertext = await Sodium.crypto_aead_aes256gcm_encrypt(payloadBytes, aad, fileNonce, fileKey);
  
  // Combine: header + ciphertext + tag
  return concat(header, ciphertext);
}

export async function decryptBackup(
  fileData: Uint8Array,
  password: string
): Promise<{ sqlDump: string; metadata: BackupMetadata }> {
  const header = parseHeader(fileData.slice(0, 96));
  const ciphertext = fileData.slice(96);
  
  const backupKey = await deriveBackupKey(password, header.salt);
  const fileKey = await Sodium.crypto_kdf_derive_from_key(32, 1, 'DenDen Backup File v1', backupKey);
  
  const aad = fileData.slice(16, 96); // Header except magic
  const payloadBytes = await Sodium.crypto_aead_aes256gcm_decrypt(ciphertext, aad, header.nonce, fileKey);
  
  const { sqlDump, metadata } = JSON.parse(new TextDecoder().decode(payloadBytes));
  return { sqlDump, metadata };
}
```

#### Export Process

```typescript
// src/features/backup/hooks.ts
export function useExportBackup() {
  const [progress, setProgress] = useState<BackupProgress>({ stage: 'idle', percent: 0 });
  
  const exportBackup = useCallback(async (password: string) => {
    setProgress({ stage: 'validating', percent: 10 });
    
    // 1. Validate password strength
    if (!validatePasswordStrength(password)) {
      throw new Error('Password too weak');
    }
    
    setProgress({ stage: 'dumping', percent: 30 });
    
    // 2. Dump database to SQL
    const sqlDump = await database.dumpToSQL([
      'users', 'devices', 'contacts', 'conversations',
      'conversation_members', 'messages', 'message_recipients',
      'attachments', 'encryption_keys', 'settings'
    ]);
    
    setProgress({ stage: 'encrypting', percent: 60 });
    
    // 3. Collect metadata
    const metadata = await collectBackupMetadata();
    
    // 4. Encrypt
    const encrypted = await encryptBackup(sqlDump, metadata, password);
    
    setProgress({ stage: 'saving', percent: 90 });
    
    // 5. Save to file
    const fileName = `denden-backup-${Date.now()}.dendenbackup`;
    const uri = await FileSystem.writeAsStringAsync(
      FileSystem.documentDirectory + fileName,
      base64FromBytes(encrypted),
      { encoding: FileSystem.EncodingType.Base64 }
    );
    
    setProgress({ stage: 'complete', percent: 100, fileUri: uri });
    
    // 6. Present share sheet
    await Share.share({ url: uri, title: 'Den Den Backup' });
    
    return uri;
  }, []);
  
  return { exportBackup, progress };
}
```

---

## B. Import on New Device

### User Flow

```
Install Den Den
  ↓
Authenticate (same account)
  ↓
Settings → Backup & Recovery → Import Backup
  ↓
Select .dendenbackup file
  ↓
Enter backup password
  ↓
Decrypt & Validate
  ↓
Restore Local Database
  ↓
Register New Device
  ↓
Establish New Device Keys
  ↓
Sync Conversations from Server
```

### Technical Implementation

#### Import Process

```typescript
// src/features/backup/hooks.ts
export function useImportBackup() {
  const [progress, setProgress] = useState<BackupProgress>({ stage: 'idle', percent: 0 });
  
  const importBackup = useCallback(async (fileUri: string, password: string) => {
    setProgress({ stage: 'reading', percent: 10 });
    
    // 1. Read file
    const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const fileData = base64ToBytes(base64);
    
    setProgress({ stage: 'decrypting', percent: 30 });
    
    // 2. Decrypt
    let sqlDump: string;
    let metadata: BackupMetadata;
    try {
      const result = await decryptBackup(fileData, password);
      sqlDump = result.sqlDump;
      metadata = result.metadata;
    } catch (e) {
      throw new Error('Wrong password or corrupted file');
    }
    
    setProgress({ stage: 'validating', percent: 50 });
    
    // 3. Validate schema compatibility
    if (metadata.schemaVersion > CURRENT_SCHEMA_VERSION) {
      throw new Error('Backup from newer app version. Please update app.');
    }
    if (metadata.schemaVersion < MIN_COMPATIBLE_SCHEMA_VERSION) {
      throw new Error('Backup too old. Contact support.');
    }
    
    // 4. Verify record counts (basic integrity)
    const expectedCounts = metadata.recordCounts;
    // Will verify after import
    
    setProgress({ stage: 'restoring', percent: 70 });
    
    // 5. Restore database (in transaction)
    await database.executeTransaction(async (tx) => {
      // Clear existing data (except current device keys)
      await clearUserData(tx, preserveDeviceKeys: true);
      
      // Execute SQL dump
      await tx.executeSql(sqlDump);
    });
    
    setProgress({ stage: 'verifying', percent: 90 });
    
    // 6. Verify restored data
    const actualCounts = await getTableCounts();
    for (const [table, expected] of Object.entries(expectedCounts)) {
      if (actualCounts[table] !== expected) {
        console.warn(`Count mismatch for ${table}: expected ${expected}, got ${actualCounts[table]}`);
      }
    }
    
    // 7. Register new device with server
    await registerDeviceWithServer();
    
    // 8. Trigger full sync
    await syncQueue.enqueue('CONVERSATION_SYNC', 'conversations', 'all', {});
    await syncQueue.enqueue('CONTACT_SYNC', 'contacts', 'all', {});
    
    setProgress({ stage: 'complete', percent: 100 });
    
    return true;
  }, []);
  
  return { importBackup, progress };
}
```

#### Critical: Device Identity Separation

```typescript
// During import, PRESERVE current device's cryptographic identity
async function clearUserData(tx: Transaction, preserveDeviceKeys: boolean) {
  const tables = [
    'messages', 'message_recipients', 'attachments',
    'conversations', 'conversation_members',
    'contacts', 'sync_queue', 'settings', 'backups'
  ];
  
  for (const table of tables) {
    await tx.executeSql(`DELETE FROM ${table}`);
  }
  
  if (!preserveDeviceKeys) {
    await tx.executeSql(`DELETE FROM devices WHERE is_primary = 0`);
    await tx.executeSql(`DELETE FROM encryption_keys`);
  }
  // KEEP: users (current user), devices (current device), encryption_keys (current device)
}
```

**Why this matters:**
- Backup contains OLD device keys
- New device must generate its OWN identity keys
- Importing old keys would compromise new device's identity
- Server sees new device registration → sends new key bundles to contacts

---

## Security Properties

| Property | Implementation |
|----------|----------------|
| **Confidentiality** | AES-256-GCM encryption, Argon2id KDF |
| **Integrity** | GCM authentication tag over header + payload |
| **Authenticity** | Password-derived key only |
| **Offline attack resistance** | Argon2id: 64MB memory, 3 iterations, 4 threads |
| **No server involvement** | Encrypted before leaving device |
| **Forward secrecy** | New device = new keys; old backups useless without password |
| **Version compatibility** | Schema version in metadata, migration on import |

---

## Password Requirements

- Minimum 12 characters
- Entropy estimation (zxcvbn)
- Strength meter in UI
- No password hints stored
- No password recovery (by design)

---

## Migration on Import

```typescript
async function migrateBackupIfNeeded(sqlDump: string, fromVersion: number): string {
  if (fromVersion === CURRENT_SCHEMA_VERSION) return sqlDump;
  
  // Parse SQL, apply migrations, regenerate SQL
  // Or: restore to temp DB, run migrations, dump again
  const tempDb = await openTempDatabase();
  await tempDb.exec(sqlDump);
  
  for (let v = fromVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
    await runMigration(tempDb, v);
  }
  
  return await tempDb.dumpToSQL();
}
```

---

## Testing

| Scenario | Test |
|----------|------|
| Export → Import same device | Roundtrip data integrity |
| Export → Import new device | New device keys generated, conversations restored |
| Wrong password | Import fails with clear error |
| Corrupted file | Import fails with clear error |
| Old schema version | Auto-migration works |
| New schema version | Clear error to update app |
| Large backup (10k msgs) | Completes in < 30s |
| Interrupted import | No partial state (transaction) |

---

## References

- [Database Schema](database.md)
- [Encryption](encryption.md)
- [Security](security.md)
- [Offline-First](offline-first.md)