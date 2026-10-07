# Den Den Architecture

## Overview

Den Den follows a **modular monolith architecture** with clear separation between the mobile client and backend services. The architecture prioritizes privacy, offline-first operation, and end-to-end encryption.

## High-Level Architecture

```text
                    DEN DEN
                       |
            +----------+----------+
            |                     |
        MOBILE APP             BACKEND
            |                     |
       Expo + TypeScript        NestJS
            |                     |
       Expo Router            REST + WebSocket
            |                     |
        SQLite                 PostgreSQL
            |                     |
       Local State           Temporary Relay
            |                     |
      Encryption Layer            |
            |                     |
       Sync Queue                |
            |                     |
            +----------------------+
```

## Core Principles

### 1. Device-First Ownership
- The user's device is the **primary owner** of conversation data
- The backend is a **temporary encrypted relay** only
- No plaintext messages ever stored on the server

### 2. Offline-First Design
- All operations work without internet connectivity
- Local SQLite database is the source of truth
- Sync queue persists operations for later execution
- UI never blocks on network requests

### 3. End-to-End Encryption
- Messages encrypted on sender's device before leaving
- Server only handles encrypted envelopes
- Keys never leave user's device (except during encrypted backup)
- Forward secrecy through key rotation

### 4. Reliable Delivery
- At-least-once delivery semantics
- Idempotent message processing
- Delivery acknowledgments required before server deletion
- Automatic retry with exponential backoff

## System Components

### Mobile Application (Expo + React Native)

| Layer | Technology | Purpose |
|-------|------------|---------|
| Navigation | Expo Router | File-based routing, deep linking |
| State Management | Zustand | Lightweight global state |
| Data Fetching | TanStack Query | Server state, caching, mutations |
| Local Database | Expo SQLite (SQLite) | Offline-first data persistence |
| Encryption | libsodium / Web Crypto API | E2EE primitives |
| Background Tasks | expo-task-manager | Sync queue processing |

#### Mobile Module Structure
```
src/
├── app/                    # Expo Router screens (routes only)
├── components/             # Shared UI components
├── features/               # Feature-based modules
│   ├── auth/              # Authentication flows
│   ├── chat/              # Messaging UI & logic
│   ├── contacts/          # Contact management
│   ├── backup/            # Export/import functionality
│   └── settings/          # App preferences
├── database/               # SQLite schema, migrations, queries
├── crypto/                 # Encryption, key management
├── api/                    # API client, types
├── realtime/               # WebSocket connection management
├── sync/                   # Sync queue, offline operations
├── store/                  # Zustand stores
├── hooks/                  # Shared React hooks
├── types/                  # Shared TypeScript types
└── utils/                  # Utilities, helpers
```

### Backend (NestJS + TypeScript)

| Module | Responsibility |
|--------|----------------|
| `auth` | Authentication, OTP, session management |
| `users` | User profiles, account management |
| `devices` | Device registration, key management |
| `conversations` | Conversation metadata (no messages) |
| `messages` | Encrypted envelope relay, delivery tracking |
| `relay` | Temporary message storage, routing |
| `delivery` | Acknowledgment processing, retry logic |
| `attachments` | Encrypted file upload/download |
| `notifications` | Push token registration, APNs/FCM |
| `health` | Health checks, metrics |
| `common` | Shared guards, interceptors, pipes |

#### Backend Module Structure
```
backend/src/
├── auth/
├── users/
├── devices/
├── conversations/
├── messages/
├── relay/
├── delivery/
├── attachments/
├── notifications/
├── health/
└── common/
```

## Data Flow

### Message Send Flow
```
1. User composes message
2. Save to local SQLite (status: PENDING)
3. Encrypt with recipient's public key
4. Add to sync queue (MESSAGE_SEND)
5. Upload encrypted envelope to backend
6. Backend stores in relay table (status: RECEIVED_BY_SERVER)
7. Backend notifies recipient via WebSocket/push
8. Recipient downloads envelope
9. Recipient decrypts and persists locally
10. Recipient sends ACK to backend
11. Backend verifies ACK, deletes relay message
12. Sender updates local status to DELIVERED
```

### Sync Queue Processing
```
1. App starts / connectivity restored
2. Process sync_queue ordered by created_at
3. For each operation:
   - Execute with retry logic
   - On success: mark COMPLETED
   - On failure: increment attempt_count, schedule retry
4. Max retries reached → mark FAILED, notify user
```

## Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      USER'S DEVICE                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Plaintext   │  │ Encryption  │  │ Encrypted Envelope  │  │
│  │ Messages    │──▶│   Layer     │──▶│   (ciphertext)      │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
└─────────────────────────────────────────────────│────────────┘
                                                  │ TLS
                                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Relay       │  │ Auth &      │  │ Push Notification   │  │
│  │ (encrypted  │  │ Device Mgmt │  │ (metadata only)     │  │
│  │  envelopes) │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                                                             │
│  NEVER: Plaintext messages, private keys, backup passwords  │
└─────────────────────────────────────────────────────────────┘
```

## Security Boundaries

| Boundary | Protection |
|----------|------------|
| Device ↔ Server | TLS 1.3, Certificate pinning (future) |
| Message encryption | X25519 + AES-256-GCM / ChaCha20-Poly1305 |
| Key storage | Platform secure enclave / keystore |
| Backup encryption | Argon2id + AES-256-GCM |
| Authentication | OTP + device-bound keys |
| API | Rate limiting, request validation, JWT |

## Future Multi-Device Support

The architecture supports multi-device without redesign:

```
User Account
    │
    ├── Device A (primary) ── Keys: identity, signed prekey, onetime prekeys
    ├── Device B ── Keys: identity, signed prekey, onetime prekeys
    └── Device C ── Keys: identity, signed prekey, onetime prekeys
```

Each device has independent cryptographic identity. Messages encrypt to all recipient devices.

## Deployment Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Mobile    │────▶│  API Gateway │────▶│  NestJS     │
│   Apps      │     │  (optional)  │     │  Backend    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐            │
                    │  PostgreSQL │◀───────────┘
                    │  (relay,    │
                    │   auth,     │
                    │   devices)  │
                    └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Object     │
                    │  Storage    │
                    │ (attachments)│
                    └─────────────┘
```

## Technology Decisions

| Area | Choice | Rationale |
|------|--------|-----------|
| Mobile Framework | Expo + React Native | Cross-platform, managed workflow, fast iteration |
| Navigation | Expo Router | File-based, type-safe, React Native native |
| Local DB | Expo SQLite | Native SQLite, no sync conflicts, mature |
| State | Zustand | Simple, no boilerplate, TypeScript-first |
| Server State | TanStack Query | Caching, mutations, offline persistence |
| Backend | NestJS | Modular, TypeScript-native, good DX |
| ORM | Drizzle ORM | Lightweight, type-safe, SQL-like, no magic |
| Database | PostgreSQL | ACID, JSONB, mature, reliable |
| Realtime | WebSocket (ws) | Low latency, bidirectional, standard |
| Push | Expo Push / FCM / APNs | Cross-platform, managed |
| CI/CD | GitHub Actions | Integrated, free for public, flexible |
| Versioning | Semantic Versioning | Clear communication of changes |

## References

- [Database Schema](database.md)
- [API Design](api.md)
- [Encryption Design](encryption.md)
- [Security Model](security.md)
- [Offline-First Design](offline-first.md)
- [Frontend Architecture](frontend.md)
- [Backend Architecture](backend.md)
- [Backup & Recovery](backup-recovery.md)