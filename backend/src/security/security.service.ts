import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { encryptionKeys, devices, syncOperations } from '../common/database/schema';
import { eq, and, desc, isNull, gte, lt } from 'drizzle-orm';
import { createId } from '../common/utils/id';
import * as crypto from 'crypto';

export interface SecurityConfig {
  maxFailedAttempts: number;
  lockoutDurationMs: number;
  tokenRotationIntervalMs: number;
  sessionTimeoutMs: number;
  requireBiometricForSensitive: boolean;
  enableCertificatePinning: boolean;
  allowedKeyAlgorithms: string[];
  minKeySize: number;
}

export interface SecurityEvent {
  id: string;
  userId: string | null;
  deviceId: string | null;
  eventType: SecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'TOKEN_REFRESH'
  | 'TOKEN_REVOKED'
  | 'DEVICE_LINKED'
  | 'DEVICE_REVOKED'
  | 'KEY_ROTATED'
  | 'BIOMETRIC_AUTH_SUCCESS'
  | 'BIOMETRIC_AUTH_FAILED'
  | 'CERT_PINNING_VALIDATION'
  | 'REPLAY_ATTACK_DETECTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'SETTINGS_CHANGED'
  | 'MESSAGE_SENT'
  | 'MESSAGE_DECRYPTION_FAILED';

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly config: SecurityConfig;

  constructor(
    private drizzle: DrizzleService,
    private configService: ConfigService,
  ) {
    this.config = {
      maxFailedAttempts: this.configService.get('SECURITY_MAX_FAILED_ATTEMPTS', 5),
      lockoutDurationMs: this.configService.get('SECURITY_LOCKOUT_DURATION_MS', 15 * 60 * 1000),
      tokenRotationIntervalMs: this.configService.get('SECURITY_TOKEN_ROTATION_MS', 24 * 60 * 60 * 1000),
      sessionTimeoutMs: this.configService.get('SECURITY_SESSION_TIMEOUT_MS', 30 * 60 * 1000),
      requireBiometricForSensitive: this.configService.get('SECURITY_REQUIRE_BIOMETRIC', true),
      enableCertificatePinning: this.configService.get('SECURITY_CERT_PINNING', true),
      allowedKeyAlgorithms: ['X25519', 'Ed25519', 'AES-256-GCM'],
      minKeySize: 256,
    };
  }

  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'createdAt'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: createId(),
      createdAt: new Date(),
    };

    await this.drizzle.client.insert(syncOperations).values({
      userId: event.userId || 'system',
      deviceId: event.deviceId || 'unknown',
      operationType: 'SECURITY_EVENT',
      entityType: 'security_event',
      entityId: securityEvent.id,
      payload: securityEvent,
      idempotencyKey: `security:${securityEvent.id}`,
      status: 'COMPLETED',
      maxAttempts: 1,
    });

    if (event.severity === 'HIGH' || event.severity === 'CRITICAL') {
      this.logger.warn(`Security event: ${event.eventType} - ${event.description}`, event.metadata);
    }
  }

  async validateKeyAlgorithm(algorithm: string, keySize: number): Promise<boolean> {
    return this.config.allowedKeyAlgorithms.includes(algorithm) && keySize >= this.config.minKeySize;
  }

  async checkDeviceLockout(deviceId: string): Promise<{ locked: boolean; remainingMs?: number }> {
    const failedAttempts = await this.drizzle.client.query.syncOperations.findMany({
      where: and(
        eq(syncOperations.deviceId, deviceId),
        eq(syncOperations.operationType, 'LOGIN_FAILED'),
        gte(syncOperations.createdAt, new Date(Date.now() - this.config.lockoutDurationMs)),
      ),
    });

    if (failedAttempts.length >= this.config.maxFailedAttempts) {
      const oldestAttempt = failedAttempts[failedAttempts.length - 1];
      const lockoutEndsAt = new Date(oldestAttempt.createdAt.getTime() + this.config.lockoutDurationMs);
      const remainingMs = lockoutEndsAt.getTime() - Date.now();
      return { locked: true, remainingMs: Math.max(0, remainingMs) };
    }

    return { locked: false };
  }

  async recordFailedAttempt(deviceId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });
    const userId = device?.userId || 'unknown';

    await this.drizzle.client.insert(syncOperations).values({
      userId,
      deviceId,
      operationType: 'LOGIN_FAILED',
      entityType: 'security',
      entityId: createId(),
      payload: { ipAddress, userAgent },
      idempotencyKey: `failed:${deviceId}:${Date.now()}`,
      status: 'COMPLETED',
      maxAttempts: 1,
    });
  }

  async recordSuccessfulLogin(deviceId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });
    const userId = device?.userId || 'unknown';

    await this.drizzle.client.insert(syncOperations).values({
      userId,
      deviceId,
      operationType: 'LOGIN_SUCCESS',
      entityType: 'security',
      entityId: createId(),
      payload: { ipAddress, userAgent },
      idempotencyKey: `success:${deviceId}:${Date.now()}`,
      status: 'COMPLETED',
      maxAttempts: 1,
    });
  }

  async rotateTokensIfNeeded(deviceId: string): Promise<boolean> {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });

    if (!device) return false;

    const lastRotation = await this.drizzle.client.query.syncOperations.findFirst({
      where: and(
        eq(syncOperations.deviceId, deviceId),
        eq(syncOperations.operationType, 'TOKEN_REFRESH'),
      ),
      orderBy: desc(syncOperations.createdAt),
    });

    if (!lastRotation || Date.now() - lastRotation.createdAt.getTime() > this.config.tokenRotationIntervalMs) {
      await this.drizzle.client.insert(syncOperations).values({
        userId: device.userId,
        deviceId,
        operationType: 'TOKEN_REFRESH',
        entityType: 'token',
        entityId: createId(),
        payload: { reason: 'scheduled_rotation' },
        idempotencyKey: `rotate:${deviceId}:${Date.now()}`,
        status: 'COMPLETED',
        maxAttempts: 1,
      });
      return true;
    }

    return false;
  }

  getConfig(): Readonly<SecurityConfig> {
    return { ...this.config };
  }

  async validateSession(deviceId: string, sessionId: string): Promise<boolean> {
    const session = await this.drizzle.client.query.syncOperations.findFirst({
      where: and(
        eq(syncOperations.deviceId, deviceId),
        eq(syncOperations.entityId, sessionId),
        eq(syncOperations.operationType, 'SESSION_CREATE'),
      ),
    });

    if (!session) return false;

    const sessionAge = Date.now() - session.createdAt.getTime();
    return sessionAge < this.config.sessionTimeoutMs;
  }

  async revokeAllSessions(deviceId: string): Promise<number> {
    const result = await this.drizzle.client
      .update(syncOperations)
      .set({ status: 'REVOKED', updatedAt: new Date() })
      .where(and(
        eq(syncOperations.deviceId, deviceId),
        eq(syncOperations.operationType, 'SESSION_CREATE'),
        eq(syncOperations.status, 'COMPLETED'),
      ))
      .returning({ id: syncOperations.id });

    return result.length;
  }

  async checkRateLimit(
    identifier: string,
    operation: string,
    maxRequests: number,
    windowMs: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const windowStart = new Date(Date.now() - windowMs);
    const requests = await this.drizzle.client.query.syncOperations.findMany({
      where: and(
        eq(syncOperations.operationType, operation),
        eq(syncOperations.entityType, 'rate_limit'),
        eq(syncOperations.payload, { identifier }),
        gte(syncOperations.createdAt, windowStart),
      ),
    });

    const used = requests.length;
    const remaining = Math.max(0, maxRequests - used);
    const resetAt = new Date(Date.now() + windowMs);

    if (used >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    await this.drizzle.client.insert(syncOperations).values({
      userId: 'rate_limit',
      deviceId: 'rate_limit',
      operationType: operation,
      entityType: 'rate_limit',
      entityId: identifier,
      payload: { identifier },
      idempotencyKey: `ratelimit:${operation}:${identifier}:${Date.now()}`,
      status: 'COMPLETED',
      maxAttempts: 1,
    });

    return { allowed: true, remaining, resetAt };
  }
}