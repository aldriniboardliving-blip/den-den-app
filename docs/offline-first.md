# Den Den Offline-First Design

## Philosophy

> **The app works identically whether online or offline. The network is an enhancement, not a requirement.**

### Core Principles

1. **Local-first UI** - Every user action reflects immediately in local DB
2. **Optimistic updates** - No loading spinners for local operations
3. **Persistent queue** - All outbound operations survive app kill/restart
4. **Conflict resolution** - Last-write-wins with server version vector
5. **Background sync** - Automatic, non-blocking, battery-aware

---

## Sync Queue Architecture

### Queue Table Schema (from database.md)

```sql
CREATE TABLE sync_queue (
    id TEXT PRIMARY KEY,                    -- UUIDv7
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL,                -- MESSAGE_CREATE, MESSAGE_SEND, MESSAGE_ACK, MESSAGE_READ, ATTACHMENT_UPLOAD, ATTACHMENT_DOWNLOAD, CONTACT_SYNC, CONVERSATION_SYNC, DEVICE_SYNC, KEY_ROTATION, BACKUP_CREATE, BACKUP_RESTORE
    entity_type TEXT NOT NULL,              -- messages, message_recipients, attachments, contacts, conversations, devices, encryption_keys
    entity_id TEXT NOT NULL,                -- ID of affected entity
    payload TEXT,                           -- JSON payload for operation
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
    priority INTEGER NOT NULL DEFAULT 0,    -- Higher = more urgent
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 10,
    last_attempt_at INTEGER,
    next_attempt_at INTEGER NOT NULL,       -- Scheduled retry time
    backoff_base_ms INTEGER NOT NULL DEFAULT 1000,
    backoff_max_ms INTEGER NOT NULL DEFAULT 300000,  -- 5 minutes
    last_error TEXT,
    error_code TEXT,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    idempotency_key TEXT UNIQUE
);
```

### Operation Types

| Operation | Entity Type | Payload | Priority | Description |
|-----------|-------------|---------|----------|-------------|
| `MESSAGE_CREATE` | messages | `{conversationId, content, type}` | 10 | Local message creation |
| `MESSAGE_SEND` | messages | `{messageId, recipientDeviceIds[]}` | 10 | Encrypt & upload envelope |
| `MESSAGE_ACK` | message_recipients | `{serverMessageId, status}` | 10 | Delivery acknowledgment |
| `MESSAGE_READ` | message_recipients | `{serverMessageId, readAt}` | 5 | Read receipt |
| `ATTACHMENT_UPLOAD` | attachments | `{attachmentId, filePath}` | 8 | Upload encrypted file |
| `ATTACHMENT_DOWNLOAD` | attachments | `{attachmentId, downloadUrl}` | 5 | Download & decrypt |
| `CONTACT_SYNC` | contacts | `{accountId}` | 3 | Fetch contact keys |
| `CONVERSATION_SYNC` | conversations | `{conversationId}` | 3 | Fetch conversation metadata |
| `DEVICE_SYNC` | devices | `{deviceId}` | 5 | Register/rotate keys |
| `KEY_ROTATION` | encryption_keys | `{keyType}` | 2 | Rotate prekeys |
| `BACKUP_CREATE` | backups | `{password, tables[]}` | 1 | Encrypted export |
| `BACKUP_RESTORE` | backups | `{filePath, password}` | 1 | Import & decrypt |

### Priority Levels
- **10 (Critical)**: User-facing message send/ack
- **8 (High)**: Attachment upload
- **5 (Normal)**: Read receipts, downloads, device sync
- **3 (Low)**: Contact/conversation sync
- **2 (Background)**: Key rotation
- **1 (Maintenance)**: Backup operations

---

## Message State Machine

```
                    ┌─────────────┐
                    │   DRAFT     │  (Local only, not in queue)
                    └──────┬──────┘
                           │ User taps send
                           ▼
                    ┌─────────────┐
         ┌──────────▶│  PENDING    │◀──────────────┐
         │           └──────┬──────┘               │
         │                  │ Save to SQLite       │
         │                  │ Add to sync_queue    │
         │                  │ (MESSAGE_SEND)       │
         │                  ▼                      │
         │           ┌─────────────┐               │
         │           │ UPLOADING   │               │
         │           └──────┬──────┘               │
         │                  │ Upload to server     │
         │                  ▼                      │
         │           ┌─────────────┐               │
         │           │  RELAYED    │               │
         │           └──────┬──────┘               │
         │                  │ Server ACK           │
         │                  ▼                      │
         │           ┌─────────────┐               │
         └───────────│  DELIVERED  │               │
                     └──────┬──────┘               │
                            │ Recipient reads      │
                            ▼                      │
                     ┌─────────────┐               │
                     │    READ     │               │
                     └─────────────┘               │
                            │                      │
                            │ Failure at any step  │
                            │                      │
                            └──────────────────────┘
```

### Status Definitions

| Status | Meaning | Next Steps |
|--------|---------|------------|
| `DRAFT` | Local only, not queued | User edits → stays DRAFT; Send → PENDING |
| `PENDING` | Queued for upload | Sync processor picks up → UPLOADING |
| `UPLOADING` | HTTP request in flight | Success → RELAYED; Failure → PENDING (retry) |
| `RELAYED` | Server accepted envelope | Wait for recipient ACK |
| `DELIVERED` | Recipient persisted locally | Auto-send read when viewed |
| `READ` | Recipient read | Terminal state |
| `FAILED` | Max retries exceeded | User intervention needed |

---

## Sync Processor

### Processing Loop

```typescript
// src/sync/sync-processor.ts

class SyncProcessor {
  private isProcessing = false;
  private readonly BATCH_SIZE = 10;
  private readonly POLL_INTERVAL_MS = 5000;

  async start() {
    // Initial processing
    await this.processQueue();
    
    // Periodic polling
    this.interval = setInterval(() => this.processQueue(), this.POLL_INTERVAL_MS);
    
    // Network change listener
    NetInfo.addEventListener(this.onNetworkChange);
  }

  async processQueue() {
    if (this.isProcessing) return;
    if (!(await this.isOnline())) return;

    this.isProcessing = true;
    try {
      // Get pending operations ordered by priority, then created_at
      const operations = await this.db.getSyncOperations({
        status: ['PENDING', 'PROCESSING'],
        limit: this.BATCH_SIZE,
        orderBy: 'priority DESC, created_at ASC'
      });

      for (const op of operations) {
        await this.executeOperation(op);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async executeOperation(op: SyncOperation) {
    // Mark PROCESSING
    await this.db.updateSyncOperation(op.id, { status: 'PROCESSING', last_attempt_at: now() });

    try {
      const handler = this.getHandler(op.operation);
      await handler(op);
      
      // Success
      await this.db.updateSyncOperation(op.id, { 
        status: 'COMPLETED', 
        completed_at: now() 
      });
      
      // Cleanup old completed
      await this.cleanupCompleted();
      
    } catch (error) {
      await this.handleFailure(op, error);
    }
  }

  async handleFailure(op: SyncOperation, error: Error) {
    const attemptCount = op.attempt_count + 1;
    const maxAttempts = op.max_attempts;
    
    if (attemptCount >= maxAttempts) {
      await this.db.updateSyncOperation(op.id, {
        status: 'FAILED',
        attempt_count: attemptCount,
        last_error: error.message,
        error_code: error.code
      });
      // Notify user via UI
      this.notifyFailure(op);
    } else {
      // Exponential backoff with jitter
      const baseDelay = op.backoff_base_ms * Math.pow(2, attemptCount - 1);
      const jitter = Math.random() * 1000;
      const nextAttempt = Date.now() + Math.min(baseDelay + jitter, op.backoff_max_ms);
      
      await this.db.updateSyncOperation(op.id, {
        status: 'PENDING',
        attempt_count: attemptCount,
        last_error: error.message,
        next_attempt_at: nextAttempt
      });
    }
  }
}
```

### Network Awareness

```typescript
// src/sync/network-monitor.ts

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

class NetworkMonitor {
  private listeners: Set<(online: boolean) => void> = new Set();
  private currentState: NetInfoState | null = null;

  constructor() {
    NetInfo.addEventListener(this.handleChange);
  }

  private handleChange = (state: NetInfoState) => {
    const wasOnline = this.currentState?.isConnected === true;
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    
    this.currentState = state;
    
    if (!wasOnline && isOnline) {
      // Came online - trigger immediate sync
      this.listeners.forEach(l => l(true));
    }
  };

  async isOnline(): Promise<boolean> {
    if (this.currentState) {
      return this.currentState.isConnected === true && this.currentState.isInternetReachable !== false;
    }
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  }

  onOnline(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
```

---

## Background Sync

### iOS (Background Tasks)
```typescript
// src/sync/background-ios.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const BACKGROUND_SYNC_TASK = 'background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const processor = new SyncProcessor();
    await processor.processQueue();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
    minimumInterval: 15 * 60, // 15 minutes
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
```

### Android (WorkManager)
```typescript
// src/sync/background-android.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

// Same task definition, Android uses WorkManager under the hood
// Minimum interval ~15 minutes (Android enforces)
```

### Web (Service Worker)
```typescript
// public/sw.js - Registered via expo-web
self.addEventListener('sync', event => {
  if (event.tag === 'den-den-sync') {
    event.waitUntil(processSyncQueue());
  }
});

// Periodic background sync (Chrome only)
navigator.serviceWorker.ready.then(reg => {
  reg.periodicSync.register('den-den-sync', { minInterval: 24 * 60 * 60 * 1000 });
});
```

---

## Conflict Resolution

### Version Vectors

Each entity carries a `server_version` integer incremented on every server write.

```
Local:  server_version = 5,  local_changes = true
Server: server_version = 7,  remote_changes = true
```

### Resolution Strategy

| Scenario | Resolution |
|----------|------------|
| Local only changed | Push local (optimistic) |
| Remote only changed | Pull remote |
| Both changed (same field) | **Last-write-wins** by `updated_at` timestamp |
| Both changed (different fields) | **Merge** (field-level) |
| Deleted locally, changed remotely | **Resurrect** remote (user explicitly deleted) |
| Changed locally, deleted remotely | **Keep local**, push as recreate |

### Implementation

```typescript
// src/sync/conflict-resolution.ts

interface EntityWithVersion {
  id: string;
  server_version: number;
  updated_at: number;
  deleted_at?: number;
  [key: string]: any;
}

function resolveConflict(local: EntityWithVersion, remote: EntityWithVersion): EntityWithVersion {
  // Deleted locally
  if (local.deleted_at && !remote.deleted_at) {
    return remote; // Resurrect
  }
  
  // Deleted remotely
  if (!local.deleted_at && remote.deleted_at) {
    return { ...local, server_version: remote.server_version }; // Keep local
  }
  
  // Both exist - compare timestamps
  if (local.updated_at >= remote.updated_at) {
    return { ...local, server_version: remote.server_version }; // Local wins
  } else {
    return { ...remote }; // Remote wins
  }
}

// For messages: never auto-resolve content conflicts
// Messages are immutable once sent - only status changes
// Status conflicts: DELIVERED > RELAYED > PENDING > FAILED
```

---

## Idempotency

### Client-Side Idempotency Keys

Every mutating operation generates a UUIDv4 idempotency key:

```typescript
// src/sync/idempotency.ts

function generateIdempotencyKey(operation: string, entityId: string): string {
  // Deterministic for retries, unique per operation
  return `${operation}:${entityId}:${generateUUIDv4()}`;
}

// Stored in sync_queue.idempotency_key
// Server also accepts Idempotency-Key header
```

### Server-Side Idempotency

- Store `idempotency_key → response` for 24 hours
- On duplicate key: return cached response (200/201)
- Prevents: duplicate messages, double uploads, double acks

---

## Offline UI Patterns

### Optimistic Updates

```typescript
// src/features/chat/chat-store.ts
import { create } from 'zustand';

interface Message {
  id: string;
  status: 'DRAFT' | 'PENDING' | 'UPLOADING' | 'RELAYED' | 'DELIVERED' | 'READ' | 'FAILED';
  // ...
}

const useChatStore = create<ChatState>((set) => ({
  sendMessage: async (conversationId, content) => {
    // 1. Create local message IMMEDIATELY
    const messageId = generateUUIDv7();
    const message: Message = {
      id: messageId,
      conversationId,
      content,
      status: 'PENDING',
      createdAt: Date.now(),
      // ...
    };
    
    set(state => ({ messages: [...state.messages, message] }));
    
    // 2. Queue for sync (non-blocking)
    await syncQueue.enqueue('MESSAGE_SEND', 'messages', messageId, { messageId });
    
    // 3. Return immediately - UI already updated
    return messageId;
  },
}));
```

### Status Indicators

```tsx
// src/features/chat/MessageStatus.tsx

function MessageStatus({ status }: { status: Message['status'] }) {
  const icons = {
    PENDING: <ClockIcon />,
    UPLOADING: <SpinnerIcon />,
    RELAYED: <SingleCheckIcon />,
    DELIVERED: <DoubleCheckIcon color="gray" />,
    READ: <DoubleCheckIcon color="green" />,
    FAILED: <AlertIcon onPress={retry} />,
  };
  
  return icons[status] || null;
}
```

---

## Data Consistency Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| **No message loss** | Persistent queue + server ACK before local delete |
| **No duplicate messages** | UUIDv7 message IDs + server deduplication |
| **Order preservation** | UUIDv7 time-ordering + conversation-level sequencing |
| **Read receipts delivered** | Queue survives app kill, retry on restart |
| **Attachment integrity** | SHA-256 verification on download |

---

## Battery & Network Optimization

### Batching
- Group operations by type (all message sends together)
- Single HTTP/2 connection for batch
- Compress payloads (gzip)

### Scheduling
- **Foreground**: Immediate processing
- **Background**: 15 min intervals (OS controlled)
- **Charging + WiFi**: Aggressive sync (download media, backups)
- **Low battery**: Defer non-critical (priority < 5)

### Delta Sync
- `since` timestamp for incremental message sync
- Only fetch changed conversations/contacts
- Server returns `nextCursor` for pagination

---

## Testing Offline Scenarios

| Scenario | Test |
|----------|------|
| Send offline → online | Message appears instantly, syncs when online |
| Receive offline | Push wakes app, downloads, shows notification |
| App killed during upload | Restart → resumes from queue |
| Network flapping | Exponential backoff, no duplicate sends |
| Conflict: edit offline, edit online | Last-write-wins by timestamp |
| Large attachment | Chunked upload, resume on reconnect |
| Queue overflow | Auto-cleanup old completed (7 days) |

---

## Monitoring & Metrics

### Client-Side Metrics
```typescript
interface SyncMetrics {
  queueDepth: number;
  pendingCount: number;
  failedCount: number;
  avgSyncLatencyMs: number;
  lastSuccessfulSync: number;
  bytesUploaded: number;
  bytesDownloaded: number;
}
```

### Server-Side Metrics
- Queue depth per user
- Message relay latency (p50, p95, p99)
- Delivery ACK rate
- Failed delivery rate
- Push notification delivery rate

---

## References

- [Architecture](architecture.md)
- [Database](database.md)
- [API Design](api.md)
- [Encryption](encryption.md)
- [Backend](backend.md)
- [Testing](testing.md)