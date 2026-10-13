import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { syncOperations, devices } from '../common/database/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { createId } from '../common/utils/id';

export interface MessageIdentifier {
  messageId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  timestamp: number;
  nonce: string;
}

export interface ReplayCheckResult {
  isReplay: boolean;
  reason?: string;
  originalTimestamp?: number;
}

@Injectable()
export class ReplayProtectionService {
  private readonly logger = new Logger(ReplayProtectionService.name);
  private readonly maxMessageAgeMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly minMessageAgeMs = 1000; // 1 second (clock skew tolerance)

  constructor(private drizzle: DrizzleService) {}

  async checkAndRecord(identifier: MessageIdentifier): Promise<ReplayCheckResult> {
    if (!this.isValidTimestamp(identifier.timestamp)) {
      return {
        isReplay: true,
        reason: 'Invalid timestamp (too old or in future)',
        originalTimestamp: identifier.timestamp,
      };
    }

    const existing = await this.drizzle.client.query.syncOperations.findFirst({
      where: and(
        eq(syncOperations.operationType, 'MESSAGE_PROCESSED'),
        eq(syncOperations.entityType, 'replay_protection'),
        eq(syncOperations.entityId, this.getCompositeKey(identifier)),
      ),
    });

    if (existing) {
      this.logger.warn(`Replay attack detected: ${identifier.messageId} from ${identifier.senderDeviceId}`);
      
      const recipientDevice = await this.drizzle.client.query.devices.findFirst({
        where: eq(devices.id, identifier.recipientDeviceId),
      });

      await this.drizzle.client.insert(syncOperations).values({
        userId: recipientDevice?.userId || 'unknown',
        deviceId: identifier.recipientDeviceId,
        operationType: 'REPLAY_ATTACK_DETECTED',
        entityType: 'security',
        entityId: createId(),
        payload: {
          messageId: identifier.messageId,
          senderDeviceId: identifier.senderDeviceId,
          recipientDeviceId: identifier.recipientDeviceId,
          originalTimestamp: existing.createdAt.getTime(),
          replayTimestamp: identifier.timestamp,
          nonce: identifier.nonce,
        },
        idempotencyKey: `replay:${identifier.messageId}:${Date.now()}`,
        status: 'COMPLETED',
        maxAttempts: 1,
      });

      return {
        isReplay: true,
        reason: 'Duplicate message detected',
        originalTimestamp: existing.createdAt.getTime(),
      };
    }

    const recipientDevice = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, identifier.recipientDeviceId),
    });

    await this.drizzle.client.insert(syncOperations).values({
      userId: recipientDevice?.userId || 'unknown',
      deviceId: identifier.recipientDeviceId,
      operationType: 'MESSAGE_PROCESSED',
      entityType: 'replay_protection',
      entityId: this.getCompositeKey(identifier),
      payload: identifier,
      idempotencyKey: `processed:${identifier.messageId}:${identifier.recipientDeviceId}`,
      status: 'COMPLETED',
      maxAttempts: 1,
    });

    await this.cleanupOldEntries();

    return { isReplay: false };
  }

  private getCompositeKey(identifier: MessageIdentifier): string {
    return `${identifier.messageId}:${identifier.recipientDeviceId}`;
  }

  private isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const age = now - timestamp;
    return age >= -this.minMessageAgeMs && age <= this.maxMessageAgeMs;
  }

  private async cleanupOldEntries(): Promise<void> {
    const cutoff = new Date(Date.now() - this.maxMessageAgeMs * 2);
    
    await this.drizzle.client
      .delete(syncOperations)
      .where(and(
        eq(syncOperations.operationType, 'MESSAGE_PROCESSED'),
        eq(syncOperations.entityType, 'replay_protection'),
        lt(syncOperations.createdAt, cutoff),
      ));
  }

  async getProcessedCount(deviceId: string, windowMs = 60 * 60 * 1000): Promise<number> {
    const windowStart = new Date(Date.now() - windowMs);
    
    const results = await this.drizzle.client.query.syncOperations.findMany({
      where: and(
        eq(syncOperations.deviceId, deviceId),
        eq(syncOperations.operationType, 'MESSAGE_PROCESSED'),
        eq(syncOperations.entityType, 'replay_protection'),
        gte(syncOperations.createdAt, windowStart),
      ),
    });

    return results.length;
  }

  async verifyMessageChain(
    recipientDeviceId: string,
    messages: Array<{ messageId: string; senderDeviceId: string; timestamp: number; nonce: string }>,
  ): Promise<{ valid: boolean; firstGap?: number; gaps: number[] }> {
    if (messages.length === 0) return { valid: true, gaps: [] };

    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    const gaps: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const expected = sorted[i - 1].timestamp + 1;
      if (sorted[i].timestamp > expected) {
        gaps.push(expected);
      }
    }

    for (const msg of sorted) {
      const result = await this.checkAndRecord({
        messageId: msg.messageId,
        senderDeviceId: msg.senderDeviceId,
        recipientDeviceId,
        timestamp: msg.timestamp,
        nonce: msg.nonce,
      });

      if (result.isReplay) {
        return { valid: false, gaps };
      }
    }

    return { valid: true, gaps: gaps.length > 0 ? gaps : [] };
  }
}

import { lt } from 'drizzle-orm';