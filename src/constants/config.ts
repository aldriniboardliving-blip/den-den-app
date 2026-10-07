// src/constants/config.ts
export const CONFIG = {
  api: {
    baseUrl: __DEV__ ? 'http://localhost:3000/api/v1' : 'https://api.den-den.app/api/v1',
    wsUrl: __DEV__ ? 'ws://localhost:3000/realtime' : 'wss://api.den-den.app/realtime',
    timeout: 30000,
  },
  sync: {
    pollIntervalMs: 5000,
    batchSize: 10,
    maxRetries: 10,
    backoffBaseMs: 1000,
    backoffMaxMs: 300000,
  },
  encryption: {
    algorithm: 'X25519-AES256GCM' as const,
    nonceSize: 12,
    keySize: 32,
  },
  backup: {
    kdfMemoryKib: 65536,
    kdfIterations: 3,
    kdfParallelism: 4,
  },
  ui: {
    maxMessageLength: 4096,
    maxAttachmentSizeMb: 50,
    typingTimeoutMs: 3000,
  },
} as const;

export type Config = typeof CONFIG;
