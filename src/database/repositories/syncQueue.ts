// src/database/repositories/syncQueue.ts
// Sync queue repository

import { getDatabase } from '../connection';
import { SyncOperation, SyncOperationType, SyncQueueStatus, SyncEntityType } from '../../types';

export class SyncQueueRepository {
  private static instance: SyncQueueRepository;

  static getInstance(): SyncQueueRepository {
    if (!SyncQueueRepository.instance) {
      SyncQueueRepository.instance = new SyncQueueRepository();
    }
    return SyncQueueRepository.instance;
  }

  async enqueue(
    userId: string,
    operation: SyncOperationType,
    entityType: SyncEntityType,
    entityId: string,
    payload: Record<string, unknown> = {},
    options: {
      priority?: number;
      maxAttempts?: number;
      backoffBaseMs?: number;
      backoffMaxMs?: number;
      idempotencyKey?: string;
    } = {}
  ): Promise<SyncOperation> {
    const db = await getDatabase();
    const id = generateId();
    const now = Date.now();

    const operationRecord: SyncOperation = {
      id,
      userId,
      operation,
      entityType,
      entityId,
      payload: JSON.stringify(payload),
      status: 'PENDING',
      priority: options.priority || 0,
      attemptCount: 0,
      maxAttempts: options.maxAttempts || 10,
      lastAttemptAt: null,
      nextAttemptAt: now,
      backoffBaseMs: options.backoffBaseMs || 1000,
      backoffMaxMs: options.backoffMaxMs || 300000,
      lastError: null,
      errorCode: null,
      createdAt: now,
      completedAt: null,
      idempotencyKey: options.idempotencyKey || null,
    };

    await db.runAsync(
      `INSERT INTO sync_queue (
        id, user_id, operation, entity_type, entity_id, payload,
        status, priority, attempt_count, max_attempts,
        last_attempt_at, next_attempt_at, backoff_base_ms, backoff_max_ms,
        last_error, error_code, created_at, completed_at, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      operationRecord.id,
      operationRecord.userId,
      operationRecord.operation,
      operationRecord.entityType,
      operationRecord.entityId,
      operationRecord.payload,
      operationRecord.status,
      operationRecord.priority,
      operationRecord.attemptCount,
      operationRecord.maxAttempts,
      operationRecord.lastAttemptAt,
      operationRecord.nextAttemptAt,
      operationRecord.backoffBaseMs,
      operationRecord.backoffMaxMs,
      operationRecord.lastError,
      operationRecord.errorCode,
      operationRecord.createdAt,
      operationRecord.completedAt,
      operationRecord.idempotencyKey
    );

    return operationRecord;
  }

  async getPending(userId: string, limit: number = 50): Promise<SyncOperation[]> {
    const db = await getDatabase();
    return db.getAllAsync<SyncOperation>(
      `SELECT * FROM sync_queue
       WHERE user_id = ? AND status IN ('PENDING', 'PROCESSING')
       AND next_attempt_at <= ?
       ORDER BY priority DESC, created_at ASC
       LIMIT ?`,
      userId,
      Date.now(),
      limit
    );
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<SyncOperation | null> {
    const db = await getDatabase();
    return db.getFirstAsync<SyncOperation>(
      `SELECT * FROM sync_queue WHERE idempotency_key = ?`,
      idempotencyKey
    );
  }

  async updateStatus(
    id: string,
    status: SyncQueueStatus,
    updates: {
      attemptCount?: number;
      lastError?: string;
      errorCode?: string;
      nextAttemptAt?: number;
    } = {}
  ): Promise<void> {
    const db = await getDatabase();

    const fields: string[] = ['status = ?'];
    const params: (string | number | null)[] = [status];

    if (updates.attemptCount !== undefined) {
      fields.push('attempt_count = ?');
      params.push(updates.attemptCount);
      fields.push('last_attempt_at = ?');
      params.push(Date.now());
    }

    if (updates.lastError !== undefined) {
      fields.push('last_error = ?');
      params.push(updates.lastError);
    }

    if (updates.errorCode !== undefined) {
      fields.push('error_code = ?');
      params.push(updates.errorCode);
    }

    if (updates.nextAttemptAt !== undefined) {
      fields.push('next_attempt_at = ?');
      params.push(updates.nextAttemptAt);
    }

    if (status === 'COMPLETED') {
      fields.push('completed_at = ?');
      params.push(Date.now());
    }

    params.push(id);

    await db.runAsync(
      `UPDATE sync_queue SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async markProcessing(id: string): Promise<void> {
    await this.updateStatus(id, 'PROCESSING', { attemptCount: 1 });
  }

  async markCompleted(id: string): Promise<void> {
    await this.updateStatus(id, 'COMPLETED');
  }

  async markFailed(
    id: string,
    error: Error,
    errorCode?: string,
    willRetry: boolean = true
  ): Promise<void> {
    const op = await this.getById(id);
    if (!op) return;

    const nextAttempt = willRetry
      ? Date.now() + Math.min(
          op.backoffBaseMs * Math.pow(2, op.attemptCount) + Math.random() * 1000,
          op.backoffMaxMs
        )
      : Date.now() + 86400000; // 24 hours if no retry

    await this.updateStatus(id, willRetry ? 'PENDING' : 'FAILED', {
      attemptCount: op.attemptCount + 1,
      lastError: error.message,
      errorCode,
      nextAttemptAt: nextAttempt,
    });
  }

  async getById(id: string): Promise<SyncOperation | null> {
    const db = await getDatabase();
    return db.getFirstAsync<SyncOperation>('SELECT * FROM sync_queue WHERE id = ?', id);
  }

  async getFailed(limit: number = 100): Promise<SyncOperation[]> {
    const db = await getDatabase();
    return db.getAllAsync<SyncOperation>(
      `SELECT * FROM sync_queue WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT ?`,
      limit
    );
  }

  async cleanupCompleted(olderThanDays: number = 7): Promise<number> {
    const db = await getDatabase();
    const cutoff = Date.now() - olderThanDays * 86400000;

    const result = await db.runAsync(
      `DELETE FROM sync_queue 
       WHERE status = 'COMPLETED' AND completed_at < ?`,
      cutoff
    );

    return result.changes;
  }

  async getQueueDepth(userId: string): Promise<{ pending: number; processing: number; failed: number }> {
    const db = await getDatabase();
    const result = await db.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM sync_queue 
       WHERE user_id = ? AND status IN ('PENDING', 'PROCESSING', 'FAILED')
       GROUP BY status`,
      userId
    );

    const depths = { pending: 0, processing: 0, failed: 0 };
    for (const row of result) {
      if (row.status === 'PENDING') depths.pending = row.count;
      else if (row.status === 'PROCESSING') depths.processing = row.count;
      else if (row.status === 'FAILED') depths.failed = row.count;
    }

    return depths;
  }
}

function generateId(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestampHex}-${randomHex}`;
}

export const syncQueueRepository = SyncQueueRepository.getInstance();