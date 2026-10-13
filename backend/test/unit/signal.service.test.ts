import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignalService } from '../../src/crypto/signal/signal.service';
import { SignalStore } from '../../src/crypto/signal/signal-store';
import { DrizzleService } from '../../src/common/database/drizzle.service';

describe('SignalService', () => {
  let signalService: SignalService;
  let mockSignalStore: any;
  let mockDrizzle: any;

  beforeEach(() => {
    mockSignalStore = {
      getPreKeyBundle: vi.fn(),
      loadSession: vi.fn(),
      deleteSession: vi.fn(),
      rotateSignedPreKey: vi.fn(),
      addOneTimePreKeys: vi.fn(),
      consumeOneTimePreKey: vi.fn(),
    };

    mockDrizzle = {
      client: {
        query: {
          devices: {
            findFirst: vi.fn(),
          },
          deviceOneTimePreKeys: {
            findMany: vi.fn(),
          },
        },
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn(),
      },
    };

    signalService = new SignalService(mockSignalStore, mockDrizzle);
  });

  describe('getPreKeyBundle', () => {
    it('should return prekey bundle for existing device', async () => {
      mockSignalStore.getPreKeyBundle.mockResolvedValue({
        registrationId: 123,
        deviceId: 123,
        identityKey: Buffer.from('identity-key'),
        signedPreKey: {
          keyId: 1,
          publicKey: Buffer.from('signed-prekey'),
          signature: Buffer.from('signature'),
        },
        preKey: {
          keyId: 2,
          publicKey: Buffer.from('onetime-prekey'),
        },
      });

      const bundle = await signalService.getPreKeyBundle('device-1');

      expect(bundle).toBeDefined();
      expect(bundle.identityKey).toBeDefined();
      expect(bundle.signedPreKey).toBeDefined();
      expect(bundle.preKey).toBeDefined();
    });

    it('should return null for non-existent device', async () => {
      mockSignalStore.getPreKeyBundle.mockResolvedValue(null);

      const bundle = await signalService.getPreKeyBundle('non-existent');

      expect(bundle).toBeNull();
    });
  });

  describe('hasSession', () => {
    it('should return true when session exists', async () => {
      mockSignalStore.loadSession.mockResolvedValue('session-data');

      const hasSession = await signalService.hasSession('sender-1', 'recipient-1');

      expect(hasSession).toBe(true);
    });

    it('should return false when session does not exist', async () => {
      mockSignalStore.loadSession.mockResolvedValue(null);

      const hasSession = await signalService.hasSession('sender-1', 'recipient-1');

      expect(hasSession).toBe(false);
    });
  });

  describe('rotateSignedPreKey', () => {
    it('should update device and store new signed prekey', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({ id: 'device-1' });

      await signalService.rotateSignedPreKey('device-1', {
        publicKey: 'new-public-key',
        signature: 'new-signature',
        keyId: 5,
      });

      expect(mockDrizzle.client.update).toHaveBeenCalled();
    });
  });

  describe('rotateSignedPreKey', () => {
    it('should update device and store new signed prekey', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({ id: 'device-1' });

      await signalService.rotateSignedPreKey('device-1', {
        publicKey: 'new-public-key',
        signature: 'new-signature',
        keyId: 5,
      });

      expect(mockDrizzle.client.update).toHaveBeenCalled();
    });
  });

  describe('addOneTimePreKeys', () => {
    it('should add multiple one-time prekeys', async () => {
      const keys = [
        { keyId: 10, publicKey: 'pub-10', privateKey: 'priv-10' },
        { keyId: 11, publicKey: 'pub-11', privateKey: 'priv-11' },
      ];

      await signalService.addOneTimePreKeys('device-1', keys);

      expect(mockDrizzle.client.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('consumeOneTimePreKey', () => {
    it('should mark one-time prekey as used', async () => {
      await signalService.consumeOneTimePreKey('device-1', 5);

      expect(mockDrizzle.client.update).toHaveBeenCalled();
    });
  });
});

describe('SignalStore', () => {
  let signalStore: any;
  let mockDrizzle: any;

  beforeEach(() => {
    mockDrizzle = {
      client: {
        query: {
          encryptionKeys: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
          },
          devices: {
            findFirst: vi.fn(),
          },
        },
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn(),
        delete: vi.fn().mockReturnThis(),
      },
    };

    signalStore = new SignalStore(mockDrizzle);
  });

  describe('getIdentityKeyPair', () => {
    it('should return identity key pair', async () => {
      mockDrizzle.client.query.encryptionKeys.findFirst.mockResolvedValue({
        publicKey: 'base64-public-key',
        privateKeyEncrypted: 'base64-private-key',
      });

      const keyPair = await signalStore.getIdentityKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.pubKey).toBeInstanceOf(ArrayBuffer);
      expect(keyPair.privKey).toBeInstanceOf(ArrayBuffer);
    });

    it('should return undefined when identity key not found', async () => {
      mockDrizzle.client.query.encryptionKeys.findFirst.mockResolvedValue(null);

      const keyPair = await signalStore.getIdentityKeyPair();

      expect(keyPair).toBeUndefined();
    });
  });

  describe('getLocalRegistrationId', () => {
    it('should return registration ID', async () => {
      mockDrizzle.client.query.encryptionKeys.findFirst.mockResolvedValue({
        value: 12345,
      });

      const regId = await signalStore.getLocalRegistrationId();

      expect(regId).toBe(12345);
    });
  });

  describe('saveIdentity', () => {
    it('should store remote identity key', async () => {
      await signalStore.saveIdentity(
        { getName: () => 'user', getDeviceId: () => 1 } as any,
        new Uint8Array([1, 2, 3, 4]),
      );

      expect(mockDrizzle.client.insert).toHaveBeenCalled();
    });
  });

  describe('isTrustedIdentity', () => {
    it('should return true for unknown identity (trust on first use)', async () => {
      mockDrizzle.client.query.encryptionKeys.findFirst.mockResolvedValue(null);

      const trusted = await signalStore.isTrustedIdentity(
        { getName: () => 'user', getDeviceId: () => 1 } as any,
        new Uint8Array([1, 2, 3, 4]),
      );

      expect(trusted).toBe(true);
    });

    it('should return true for matching identity', async () => {
      mockDrizzle.client.query.encryptionKeys.findFirst.mockResolvedValue({
        publicKey: Buffer.from([1, 2, 3, 4]),
      });

      const trusted = await signalStore.isTrustedIdentity(
        { getName: () => 'user', getDeviceId: () => 1 } as any,
        Buffer.from([1, 2, 3, 4]),
      );

      expect(trusted).toBe(true);
    });

    it('should return false for mismatched identity', async () => {
      mockDrizzle.client.query.encryptionKeys.findFirst.mockResolvedValue({
        publicKey: Buffer.from([1, 2, 3, 4]),
      });

      const trusted = await signalStore.isTrustedIdentity(
        { getName: () => 'user', getDeviceId: () => 1 } as any,
        Buffer.from([5, 6, 7, 8]),
      );

      expect(trusted).toBe(false);
    });
  });
});