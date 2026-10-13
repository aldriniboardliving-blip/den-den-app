// src/crypto/__tests__/backup.test.js
// Unit tests for backup encryption

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupEncryption } from '../backup';

// Mock react-native-libsodium
vi.mock('react-native-libsodium', () => ({
  crypto_pwhash: vi.fn().mockResolvedValue(new Uint8Array(32).fill(1)),
  crypto_aead_aes256gcm_encrypt: vi.fn().mockResolvedValue(new Uint8Array(100).fill(2)),
  crypto_aead_aes256gcm_decrypt: vi.fn().mockResolvedValue(new TextEncoder().encode('test backup data')),
  crypto_hash_sha256: vi.fn().mockResolvedValue(new Uint8Array(32).fill(3)),
  randombytes_buf: vi.fn().mockImplementation((size) => new Uint8Array(size).fill(4)),
  crypto_pwhash_ALG_ARGON2ID13: 1,
  crypto_pwhash_OPSLIMIT_INTERACTIVE: 3,
  crypto_pwhash_MEMLIMIT_INTERACTIVE: 67108864,
}));

describe('BackupEncryption', () => {
  const mockParams = {
    algorithm: 'AES-256-GCM',
    kdf: 'ARGON2ID',
    memoryKib: 65536,
    iterations: 3,
    parallelism: 4,
    salt: new Uint8Array(32).fill(5),
    nonce: new Uint8Array(12).fill(6),
  };

  describe('encryptBackup', () => {
    it('should encrypt backup data with Argon2id + AES-256-GCM', async () => {
      const backupData = new TextEncoder().encode('SQL backup data here');
      const password = 'test-password-123';
      
      const result = await BackupEncryption.encryptBackup(backupData, password, mockParams);
      
      expect(result).toBeDefined();
      expect(result.ciphertext).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(result.verificationHash).toBeDefined();
      expect(result.kdfParams).toBeDefined();
      expect(result.kdfParams.algorithm).toBe('ARGON2ID');
    });

    it('should produce different ciphertexts for same data with different salts', async () => {
      const backupData = new TextEncoder().encode('Same data');
      const password = 'same-password';
      
      const params1 = { ...mockParams, salt: new Uint8Array(32).fill(1) };
      const params2 = { ...mockParams, salt: new Uint8Array(32).fill(2) };
      
      const result1 = await BackupEncryption.encryptBackup(backupData, password, params1);
      const result2 = await BackupEncryption.encryptBackup(backupData, password, params2);
      
      expect(result1.ciphertext).not.toEqual(result2.ciphertext);
      expect(result1.salt).not.toEqual(result2.salt);
    });
  });

  describe('decryptBackup', () => {
    it('should decrypt backup data with correct password', async () => {
      const backupData = new TextEncoder().encode('Decrypt test data');
      const password = 'correct-password';
      
      const encrypted = await BackupEncryption.encryptBackup(backupData, password, mockParams);
      const decrypted = await BackupEncryption.decryptBackup(encrypted, password, mockParams);
      
      expect(new TextDecoder().decode(decrypted)).toBe('Decrypt test data');
    });

    it('should throw error for incorrect password', async () => {
      const backupData = new TextEncoder().encode('Wrong password test');
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';
      
      const encrypted = await BackupEncryption.encryptBackup(backupData, password, mockParams);
      
      await expect(
        BackupEncryption.decryptBackup(encrypted, wrongPassword, mockParams)
      ).rejects.toThrow();
    });
  });

  describe('verifyBackupIntegrity', () => {
    it('should verify backup integrity with correct hash', async () => {
      const backupData = new TextEncoder().encode('Integrity test');
      const password = 'integrity-password';
      
      const encrypted = await BackupEncryption.encryptBackup(backupData, password, mockParams);
      const isValid = await BackupEncryption.verifyBackupIntegrity(encrypted, password, mockParams);
      
      expect(isValid).toBe(true);
    });

    it('should fail verification for corrupted data', async () => {
      const backupData = new TextEncoder().encode('Corrupt test');
      const password = 'corrupt-password';
      
      const encrypted = await BackupEncryption.encryptBackup(backupData, password, mockParams);
      
      // Corrupt the ciphertext
      const corrupted = {
        ...encrypted,
        ciphertext: new Uint8Array(encrypted.ciphertext).fill(255),
      };
      
      const isValid = await BackupEncryption.verifyBackupIntegrity(corrupted, password, mockParams);
      
      expect(isValid).toBe(false);
    });
  });

  describe('generateBackupParams', () => {
    it('should generate valid encryption parameters', () => {
      const params = BackupEncryption.generateBackupParams();
      
      expect(params).toBeDefined();
      expect(params.algorithm).toBe('AES-256-GCM');
      expect(params.kdf).toBe('ARGON2ID');
      expect(params.memoryKib).toBe(65536); // 64 MB
      expect(params.iterations).toBe(3);
      expect(params.parallelism).toBe(4);
      expect(params.salt).toBeDefined();
      expect(params.salt.length).toBe(32);
      expect(params.nonce).toBeDefined();
      expect(params.nonce.length).toBe(12);
    });

    it('should generate unique params each time', () => {
      const params1 = BackupEncryption.generateBackupParams();
      const params2 = BackupEncryption.generateBackupParams();
      
      expect(params1.salt).not.toEqual(params2.salt);
      expect(params1.nonce).not.toEqual(params2.nonce);
    });
  });
});