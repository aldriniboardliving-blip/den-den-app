import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { messageRecipients, relayMessages, messages } from '../common/database/schema';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';
import { RelayService } from '../relay/relay.service';

@Injectable()
export class DeliveryService {
  constructor(
    private drizzle: DrizzleService,
    private relay: RelayService,
  ) {}

  async processAck(messageId: string, recipientDeviceId: string, status: 'DELIVERED' | 'READ') {
    const [recipient] = await this.drizzle.client
      .update(messageRecipients)
      .set({
        status,
        deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
        readAt: status === 'READ' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.recipientDeviceId, recipientDeviceId)))
      .returning();

    if (!recipient) return { success: false, reason: 'Recipient not found' };

    if (status === 'DELIVERED') {
      await this.relay.markDelivered(messageId, recipientDeviceId);
    }

    return { success: true, recipient };
  }

  async getDeliveryStatus(messageId: string) {
    return this.drizzle.client.query.messageRecipients.findMany({
      where: eq(messageRecipients.messageId, messageId),
    });
  }

  async retryUndelivered() {
    const undelivered = await this.drizzle.client.query.messageRecipients.findMany({
      where: and(
        eq(messageRecipients.status, 'PENDING'),
        sql`${messageRecipients.createdAt} < NOW() - INTERVAL '5 minutes'`,
      ),
      limit: 100,
    });

    for (const recipient of undelivered) {
      await this.drizzle.client
        .update(messageRecipients)
        .set({ status: 'RELAYED' })
        .where(eq(messageRecipients.id, recipient.id));
    }

    return undelivered.length;
  }
}