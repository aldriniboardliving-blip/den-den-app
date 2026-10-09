import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { messages, messageRecipients, conversationMembers, relayMessages as relayMessagesTable, devices, conversations as conversationsTable } from '../common/database/schema';
import { eq, and, desc, inArray, isNull, sql } from 'drizzle-orm';
import { createId } from '../common/utils/id';
import { RelayService } from '../relay/relay.service';
import { SignalService, EncryptedMessage } from '../crypto/signal/signal.service';

export interface MessageEnvelope {
  messageId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  conversationId: string;
  ciphertext: string;
  nonce: string;
  ephemeralPublic: string;
  signedPreKeyId: number;
  onetimePreKeyId?: number;
  sentAt: string;
}

export interface SignalEnvelope {
  type: number;
  body: string; // base64
}

@Injectable()
export class MessagesService {
  constructor(
    private drizzle: DrizzleService,
    private relay: RelayService,
    private signal: SignalService,
  ) {}

  async send(
    senderDeviceId: string,
    data: {
      conversationId: string;
      clientMessageId: string;
      type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'EDIT' | 'DELETE';
      content?: string;
      contentHash?: string;
      editOfMessageId?: string;
      envelopes: MessageEnvelope[];
    },
  ) {
    const conversation = await this.drizzle.client.query.conversations.findFirst({
      where: eq(conversationsTable.id, data.conversationId),
      with: { members: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const senderMember = conversation.members.find((m) => m.deviceId === senderDeviceId);
    if (!senderMember) throw new ForbiddenException('Sender not in conversation');

    const recipientMembers = conversation.members.filter((m) => m.deviceId !== senderDeviceId);
    if (recipientMembers.length === 0) throw new Error('No recipients');

    const [message] = await this.drizzle.client
      .insert(messages)
      .values({
        conversationId: data.conversationId,
        senderDeviceId,
        clientMessageId: data.clientMessageId,
        type: data.type,
        content: data.content,
        contentHash: data.contentHash,
        editOfMessageId: data.editOfMessageId,
      })
      .returning();

    const recipients = recipientMembers.map((m) => ({
      messageId: message.id,
      recipientDeviceId: m.deviceId,
      status: 'PENDING' as const,
    }));

    await this.drizzle.client.insert(messageRecipients).values(recipients);

    const relayMessagesData = data.envelopes.map((env) => ({
      messageId: message.id,
      recipientDeviceId: env.recipientDeviceId,
      envelope: {
        messageId: env.messageId,
        senderDeviceId: env.senderDeviceId,
        recipientDeviceId: env.recipientDeviceId,
        conversationId: env.conversationId,
        ciphertext: env.ciphertext,
        nonce: env.nonce,
        ephemeralPublic: env.ephemeralPublic,
        signedPreKeyId: env.signedPreKeyId,
        onetimePreKeyId: env.onetimePreKeyId,
        sentAt: env.sentAt,
      },
      nextRetryAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));

    await this.drizzle.client.insert(relayMessagesTable).values(relayMessagesData);

    await this.drizzle.client
      .update(messageRecipients)
      .set({ status: 'RELAYED' })
      .where(eq(messageRecipients.messageId, message.id));

    await this.drizzle.client
      .update(conversationsTable)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(conversationsTable.id, data.conversationId));

    for (const env of data.envelopes) {
      await this.relay.notifyRecipient(env.recipientDeviceId, message.id);
    }

    return message;
  }

  async getPendingForDevice(deviceId: string, limit = 50) {
    return this.drizzle.client.query.relayMessages.findMany({
      where: and(
        eq(relayMessagesTable.recipientDeviceId, deviceId),
        isNull(relayMessagesTable.ackedAt),
        sql`${relayMessagesTable.nextRetryAt} <= NOW()`,
      ),
      limit,
      with: { message: true },
    });
  }

  async ack(messageId: string, recipientDeviceId: string, status: 'DELIVERED' | 'READ', clientMessageId?: string) {
    if (status === 'DELIVERED') {
      const result = await this.relay.verifyAndAck(messageId, recipientDeviceId, clientMessageId || '');
      if (!result.success) {
        throw new NotFoundException(result.reason || 'Message recipient not found');
      }
      return { 
        success: true, 
        duplicate: result.duplicate,
        reason: result.reason,
      };
    }

    if (status === 'READ') {
      const success = await this.relay.verifyAndMarkRead(messageId, recipientDeviceId);
      if (!success) {
        throw new NotFoundException('Message recipient not found');
      }
      return { success: true };
    }

    throw new Error('Invalid status');
  }

  async getConversationMessages(conversationId: string, deviceId: string, before?: Date, limit = 50) {
    const member = await this.drizzle.client.query.conversationMembers.findFirst({
      where: and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.deviceId, deviceId)),
    });
    if (!member) throw new ForbiddenException('Not a member');

    const where = and(
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt),
      before ? sql`${messages.sentAt} < ${before}` : undefined,
    );

    return this.drizzle.client.query.messages.findMany({
      where,
      orderBy: desc(messages.sentAt),
      limit,
      with: {
        recipients: { where: eq(messageRecipients.recipientDeviceId, deviceId) },
      },
    });
  }

  async markAsRead(messageId: string, deviceId: string) {
    return this.ack(messageId, deviceId, 'READ');
  }

  async getPreKeyBundle(deviceId: string) {
    return this.signal.getPreKeyBundle(deviceId);
  }

  async hasSession(senderDeviceId: string, recipientDeviceId: string): Promise<boolean> {
    return this.signal.hasSession(senderDeviceId, recipientDeviceId);
  }

  async rotateSignedPreKey(
    deviceId: string,
    data: { publicKey: string; signature: string; keyId: number },
  ) {
    return this.signal.rotateSignedPreKey(deviceId, data);
  }

  async addOneTimePreKeys(
    deviceId: string,
    keys: Array<{ keyId: number; publicKey: string; privateKey: string }>,
  ) {
    return this.signal.addOneTimePreKeys(deviceId, keys);
  }

  async consumeOneTimePreKey(deviceId: string, keyId: number) {
    return this.signal.consumeOneTimePreKey(deviceId, keyId);
  }
}