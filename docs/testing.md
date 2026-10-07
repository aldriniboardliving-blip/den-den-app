# Den Den Testing Strategy

## Testing Pyramid

```
        /\
       /  \     E2E (Detox) - Critical user flows
      /____\    
     /      \   Integration (Vitest + MSW) - Feature workflows
    /________\ 
   /          \ Unit (Vitest) - Pure functions, hooks, crypto
  /____________\
```

## Test Categories

### 1. Unit Tests (Vitest)

**Target: 90%+ coverage for crypto, utils, hooks**

| Module | Test Files | Key Scenarios |
|--------|------------|---------------|
| `src/crypto/encryption.ts` | `encryption.test.ts` | Encrypt/decrypt roundtrip, wrong key fails, tampered ciphertext fails, AAD mismatch fails |
| `src/crypto/keys.ts` | `keys.test.ts` | Key generation, rotation, storage/retrieval, prekey consumption |
| `src/crypto/backup.ts` | `backup.test.ts` | Backup encrypt/decrypt, wrong password fails, corrupted file fails |
| `src/crypto/verification.ts` | `verification.test.ts` | Safety number computation, matching, QR generation |
| `src/utils/date.ts` | `date.test.ts` | Formatting, parsing, timezone handling |
| `src/utils/validation.ts` | `validation.test.ts` | Zod schema validation, edge cases |
| `src/hooks/useDebounce.ts` | `useDebounce.test.ts` | Debounce timing, cleanup |
| `src/sync/processor.ts` | `processor.test.ts` | Retry logic, backoff, max attempts, idempotency |

**Example:**
```typescript
// src/crypto/encryption.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptMessage, decryptMessage } from './encryption';
import { generateKeyBundle } from './keys';

describe('Message Encryption', () => {
  let senderKeys: KeyPair;
  let recipientKeys: KeyBundle;
  
  beforeEach(async () => {
    senderKeys = await generateKeyPair();
    recipientKeys = await generateKeyBundle();
  });
  
  it('encrypts and decrypts roundtrip', async () => {
    const plaintext = new TextEncoder().encode('Hello, Den Den!');
    const envelope = await encryptMessage(plaintext, recipientKeys, senderKeys.publicKey, 'conv-1');
    const decrypted = await decryptMessage(envelope, recipientKeys.privateKey);
    expect(new TextDecoder().decode(decrypted)).toBe('Hello, Den Den!');
  });
  
  it('fails with wrong private key', async () => {
    const plaintext = new TextEncoder().encode('Test');
    const envelope = await encryptMessage(plaintext, recipientKeys, senderKeys.publicKey, 'conv-1');
    const wrongKeys = await generateKeyPair();
    await expect(decryptMessage(envelope, wrongKeys.privateKey)).rejects.toThrow();
  });
  
  it('fails with tampered ciphertext', async () => {
    const plaintext = new TextEncoder().encode('Test');
    const envelope = await encryptMessage(plaintext, recipientKeys, senderKeys.publicKey, 'conv-1');
    envelope.ciphertext = tamper(envelope.ciphertext);
    await expect(decryptMessage(envelope, recipientKeys.privateKey)).rejects.toThrow();
  });
  
  it('fails with wrong AAD', async () => {
    const plaintext = new TextEncoder().encode('Test');
    const envelope = await encryptMessage(plaintext, recipientKeys, senderKeys.publicKey, 'conv-1');
    envelope.messageId = 'different-id'; // AAD includes messageId
    await expect(decryptMessage(envelope, recipientKeys.privateKey)).rejects.toThrow();
  });
});
```

### 2. Integration Tests (Vitest + MSW)

**Target: 70%+ coverage for feature workflows**

| Feature | Test File | Scenarios |
|---------|-----------|-----------|
| Auth flow | `auth.integration.test.ts` | OTP request → verify → token storage → device registration |
| Message send | `chat.integration.test.ts` | Local create → encrypt → queue → upload → ACK → status updates |
| Message receive | `chat.integration.test.ts` | WebSocket event → decrypt → persist → ACK → notification |
| Sync queue | `sync.integration.test.ts` | Offline queue → online → process → retry → cleanup |
| Contact add | `contacts.integration.test.ts` | Search → add → key fetch → verify safety number |
| Backup | `backup.integration.test.ts` | Export → encrypt → import → decrypt → validate |

**MSW Setup:**
```typescript
// test/msw/setup.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  http.post('/api/v1/auth/otp/request', () => HttpResponse.json({ message: 'OTP sent' })),
  http.post('/api/v1/auth/otp/verify', () => HttpResponse.json({ accessToken: 'token', user: {...} })),
  http.get('/api/v1/conversations', () => HttpResponse.json({ conversations: [] })),
  http.post('/api/v1/messages/send', () => HttpResponse.json({ messageId: 'msg-1', status: 'RECEIVED_BY_SERVER' })),
  // ... more handlers
);

// test/setup.ts
import { server } from './msw/setup';
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Example:**
```typescript
// features/chat/chat.integration.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSendMessage } from '@/features/chat/hooks';
import { useSyncQueue } from '@/sync/queue';
import { server } from '../../test/msw/setup';
import { http, HttpResponse } from 'msw';

describe('Message Send Flow', () => {
  it('creates local message, queues, uploads, receives ACK', async () => {
    const { result } = renderHook(() => useSendMessage());
    
    // Mock server response
    server.use(
      http.post('/api/v1/messages/send', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ 
          messageId: body.messageId, 
          serverMessageId: 'server-123',
          status: 'RECEIVED_BY_SERVER' 
        });
      })
    );
    
    // Send message
    const messageId = await result.current.sendMessage('conv-1', 'Hello!');
    
    // Verify local message created immediately
    const localMsg = await getLocalMessage(messageId);
    expect(localMsg.status).toBe('PENDING');
    
    // Wait for sync processor
    await waitFor(() => expect(getSyncQueueStatus(messageId)).toBe('COMPLETED'));
    
    // Verify final state
    const finalMsg = await getLocalMessage(messageId);
    expect(finalMsg.status).toBe('DELIVERED');
    expect(finalMsg.serverMessageId).toBe('server-123');
  });
});
```

### 3. E2E Tests (Detox)

**Target: Critical user flows**

| Flow | Test File | Devices |
|------|-----------|---------|
| First launch → register → chat | `onboarding.e2e.ts` | iOS, Android |
| Send message online | `messaging.e2e.ts` | iOS, Android |
| Send offline → online | `offline.e2e.ts` | iOS, Android |
| Backup export/import | `backup.e2e.ts` | iOS, Android |
| Device revocation | `security.e2e.ts` | iOS, Android |
| Contact verification | `verification.e2e.ts` | iOS, Android |

**Example:**
```typescript
// e2e/messaging.e2e.ts
import { device, element, by, expect } from 'detox';

describe('Messaging', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });
  
  it('sends and receives message', async () => {
    // Sender
    await element(by.id('conversation-list')).tap();
    await element(by.id('message-input')).typeText('Hello from Detox!');
    await element(by.id('send-button')).tap();
    
    // Wait for delivered status
    await waitFor(element(by.id('message-status-delivered')))
      .toBeVisible()
      .withTimeout(10000);
    
    // Receiver (separate device/app instance)
    // ... switch device
    await expect(element(by.text('Hello from Detox!'))).toBeVisible();
  });
  
  it('works offline', async () => {
    await device.sendToHome();
    await device.setURLBlacklist(['*']); // Block network
    await device.launchApp();
    
    await element(by.id('message-input')).typeText('Offline message');
    await element(by.id('send-button')).tap();
    
    // Should show pending immediately
    await expect(element(by.id('message-status-pending'))).toBeVisible();
    
    // Restore network
    await device.setURLBlacklist([]);
    await device.launchApp();
    
    // Should eventually deliver
    await waitFor(element(by.id('message-status-delivered')))
      .toBeVisible()
      .withTimeout(30000);
  });
});
```

---

## Test Infrastructure

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test Utilities

```typescript
// test/utils/render.tsx
import { render, RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StoreProvider } from '@/store';
import { ReactNode } from 'react';

export function renderWithProviders(
  ui: ReactNode,
  options?: RenderOptions
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  
  return render(
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        {ui}
      </StoreProvider>
    </QueryClientProvider>,
    options
  );
}
```

---

## Security Testing

### Crypto-Specific Tests

```typescript
// test/security/crypto-security.test.ts
describe('Crypto Security Properties', () => {
  it('uses constant-time comparison for MAC verification', () => {
    // Verify sodium_memcmp or equivalent used
    const implementation = getEncryptionImplementation();
    expect(implementation.usesConstantTimeCompare).toBe(true);
  });
  
  it('generates cryptographically secure random nonces', () => {
    const nonces = new Set();
    for (let i = 0; i < 10000; i++) {
      const nonce = generateNonce();
      expect(nonces.has(nonce)).toBe(false);
      nonces.add(nonce);
    }
  });
  
  it('zeroizes sensitive memory after use', () => {
    // Verify sodium_memzero called on private keys
    const implementation = getKeyStorageImplementation();
    expect(implementation.zeroizesMemory).toBe(true);
  });
  
  it('never logs sensitive data', () => {
    const logs = captureLogs(() => {
      encryptMessage(plaintext, keys, 'conv-1');
    });
    expect(logs).not.toContainEqual(expect.stringMatching(/private|key|password/));
  });
});
```

### Dependency Scanning

```bash
# CI runs
npm audit --audit-level=high
# or
npx audit-ci --config audit-ci.json
```

---

## CI Pipeline

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration
      - uses: codecov/codecov-action@v3
        if: github.event_name == 'push'
```

---

## Test Data Management

### Factories

```typescript
// test/factories/messages.ts
export function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${uuidv4()}`,
    conversationId: `conv-${uuidv4()}`,
    senderDeviceId: `dev-${uuidv4()}`,
    content: 'Test message',
    status: 'DELIVERED',
    createdAt: Date.now(),
    ...overrides,
  };
}

export function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: `conv-${uuidv4()}`,
    type: 'DIRECT',
    members: [],
    unreadCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}
```

---

## References

- [Architecture](architecture.md)
- [Frontend](frontend.md)
- [Offline-First](offline-first.md)
- [Encryption](encryption.md)
- [DevOps](devops.md)