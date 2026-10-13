// src/crypto/__tests__/encryption.test.ts
// Unit tests for MessageEncryption

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MessageEncryption } from '../encryption';

// Mock react-native-libsodium at the top level
const mockSodium = {
  crypto_sign_verify_detached: jest.fn().mockResolvedValue(true),
  crypto_box_keypair: jest.fn().mockResolvedValue({
    publicKey: new Uint8Array(32).fill(1),
    privateKey: new Uint8Array(32).fill(2),
    keyType: 'x25519',
  }),
  crypto_scalarmult: jest.fn().mockResolvedValue(new Uint8Array(32).fill(3)),
  crypto_kdf_derive_from_key: jest.fn().mockResolvedValue(new Uint8Array(32).fill(4)),
  randombytes_buf: jest.fn().mockImplementation((size: number) => new Uint8Array(size).fill(5)),
  crypto_secretbox_easy: jest.fn().mockResolvedValue(new Uint8Array(40).fill(6)),
  crypto_secretbox_open_easy: jest.fn().mockResolvedValue(new TextEncoder().encode('test message')),
};

jest.mock('react-native-libsodium', () => mockSodium);

import { MessageEncryption } from '../encryption';

describe('MessageEncryption', () => {
  const mockKeyBundle = {
    deviceId: 'device-123',
    identityKeyPublic: new Uint8Array(32).fill(10),
    signedPrekeyPublic: new Uint8Array(32).fill(20),
    signedPrekeySignature: new Uint8Array(64).fill(30),
    signedPrekeyId: 1,
    onetimePrekeyPublic: new Uint8Array(32).fill(40),
    onetimePrekeyId: 5,
  };

  const mockIdentityKeys = {
    identityKeyPair: {
      publicKey: new Uint8Array(32).fill(10),
      privateKey: new Uint8Array(32).fill(11),
      keyType: 'x25519',
    },
    signedPreKeyPair: {
      publicKey: new Uint8Array(32).fill(20),
      privateKey: new Uint8Array(32).fill(21),
      keyType: 'x25519',
    },
    signedPreKeySignature: new Uint8Array(64).fill(30),
    signedPreKeyId: 1,
    signedPreKeyCreatedAt: Date.now(),
    onetimePreKeys: [
      {
        id: 5,
        keyPair: {
          publicKey: new Uint8Array(32).fill(40),
          privateKey: new Uint8Array(32).fill(41),
          keyType: 'x25519',
        },
        usedAt: null,
      },
    ],
  };

  const mockEnvelope = {
    messageId: 'msg-123',
    senderDeviceId: 'sender-1',
    recipientDeviceId: 'device-123',
    conversationId: 'conv-1',
    ciphertext: new Uint8Array(40).fill(6),
    nonce: new Uint8Array(24).fill(5),
    ephemeralPublic: new Uint8Array(32).fill(1),
    signedPreKeyId: 1,
    onetimePreKeyId: 5,
    encryptionAlgorithm: 'X25519-AES256GCM',
    contentType: 'TEXT',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('encrypt', () => {
    it('should encrypt plaintext and return valid envelope', async () => {
      const plaintext = new TextEncoder().encode('Hello, World!');
      
      const envelope = await MessageEncryption.encrypt(
        plaintext,
        mockKeyBundle,
        'sender-device',
        'conversation-1'
      );

      expect(envelope).toBeDefined();
      expect(envelope.messageId).toBeDefined();
      expect(envelope.senderDeviceId).toBe('sender-device');
      expect(envelope.recipientDeviceId).toBe('device-123');
      expect(envelope.conversationId).toBe('conversation-1');
      expect(envelope.ciphertext).toBeDefined();
      expect(envelope.nonce).toBeDefined();
      expect(envelope.ephemeralPublic).toBeDefined();
      expect(envelope.signedPreKeyId).toBe(1);
      expect(envelope.onetimePreKeyId).toBe(5);
      expect(envelope.encryptionAlgorithm).toBe('X25519-AES256GCM');
      expect(envelope.contentType).toBe('TEXT');
    });

    it('should throw error for invalid signed prekey signature', async () => {
      const Sodium = await import('react-native-libsodium');
      Sodium.crypto_sign_verify_detached.mockResolvedValueOnce(false);

      const plaintext = new TextEncoder().encode('Hello');
      
      await expect(
        MessageEncryption.encrypt(plaintext, mockKeyBundle, 'sender', 'conv')
      ).rejects.toThrow('Invalid signed prekey signature');
    });

    it('should work without onetime prekey', async () => {
      const keyBundleWithoutOnetime = { ...mockKeyBundle, onetimePrekeyPublic: null, onetimePrekeyId: null };
      const plaintext = new TextEncoder().encode('No onetime prekey');
      
      const envelope = await MessageEncryption.encrypt(
        plaintext,
        keyBundleWithoutOnetime,
        'sender',
        'conv'
      );

      expect(envelope.onetimePreKeyId).toBeNull();
      expect(envelope.ciphertext).toBeDefined();
    });
  });

  describe('decrypt', () => {
    it('should decrypt envelope and return plaintext', async () => {
      const plaintext = await MessageEncryption.decrypt(mockEnvelope, mockIdentityKeys);
      
      expect(plaintext).toBeDefined();
      expect(new TextDecoder().decode(plaintext)).toBe('test message');
    });

    it('should throw error for signed prekey ID mismatch', async () => {
      const envelopeWithWrongSpk = { ...mockEnvelope, signedPreKeyId: 999 };
      
      await expect(
        MessageEncryption.decrypt(envelopeWithWrongSpk, mockIdentityKeys)
      ).rejects.toThrow('Signed prekey ID mismatch');
    });

    it('should throw error for missing onetime prekey', async () => {
      const envelopeWithMissingOTPK = { ...mockEnvelope, onetimePreKeyId: 999 };
      
      await expect(
        MessageEncryption.decrypt(envelopeWithMissingOTPK, mockIdentityKeys)
      ).rejects.toThrow('Onetime prekey 999 not found');
    });
  });

  describe('encryptForGroup / decryptGroup', () => {
    it('should encrypt and decrypt group messages', async () => {
      const senderKey = new Uint8Array(32).fill(100);
      const plaintext = new TextEncoder().encode('Group message');
      
      const { ciphertext, nonce } = await MessageEncryption.encryptForGroup(
        plaintext,
        senderKey,
        'sender-device',
        'group-conv'
      );
      
      expect(ciphertext).toBeDefined();
      expect(nonce).toBeDefined();
      
      const decrypted = await MessageEncryption.decryptGroup(
        ciphertext,
        nonce,
        senderKey,
        'sender-device',
        'group-conv'
      );
      
      expect(new TextDecoder().decode(decrypted)).toBe('Group message');
    });
  });
});