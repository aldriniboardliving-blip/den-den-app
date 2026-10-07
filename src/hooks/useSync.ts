// src/hooks/useSync.ts
// Sync hook

import { useCallback } from 'react';
import { syncProcessor } from '../sync/processor';
import { networkMonitor } from '../sync/network';
import { syncQueueRepository } from '../database/repositories/syncQueue';
import type { SyncOperationType, SyncEntityType } from '../types';

export function useSync() {
  const enqueue = useCallback(
    async (
      operation: SyncOperationType,
      entityType: SyncEntityType,
      entityId: string,
      payload: Record<string, unknown> = {},
      options: {
        priority?: number;
        maxAttempts?: number;
        idempotencyKey?: string;
      } = {}
    ) => {
      return syncQueueRepository.enqueue(
        'current-user-id', // In real app, get from auth store
        operation,
        entityType,
        entityId,
        payload,
        options
      );
    },
    []
  );

  const processNow = useCallback(async () => {
    await syncProcessor.processQueue();
  }, []);

  const getQueueDepth = useCallback(async () => {
    return syncQueueRepository.getQueueDepth('current-user-id');
  }, []);

  const isOnline = networkMonitor.isOnline();

  return {
    enqueue,
    processNow,
    getQueueDepth,
    isOnline,
  };
}
