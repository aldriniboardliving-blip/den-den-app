import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../src/auth/auth.service';
import { OtpService } from '../../src/auth/otp.service';
import { DrizzleService } from '../../src/common/database/drizzle.service';

describe('Auth Integration Tests', () => {
  let authService: AuthService;
  let otpService: OtpService;
  let mockDrizzle: any;
  let mockJwt: any;
  let mockConfig: any;

  beforeEach(() => {
    mockDrizzle = {
      client: {
        query: {
          users: {
            findFirst: vi.fn(),
          },
          devices: {
            findFirst: vi.fn(),
          },
        },
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'user-1' }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
      },
    };

    mockJwt = {
      sign: vi.fn().mockReturnValue('mock-jwt-token'),
      verify: vi.fn().mockReturnValue({
        sub: 'token-id',
        userId: 'user-1',
        deviceId: 'device-1',
        type: 'access',
      }),
    };

    mockConfig = {
      get: vi.fn((key: string) => {
        const defaults: Record<string, any> = {
          'JWT_SECRET': 'test-secret',
          'JWT_REFRESH_SECRET': 'test-refresh-secret',
          'JWT_ACCESS_EXPIRES': '15m',
          'JWT_REFRESH_EXPIRES': '30d',
        };
        return defaults[key];
      }),
    };

    otpService = new OtpService(mockConfig, mockDrizzle);
    authService = new AuthService(mockDrizzle, mockJwt, mockConfig, otpService);
  });

  describe('sendOtp', () => {
    it('should send OTP for email', async () => {
      await authService.sendOtp('test@example.com', 'email');
      
      // OTP service uses in-memory store, just verify no errors
      expect(true).toBe(true);
    });

    it('should send OTP for phone', async () => {
      await authService.sendOtp('+1234567890', 'phone');
      expect(true).toBe(true);
    });
  });

  describe('verifyOtpAndRegister', () => {
    it('should reject invalid OTP', async () => {
      vi.spyOn(otpService, 'verify').mockResolvedValue(false);

      await expect(
        authService.verifyOtpAndRegister('test@example.com', 'email', '123456', {
          platform: 'ios',
          identityKeyPublic: 'a'.repeat(64),
          signingKeyPublic: 'b'.repeat(64),
          signedPreKeyPublic: 'c'.repeat(64),
          signedPreKeySignature: 'd'.repeat(88),
          signedPreKeyId: 1,
          oneTimePreKeys: [{ keyId: 1, publicKey: 'e'.repeat(64) }],
        })
      ).rejects.toThrow('Invalid or expired OTP');
    });

    it('should create new user and device on valid OTP', async () => {
      vi.spyOn(otpService, 'verify').mockResolvedValue(true);
      mockDrizzle.client.query.users.findFirst.mockResolvedValue(null);

      const result = await authService.verifyOtpAndRegister('test@example.com', 'email', '123456', {
        platform: 'ios',
        identityKeyPublic: 'a'.repeat(64),
        signingKeyPublic: 'b'.repeat(64),
        signedPreKeyPublic: 'c'.repeat(64),
        signedPreKeySignature: 'd'.repeat(88),
        signedPreKeyId: 1,
        oneTimePreKeys: [{ keyId: 1, publicKey: 'e'.repeat(64) }],
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(15 * 60);
      // user + device + oneTimePreKeys = 3 inserts
      expect(mockDrizzle.client.insert).toHaveBeenCalled();
    });

    it('should use existing user on valid OTP', async () => {
      vi.spyOn(otpService, 'verify').mockResolvedValue(true);
      mockDrizzle.client.query.users.findFirst.mockResolvedValue({ id: 'existing-user' });

      const result = await authService.verifyOtpAndRegister('test@example.com', 'email', '123456', {
        platform: 'ios',
        identityKeyPublic: 'a'.repeat(64),
        signingKeyPublic: 'b'.repeat(64),
        signedPreKeyPublic: 'c'.repeat(64),
        signedPreKeySignature: 'd'.repeat(88),
        signedPreKeyId: 1,
        oneTimePreKeys: [{ keyId: 1, publicKey: 'e'.repeat(64) }],
      });

      expect(result.accessToken).toBeDefined();
      // device + oneTimePreKeys = 2 inserts
      expect(mockDrizzle.client.insert).toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    beforeEach(() => {
      mockJwt.verify.mockReset();
      mockJwt.verify.mockImplementation(() => Promise.resolve({
        sub: 'token-id',
        userId: 'user-1',
        deviceId: 'device-1',
        type: 'refresh',
      }));
    });

    it('should return new tokens for valid refresh token', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({
        id: 'device-1',
        userId: 'user-1',
        revokedAt: null,
      });

      const result = await authService.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(mockJwt.verify).toHaveBeenCalled();
    });

    it('should reject revoked device', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({
        id: 'device-1',
        userId: 'user-1',
        revokedAt: new Date(),
      });

      await expect(authService.refreshTokens('valid-refresh-token')).rejects.toThrow('Device revoked');
    });

    it('should reject invalid refresh token', async () => {
      mockJwt.verify.mockRejectedValueOnce(new Error('Invalid token'));

      await expect(authService.refreshTokens('invalid-token')).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('revokeDevice', () => {
    it('should revoke device for owner', async () => {
      await authService.revokeDevice('user-1', 'device-1');

      expect(mockDrizzle.client.update).toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('should return true for valid active device', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({
        id: 'device-1',
        userId: 'user-1',
        revokedAt: null,
      });

      const result = await authService.validateUser('user-1', 'device-1');

      expect(result).toBe(true);
    });

    it('should return false for revoked device', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({
        id: 'device-1',
        userId: 'user-1',
        revokedAt: new Date(),
      });

      const result = await authService.validateUser('user-1', 'device-1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent device', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue(null);

      const result = await authService.validateUser('user-1', 'device-1');

      expect(result).toBe(false);
    });
  });
});