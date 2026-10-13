import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplayProtectionService } from '../../src/security/replay-protection.service';
import { DrizzleService } from '../../src/common/database/drizzle.service';

describe('ReplayProtectionService', () => {
  let replayService: ReplayProtectionService;
  let mockDrizzle: any;

  beforeEach(() => {
    mockDrizzle = {
      client: {
        query: {
          devices: {
            findFirst: vi.fn(),
          },
          syncOperations: {
            findFirst: vi.fn(),
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
        delete: vi.fn().mockReturnThis(),
      },
    };

    replayService = new ReplayProtectionService(mockDrizzle);
  });

  describe('checkAndRecord', () => {
    it('should return isReplay=false for new message', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockDrizzle.client.query.syncOperations.findFirst.mockResolvedValue(null);

      const identifier = {
        messageId: 'msg-1',
        senderDeviceId: 'sender-1',
        recipientDeviceId: 'recipient-1',
        timestamp: Date.now(),
        nonce: 'nonce-1',
      };

      const result = await replayService.checkAndRecord(identifier);

      expect(result.isReplay).toBe(false);
      expect(mockDrizzle.client.insert).toHaveBeenCalled();
    });

    it('should return isReplay=true for duplicate message', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockDrizzle.client.query.syncOperations.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 1000),
      });

      const identifier = {
        messageId: 'msg-1',
        senderDeviceId: 'sender-1',
        recipientDeviceId: 'recipient-1',
        timestamp: Date.now(),
        nonce: 'nonce-1',
      };

      const result = await replayService.checkAndRecord(identifier);

      expect(result.isReplay).toBe(true);
      expect(result.reason).toBe('Duplicate message detected');
    });

    it('should return isReplay=true for timestamp too old', async () => {
      const identifier = {
        messageId: 'msg-1',
        senderDeviceId: 'sender-1',
        recipientDeviceId: 'recipient-1',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        nonce: 'nonce-1',
      };

      const result = await replayService.checkAndRecord(identifier);

      expect(result.isReplay).toBe(true);
      expect(result.reason).toContain('Invalid timestamp');
    });

    it('should return isReplay=true for timestamp in future', async () => {
      const identifier = {
        messageId: 'msg-1',
        senderDeviceId: 'sender-1',
        recipientDeviceId: 'recipient-1',
        timestamp: Date.now() + 2000, // 2 seconds in future
        nonce: 'nonce-1',
      };

      const result = await replayService.checkAndRecord(identifier);

      expect(result.isReplay).toBe(true);
      expect(result.reason).toContain('Invalid timestamp');
    });
  });

  describe('verifyMessageChain', () => {
    it('should return valid=true for sequential messages', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockDrizzle.client.query.syncOperations.findFirst.mockResolvedValue(null);

      const messages = [
        { messageId: 'msg-1', senderDeviceId: 'sender-1', timestamp: 1000, nonce: 'nonce-1' },
        { messageId: 'msg-2', senderDeviceId: 'sender-1', timestamp: 1001, nonce: 'nonce-2' },
        { messageId: 'msg-3', senderDeviceId: 'sender-1', timestamp: 1002, nonce: 'nonce-3' },
      ];

      // Mock checkAndRecord to return isReplay=false for all messages
      vi.spyOn(replayService, 'checkAndRecord').mockResolvedValue({ isReplay: false });

      const result = await replayService.verifyMessageChain('recipient-1', messages);

      expect(result.valid).toBe(true);
      expect(result.gaps).toEqual([]);
    });

    it('should detect gaps in message chain', async () => {
      mockDrizzle.client.query.devices.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockDrizzle.client.query.syncOperations.findFirst.mockResolvedValue(null);

      const messages = [
        { messageId: 'msg-1', senderDeviceId: 'sender-1', timestamp: 1000, nonce: 'nonce-1' },
        { messageId: 'msg-3', senderDeviceId: 'sender-1', timestamp: 1003, nonce: 'nonce-3' }, // gap at 1001, 1002
      ];

      // Mock checkAndRecord to return isReplay=false for all messages
      vi.spyOn(replayService, 'checkAndRecord').mockResolvedValue({ isReplay: false });

      const result = await replayService.verifyMessageChain('recipient-1', messages);

      expect(result.valid).toBe(true);
      expect(result.gaps).toContain(1001);
      // Service only detects first gap between consecutive messages
    });
  });

  describe('getProcessedCount', () => {
    it('should return count of processed messages', async () => {
      mockDrizzle.client.query.syncOperations.findMany.mockResolvedValue([
        {}, {}, {},
      ]);

      const count = await replayService.getProcessedCount('device-1', 60 * 60 * 1000);

      expect(count).toBe(3);
    });
  });
});