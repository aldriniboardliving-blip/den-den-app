import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { conversations, conversationMembers, users, devices } from '../common/database/schema';
import { eq, and, desc, inArray, or, isNull } from 'drizzle-orm';
import { createId } from '../common/utils/id';

@Injectable()
export class ConversationsService {
  constructor(private drizzle: DrizzleService) {}

  async create(
    creatorId: string,
    data: { type: 'DIRECT' | 'GROUP'; title?: string; memberDeviceIds: string[] },
  ) {
    if (data.type === 'DIRECT' && data.memberDeviceIds.length !== 1) {
      throw new Error('Direct conversation requires exactly 1 other member');
    }

    const [conversation] = await this.drizzle.client
      .insert(conversations)
      .values({
        type: data.type,
        title: data.title,
        createdById: creatorId,
      })
      .returning();

    const creatorDevice = await this.drizzle.client.query.devices.findFirst({
      where: and(eq(devices.userId, creatorId), isNull(devices.revokedAt)),
      orderBy: desc(devices.lastActiveAt),
    });

    if (!creatorDevice) throw new Error('Creator has no active device');

    const memberDevices = await this.drizzle.client.query.devices.findMany({
      where: inArray(devices.id, data.memberDeviceIds),
    });

    if (memberDevices.length !== data.memberDeviceIds.length) {
      throw new Error('One or more member devices not found');
    }

    const members = [
      {
        conversationId: conversation.id,
        userId: creatorId,
        deviceId: creatorDevice.id,
        role: 'ADMIN' as const,
      },
      ...memberDevices.map((d) => ({
        conversationId: conversation.id,
        userId: d.userId,
        deviceId: d.id,
        role: 'MEMBER' as const,
      })),
    ];

    await this.drizzle.client.insert(conversationMembers).values(members);

    return this.getById(conversation.id);
  }

  async getById(id: string) {
    const conv = await this.drizzle.client.query.conversations.findFirst({
      where: eq(conversations.id, id),
      with: {
        members: { with: { user: true, device: true } },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async getUserConversations(userId: string, deviceId: string) {
    const memberConvs = await this.drizzle.client.query.conversationMembers.findMany({
      where: and(eq(conversationMembers.userId, userId), eq(conversationMembers.deviceId, deviceId), isNull(conversationMembers.leftAt)),
      with: {
        conversation: {
          with: {
            members: { with: { user: true, device: true } },
          },
        },
      },
      orderBy: desc(conversationMembers.updatedAt),
    });

    return memberConvs.map((m) => m.conversation).filter(Boolean);
  }

  async addMember(
    requesterId: string,
    conversationId: string,
    deviceId: string,
  ) {
    const conv = await this.getById(conversationId);
    const requesterMember = conv.members.find((m) => m.userId === requesterId);
    if (!requesterMember) throw new ForbiddenException('Not a member');

    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });
    if (!device) throw new NotFoundException('Device not found');

    const existing = conv.members.find((m) => m.deviceId === deviceId);
    if (existing) throw new Error('Device already in conversation');

    await this.drizzle.client.insert(conversationMembers).values({
      conversationId,
      userId: device.userId,
      deviceId,
      role: 'MEMBER',
    });

    return this.getById(conversationId);
  }

  async removeMember(
    requesterId: string,
    conversationId: string,
    deviceId: string,
  ) {
    const conv = await this.getById(conversationId);
    const requesterMember = conv.members.find((m) => m.userId === requesterId);
    if (!requesterMember || requesterMember.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can remove members');
    }

    await this.drizzle.client
      .update(conversationMembers)
      .set({ leftAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.deviceId, deviceId)));

    return this.getById(conversationId);
  }

  async updateLastMessage(conversationId: string, timestamp: Date) {
    await this.drizzle.client
      .update(conversations)
      .set({ lastMessageAt: timestamp, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }

  async updateDisappearingTimer(conversationId: string, timerMs: number) {
    await this.drizzle.client
      .update(conversations)
      .set({ disappearingTimerMs: timerMs, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
}