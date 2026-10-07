# Den Den Backend Architecture

## Technology Decision: Drizzle ORM over Prisma

### Decision: **Drizzle ORM**

After evaluating both options for the Den Den backend, we choose **Drizzle ORM** for the following reasons:

| Factor | Prisma | Drizzle | Winner |
|--------|--------|---------|--------|
| **Type Safety** | Excellent (generated client) | Excellent (inferred from schema) | Tie |
| **Bundle Size** | ~10MB (engine + client) | ~1MB (no runtime engine) | Drizzle |
| **Cold Start** | Slower (engine startup) | Instant (no engine) | Drizzle |
| **SQL Control** | Limited (query abstraction) | Full (SQL-like API) | Drizzle |
| **Migrations** | `prisma migrate` | `drizzle-kit` (SQL-based) | Drizzle |
| **Edge/Serverless** | Requires Data Proxy | Native support | Drizzle |
| **Learning Curve** | Higher (DSL, generators) | Lower (TypeScript, SQL) | Drizzle |
| **Debugging** | Harder (generated code) | Easier (readable queries) | Drizzle |
| **Performance** | Good (with caveats) | Excellent (near-native SQL) | Drizzle |
| **Ecosystem Maturity** | Very mature | Rapidly growing, production-ready | Prisma (slight) |

### Why Drizzle Fits Den Den

1. **Minimal runtime overhead** - Critical for serverless/edge deployment
2. **Full SQL control** - We need precise control over queries for:
   - Encrypted envelope routing (no ORM magic)
   - Complex sync/ack queries
   - Temporary message TTL cleanup
3. **Type-safe without codegen** - Schema is the single source of truth
4. **SQLite (local) + PostgreSQL (server) parity** - Same query API
5. **No `prisma generate` step** - Faster CI, simpler DX

### Prisma Would Be Better If
- We needed a visual database browser (Prisma Studio)
- Team strongly prefers declarative schema over code-first
- Complex relation-heavy queries with deep nesting (we don't have this)

---

## Backend Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | NestJS | 10.x |
| Language | TypeScript | 5.x |
| ORM | Drizzle ORM | 0.30+ |
| Database | PostgreSQL | 16+ |
| Validation | Zod + class-validator | Latest |
| Auth | JWT + Passport | Latest |
| WebSocket | `@nestjs/websockets` + `ws` | Latest |
| Push | Expo Push Service / FCM / APNs | Latest |
| Logging | Pino | Latest |
| Config | `@nestjs/config` + Zod | Latest |
| Testing | Vitest + Supertest | Latest |

---

## Project Structure

```
backend/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── dto/
│   │   ├── guards/
│   │   ├── strategies/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── users/                   # User management
│   ├── devices/                 # Device registration & keys
│   ├── conversations/           # Conversation metadata
│   ├── messages/                # Message relay & delivery
│   ├── relay/                   # Temporary message storage
│   ├── delivery/                # Acknowledgment processing
│   ├── attachments/             # File upload/download
│   ├── notifications/           # Push notifications
│   ├── health/                  # Health checks
│   ├── common/                  # Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   ├── config/                  # Configuration
│   │   ├── configuration.ts
│   │   ├── validation.ts
│   │   └── env.schema.ts
│   ├── database/                # Drizzle setup
│   │   ├── drizzle.module.ts
│   │   ├── drizzle.service.ts
│   │   ├── schema/
│   │   │   ├── users.ts
│   │   │   ├── devices.ts
│   │   │   ├── conversations.ts
│   │   │   ├── messages.ts
│   │   │   ├── attachments.ts
│   │   │   └── index.ts
│   │   └── migrations/
│   └── main.ts                  # Application entry
├── drizzle.config.ts            # Drizzle Kit config
├── package.json
├── tsconfig.json
├── .env.example
└── Dockerfile
```

---

## Database Schema (PostgreSQL)

### Core Tables

```sql
-- Users (accounts)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(64) NOT NULL UNIQUE,  -- Public Den Den ID
    display_name VARCHAR(128),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Devices (cryptographic identities)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(128),
    platform VARCHAR(32) NOT NULL,  -- ios, android, web
    platform_version VARCHAR(32),
    app_version VARCHAR(32),
    -- Cryptographic identity (public only)
    identity_key_public TEXT NOT NULL,      -- X25519 base64
    signed_prekey_public TEXT NOT NULL,     -- X25519 base64
    signed_prekey_signature TEXT NOT NULL,  -- Ed25519 base64
    signed_prekey_created_at TIMESTAMPTZ NOT NULL,
    onetime_prekeys JSONB NOT NULL DEFAULT '[]',  -- [{id, public_key, created_at}]
    -- State
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    push_token TEXT,                        -- Expo/FCM/APNs token
    push_token_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_push_token ON devices(push_token) WHERE push_token IS NOT NULL;

-- Conversations (metadata only)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(16) NOT NULL DEFAULT 'DIRECT',  -- DIRECT, GROUP
    title VARCHAR(256),                          -- Group name
    avatar_url TEXT,
    created_by UUID REFERENCES devices(id),
    admin_device_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Conversation members
CREATE TABLE conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'MEMBER',  -- ADMIN, MEMBER
    sender_key_public TEXT,                       -- For group sender keys
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(conversation_id, device_id)
);

CREATE INDEX idx_conversation_members_conversation ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_device ON conversation_members(device_id);

-- Message envelopes (temporary relay storage)
CREATE TABLE message_envelopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(64) NOT NULL UNIQUE,  -- Client-generated UUIDv7
    sender_device_id UUID NOT NULL REFERENCES devices(id),
    recipient_device_id UUID NOT NULL REFERENCES devices(id),
    conversation_id UUID NOT NULL REFERENCES conversations(id),
    -- Encrypted envelope
    ciphertext TEXT NOT NULL,                 -- Base64 encrypted content
    nonce TEXT NOT NULL,                      -- Base64 nonce
    sender_key_id INTEGER,                    -- Key ID used
    encryption_algorithm VARCHAR(32) NOT NULL, -- X25519-AES256GCM, etc.
    -- Delivery tracking
    status VARCHAR(16) NOT NULL DEFAULT 'RECEIVED_BY_SERVER',  -- RECEIVED_BY_SERVER, RECEIVED_BY_DEVICE, PERSISTED_LOCALLY, ACKNOWLEDGED
    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    -- TTL for cleanup (24-72 hours)
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours')
);

CREATE INDEX idx_message_envelopes_recipient ON message_envelopes(recipient_device_id, status);
CREATE INDEX idx_message_envelopes_sender ON message_envelopes(sender_device_id);
CREATE INDEX idx_message_envelopes_expires ON message_envelopes(expires_at) WHERE status != 'ACKNOWLEDGED';
CREATE INDEX idx_message_envelopes_conversation ON message_envelopes(conversation_id);

-- Delivery receipts
CREATE TABLE delivery_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_envelope_id UUID NOT NULL REFERENCES message_envelopes(id) ON DELETE CASCADE,
    recipient_device_id UUID NOT NULL REFERENCES devices(id),
    status VARCHAR(16) NOT NULL,  -- RECEIVED_BY_DEVICE, PERSISTED_LOCALLY, ACKNOWLEDGED
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_delivery_receipts_envelope ON delivery_receipts(message_envelope_id);
CREATE INDEX idx_delivery_receipts_device ON delivery_receipts(recipient_device_id);

-- Attachments (temporary storage metadata)
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_envelope_id UUID REFERENCES message_envelopes(id) ON DELETE SET NULL,
    filename VARCHAR(256) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,        -- Object storage key
    storage_bucket VARCHAR(64) NOT NULL,
    encryption_key TEXT NOT NULL,            -- Encrypted AES key (base64)
    nonce TEXT NOT NULL,                     -- Base64 nonce
    upload_status VARCHAR(16) NOT NULL DEFAULT 'PENDING',  -- PENDING, UPLOADED, FAILED
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_at TIMESTAMPTZ
);

CREATE INDEX idx_attachments_envelope ON attachments(message_envelope_id);
CREATE INDEX idx_attachments_expires ON attachments(expires_at) WHERE upload_status != 'UPLOADED';

-- Sessions (auth)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    refresh_token_hash TEXT NOT NULL,        -- bcrypt/argon2 hash
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE revoked_at IS NULL;

-- OTP codes (auth)
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(256) NOT NULL,        -- email or phone
    code_hash TEXT NOT NULL,                 -- bcrypt hash
    type VARCHAR(16) NOT NULL,               -- EMAIL, SMS
    purpose VARCHAR(32) NOT NULL,            -- REGISTER, LOGIN, DEVICE_ADD
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_identifier ON otp_codes(identifier, purpose, consumed_at) WHERE consumed_at IS NULL;
```

### Drizzle Schema Files

```typescript
// backend/src/database/schema/users.ts
import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: varchar('account_id', { length: 64 }).notNull().unique(),
    displayName: varchar('display_name', { length: 128 }),
    avatarUrl: text('avatar_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
    accountIdIdx: uniqueIndex('idx_users_account_id').on(table.accountId),
}));

export const devices = pgTable('devices', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    deviceName: varchar('device_name', { length: 128 }),
    platform: varchar('platform', { length: 32 }).notNull(),
    platformVersion: varchar('platform_version', { length: 32 }),
    appVersion: varchar('app_version', { length: 32 }),
    identityKeyPublic: text('identity_key_public').notNull(),
    signedPrekeyPublic: text('signed_prekey_public').notNull(),
    signedPrekeySignature: text('signed_prekey_signature').notNull(),
    signedPrekeyCreatedAt: timestamp('signed_prekey_created_at', { withTimezone: true }).notNull(),
    onetimePrekeys: jsonb('onetime_prekeys').notNull().default('[]'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    isPrimary: boolean('is_primary').notNull().default(false),
    pushToken: text('push_token'),
    pushTokenUpdatedAt: timestamp('push_token_updated_at', { withTimezone: true }),
}, (table) => ({
    userIdx: index('idx_devices_user').on(table.userId),
    pushTokenIdx: index('idx_devices_push_token').on(table.pushToken).where(sql`${table.pushToken} IS NOT NULL`),
}));

// ... similar for other tables
```

---

## Module Details

### 1. Auth Module (`auth/`)
- **OTP-based authentication** (email primary, SMS future)
- **Providers**: `EmailOTPProvider`, `SMSOTPProvider` (interface-based)
- **JWT access tokens** (15 min) + **refresh tokens** (30 days)
- **Device-bound sessions** - each device gets own session
- **Rate limiting** on OTP endpoints

### 2. Users Module (`users/`)
- Profile management (display name, avatar)
- Account deletion (GDPR compliance)
- Device listing

### 3. Devices Module (`devices/`)
- Device registration with cryptographic keys
- Prekey rotation (signed prekey weekly, onetime prekeys on demand)
- Push token management
- Device revocation (logout, lost device)

### 4. Conversations Module (`conversations/`)
- Create/list conversations
- Group management (add/remove members, admins)
- Conversation metadata only - **no messages**

### 5. Messages Module (`messages/`)
- **Envelope relay** - receive, store, forward encrypted envelopes
- **No decryption** - server never sees plaintext
- Delivery status tracking
- TTL-based cleanup (cron job)

### 6. Relay Module (`relay/`)
- Temporary message storage
- WebSocket push for online recipients
- Push notification fallback for offline
- Message deduplication (idempotency keys)

### 7. Delivery Module (`delivery/`)
- Process delivery acknowledgments
- Verify ACK before deleting relay message
- Retry logic for unacknowledged messages
- Metrics collection

### 8. Attachments Module (`attachments/`)
- Presigned URL generation for direct-to-storage upload
- Temporary storage (7 days TTL)
- Encryption key management (server never sees plaintext key)
- CDN integration (future)

### 9. Notifications Module (`notifications/`)
- Push token registration/validation
- APNs (iOS) + FCM (Android) + Expo Push
- **Payload**: Only conversation ID, sender ID, message type - **NO CONTENT**
- Silent push for background sync wake-up

### 10. Health Module (`health/`)
- Liveness/readiness probes
- Database connectivity
- Queue depths
- Memory/CPU metrics

---

## Common Patterns

### Configuration
```typescript
// backend/src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('30d'),
    OTP_EMAIL_ENABLED: z.coerce.boolean().default(true),
    OTP_SMS_ENABLED: z.coerce.boolean().default(false),
    PUSH_EXPO_ENABLED: z.coerce.boolean().default(true),
    PUSH_FCM_ENABLED: z.coerce.boolean().default(false),
    PUSH_APNS_ENABLED: z.coerce.boolean().default(false),
    STORAGE_ENDPOINT: z.string().url(),
    STORAGE_BUCKET: z.string(),
    STORAGE_ACCESS_KEY: z.string(),
    STORAGE_SECRET_KEY: z.string(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});
```

### Global Exception Filter
```typescript
// backend/src/common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        // Never log sensitive data
        const safeError = this.sanitizeError(exception);

        this.logger.error({
            message: safeError.message,
            path: request.url,
            method: request.method,
            // No request body, no tokens, no message content
        });

        response.status(statusCode).json({
            statusCode,
            error: errorName,
            message: clientMessage,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
```

### Authentication Guard
```typescript
// backend/src/common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    // Validates access token, attaches user + device to request
}
```

### Device Guard
```typescript
// backend/src/common/guards/device.guard.ts
@Injectable()
export class DeviceGuard implements CanActivate {
    // Ensures request comes from registered device
    // Validates device identity key signature
}
```

---

## Security Considerations

1. **No plaintext messages** - Ever. Envelopes only.
2. **Rate limiting** - Per-IP, per-user, per-device
3. **Input validation** - Zod schemas on all DTOs
4. **SQL injection prevention** - Drizzle parameterized queries
5. **CORS** - Restricted to known origins
6. **Helmet** - Security headers
7. **Request size limits** - Prevent DoS
8. **Audit logging** - Auth events, device changes, admin actions
9. **No sensitive data in logs** - Sanitized error filter

---

## Deployment

### Docker
```dockerfile
# backend/Dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Environment Variables
```bash
# .env.example
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/denden
JWT_SECRET=your-256-bit-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
OTP_EMAIL_ENABLED=true
OTP_SMS_ENABLED=false
PUSH_EXPO_ENABLED=true
STORAGE_ENDPOINT=https://s3.example.com
STORAGE_BUCKET=denden-attachments
STORAGE_ACCESS_KEY=xxx
STORAGE_SECRET_KEY=xxx
```

---

## Development Workflow

```bash
# Install dependencies
npm install

# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Start development server
npm run start:dev

# Run tests
npm run test

# Type check
npm run typecheck

# Lint
npm run lint
```

---

## Future Considerations

| Feature | Approach |
|---------|----------|
| **Multi-region** | Read replicas, eventual consistency for relay |
| **Message search** | Client-side only (server can't decrypt) |
| **Analytics** | Opt-in, aggregated, no message metadata |
| **Moderation** | User reports only, no content scanning |
| **Backup codes** | Encrypted recovery codes for account access |

---

## References

- [Architecture](architecture.md)
- [API Design](api.md)
- [Database Schema](database.md)
- [Security Model](security.md)
- [Encryption Design](encryption.md)