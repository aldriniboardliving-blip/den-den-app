import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityService } from '../../src/security/security.service';
import { DrizzleService } from '../../src/common/database/drizzle.service';

describe('SecurityService', () => {
  let securityService: SecurityService;
  let mockDrizzle: any;

  beforeEach(() => {
    mockDrizzle = {
      client: {
        query: {
          syncOperations: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
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

    vi.stubGlobal('SecurityService', SecurityService);
    securityService = new SecurityService(
      mockDrizzle,
      {
        get: vi.fn((key: string) => {
          const defaults: Record<string, any> = {
            'SECURITY_MAX_FAILED_ATTEMPTS': 5,
            'SECURITY_LOCKOUT_DURATION_MS': 15 * 60 * 1000,
            'SECURITY_TOKEN_ROTATION_MS': 24 * 60 * 60 * 1000,
            'SECURITY_SESSION_TIMEOUT_MS': 30 * 60 * 1000,
            'SECURITY_REQUIRE_BIOMETRIC': true,
            'SECURITY_CERT_PINNING': true,
          };
          return defaults[key];
        }),
      } as any,
    );
  });

  describe('checkDeviceLockout', () => {
    it('should return locked=true when failed attempts exceed threshold', async () => {
      const failedAttempts = Array(6).fill(null).map((_, i) => ({
        createdAt: new Date(Date.now() - i * 60000),
      }));

      mockDrizzle.client.query.syncOperations.findMany.mockResolvedValue(failedAttempts);

      const result = await securityService.checkDeviceLockout('device-1');

      expect(result.locked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
    });

    it('should return locked=false when failed attempts below threshold', async () => {
      const failedAttempts = Array(3).fill(null).map((_, i) => ({
        createdAt: new Date(Date.now() - i * 60000),
      }));

      mockDrizzle.client.query.syncOperations.findMany.mockResolvedValue(failedAttempts);

      const result = await securityService.checkDeviceLockout('device-1');

      expect(result.locked).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return security configuration', () => {
      const config = securityService.getConfig();
      
      expect(config.maxFailedAttempts).toBe(5);
      expect(config.lockoutDurationMs).toBe(15 * 60 * 1000);
      expect(config.tokenRotationIntervalMs).toBe(24 * 60 * 60 * 1000);
      expect(config.sessionTimeoutMs).toBe(30 * 60 * 1000);
      expect(config.requireBiometricForSensitive).toBe(true);
      expect(config.enableCertificatePinning).toBe(true);
    });
  });

  describe('validateKeyAlgorithm', () => {
    it('should return true for allowed algorithms with sufficient key size', async () => {
      expect(await securityService.validateKeyAlgorithm('X25519', 256)).toBe(true);
      expect(await securityService.validateKeyAlgorithm('Ed25519', 256)).toBe(true);
      expect(await securityService.validateKeyAlgorithm('AES-256-GCM', 256)).toBe(true);
    });

    it('should return false for disallowed algorithms', async () => {
      expect(await securityService.validateKeyAlgorithm('RSA-2048', 2048)).toBe(false);
      expect(await securityService.validateKeyAlgorithm('DES', 56)).toBe(false);
    });

    it('should return false for insufficient key size', async () => {
      expect(await securityService.validateKeyAlgorithm('X25519', 128)).toBe(false);
    });
  });
});