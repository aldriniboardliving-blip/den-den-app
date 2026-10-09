# Den Den — Canonical Development Roadmap

**Single Source of Truth** for all development phases. This document reflects actual implementation status as of the current repository state.

---

## Phase 0 — Foundation

**STATUS: COMPLETE**

- Expo 57 project initialization
- TypeScript 6 strict mode configuration
- ESLint + Prettier + Husky
- GitHub Actions CI foundation (typecheck, lint, test)
- Expo Router file-based navigation structure
- Core dependencies: Zustand, TanStack Query, Zod, react-native-reanimated

---

## Phase 1 — Local Data Layer

**STATUS: COMPLETE**

- SQLite database (`expo-sqlite`) with WAL mode
- 4 migrations (v1–v4): initial schema, sync queue, encryption keys, backups
- 12 tables: users, devices, contacts, conversations, conversation_members, messages, message_recipients, attachments, encryption_keys, sync_queue, settings, backups
- Repository pattern (DAOs) for all tables
- Persistent sync queue with idempotency keys, priority, exponential backoff
- SQLite triggers for updated_at, unread counts

---

## Phase 2 — Authentication & Account

**STATUS: COMPLETE / NEEDS BACKEND INTEGRATION**

- OTP-based authentication (email/SMS abstraction)
- Device registration with cryptographic identity generation
- Auth store (Zustand) with secure token persistence
- Login, OTP verification, Device Registration screens
- Root layout with auth-state routing
- JWT access/refresh token handling (frontend only — backend not yet built)

---

## Phase 3 — Device Identity & Cryptographic Foundation

**STATUS: PARTIALLY COMPLETE**

**Implemented:**
- Device identity generation (X25519 identity key, Ed25519 signing key)
- Signed prekey (weekly rotation, Ed25519 signature)
- 100 one-time prekeys (X25519, consumed once)
- Secure hardware storage (iOS Secure Enclave, Android StrongBox, Web Crypto)
- KeyManager: generation, rotation, sender keys for groups
- MessageEncryption: X25519 + AES-256-GCM (3 DH operations, HKDF-SHA256, AAD binding)
- BackupEncryption: Argon2id (64MB/3/4) → HKDF → AES-256-GCM
- Safety number computation (SHA-256 fingerprint)

**Missing (Signal Protocol — Phase 11):**
- Double Ratchet (session establishment, chain keys, message keys)
- Forward secrecy with per-message ratcheting
- Key rotation after N messages
- Replay protection (message number tracking)
- Device revocation & key synchronization

**Current crypto provides:** Ephemeral-key-per-message encryption (no session ratcheting). NOT Signal-level E2EE.

---

## Phase 4 — Messaging Client

**STATUS: COMPLETE**

- 1:1 conversations
- Group conversations (sender keys)
- Message thread with bubbles, timestamps, status indicators
- Message input with attachment button, send
- Message editing (optimistic UI, context menu)
- Message deletion (local + sync queue)
- Full-text message search (SQLite FTS5)
- Disappearing messages (timer: 24h, 7d, 90d; auto-delete on read + background task)
- Forward messages
- Group info / member management

---

## Phase 5 — Contacts & Verification

**STATUS: COMPLETE**

- Contact list with verification status badges
- Add contact by identifier (phone/email/username)
- Contact detail screen with safety number display
- QR code scanning (expo-camera) for in-person verification
- Safety number computation & comparison
- Contact blocking / unblocking
- Verification status: UNVERIFIED / VERIFIED / BLOCKED / PENDING

---

## Phase 6 — Realtime Client

**STATUS: COMPLETE**

- Custom WebSocket client (`useRealtime` hook) — not socket.io
- `wss://api.den-den.app/realtime?token=<jwt>&deviceId=<uuid>`
- Auto-reconnect with exponential backoff (1s → 30s, 10 attempts)
- Heartbeat (PING/PONG every 30s)
- Request/response correlation with requestId
- Offline message queue with flush on reconnect
- Event listeners per type (MessageEvent, ConversationEvent, ContactEvent, etc.)
- Typing indicators (TYPING_START/STOP)
- Presence (online/offline/last_seen)

**Server→Client Events:** MESSAGE_NEW, MESSAGE_DELIVERED, MESSAGE_READ, CONVERSATION_*, CONTACT_*, KEY_ROTATION, SYNC_REQUIRED, TYPING_START/STOP
**Client→Server:** ACK (persistence confirmation), READ, SYNC_REQUEST, TYPING_START/STOP

---

## Phase 7 — Offline Synchronization

**STATUS: COMPLETE / NEEDS REAL BACKEND VALIDATION**

- SyncProcessor: persistent queue processing with priority, retry (max 5), exponential backoff
- NetworkMonitor: connectivity awareness, background fetch integration
- Idempotency keys on all mutations
- Conflict resolution: last-write-wins for metadata, server-wins for messages
- Incremental sync (since timestamp) + full sync fallback
- Sync integration with realtime events (`useSyncIntegration.ts`):
  - Auto-persist incoming envelopes
  - Auto-send ACK on local DB success
  - Process pending outbound on reconnect
  - Trigger incremental sync on SYNC_REQUIRED

---

## Phase 8 — Notifications

**STATUS: COMPLETE**

- Permission handling (expo-notifications)
- Push token registration (Expo/FCM/APNs)
- Local notifications for incoming messages (foreground)
- Notification settings screen (per-conversation + global)
- Push payload: metadata only (NO plaintext content)
- Deep linking to conversation on tap

---

## Phase 9 — Backup & Recovery

**STATUS: COMPLETE**

- Encrypted backup creation (Argon2id + AES-256-GCM, full SQL dump)
- Backup list with metadata (size, date, version)
- Restore from backup (decrypt, validate, replace DB)
- Backup settings (auto-backup frequency, cloud storage placeholder)
- Secure backup file format with integrity verification

---

## Phase 10 — Backend & Temporary Relay

**STATUS: NOT STARTED — NEXT MAJOR PHASE**

**Build:**
- NestJS + TypeScript + PostgreSQL + Drizzle ORM
- 10 modules: auth, users, devices, conversations, messages, relay, delivery, attachments, notifications, health
- WebSocket gateway (`@nestjs/websockets`) matching frontend protocol
- Temporary message relay storage (envelopes deleted ONLY after ACK)
- Delivery acknowledgment processing with retry
- Push token registration & notification dispatch (Expo/FCM/APNs)
- Presigned S3 URLs for encrypted attachments
- Rate limiting, idempotency, validation, security headers
- Dockerfile, CI/CD, database migrations

**API Contract (from docs/api.md):**
```
POST   /api/v1/auth/send-otp
POST   /api/v1/auth/verify-otp
POST   /api/v1/auth/refresh
POST   /api/v1/devices
GET    /api/v1/devices
GET    /api/v1/devices/:id/keys
POST   /api/v1/devices/:id/keys
POST   /api/v1/conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/:id
POST   /api/v1/conversations/:id/members
DELETE /api/v1/conversations/:id/members/:deviceId
POST   /api/v1/messages
GET    /api/v1/messages/pending
POST   /api/v1/messages/:id/ack
POST   /api/v1/sync
POST   /api/v1/push-tokens
GET    /api/v1/health
GET    /api/v1/health/ready
WS     /realtime
```

---

## Phase 11 — End-to-End Messaging Protocol (Signal Protocol)

**STATUS: NOT COMPLETE**

**Must implement production-grade E2EE. Investigate and use established Signal Protocol libraries rather than custom implementation.**

Requirements:
- Identity keys (long-term X25519 + Ed25519)
- Prekey bundles (signed prekey + 100 one-time prekeys)
- X3DH session establishment (3 DH + HKDF)
- Double Ratchet: root chain, sending/receiving chains
- Forward secrecy (per-message ratchet step)
- Key rotation (after N messages or time)
- Message authentication (MAC)
- Replay protection (message number tracking, skipped message keys)
- Device verification (safety numbers)
- Multi-device fan-out (sender keys per device)

**Do not implement a homemade cryptographic protocol.**

---

## Phase 12 — Reliable Delivery & Relay Deletion

**STATUS: NOT COMPLETE**

**Critical Den Den guarantee: Relay message deleted ONLY after receiver confirms local persistence.**

Flow:
```
Sender encrypts → POST envelope → Backend stores temporary
Receiver downloads → Decrypts locally → SQLite transaction succeeds
Receiver sends ACK {serverMessageId, status: PERSISTED_LOCALLY}
Backend validates ACK → Deletes temporary envelope
```

If ACK never arrives: **DO NOT DELETE** — retry with exponential backoff.

Implement:
- Unique message IDs (UUID v7 or ULID)
- Idempotency (deduplicate by messageId)
- Delivery state machine (PENDING → RELAYED → DELIVERED → READ)
- Persistence ACK protocol
- Duplicate protection (message_recipients unique constraint)
- Crash recovery (unACKed messages re-sent on reconnect)
- Relay cleanup (TTL for abandoned messages: 30 days)
- ACK timeout handling (re-queue for redelivery)

---

## Phase 13 — Attachments & Media

**STATUS: PARTIALLY IMPLEMENTED / NOT PRODUCTION READY**

**Frontend has:** attachments table, upload/download status, encrypted media keys placeholder

**Need:**
- Encrypted attachment upload (client-side encryption before upload)
- Presigned S3 URLs (backend generates, frontend uploads directly)
- Image/video/file sending UI
- Thumbnail generation (client-side)
- Attachment metadata (filename, size, MIME, encrypted key, nonce)
- Temporary server storage (auto-expire after delivery)
- Offline attachment queue (sync queue integration)
- Download progress, resume, retry

---

## Phase 14 — Multi-Device

**STATUS: NOT STARTED**

Design and implement:
- Linked devices (primary + secondaries)
- Per-device cryptographic identities
- Device authorization flow (QR pairing or verification code)
- Device revocation (remote wipe, key rotation)
- Key synchronization (secure backup/restore or direct transfer)
- Message fan-out (encrypt once per recipient device)
- Device-specific encryption (no shared keys across devices)
- Conversation sync across devices

**Do not compromise E2EE for convenience.**

---

## Phase 15 — Security Hardening

**STATUS: NOT STARTED**

- Threat model review (STRIDE)
- Secure key storage audit (hardware-backed on all platforms)
- Replay protection verification
- Rate limiting (auth, messages, relay, WebSocket)
- Certificate pinning (investigate — `expo-dev-client` required)
- Session security (short-lived access tokens, secure refresh)
- Token security (secure storage, rotation)
- Sealed sender investigation (metadata minimization)
- Metadata minimization (no conversation participants in relay)
- Secure logging (no PII, no message content)
- Dependency security (audit, SBOM, dependabot)
- Backup security (encryption, integrity, access control)
- Biometric app lock (local authentication)

**Do not mark complete simply because encryption exists.**

---

## Phase 16 — Testing & Reliability

**STATUS: NOT COMPLETE**

### Unit Tests
- Crypto primitives (encryption, keys, backup)
- Database repositories (CRUD, queries, transactions)
- Sync queue processor (priority, retry, backoff, idempotency)
- State transitions (auth, conversation, message status)

### Integration Tests
- Authentication flow (OTP, device registration, refresh)
- Backend API (all endpoints, validation, auth)
- Relay + delivery ACK flow
- Retry & duplicate handling
- Sync incremental + full

### E2E Tests (Detox / Playwright)
- Sender online / Receiver online
- Sender offline / Receiver online
- Receiver offline (relay storage, retry)
- Both offline (local queue, flush on reconnect)
- Network loss mid-transaction
- App crash during write (WAL recovery)
- Duplicate delivery (ACK race)
- ACK failure (timeout, retry)
- Backup → Restore → Verify
- Device replacement (new device, restore backup)

---

## Phase 17 — Production & DevOps

**STATUS: PARTIALLY COMPLETE**

- GitHub Actions CI (typecheck, lint, test)
- EAS Build configuration (development, preview, production)
- Semantic Release (automated versioning, changelog)
- **Release automation ONLY on:**
  ```yaml
  on:
    push:
      branches:
        - main
  ```
- Feature branches must NEVER create releases
- Database migration strategy (Drizzle migrations, backward compatible)
- Monitoring (health endpoints, metrics)
- Logging (structured, correlated, no secrets)
- Secrets management (EAS secrets, GitHub Environments)
- Backup strategy (PostgreSQL PITR, S3 versioning)

---

## Discrepancy Notes

| Original Label | Actual Status | Note |
|----------------|---------------|------|
| "Phase 0–11 completed" | Phases 0–9 complete, 10+ not started | Previous phase numbering was informal/client-side only |
| "Signal-level E2EE" | NOT implemented | Current: ephemeral-key-per-message (Phase 3 partial) |
| "Backend exists" | NOT implemented | Documented in `docs/backend.md`, `docs/api.md` only |
| "Multi-device" | NOT implemented | Architecture designed, no code |

---

## Current Priority

**Phase 10 — Backend & Temporary Relay** is the immediate blocker. The frontend is feature-complete for a single-device MVP but cannot function without a backend.

After Phase 10: Phase 11 (Signal Protocol) is the critical security milestone before any production consideration.