import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { devices, users, conversations, conversationMembers, messages, encryptionKeys } from '../common/database/schema';
import { eq, and, desc, inArray, isNull, sql } from 'drizzle-orm';
import { createId } from '../common/utils/id';
import { SignalService } from '../crypto/signal/signal.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface LinkedDevice {
  id: string;
  deviceName: string | null;
  platform: string;
  platformVersion: string | null;
  appVersion: string | null;
  linkedAt: Date;
  lastActiveAt: Date | null;
  isPrimary: boolean;
}

export interface DeviceLinkRequest {
  primaryDeviceId: string;
  newDevicePublicKey: string;
  newDeviceSigningKey: string;
  newDeviceName?: string;
  platform: 'ios' | 'android' | 'web';
  platformVersion?: string;
  appVersion?: string;
}

export interface DeviceLinkChallenge {
  challengeId: string;
  primaryDeviceId: string;
  newDevicePublicKey: string;
  newDeviceSigningKey: string;
  newDeviceName?: string;
  platform: string;
  platformVersion?: string;
  appVersion?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
}

export interface SyncKeyBundle {
  deviceId: string;
  identityKey: string;
  signedPreKey: { keyId: number; publicKey: string; signature: string };
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
}

@Injectable()
export class MultiDeviceService {
  constructor(
    private drizzle: DrizzleService,
    private signal: SignalService,
    private realtime: RealtimeGateway,
  ) {}

  async initiateDeviceLink(
    primaryDeviceId: string,
    data: Omit<DeviceLinkRequest, 'primaryDeviceId'>,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    const primaryDevice = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, primaryDeviceId),
    });
    if (!primaryDevice) throw new NotFoundException('Primary device not found');
    if (primaryDevice.revokedAt) throw new ForbiddenException('Primary device is revoked');

    const userId = primaryDevice.userId;
    const challengeId = createId();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const challengeKey = `link_challenge_${challengeId}`;
    await this.drizzle.client
      .insert(encryptionKeys)
      .values({
        id: challengeKey,
        deviceId: primaryDeviceId,
        keyType: 'LINK_CHALLENGE',
        publicKey: JSON.stringify({
          newDevicePublicKey: data.newDevicePublicKey,
          newDeviceSigningKey: data.newDeviceSigningKey,
          newDeviceName: data.newDeviceName,
          platform: data.platform,
          platformVersion: data.platformVersion,
          appVersion: data.appVersion,
        }),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    this.realtime.sendToDevice(primaryDeviceId, 'DEVICE_LINK_REQUEST', {
      challengeId,
      newDeviceName: data.newDeviceName,
      platform: data.platform,
      expiresAt: expiresAt.toISOString(),
    });

    return { challengeId, expiresAt };
  }

  async approveDeviceLink(
    primaryDeviceId: string,
    challengeId: string,
    approve: boolean,
  ): Promise<{ success: boolean; deviceId?: string }> {
    const challengeKey = `link_challenge_${challengeId}`;
    const challenge = await this.drizzle.client.query.encryptionKeys.findFirst({
      where: and(eq(encryptionKeys.id, challengeKey), eq(encryptionKeys.isActive, true)),
    });

    if (!challenge) throw new NotFoundException('Link challenge not found or expired');
    if (challenge.deviceId !== primaryDeviceId) throw new ForbiddenException('Not your challenge');

    const challengeData = JSON.parse(challenge.publicKey || '{}');
    if (!approve) {
      await this.drizzle.client
        .update(encryptionKeys)
        .set({ isActive: false, usedAt: new Date() })
        .where(eq(encryptionKeys.id, challengeKey));
      return { success: true };
    }

    const primaryDevice = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, primaryDeviceId),
    });
    if (!primaryDevice) throw new NotFoundException('Primary device not found');

    const [newDevice] = await this.drizzle.client
      .insert(devices)
      .values({
        userId: primaryDevice.userId,
        deviceName: challengeData.newDeviceName || 'Linked Device',
        platform: challengeData.platform,
        platformVersion: challengeData.platformVersion,
        appVersion: challengeData.appVersion,
        identityKeyPublic: challengeData.newDevicePublicKey,
        signingKeyPublic: challengeData.newDeviceSigningKey,
        signedPreKeyPublic: '',
        signedPreKeySignature: '',
        signedPreKeyId: 0,
        lastActiveAt: new Date(),
      })
      .returning();

    await this.drizzle.client
      .update(encryptionKeys)
      .set({ isActive: false, usedAt: new Date() })
      .where(eq(encryptionKeys.id, challengeKey));

    const userDevices = await this.drizzle.client.query.devices.findMany({
      where: and(eq(devices.userId, primaryDevice.userId), isNull(devices.revokedAt)),
    });

    for (const device of userDevices) {
      this.realtime.sendToDevice(device.id, 'DEVICE_LINKED', {
        deviceId: newDevice.id,
        deviceName: newDevice.deviceName,
        platform: newDevice.platform,
        isPrimary: device.id === primaryDeviceId,
      });
    }

    return { success: true, deviceId: newDevice.id };
  }

  async getLinkedDevices(userId: string): Promise<LinkedDevice[]> {
    const userDevices = await this.drizzle.client.query.devices.findMany({
      where: and(eq(devices.userId, userId), isNull(devices.revokedAt)),
      orderBy: desc(devices.lastActiveAt),
    });

    const primaryDevice = userDevices.find(d => d.id === userDevices[0]?.id);

    return userDevices.map(d => ({
      id: d.id,
      deviceName: d.deviceName,
      platform: d.platform,
      platformVersion: d.platformVersion,
      appVersion: d.appVersion,
      linkedAt: d.createdAt,
      lastActiveAt: d.lastActiveAt,
      isPrimary: d.id === primaryDevice?.id,
    }));
  }

  async revokeDevice(userId: string, deviceIdToRevoke: string, requestingDeviceId: string): Promise<void> {
    const requestingDevice = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, requestingDeviceId),
    });
    if (!requestingDevice || requestingDevice.userId !== userId) {
      throw new ForbiddenException('Not your device');
    }

    const deviceToRevoke = await this.drizzle.client.query.devices.findFirst({
      where: and(eq(devices.id, deviceIdToRevoke), eq(devices.userId, userId)),
    });
    if (!deviceToRevoke) throw new NotFoundException('Device not found');
    if (deviceToRevoke.id === requestingDeviceId) {
      throw new ConflictException('Cannot revoke current device');
    }

    await this.drizzle.client
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(eq(devices.id, deviceIdToRevoke));

    await this.drizzle.client
      .update(encryptionKeys)
      .set({ isActive: false, usedAt: new Date() })
      .where(and(eq(encryptionKeys.deviceId, deviceIdToRevoke), eq(encryptionKeys.isActive, true)));

    const userDevices = await this.drizzle.client.query.devices.findMany({
      where: and(eq(devices.userId, userId), isNull(devices.revokedAt)),
    });

    for (const device of userDevices) {
      this.realtime.sendToDevice(device.id, 'DEVICE_REVOKED', {
        revokedDeviceId: deviceIdToRevoke,
      });
    }
  }

  async syncConversationKeys(
    deviceId: string,
    conversationId: string,
    senderKeys: Map<string, string>,
  ): Promise<void> {
    const member = await this.drizzle.client.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.deviceId, deviceId),
        isNull(conversationMembers.leftAt),
      ),
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');

    const otherMembers = await this.drizzle.client.query.conversationMembers.findMany({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        isNull(conversationMembers.leftAt),
      ),
    });

    for (const otherMember of otherMembers) {
      if (otherMember.deviceId === deviceId) continue;
      const senderKey = senderKeys.get(otherMember.deviceId);
      if (senderKey) {
        await this.drizzle.client
          .update(conversationMembers)
          .set({ senderKey, updatedAt: new Date() })
          .where(eq(conversationMembers.id, otherMember.id));
      }
    }
  }

  async getConversationKeyBundle(deviceId: string, conversationId: string): Promise<SyncKeyBundle | null> {
    const member = await this.drizzle.client.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.deviceId, deviceId),
        isNull(conversationMembers.leftAt),
      ),
    });
    if (!member) return null;

    return {
      deviceId: member.deviceId,
      identityKey: member.senderKey || '',
      signedPreKey: { keyId: 0, publicKey: '', signature: '' },
      oneTimePreKeys: [],
    };
  }

  async fanOutMessage(
    senderDeviceId: string,
    conversationId: string,
    envelope: any,
  ): Promise<string[]> {
    const conversation = await this.drizzle.client.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      with: { members: { where: isNull(conversationMembers.leftAt) } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const recipientDevices = conversation.members
      .filter(m => m.deviceId !== senderDeviceId)
      .map(m => m.deviceId);

    for (const deviceId of recipientDevices) {
      this.realtime.sendToDevice(deviceId, 'MESSAGE_NEW', { messageId: envelope.messageId });
    }

    return recipientDevices;
  }

  async syncConversationHistory(
    deviceId: string,
    conversationId: string,
    since?: Date,
  ): Promise<any[]> {
    const member = await this.drizzle.client.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.deviceId, deviceId),
        isNull(conversationMembers.leftAt),
      ),
    });
    if (!member) throw new ForbiddenException('Not a member');

    const where = and(
      eq(messages.conversationId, conversationId),
      isNull(messages.deletedAt),
      since ? sql`${messages.sentAt} > ${since}` : undefined,
    );

    return this.drizzle.client.query.messages.findMany({
      where,
      orderBy: desc(messages.sentAt),
      limit: 100,
    });
  }

  async registerSenderKey(
    deviceId: string,
    conversationId: string,
    senderKey: string,
  ): Promise<void> {
    await this.drizzle.client
      .update(conversationMembers)
      .set({ senderKey, updatedAt: new Date() })
      .where(and(
        eq(conversationMembers.deviceId, deviceId),
        eq(conversationMembers.conversationId, conversationId),
      ));
  }

  async getPendingSyncOperations(deviceId: string, limit = 50): Promise<any[]> {
    return this.drizzle.client.query.encryptionKeys.findMany({
      where: and(
        eq(encryptionKeys.deviceId, deviceId),
        eq(encryptionKeys.keyType, 'SYNC_OPERATION'),
        eq(encryptionKeys.isActive, true),
      ),
      limit,
      orderBy: desc(encryptionKeys.createdAt),
    });
  }

  async queueKeySync(
    deviceId: string,
    conversationId: string,
    senderKey: string,
  ): Promise<void> {
    const syncKey = `sync_${deviceId}_${conversationId}_${Date.now()}`;
    await this.drizzle.client
      .insert(encryptionKeys)
      .values({
        id: syncKey,
        deviceId,
        keyType: 'SYNC_OPERATION',
        publicKey: JSON.stringify({ conversationId, senderKey }),
        isActive: true,
      });
  }
}