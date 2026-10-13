import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessagesService } from '../../src/messages/messages.service';
import { RelayService } from '../../src/relay/relay.service';
import { DeliveryService } from '../../src/delivery/delivery.service';
import { SignalService } from '../../src/crypto/signal/signal.service';
import { DrizzleService } from '../../src/common/database/drizzle.service';

describe('Message Relay & Delivery Integration Tests', () => {
  let messagesService: MessagesService;
  let relayService: RelayService;
  let deliveryService: DeliveryService;
  let mockDrizzle: any;
  let mockRelay: any;
  let mockSignal: any;

  beforeEach(() => {
    const transactionMock = vi.fn().mockImplementation(async (cb) => {
      const tx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'tx-1' }]),
      };
      await cb(tx);
      return tx;
    });

    mockDrizzle = {
      client: {
        query: {
          conversations: {
            findFirst: vi.fn(),
          },
          devices: {
            findFirst: vi.fn(),
          },
          relayMessages: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
          },
          messageRecipients: {
            findFirst: vi.fn(),
          },
          messages: {
            findMany: vi.fn(),
          },
        },
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'msg-1' }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        transaction: transactionMock,
      },
    };

    mockRelay = {
      notifyRecipient: vi.fn(),
      markDelivered: vi.fn(),
      retryFailedDeliveries: vi.fn(),
      cleanupExpiredRelayMessages: vi.fn(),
      getRelayStats: vi.fn(),
    };

    mockSignal = {
      getPreKeyBundle: vi.fn(),
      hasSession: vi.fn(),
      rotateSignedPreKey: vi.fn(),
      addOneTimePreKeys: vi.fn(),
      consumeOneTimePreKey: vi.fn(),
    };

    messagesService = new MessagesService(mockDrizzle, mockRelay);
    relayService = new RelayService(mockDrizzle, { sendToDevice: vi.fn() } as any);
    deliveryService = new DeliveryService(mockDrizzle, mockRelay);
  });

  describe('send message flow', () => {
    it('should create message, recipients, and relay entries', async () => {
      mockDrizzle.client.query.conversations.findFirst.mockResolvedValue({
        id: 'conv-1',
        members: [
          { deviceId: 'sender-device', userId: 'user-1' },
          { deviceId: 'recipient-device', userId: 'user-2' },
        ],
      });

      const result = await messagesService.send('sender-device', {
        conversationId: 'conv-1',
        clientMessageId: 'client-msg-1',
        type: 'TEXT',
        content: 'Hello',
        envelopes: [{
          messageId: 'msg-1',
          senderDeviceId: 'sender-device',
          recipientDeviceId: 'recipient-device',
          conversationId: 'conv-1',
          ciphertext: 'encrypted-content',
          nonce: 'nonce-1',
          ephemeralPublic: 'ephemeral-1',
          signedPreKeyId: 1,
          sentAt: new Date().toISOString(),
        }],
      });

      expect(result.id).toBe('msg-1');
      expect(mockDrizzle.client.insert).toHaveBeenCalledTimes(3); // messages, messageRecipients, relayMessages
      expect(mockRelay.notifyRecipient).toHaveBeenCalledWith('recipient-device', 'msg-1');
    });

    it('should throw for non-existent conversation', async () => {
      mockDrizzle.client.query.conversations.findFirst.mockResolvedValue(null);

      await expect(
        messagesService.send('sender-device', {
          conversationId: 'non-existent',
          clientMessageId: 'client-msg-1',
          type: 'TEXT',
          envelopes: [],
        })
      ).rejects.toThrow('Conversation not found');
    });

    it('should throw when sender not in conversation', async () => {
      mockDrizzle.client.query.conversations.findFirst.mockResolvedValue({
        id: 'conv-1',
        members: [
          { deviceId: 'other-device', userId: 'user-1' },
        ],
      });

      await expect(
        messagesService.send('sender-device', {
          conversationId: 'conv-1',
          clientMessageId: 'client-msg-1',
          type: 'TEXT',
          envelopes: [],
        })
      ).rejects.toThrow('Sender not in conversation');
    });
  });

  describe('acknowledgment flow', () => {
    it('should verify and mark message as delivered', async () => {
      mockDrizzle.client.query.relayMessages.findFirst.mockResolvedValue({
        id: 'relay-1',
        messageId: 'msg-1',
        recipientDeviceId: 'recipient-device',
        ackedAt: null,
      });

      mockDrizzle.client.query.messageRecipients.findFirst.mockResolvedValue({
        id: 'recipient-1',
        messageId: 'msg-1',
        recipientDeviceId: 'recipient-device',
        status: 'PENDING',
      });

      mockDrizzle.client.transaction.mockImplementation(async (cb) => {
        await cb({
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
        });
      });

      const result = await relayService.verifyAndAck('msg-1', 'recipient-device', 'client-msg-1');

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);
    });

    it('should handle duplicate ACK gracefully', async () => {
      mockDrizzle.client.query.relayMessages.findFirst.mockResolvedValue({
        id: 'relay-1',
        messageId: 'msg-1',
        recipientDeviceId: 'recipient-device',
        ackedAt: new Date(), // Already acknowledged
      });

      const result = await relayService.verifyAndAck('msg-1', 'recipient-device', 'client-msg-1');

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(result.reason).toBe('Already acknowledged');
    });

    it('should handle already delivered message', async () => {
      mockDrizzle.client.query.relayMessages.findFirst.mockResolvedValue({
        id: 'relay-1',
        messageId: 'msg-1',
        recipientDeviceId: 'recipient-device',
        ackedAt: null,
      });

      mockDrizzle.client.query.messageRecipients.findFirst.mockResolvedValue({
        id: 'recipient-1',
        messageId: 'msg-1',
        recipientDeviceId: 'recipient-device',
        status: 'DELIVERED', // Already delivered
      });

      mockDrizzle.client.transaction.mockImplementation(async (cb) => {
        await cb({
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
        });
      });

      const result = await relayService.verifyAndAck('msg-1', 'recipient-device', 'client-msg-1');

      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(result.reason).toBe('Already delivered');
    });

    it('should reject ACK for non-existent relay message', async () => {
      mockDrizzle.client.query.relayMessages.findFirst.mockResolvedValue(null);

      const result = await relayService.verifyAndAck('msg-1', 'recipient-device', 'client-msg-1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Relay message not found');
    });

    it('should reject ACK for non-existent recipient', async () => {
      mockDrizzle.client.query.relayMessages.findFirst.mockResolvedValue({
        id: 'relay-1',
        messageId: 'msg-1',
        recipientDeviceId: 'recipient-device',
        ackedAt: null,
      });

      mockDrizzle.client.query.messageRecipients.findFirst.mockResolvedValue(null);

      const result = await relayService.verifyAndAck('msg-1', 'recipient-device', 'client-msg-1');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Recipient record not found');
    });
  });

  describe('read receipt flow', () => {
    it('should mark message as read', async () => {
      mockDrizzle.client.query.relayMessages.findFirst.mockResolvedValue({
        id: 'relay-1',
        messageId: 'msg-1',
        recipientDeviceId: 'recipient-device',
        ackedAt: null,
      });

      mockDrizzle.client.update.mockReturnThis();
      mockDrizzle.client.set.mockReturnThis();
      mockDrizzle.client.where.mockReturnThis();

      const result = await relayService.verifyAndMarkRead('msg-1', 'recipient-device');

      expect(result).toBe(true);
      expect(mockDrizzle.client.update).toHaveBeenCalled();
    });

    it('should return false for non-existent relay message', async () => {
      mockDrizzle.client.query.relayMessages.findFirst.mockResolvedValue(null);

      const result = await relayService.verifyAndMarkRead('msg-1', 'recipient-device');

      expect(result).toBe(false);
    });
  });

  describe('retry failed deliveries', () => {
    it('should retry failed deliveries with exponential backoff', async () => {
      mockDrizzle.client.query.relayMessages.findMany.mockResolvedValue([
        {
          id: 'relay-1',
          messageId: 'msg-1',
          recipientDeviceId: 'recipient-1',
          attempts: 0,
          maxAttempts: 10,
        },
        {
          id: 'relay-2',
          messageId: 'msg-2',
          recipientDeviceId: 'recipient-2',
          attempts: 1,
          maxAttempts: 10,
        },
      ]);

      mockDrizzle.client.update.mockReturnThis();
      mockDrizzle.client.set.mockReturnThis();
      mockDrizzle.client.where.mockReturnThis();

      const realtime = { sendToDevice: vi.fn() };
      const relay = new RelayService(mockDrizzle, realtime);

      const count = await relay.retryFailedDeliveries();

      expect(count).toBe(2);
      expect(realtime.sendToDevice).toHaveBeenCalledTimes(2);
    });
  });

  describe('recover unacked on reconnect', () => {
    it('should resend unacknowledged messages on reconnect', async () => {
      mockDrizzle.client.query.relayMessages.findMany.mockResolvedValue([
        { messageId: 'msg-1', recipientDeviceId: 'device-1' },
        { messageId: 'msg-2', recipientDeviceId: 'device-1' },
      ]);

      const realtime = { sendToDevice: vi.fn() };
      const relay = new RelayService(mockDrizzle, realtime);

      const count = await relay.recoverUnackedOnReconnect('device-1');

      expect(count).toBe(2);
      expect(realtime.sendToDevice).toHaveBeenCalledTimes(2);
      expect(realtime.sendToDevice).toHaveBeenCalledWith('device-1', 'MESSAGE_NEW', {
        messageId: 'msg-1',
        recovered: true,
      });
    });
  });

  describe('handle ACK timeout', () => {
    it('should mark messages as failed after max attempts', async () => {
      mockDrizzle.client.query.relayMessages.findMany.mockResolvedValue([
        {
          id: 'relay-1',
          messageId: 'msg-1',
          recipientDeviceId: 'device-1',
          attempts: 10,
          maxAttempts: 10,
        },
      ]);

      mockDrizzle.client.update.mockReturnThis();
      mockDrizzle.client.set.mockReturnThis();
      mockDrizzle.client.where.mockReturnThis();

      const count = await relayService.handleAckTimeout();

      expect(count).toBe(1);
      expect(mockDrizzle.client.update).toHaveBeenCalled();
    });
  });

  describe('cleanup expired relay messages', () => {
    it('should delete expired unacked messages', async () => {
      mockDrizzle.client.delete.mockReturnThis();
      mockDrizzle.client.where.mockReturnThis();
      mockDrizzle.client.returning.mockResolvedValue([{ id: 'relay-1' }]);

      const count = await relayService.cleanupExpiredRelayMessages();

      expect(count).toBe(1);
    });
  });
});