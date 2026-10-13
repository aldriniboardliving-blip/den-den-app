// src/crypto/__tests__/keyManager.test.js
// Unit tests for KeyManager

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyManager } from '../keys';

// Mock react-native-libsodium
vi.mock('react-native-libsodium', () => ({
  crypto_box_keypair: vi.fn().mockResolvedValue({
    publicKey: new Uint8Array(32).fill(1),
    privateKey: new Uint8Array(32).fill(2),
    keyType: 'x25519',
  }),
  crypto_sign_keypair: vi.fn().mockResolvedValue({
    publicKey: new Uint8Array(32).fill(3),
    privateKey: new Uint8Array(64).fill(4),
    keyType: 'ed25519',
  }),
  crypto_sign_detached: vi.fn().mockResolvedValue(new Uint8Array(64).fill(5)),
  crypto_sign_verify_detached: vi.fn().mockResolvedValue(true),
  randombytes_buf: vi.fn().mockImplementation((size) => new Uint8Array(size).fill(6)),
}));

// Mock keystore
vi.mock('../keystore', () => ({
  keystore: {
    generateOnetimePreKeys: vi.fn().mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        keyPair: {
          publicKey: new Uint8Array(32).fill(i + 10),
          privateKey: new Uint8Array(32).fill(i + 20),
          keyType: 'x25519',
        },
        usedAt: null,
      }))
    ),
    saveIdentityKeys: vi.fn().mockResolvedValue(undefined),
    getIdentityKeys: vi.fn().mockResolvedValue(null),
  },
}));

describe('KeyManager', () => {
  let keyManager;

  beforeEach(() => {
    vi.clearAllMocks();
    keyManager = KeyManager.getInstance();
    // Reset singleton state
    KeyManager.instance = new KeyManager();
    keyManager = KeyManager.getInstance();
  });

  afterEach(() => {
    keyManager.clearUserContext();
  });

  describe('initializeDeviceKeys', () => {
    it('should generate identity keys, signed prekey, and onetime prekeys', async () => {
      const identityKeys = await keyManager.initializeDeviceKeys();

      expect(identityKeys).toBeDefined();
      expect(identityKeys.identityKeyPair).toBeDefined();
      expect(identityKeys.identityKeyPair.publicKey).toBeDefined();
      expect(identityKeys.identityKeyPair.privateKey).toBeDefined();
      expect(identityKeys.signedPreKeyPair).toBeDefined();
      expect(identityKeys.signedPreKeySignature).toBeDefined();
      expect(identityKeys.signedPreKeyId).toBe(1);
      expect(identityKeys.onetimePreKeys).toHaveLength(100);
      expect(identityKeys.onetimePreKeys.every(k => k.usedAt === null)).toBe(true);
    });

    it('should save keys to keystore', async () => {
      const { keystore } = await import('../keystore');
      
      await keyManager.initializeDeviceKeys();
      
      expect(keystore.saveIdentityKeys).toHaveBeenCalledWith('current_user', expect.any(Object));
    });
  });

  describe('loadIdentityKeys', () => {
    it('should load keys from keystore', async () => {
      const { keystore } = await import('../keystore');
      const mockKeys = {
        identityKeyPair: {
          publicKey: new Uint8Array(32).fill(1),
          privateKey: new Uint8Array(32).fill(2),
          keyType: 'x25519',
        },
        signedPreKeyPair: {
          publicKey: new Uint8Array(32).fill(3),
          privateKey: new Uint8Array(32).fill(4),
          keyType: 'x25519',
        },
        signedPreKeySignature: new Uint8Array(64).fill(5),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: [],
      };
      
      keystore.getIdentityKeys).mockResolvedValueOnce(mockKeys);
      
      const loadedKeys = await keyManager.loadIdentityKeys();
      
      expect(loadedKeys).toEqual(mockKeys);
      expect(keyManager.getIdentityKeys()).toEqual(mockKeys);
    });
  });

  describe('getNextOnetimePreKey', () => {
    it('should return unused onetime prekey and mark as used', async () => {
      const mockKeys = {
        identityKeyPair: {
          publicKey: new Uint8Array(32).fill(1),
          privateKey: new Uint8Array(32).fill(2),
          keyType: 'x25519',
        },
        signedPreKeyPair: {
          publicKey: new Uint8Array(32).fill(3),
          privateKey: new Uint8Array(32).fill(4),
          keyType: 'x25519',
        },
        signedPreKeySignature: new Uint8Array(64).fill(5),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: [
          { id: 1, keyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' }, usedAt: null },
          { id: 2, keyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' }, usedAt: Date.now() },
        ],
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      const otpk = keyManager.getNextOnetimePreKey();
      
      expect(otpk).toBeDefined();
      expect(otpk.id).toBe(1);
      expect(otpk.usedAt).not.toBeNull();
    });

    it('should return null when no unused prekeys available', async () => {
      const mockKeys = {
        identityKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeySignature: new Uint8Array(64),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: [
          { id: 1, keyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' }, usedAt: Date.now() },
        ],
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      const otpk = keyManager.getNextOnetimePreKey();
      
      expect(otpk).toBeNull();
    });
  });

  describe('needsPrekeyReplenishment', () => {
    it('should return true when unused prekeys below threshold', () => {
      const mockKeys = {
        identityKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeySignature: new Uint8Array(64),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: Array.from({ length: 15 }, (_, i) => ({
          id: i + 1,
          keyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
          usedAt: i < 10 ? Date.now() : null,
        })),
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      expect(keyManager.needsPrekeyReplenishment(20)).toBe(true);
    });

    it('should return false when enough unused prekeys', () => {
      const mockKeys = {
        identityKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeySignature: new Uint8Array(64),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: Array.from({ length: 50 }, (_, i) => ({
          id: i + 1,
          keyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
          usedAt: null,
        })),
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      expect(keyManager.needsPrekeyReplenishment(20)).toBe(false);
    });
  });

  describe('replenishOnetimePreKeys', () => {
    it('should generate new prekeys and keep recent used ones', async () => {
      const { keystore } = await import('../keystore');
      
      const mockKeys = {
        identityKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeySignature: new Uint8Array(64),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: [
          { id: 1, keyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' }, usedAt: Date.now() },
          { id: 2, keyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' }, usedAt: null },
        ],
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      const newKeys = await keyManager.replenishOnetimePreKeys(50);
      
      expect(newKeys).toHaveLength(50);
      expect(keystore.saveIdentityKeys).toHaveBeenCalled();
      // Should keep the 1 recent used key + 50 new keys
      expect(keyManager.getIdentityKeys().onetimePreKeys).toHaveLength(51);
    });
  });

  describe('getKeyBundle', () => {
    it('should return key bundle with next available onetime prekey', () => {
      const mockKeys = {
        identityKeyPair: { publicKey: new Uint8Array(32).fill(1), privateKey: new Uint8Array(32).fill(2), keyType: 'x25519' },
        signedPreKeyPair: { publicKey: new Uint8Array(32).fill(3), privateKey: new Uint8Array(32).fill(4), keyType: 'x25519' },
        signedPreKeySignature: new Uint8Array(64).fill(5),
        signedPreKeyId: 42,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: [
          { id: 1, keyPair: { publicKey: new Uint8Array(32).fill(10), privateKey: new Uint8Array(32).fill(20), keyType: 'x25519' }, usedAt: null },
        ],
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      const bundle = keyManager.getKeyBundle('device-123');
      
      expect(bundle.deviceId).toBe('device-123');
      expect(bundle.identityKeyPublic).toEqual(mockKeys.identityKeyPair.publicKey);
      expect(bundle.signedPrekeyPublic).toEqual(mockKeys.signedPreKeyPair.publicKey);
      expect(bundle.signedPrekeyId).toBe(42);
      expect(bundle.onetimePrekeyId).toBe(1);
    });
  });

  describe('rotateSignedPreKey', () => {
    it('should rotate signed prekey and update keystore', async () => {
      const { keystore } = await import('../keystore');
      
      const mockKeys = {
        identityKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeyPair: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32), keyType: 'x25519' },
        signedPreKeySignature: new Uint8Array(64),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: [],
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      const result = await keyManager.rotateSignedPreKey();
      
      expect(result.keyId).toBe(2);
      expect(result.signature).toBeDefined();
      expect(keystore.saveIdentityKeys).toHaveBeenCalled();
    });
  });

  describe('generateSenderKey / encryptSenderKey / decryptSenderKey', () => {
    it('should generate sender key', async () => {
      const senderKey = await keyManager.generateSenderKey();
      
      expect(senderKey).toBeDefined();
      expect(senderKey.length).toBe(32);
    });

    it('should encrypt and decrypt sender key', async () => {
      const senderKey = await keyManager.generateSenderKey();
      const mockKeys = {
        identityKeyPair: { publicKey: new Uint8Array(32).fill(1), privateKey: new Uint8Array(32).fill(2), keyType: 'x25519' },
        signedPreKeyPair: { publicKey: new Uint8Array(32).fill(3), privateKey: new Uint8Array(32).fill(4), keyType: 'x25519' },
        signedPreKeySignature: new Uint8Array(64).fill(5),
        signedPreKeyId: 1,
        signedPreKeyCreatedAt: Date.now(),
        onetimePreKeys: [],
      };
      
      keyManager.currentIdentityKeys = mockKeys;
      
      const recipientBundle = {
        deviceId: 'recipient-1',
        identityKeyPublic: mockKeys.identityKeyPair.publicKey,
        signedPrekeyPublic: mockKeys.signedPreKeyPair.publicKey,
        signedPrekeySignature: mockKeys.signedPreKeySignature,
        signedPrekeyId: 1,
        onetimePrekeyPublic: null,
        onetimePrekeyId: null,
      };
      
      const encrypted = await keyManager.encryptSenderKey(senderKey, recipientBundle, mockKeys.identityKeyPair);
      const decrypted = await keyManager.decryptSenderKey(encrypted, mockKeys);
      
      expect(decrypted).toEqual(senderKey);
    });
  });
});