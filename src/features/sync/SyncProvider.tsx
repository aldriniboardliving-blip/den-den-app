// src/features/sync/SyncProvider.tsx
import React, { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { syncProcessor } from '@/sync/processor';
import { useSyncIntegration } from '@/features/realtime/hooks/useSyncIntegration';
import { useOutgoingMessageProcessor } from '@/features/realtime/hooks/useSyncIntegration';
import { useRealtime } from '@/features/realtime/hooks/useRealtime';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accessToken, device } = useAuthStore();

  // Initialize sync integration when authenticated
  useSyncIntegration();

  // Process outgoing messages when connected
  useOutgoingMessageProcessor();

  // Start/stop sync processor based on auth state
  useEffect(() => {
    if (isAuthenticated && accessToken && device) {
      // Start the sync processor to process the queue
      syncProcessor.start();
      console.log('[SyncProvider] Sync processor started');
    } else {
      syncProcessor.stop();
      console.log('[SyncProvider] Sync processor stopped');
    }
  }, [isAuthenticated, accessToken, device]);

  return <>{children}</>;
}

// Re-export the hooks for convenience
export { useSyncIntegration, useOutgoingMessageProcessor } from '@/features/realtime/hooks/useSyncIntegration';