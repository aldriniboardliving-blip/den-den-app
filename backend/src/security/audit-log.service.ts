import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { syncOperations } from '../common/database/schema';
import { eq, and, desc, gte, lt } from 'drizzle-orm';
import { createId } from '../common/utils/id';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string | null;
  deviceId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata: Record<string, any>;
  correlationId?: string;
}

export interface AuditQuery {
  userId?: string;
  deviceId?: string;
  action?: string;
  resource?: string;
  outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStats {
  totalEvents: number;
  byOutcome: Record<string, number>;
  bySeverity: Record<string, number>;
  byAction: Record<string, number>;
  uniqueUsers: number;
  uniqueDevices: number;
  timeRange: { start: Date; end: Date };
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly retentionDays = 365;

  constructor(
    private config: ConfigService,
    private drizzle: DrizzleService,
  ) {}

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const auditEntry: AuditLogEntry = {
      ...entry,
      id: createId(),
      timestamp: new Date(),
    };

    await this.drizzle.client.insert(syncOperations).values({
      userId: entry.userId || 'system',
      deviceId: entry.deviceId || 'unknown',
      operationType: 'AUDIT_LOG',
      entityType: 'audit',
      entityId: auditEntry.id,
      payload: auditEntry,
      idempotencyKey: `audit:${auditEntry.id}`,
      status: 'COMPLETED',
      maxAttempts: 1,
    });

    if (entry.severity === 'HIGH' || entry.severity === 'CRITICAL') {
      this.logger.warn(`Audit: ${entry.action} on ${entry.resource} - ${entry.outcome}`, entry.metadata);
    }

    return auditEntry;
  }

  async logAuth(
    userId: string | null,
    deviceId: string | null,
    action: 'LOGIN' | 'LOGOUT' | 'TOKEN_REFRESH' | 'TOKEN_REVOKE' | 'DEVICE_LINK' | 'DEVICE_UNLINK',
    outcome: 'SUCCESS' | 'FAILURE',
    metadata: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      deviceId,
      action: `AUTH_${action}`,
      resource: 'authentication',
      resourceId: userId || deviceId || null,
      outcome,
      severity: outcome === 'FAILURE' ? 'HIGH' : 'LOW',
      ipAddress,
      userAgent,
      metadata,
    });
  }

  async logMessage(
    userId: string,
    deviceId: string,
    action: 'SEND' | 'RECEIVE' | 'READ' | 'DELETE' | 'EDIT',
    conversationId: string,
    messageId: string,
    outcome: 'SUCCESS' | 'FAILURE',
    metadata: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      deviceId,
      action: `MESSAGE_${action}`,
      resource: 'message',
      resourceId: messageId,
      outcome,
      severity: 'LOW',
      metadata: { conversationId, ...metadata },
    });
  }

  async logKeyOperation(
    userId: string,
    deviceId: string,
    action: 'GENERATE' | 'ROTATE' | 'REVOKE' | 'BACKUP' | 'RESTORE',
    keyType: 'IDENTITY' | 'SIGNED_PREKEY' | 'ONETIME_PREKEY' | 'SENDER_KEY',
    keyId: string,
    outcome: 'SUCCESS' | 'FAILURE',
    metadata: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      deviceId,
      action: `KEY_${action}`,
      resource: 'encryption_key',
      resourceId: keyId,
      outcome,
      severity: action === 'REVOKE' || outcome === 'FAILURE' ? 'HIGH' : 'MEDIUM',
      metadata: { keyType, ...metadata },
    });
  }

  async logDeviceOperation(
    userId: string,
    deviceId: string,
    action: 'REGISTER' | 'REVOKE' | 'LINK' | 'UNLINK' | 'RENAME',
    targetDeviceId: string,
    outcome: 'SUCCESS' | 'FAILURE',
    metadata: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      deviceId,
      action: `DEVICE_${action}`,
      resource: 'device',
      resourceId: targetDeviceId,
      outcome,
      severity: action === 'REVOKE' || outcome === 'FAILURE' ? 'HIGH' : 'MEDIUM',
      metadata,
    });
  }

  async logBackupOperation(
    userId: string,
    deviceId: string,
    action: 'CREATE' | 'RESTORE' | 'VERIFY' | 'EXPORT' | 'DELETE',
    backupId: string,
    outcome: 'SUCCESS' | 'FAILURE',
    metadata: Record<string, any>,
  ): Promise<void> {
    await this.log({
      userId,
      deviceId,
      action: `BACKUP_${action}`,
      resource: 'backup',
      resourceId: backupId,
      outcome,
      severity: action === 'RESTORE' || outcome === 'FAILURE' ? 'HIGH' : 'MEDIUM',
      metadata,
    });
  }

  async logSecurityEvent(
    userId: string | null,
    deviceId: string | null,
    eventType: string,
    description: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    metadata: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log({
      userId,
      deviceId,
      action: `SECURITY_${eventType}`,
      resource: 'security',
      resourceId: null,
      outcome: severity === 'CRITICAL' || severity === 'HIGH' ? 'FAILURE' : 'SUCCESS',
      severity,
      ipAddress,
      userAgent,
      metadata: { description, ...metadata },
    });
  }

  async query(query: AuditQuery): Promise<AuditLogEntry[]> {
    const conditions = [];

    if (query.userId) conditions.push(eq(syncOperations.userId, query.userId));
    if (query.deviceId) conditions.push(eq(syncOperations.deviceId, query.deviceId));
    if (query.startDate) conditions.push(gte(syncOperations.createdAt, query.startDate));
    if (query.endDate) conditions.push(lt(syncOperations.createdAt, query.endDate));

    const results = await this.drizzle.client.query.syncOperations.findMany({
      where: and(
        eq(syncOperations.operationType, 'AUDIT_LOG'),
        ...conditions,
      ),
      orderBy: desc(syncOperations.createdAt),
      limit: query.limit || 100,
      offset: query.offset || 0,
    });

    return results.map(r => r.payload as AuditLogEntry).filter(Boolean);
  }

  async getStats(userId?: string, deviceId?: string, days = 30): Promise<AuditStats> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    const conditions = [
      eq(syncOperations.operationType, 'AUDIT_LOG'),
      gte(syncOperations.createdAt, startDate),
      lt(syncOperations.createdAt, endDate),
    ];

    if (userId) conditions.push(eq(syncOperations.userId, userId));
    if (deviceId) conditions.push(eq(syncOperations.deviceId, deviceId));

    const results = await this.drizzle.client.query.syncOperations.findMany({
      where: and(...conditions),
    });

    const entries = results.map(r => r.payload as AuditLogEntry).filter(Boolean);

    const byOutcome: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const uniqueUsers = new Set<string>();
    const uniqueDevices = new Set<string>();

    for (const entry of entries) {
      byOutcome[entry.outcome] = (byOutcome[entry.outcome] || 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;
      if (entry.userId) uniqueUsers.add(entry.userId);
      if (entry.deviceId) uniqueDevices.add(entry.deviceId);
    }

    return {
      totalEvents: entries.length,
      byOutcome,
      bySeverity,
      byAction,
      uniqueUsers: uniqueUsers.size,
      uniqueDevices: uniqueDevices.size,
      timeRange: { start: startDate, end: endDate },
    };
  }

  async exportLogs(query: AuditQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    const entries = await this.query(query);

    if (format === 'csv') {
      const headers = [
        'id', 'timestamp', 'userId', 'deviceId', 'action', 'resource',
        'resourceId', 'outcome', 'severity', 'ipAddress', 'userAgent',
        'requestId', 'correlationId', 'metadata'
      ];

      const rows = entries.map(e => [
        e.id, e.timestamp.toISOString(), e.userId || '', e.deviceId || '',
        e.action, e.resource, e.resourceId || '', e.outcome, e.severity,
        e.ipAddress || '', e.userAgent || '', e.requestId || '',
        e.correlationId || '', JSON.stringify(e.metadata)
      ]);

      return [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    }

    return JSON.stringify(entries, null, 2);
  }

  async cleanupOldLogs(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.drizzle.client
      .delete(syncOperations)
      .where(and(
        eq(syncOperations.operationType, 'AUDIT_LOG'),
        lt(syncOperations.createdAt, cutoff),
      ))
      .returning({ id: syncOperations.id });

    this.logger.log(`Cleaned up ${result.length} old audit log entries`);
    return result.length;
  }

  async getRecentFailures(hours = 24, limit = 50): Promise<AuditLogEntry[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const results = await this.drizzle.client.query.syncOperations.findMany({
      where: and(
        eq(syncOperations.operationType, 'AUDIT_LOG'),
        eq(syncOperations.status, 'FAILURE'),
        gte(syncOperations.createdAt, startDate),
      ),
      orderBy: desc(syncOperations.createdAt),
      limit,
    });

    return results.map(r => r.payload as AuditLogEntry).filter(Boolean);
  }
}