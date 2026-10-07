# Den Den API Design

## Overview

RESTful API with versioned endpoints, WebSocket for realtime, and strict security model. All endpoints require authentication unless marked public.

## Base Configuration

| Property | Value |
|----------|-------|
| Base URL | `https://api.den-den.app` |
| API Version | `v1` |
| Protocol | HTTPS only |
| Authentication | JWT Bearer token |
| Content-Type | `application/json` |
| Rate Limit | 100 req/15min per IP (auth: 500 req/15min per user) |
| Idempotency | `Idempotency-Key` header for mutations |

## Authentication

### Headers
```
Authorization: Bearer <access_token>
X-Device-ID: <device_uuid>
Idempotency-Key: <uuid>  # Required for POST/PUT/PATCH
```

### Token Types
| Token | TTL | Usage |
|-------|-----|-------|
| Access Token | 15 min | API requests |
| Refresh Token | 30 days | Token renewal (stored httpOnly cookie) |

### Device Identity
Every request must include `X-Device-ID` header matching a registered device for the authenticated user.

---

## Error Response Format

All errors follow RFC 7807 Problem Details:

```json
{
  "type": "https://api.den-den.app/errors/validation-error",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Request validation failed",
  "instance": "/api/v1/auth/register",
  "errors": [
    {
      "field": "email",
      "code": "invalid_format",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2026-01-15T10:30:00.000Z",
  "requestId": "req_abc123"
}
```

### Common Error Types

| Status | Type | Description |
|--------|------|-------------|
| 400 | `validation-error` | Request body/query invalid |
| 401 | `unauthorized` | Missing/invalid/expired token |
| 403 | `forbidden` | Valid token but insufficient permissions |
| 404 | `not-found` | Resource doesn't exist |
| 409 | `conflict` | Resource conflict (duplicate, version mismatch) |
| 422 | `unprocessable` | Semantic validation failed |
| 429 | `rate-limited` | Too many requests |
| 500 | `internal-error` | Server error (logged, not exposed) |
| 503 | `service-unavailable` | Temporary overload |

---

## API Endpoints

### Authentication (`/api/v1/auth`)

#### POST `/api/v1/auth/otp/request`
Request OTP code for registration or login.

**Public endpoint** - No auth required.

**Request:**
```json
{
  "identifier": "user@example.com",
  "type": "EMAIL",
  "purpose": "REGISTER"
}
```

**Response (202):**
```json
{
  "message": "OTP sent",
  "expiresIn": 300
}
```

#### POST `/api/v1/auth/otp/verify`
Verify OTP and receive tokens.

**Public endpoint** - No auth required.

**Request:**
```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "type": "EMAIL",
  "purpose": "REGISTER",
  "deviceInfo": {
    "deviceId": "device_uuid",
    "deviceName": "iPhone 15",
    "platform": "ios",
    "platformVersion": "17.2",
    "appVersion": "1.0.0",
    "identityKeyPublic": "base64_x25519_pub",
    "signedPrekeyPublic": "base64_x25519_pub",
    "signedPrekeySignature": "base64_ed25519_sig",
    "signedPrekeyCreatedAt": "2026-01-15T10:30:00.000Z",
    "onetimePrekeys": [
      {"id": 1, "publicKey": "base64_x25519_pub"}
    ]
  }
}
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",  // Also set as httpOnly cookie
  "user": {
    "id": "uuid",
    "accountId": "den_abc123",
    "displayName": "John Doe"
  },
  "device": {
    "id": "device_uuid",
    "isPrimary": true
  }
}
```

#### POST `/api/v1/auth/refresh`
Refresh access token using refresh token.

**Request:** (Refresh token in httpOnly cookie)

**Response (200):**
```json
{
  "accessToken": "eyJ..."
}
```

#### POST `/api/v1/auth/logout`
Revoke current session.

**Auth required.**

**Response (204):** No content.

#### POST `/api/v1/auth/logout-all`
Revoke all sessions for user.

**Auth required.**

**Response (204):** No content.

---

### Users (`/api/v1/users`)

#### GET `/api/v1/users/me`
Get current user profile.

**Auth required.**

**Response (200):**
```json
{
  "id": "uuid",
  "accountId": "den_abc123",
  "displayName": "John Doe",
  "avatarUrl": "https://...",
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

#### PATCH `/api/v1/users/me`
Update profile.

**Auth required.**

**Request:**
```json
{
  "displayName": "John Smith",
  "avatarUrl": "https://..."
}
```

**Response (200):** Updated user object.

#### DELETE `/api/v1/users/me`
Delete account (GDPR).

**Auth required.** Requires password/OTP confirmation.

**Response (204):** No content.

---

### Devices (`/api/v1/devices`)

#### GET `/api/v1/devices`
List registered devices.

**Auth required.**

**Response (200):**
```json
{
  "devices": [
    {
      "id": "device_uuid",
      "deviceName": "iPhone 15",
      "platform": "ios",
      "platformVersion": "17.2",
      "appVersion": "1.0.0",
      "isPrimary": true,
      "registeredAt": "2026-01-15T10:30:00.000Z",
      "lastActiveAt": "2026-01-15T10:30:00.000Z",
      "identityKeyPublic": "base64_x25519_pub"
    }
  ]
}
```

#### POST `/api/v1/devices`
Register new device.

**Auth required.** `Idempotency-Key` required.

**Request:**
```json
{
  "deviceId": "new_device_uuid",
  "deviceName": "iPad Pro",
  "platform": "ios",
  "platformVersion": "17.2",
  "appVersion": "1.0.0",
  "identityKeyPublic": "base64_x25519_pub",
  "signedPrekeyPublic": "base64_x25519_pub",
  "signedPrekeySignature": "base64_ed25519_sig",
  "signedPrekeyCreatedAt": "2026-01-15T10:30:00.000Z",
  "onetimePrekeys": [
    {"id": 1, "publicKey": "base64_x25519_pub"}
  ]
}
```

**Response (201):** Device object.

#### PATCH `/api/v1/devices/:deviceId`
Update device (name, push token).

**Auth required.** Device must belong to user.

#### DELETE `/api/v1/devices/:deviceId`
Revoke device.

**Auth required.** Cannot revoke current device via this endpoint (use logout).

---

### Conversations (`/api/v1/conversations`)

#### GET `/api/v1/conversations`
List user's conversations.

**Auth required.**

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | integer | 50 | Max results (1-100) |
| cursor | string | - | Pagination cursor |
| includeArchived | boolean | false | Include archived |

**Response (200):**
```json
{
  "conversations": [
    {
      "id": "conv_uuid",
      "type": "DIRECT",
      "title": null,
      "avatarUrl": null,
      "members": [
        {
          "deviceId": "device_uuid",
          "accountId": "den_abc123",
          "displayName": "Jane Doe",
          "role": "MEMBER"
        }
      ],
      "lastMessage": {
        "id": "msg_uuid",
        "type": "TEXT",
        "senderId": "device_uuid",
        "sentAt": "2026-01-15T10:30:00.000Z"
      },
      "unreadCount": 3,
      "isPinned": false,
      "muteUntil": null,
      "updatedAt": "2026-01-15T10:30:00.000Z"
    }
  ],
  "nextCursor": "cursor_string"
}
```

#### POST `/api/v1/conversations`
Create conversation.

**Auth required.** `Idempotency-Key` required.

**Request (Direct):**
```json
{
  "type": "DIRECT",
  "recipientAccountId": "den_xyz789"
}
```

**Request (Group):**
```json
{
  "type": "GROUP",
  "title": "Family",
  "memberAccountIds": ["den_xyz789", "den_def456"]
}
```

**Response (201):** Conversation object.

#### GET `/api/v1/conversations/:conversationId`
Get conversation details.

**Auth required.** User must be member.

#### PATCH `/api/v1/conversations/:conversationId`
Update conversation (group only: title, avatar, admins).

**Auth required.** User must be admin.

#### DELETE `/api/v1/conversations/:conversationId`
Leave/delete conversation.

**Auth required.** Admin can delete; member can leave.

#### POST `/api/v1/conversations/:conversationId/members`
Add members (group only).

**Auth required.** User must be admin.

**Request:**
```json
{
  "accountIds": ["den_new123"]
}
```

#### DELETE `/api/v1/conversations/:conversationId/members/:deviceId`
Remove member (group only).

**Auth required.** User must be admin or removing self.

---

### Messages (`/api/v1/messages`)

#### POST `/api/v1/messages/send`
Send encrypted message envelope.

**Auth required.** `Idempotency-Key` required (client message ID).

**Request:**
```json
{
  "messageId": "msg_uuid_v7",  // Client-generated UUIDv7
  "conversationId": "conv_uuid",
  "recipientDeviceId": "device_uuid",
  "ciphertext": "base64_encrypted_content",
  "nonce": "base64_nonce",
  "senderKeyId": 123,
  "encryptionAlgorithm": "X25519-AES256GCM",
  "contentType": "TEXT",
  "attachmentId": "attach_uuid"  // Optional
}
```

**Response (202):**
```json
{
  "messageId": "msg_uuid_v7",
  "serverMessageId": "server_uuid",
  "status": "RECEIVED_BY_SERVER",
  "receivedAt": "2026-01-15T10:30:00.000Z"
}
```

**Note:** Server does NOT decrypt. Validates envelope structure only.

#### GET `/api/v1/messages/sync`
Sync messages since last sync (for initial load/catch-up).

**Auth required.**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| since | timestamp | ISO 8601 timestamp |
| conversationId | uuid | Optional filter |
| limit | integer | Max 500 |

**Response (200):**
```json
{
  "messages": [
    {
      "messageId": "msg_uuid_v7",
      "serverMessageId": "server_uuid",
      "conversationId": "conv_uuid",
      "senderDeviceId": "device_uuid",
      "ciphertext": "base64",
      "nonce": "base64",
      "senderKeyId": 123,
      "encryptionAlgorithm": "X25519-AES256GCM",
      "contentType": "TEXT",
      "status": "RECEIVED_BY_SERVER",
      "receivedAt": "2026-01-15T10:30:00.000Z"
    }
  ],
  "nextCursor": "cursor_string"
}
```

#### POST `/api/v1/messages/ack`
Acknowledge message delivery (client confirms local persistence).

**Auth required.**

**Request:**
```json
{
  "serverMessageId": "server_uuid",
  "status": "PERSISTED_LOCALLY"
}
```

**Response (200):**
```json
{
  "acknowledged": true,
  "deletedFromRelay": true
}
```

**Server Behavior:**
1. Verify message exists and recipient matches current device
2. Update status to `ACKNOWLEDGED`
3. **Delete from relay** only after `PERSISTED_LOCALLY` confirmed
4. Notify sender via WebSocket

#### POST `/api/v1/messages/read`
Send read receipt.

**Auth required.**

**Request:**
```json
{
  "serverMessageId": "server_uuid",
  "readAt": "2026-01-15T10:30:00.000Z"
}
```

**Response (200):** Success.

---

### Attachments (`/api/v1/attachments`)

#### POST `/api/v1/attachments/upload-url`
Get presigned upload URL.

**Auth required.** `Idempotency-Key` required.

**Request:**
```json
{
  "filename": "photo.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 1048576,
  "conversationId": "conv_uuid"
}
```

**Response (201):**
```json
{
  "attachmentId": "attach_uuid",
  "uploadUrl": "https://s3.example.com/presigned-url",
  "storageKey": "attachments/conv_uuid/attach_uuid.jpg",
  "expiresAt": "2026-01-15T11:30:00.000Z",
  "encryptionKey": "base64_encrypted_aes_key"  // Encrypted with recipient's key
}
```

#### POST `/api/v1/attachments/:attachmentId/complete`
Confirm upload complete.

**Auth required.**

**Request:**
```json
{
  "sha256": "hex_hash_of_encrypted_file"
}
```

**Response (200):** Attachment metadata.

#### GET `/api/v1/attachments/:attachmentId/download-url`
Get presigned download URL.

**Auth required.** User must be conversation participant.

**Response (200):**
```json
{
  "downloadUrl": "https://s3.example.com/presigned-url",
  "expiresAt": "2026-01-15T11:30:00.000Z",
  "encryptionKey": "base64_encrypted_aes_key",
  "nonce": "base64_nonce"
}
```

---

### Contacts (`/api/v1/contacts`)

#### GET `/api/v1/contacts`
List contacts.

**Auth required.**

**Query:** `limit`, `cursor`, `query` (search)

#### POST `/api/v1/contacts`
Add contact by account ID.

**Auth required.** `Idempotency-Key` required.

**Request:**
```json
{
  "accountId": "den_xyz789"
}
```

#### DELETE `/api/v1/contacts/:contactId`
Remove contact.

---

### Push Notifications (`/api/v1/push`)

#### POST `/api/v1/push/token`
Register push token.

**Auth required.**

**Request:**
```json
{
  "token": "expo_push_token_xxx",
  "platform": "ios"
}
```

#### DELETE `/api/v1/push/token`
Unregister push token.

---

### Health (`/api/v1/health`)

#### GET `/api/v1/health`
Liveness probe.

**Public.**

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:00.000Z"
}
```

#### GET `/api/v1/health/ready`
Readiness probe.

**Public.**

**Response (200):**
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}
```

---

## WebSocket API (`wss://api.den-den.app/realtime`)

### Connection
```
wss://api.den-den.app/realtime?token=<access_token>&deviceId=<device_uuid>
```

### Authentication
- Token validated on connection
- Device ID must match authenticated user
- Reconnection with same token allowed

### Message Format
```json
{
  "type": "MESSAGE_NEW",
  "payload": { ... },
  "timestamp": "2026-01-15T10:30:00.000Z",
  "id": "ws_msg_uuid"
}
```

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `MESSAGE_NEW` | `{messageEnvelope, conversationId}` | New message received |
| `MESSAGE_DELIVERED` | `{serverMessageId, recipientDeviceId}` | Delivery confirmed |
| `MESSAGE_READ` | `{serverMessageId, readAt}` | Read receipt |
| `MESSAGE_DELETED` | `{serverMessageId}` | Message deleted |
| `CONVERSATION_UPDATED` | `{conversationId, changes}` | Metadata changed |
| `CONTACT_ADDED` | `{contact}` | New contact |
| `CONTACT_REMOVED` | `{contactId}` | Contact removed |
| `DEVICE_ADDED` | `{device}` | New device registered |
| `DEVICE_REVOKED` | `{deviceId}` | Device revoked |
| `SYNC_REQUIRED` | `{reason}` | Full sync needed |
| `PING` | `{}` | Keepalive (every 30s) |

### Client → Server Messages

| Message | Payload | Description |
|---------|---------|-------------|
| `PONG` | `{}` | Respond to ping |
| `ACK` | `{serverMessageId, status}` | Message acknowledgment |
| `READ` | `{serverMessageId}` | Read receipt |
| `SYNC_REQUEST` | `{since, conversationId}` | Request sync |
| `TYPING_START` | `{conversationId}` | Typing indicator |
| `TYPING_STOP` | `{conversationId}` | Stop typing |

### Reconnection Logic
1. Client detects disconnect
2. Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
3. On reconnect: send `SYNC_REQUEST` with last known timestamp
4. Server responds with missed messages

---

## Rate Limiting

| Tier | Limit | Window |
|------|-------|--------|
| Anonymous | 100 req | 15 min |
| Authenticated | 500 req | 15 min |
| Auth (write) | 100 req | 15 min |
| OTP Request | 3 req | 1 hour |
| Device Register | 5 req | 1 hour |

Headers:
```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 499
X-RateLimit-Reset: 1705315800
Retry-After: 60  # On 429
```

---

## Idempotency

All mutating endpoints (POST, PUT, PATCH, DELETE) require `Idempotency-Key` header:
- UUIDv4 generated by client per operation
- Server stores key + response for 24 hours
- Duplicate key returns cached response (200/201)
- Prevents duplicate messages, double charges, etc.

---

## Pagination

Cursor-based pagination for all list endpoints:
```json
{
  "data": [...],
  "nextCursor": "base64_encoded_cursor",
  "hasMore": true
}
```

Client passes `cursor` query parameter for next page.

---

## Versioning

- URL path versioning: `/api/v1/`
- Breaking changes → new version (`v2`)
- Non-breaking: Add fields, new endpoints, new optional params
- Deprecation: 6 months notice, `Sunset` header

---

## Security Headers

All responses include:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'none'
Referrer-Policy: no-referrer
Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()
```

---

## OpenAPI Specification

Full OpenAPI 3.1 spec available at:
- Development: `http://localhost:3000/api/docs`
- Production: `https://api.den-den.app/api/docs`

Generated from NestJS decorators + Zod schemas.

---

## References

- [Architecture](architecture.md)
- [Backend](backend.md)
- [Database](database.md)
- [Security](security.md)
- [Encryption](encryption.md)