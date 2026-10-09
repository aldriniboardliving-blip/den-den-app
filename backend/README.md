# Den Den Backend

NestJS + PostgreSQL + Drizzle ORM backend for the Den Den E2E encrypted messaging app.

## Architecture

```
backend/
├── src/
│   ├── auth/           # OTP authentication, JWT tokens, device registration
│   ├── users/          # User profiles, search, contacts
│   ├── devices/        # Device identity, prekey management (X3DH)
│   ├── conversations/  # Conversation metadata, membership
│   ├── messages/       # Message relay (encrypted envelopes only)
│   ├── relay/          # Temporary message storage, delivery notification
│   ├── delivery/       # Acknowledgment processing, retry logic
│   ├── attachments/    # Encrypted file upload/download (presigned S3)
│   ├── notifications/  # Push tokens, Expo/FCM/APNs dispatch
│   ├── health/         # Liveness/readiness probes
│   ├── realtime/       # WebSocket gateway (Socket.io)
│   └── common/         # Database, guards, decorators, pipes, filters
├── drizzle/            # Generated migrations
└── prisma/             # (Not used - Drizzle instead)
```

## Key Design Decisions

### Temporary Relay Only
- Backend **never stores plaintext messages**
- Messages are encrypted client-side (X25519 + AES-256-GCM)
- Backend stores only encrypted envelopes in `relay_messages` table
- Envelopes deleted **only after** recipient confirms local persistence (ACK)

### Idempotency
- Every client mutation includes `idempotency-key` header
- Server deduplicates using `sync_operations` table
- At-least-once delivery semantics with client-side deduplication

### X3DH Key Agreement
- Devices register identity key, signed prekey, 100 one-time prekeys
- Sender fetches recipient's prekey bundle via `/devices/:id/prekey-bundle`
- Session establishment happens client-side

### WebSocket Protocol
- Namespace: `/realtime`
- Auth: JWT in handshake auth + deviceId
- Events: MESSAGE_NEW, MESSAGE_DELIVERED, MESSAGE_READ, TYPING_START/STOP, SYNC_REQUIRED
- Client sends ACK with `status: 'PERSISTED_LOCALLY'` after SQLite write succeeds

## API Endpoints

### Authentication
```
POST /api/v1/auth/send-otp           # Send OTP to email/phone
POST /api/v1/auth/verify-otp         # Verify OTP + register device
POST /api/v1/auth/refresh            # Refresh access token
```

### Devices
```
GET  /api/v1/devices                 # List user devices
GET  /api/v1/devices/:id/prekey-bundle  # Get X3DH prekey bundle
PATCH /api/v1/devices/:id/signed-prekey # Rotate signed prekey
POST /api/v1/devices/:id/onetime-prekeys # Add one-time prekeys
DELETE /api/v1/devices/:id           # Revoke device
POST /api/v1/devices/update-activity # Update last active
```

### Conversations
```
POST   /api/v1/conversations         # Create conversation
GET    /api/v1/conversations         # List user conversations
GET    /api/v1/conversations/:id     # Get conversation
POST   /api/v1/conversations/:id/members  # Add member
DELETE /api/v1/conversations/:id/members/:deviceId # Remove member
PATCH  /api/v1/conversations/:id/disappearing-timer # Update timer
```

### Messages
```
POST   /api/v1/messages              # Send encrypted envelope
GET    /api/v1/messages/pending      # Get pending for current device
POST   /api/v1/messages/:id/ack      # Acknowledge delivery (triggers relay deletion)
GET    /api/v1/messages/conversations/:conversationId # Get conversation messages
POST   /api/v1/messages/:id/read     # Mark as read
```

### Attachments
```
POST   /api/v1/attachments/upload-url  # Get presigned upload URL
POST   /api/v1/attachments/:id/confirm # Confirm upload complete
GET    /api/v1/attachments/:id/download-url # Get presigned download URL
GET    /api/v1/attachments/messages/:messageId # Get message attachments
DELETE /api/v1/attachments/:id       # Delete attachment
```

### Notifications
```
POST   /api/v1/push-tokens           # Register push token
DELETE /api/v1/push-tokens/:token    # Unregister push token
```

### Health
```
GET /api/v1/health          # Liveness
GET /api/v1/health/ready    # Readiness
GET /api/v1/health/info     # Service info
```

## WebSocket Events

### Client → Server
```typescript
// Authentication (handshake)
{ token: "jwt", deviceId: "uuid" }

// Acknowledgments
{ event: "ACK", data: { serverMessageId: "uuid", status: "PERSISTED_LOCALLY" } }

// Read receipts
{ event: "READ", data: { serverMessageId: "uuid" } }

// Sync
{ event: "SYNC_REQUEST", data: { since: "ISO8601" } }

// Typing
{ event: "TYPING_START", data: { conversationId: "uuid" } }
{ event: "TYPING_STOP", data: { conversationId: "uuid" } }
```

### Server → Client
```typescript
// New message available
{ event: "MESSAGE_NEW", data: { messageId: "uuid" } }

// Delivery confirmation
{ event: "MESSAGE_DELIVERED", data: { serverMessageId: "uuid", recipientDeviceId: "uuid" } }

// Read receipt
{ event: "MESSAGE_READ", data: { serverMessageId: "uuid", recipientDeviceId: "uuid" } }

// Conversation changes
{ event: "CONVERSATION_CREATED/UPDATED/DELETED", data: { ... } }

// Contact changes
{ event: "CONTACT_ADDED/VERIFIED/BLOCKED", data: { ... } }

// Key rotation
{ event: "KEY_ROTATION", data: { deviceId: "uuid", signedPreKeyId: 123 } }

// Full sync needed
{ event: "SYNC_REQUIRED", data: { reason: "DEVICE_ADDED|KEY_ROTATED|..." } }

// Typing indicators
{ event: "TYPING_START/STOP", data: { deviceId: "uuid", conversationId: "uuid" } }
```

## Local Development

```bash
# Start dependencies
docker-compose up -d postgres redis minio

# Run migrations
npm run db:migrate

# Start backend
npm run start:dev
```

## Environment Variables

See `.env.example` for all required variables.

## Testing

```bash
npm run test          # Unit tests
npm run test:watch    # Watch mode
npm run test:ui       # UI mode
```

## Production Deployment

```bash
# Build
npm run build

# Run migrations
npm run db:migrate

# Start
npm run start:prod
```

Docker image built with multi-stage build for minimal size.