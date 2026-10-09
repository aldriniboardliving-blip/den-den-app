import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { relayMessages, devices, messageRecipients, messages } from '../common/database/schema';
import { eq, and, desc, sql, lt, gte, isNull, inArray } from 'drizzle-orm';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class RelayService {
  private readonly logger = new Logger(RelayService.name);

  constructor(
    private drizzle: DrizzleService,
    private realtime: RealtimeGateway,
  ) {}

  async notifyRecipient(deviceId: string, messageId: string) {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });

    if (!device) return;

    this.realtime.sendToDevice(deviceId, 'MESSAGE_NEW', { messageId });
  }

  async getPendingForDelivery(deviceId: string, limit = 100) {
    return this.drizzle.client.query.relayMessages.findMany({
      where: and(
        eq(relayMessages.recipientDeviceId, deviceId),
        isNull(relayMessages.ackedAt),
        sql`${relayMessages.nextRetryAt} <= NOW()`,
      ),
      limit,
      orderBy: desc(relayMessages.createdAt),
    });
  }

  async markDelivered(messageId: string, recipientDeviceId: string) {
    await this.drizzle.client
      .update(relayMessages)
      .set({ ackedAt: new Date() })
      .where(and(eq(relayMessages.messageId, messageId), eq(relayMessages.recipientDeviceId, recipientDeviceId)));
  }

  async verifyAndAck(
    messageId: string,
    recipientDeviceId: string,
    clientMessageId: string,
  ): Promise<{ success: boolean; duplicate: boolean; reason?: string }> {
    const relayMsg = await this.drizzle.client.query.relayMessages.findFirst({
      where: and(
        eq(relayMessages.messageId, messageId),
        eq(relayMessages.recipientDeviceId, recipientDeviceId),
      ),
    });

    if (!relayMsg) {
      return { success: false, duplicate: false, reason: 'Relay message not found' };
    }

    if (relayMsg.ackedAt) {
      return { success: true, duplicate: true, reason: 'Already acknowledged' };
    }

    const recipient = await this.drizzle.client.query.messageRecipients.findFirst({
      where: and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientDeviceId, recipientDeviceId),
      ),
    });

    if (!recipient) {
      return { success: false, duplicate: false, reason: 'Recipient record not found' };
    }

    if (recipient.status === 'DELIVERED' || recipient.status === 'READ') {
      await this.drizzle.client
        .update(relayMessages)
        .set({ ackedAt: new Date() })
        .where(eq(relayMessages.id, relayMsg.id));
      return { success: true, duplicate: true, reason: 'Already delivered' };
    }

    await this.drizzle.client.transaction(async (tx) => {
      await tx
        .update(messageRecipients)
        .set({
          status: 'DELIVERED',
          deliveredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(messageRecipients.messageId, messageId),
          eq(messageRecipients.recipientDeviceId, recipientDeviceId),
        ));

      await tx
        .update(relayMessages)
        .set({ ackedAt: new Date() })
        .where(eq(relayMessages.id, relayMsg.id));
    });

    return { success: true, duplicate: false };
  }

  async verifyAndMarkRead(messageId: string, recipientDeviceId: string): Promise<boolean> {
    const relayMsg = await this.drizzle.client.query.relayMessages.findFirst({
      where: and(
        eq(relayMessages.messageId, messageId),
        eq(relayMessages.recipientDeviceId, recipientDeviceId),
      ),
    });

    if (!relayMsg) return false;

    await this.drizzle.client
      .update(messageRecipients)
      .set({
        status: 'READ',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(messageRecipients.messageId, messageId),
        eq(messageRecipients.recipientDeviceId, recipientDeviceId),
      ));

    if (!relayMsg.ackedAt) {
      await this.drizzle.client
        .update(relayMessages)
        .set({ ackedAt: new Date() })
        .where(eq(relayMessages.id, relayMsg.id));
    }

    return true;
  }

  async retryFailedDeliveries() {
    const failed = await this.drizzle.client.query.relayMessages.findMany({
      where: and(
        isNull(relayMessages.ackedAt),
        sql`${relayMessages.attempts} < ${relayMessages.maxAttempts}`,
        sql`${relayMessages.nextRetryAt} <= NOW()`,
      ),
      limit: 100,
    });

    for (const msg of failed) {
      const currentAttempts = msg.attempts ?? 0;
      const nextRetryDelay = Math.min(Math.pow(2, currentAttempts) * 1000, 30000);

      await this.drizzle.client
        .update(relayMessages)
        .set({
          attempts: currentAttempts + 1,
          nextRetryAt: new Date(Date.now() + nextRetryDelay),
        })
        .where(eq(relayMessages.id, msg.id));

      this.realtime.sendToDevice(msg.recipientDeviceId, 'MESSAGE_NEW', { 
        messageId: msg.messageId,
        retryAttempt: currentAttempts + 1,
      });
    }

    this.logger.log(`Retried ${failed.length} failed deliveries`);
    return failed.length;
  }

  async recoverUnackedOnReconnect(deviceId: string) {
    const unacked = await this.drizzle.client.query.relayMessages.findMany({
      where: and(
        eq(relayMessages.recipientDeviceId, deviceId),
        isNull(relayMessages.ackedAt),
      ),
      limit: 200,
    });

    for (const msg of unacked) {
      this.realtime.sendToDevice(deviceId, 'MESSAGE_NEW', { 
        messageId: msg.messageId,
        recovered: true,
      });
    }

    this.logger.log(`Recovered ${unacked.length} unacknowledged messages for device ${deviceId}`);
    return unacked.length;
  }

  async cleanupExpiredRelayMessages() {
    const result = await this.drizzle.client
      .delete(relayMessages)
      .where(and(isNull(relayMessages.ackedAt), lt(relayMessages.expiresAt, new Date())))
      .returning({ id: relayMessages.id });

    this.logger.log(`🧹 Cleaned up ${result.length} expired relay messages`);
    return result.length;
  }

  async handleAckTimeout() {
    const timedOut = await this.drizzle.client.query.relayMessages.findMany({
      where: and(
        isNull(relayMessages.ackedAt),
        sql`${relayMessages.attempts} >= ${relayMessages.maxAttempts}`,
      ),
      limit: 100,
    });

    for (const msg of timedOut) {
      await this.drizzle.client
        .update(messageRecipients)
        .set({
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'ACK timeout after max retries',
          updatedAt: new Date(),
        })
        .where(and(
          eq(messageRecipients.messageId, msg.messageId),
          eq(messageRecipients.recipientDeviceId, msg.recipientDeviceId),
        ));

      await this.drizzle.client
        .update(relayMessages)
        .set({ ackedAt: new Date() })
        .where(eq(relayMessages.id, msg.id));
    }

    this.logger.warn(`Marked ${timedOut.length} messages as failed due to ACK timeout`);
    return timedOut.length;
  }

  async getRelayStats() {
    const [pendingResult, deliveredResult, expiredResult] = await Promise.all([
      this.drizzle.client.select({ count: sql<number>`count(*)` }).from(relayMessages).where(isNull(relayMessages.ackedAt)),
      this.drizzle.client.select({ count: sql<number>`count(*)` }).from(relayMessages).where(sql`${relayMessages.ackedAt} IS NOT NULL`),
      this.drizzle.client.select({ count: sql<number>`count(*)` }).from(relayMessages).where(lt(relayMessages.expiresAt, new Date())),
    ]);

    return {
      pending: pendingResult[0]?.count || 0,
      delivered: deliveredResult[0]?.count || 0,
      expired: expiredResult[0]?.count || 0,
    };
  }
}