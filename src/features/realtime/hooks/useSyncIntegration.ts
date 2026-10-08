// src/features/realtime/hooks/useSyncIntegration.ts
import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { useRealtime, RealtimeEventType, RealtimeEvent } from './useRealtime';
import { syncProcessor } from '@/sync/processor';
import { messagesRepository } from '@/database/repositories/messages';
import { conversationsRepository } from '@/database/repositories/conversations';
import { contactsRepository } from '@/database/repositories/contacts';
import { settingsRepository } from '@/database/repositories/settings';
import { api } from '@/api/client';
import { Message, MessageStatus, Conversation, Contact, SyncStatus } from '@/types';

export function useSyncIntegration() {
  const { user, accessToken, device } = useAuthStore();
  const { onEvent, sendDeliveryReceipt, state } = useRealtime();
  const processingRef = useRef<Set<string>>(new Set());

  // Handle incoming messages
  useEffect(() => {
    if (state !== 'connected') return;

    const unsubscribeMessage = onEvent('MESSAGE_NEW', async (event: RealtimeEvent) => {
      const messageId = event.payload?.messageId;
      if (!messageId || processingRef.current.has(messageId)) return;
      
      processingRef.current.add(messageId);
      
      try {
        // Save message to local database
        const message: Message = {
          id: messageId,
          conversationId: event.payload?.conversationId,
          senderDeviceId: event.payload?.senderDeviceId,
          senderAccountId: event.payload?.senderAccountId,
          content: event.payload?.content,
          contentEncrypted: event.payload?.contentEncrypted,
          contentType: event.payload?.contentType,
          encryptionAlgorithm: event.payload?.encryptionAlgorithm,
          nonce: event.payload?.nonce,
          senderKeyId: event.payload?.senderKeyId,
          status: 'RELAYED' as MessageStatus,
          createdAt: event.payload?.createdAt || Date.now(),
          sentAt: event.payload?.sentAt,
          deliveredAt: Date.now(),
          readAt: null,
          editedAt: null,
          editedBy: null,
          deletedAt: null,
          syncStatus: 'SYNCED',
          serverMessageId: event.payload?.serverMessageId,
          lastSyncAttemptAt: Date.now(),
          syncAttemptCount: 0,
        };

        await messagesRepository.create(message);
        
        // Update conversation last message
        await conversationsRepository.updateLastMessage(
          event.payload?.conversationId,
          messageId,
          event.payload?.senderDeviceId,
          message.createdAt
        );

        // Send delivery receipt
        if (user) {
          sendDeliveryReceipt({
            messageId,
            conversationId: event.payload?.conversationId,
            recipientId: user.accountId,
            status: 'DELIVERED',
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('[SyncIntegration] Failed to process incoming message:', error);
      } finally {
        processingRef.current.delete(messageId);
      }
    });

    return () => unsubscribeMessage();
  }, [onEvent, sendDeliveryReceipt, user, state]);

  // Handle message delivery receipts
  useEffect(() => {
    if (state !== 'connected') return;

    const unsubscribeDelivered = onEvent('MESSAGE_DELIVERED', async (event: RealtimeEvent) => {
      const { messageId, conversationId, recipientId, timestamp } = event.payload || {};
      if (!messageId) return;

      try {
        await messagesRepository.updateStatus(messageId, 'DELIVERED');
        await messagesRepository.updateSyncStatus(messageId, 'COMPLETED');
      } catch (error) {
        console.error('[SyncIntegration] Failed to update delivery receipt:', error);
      }
    });

    const unsubscribeRead = onEvent('MESSAGE_READ', async (event: RealtimeEvent) => {
      const { messageId, conversationId, recipientId, timestamp } = event.payload || {};
      if (!messageId) return;

      try {
        await messagesRepository.updateStatus(messageId, 'READ');
        await messagesRepository.updateSyncStatus(messageId, 'COMPLETED');
      } catch (error) {
        console.error('[SyncIntegration] Failed to update read receipt:', error);
      }
    });

    return () => {
      unsubscribeDelivered();
      unsubscribeRead();
    };
  }, [onEvent, state]);

  // Handle conversation updates
  useEffect(() => {
    if (state !== 'connected') return;

    const unsubscribeConvCreated = onEvent('CONVERSATION_CREATED', async (event: RealtimeEvent) => {
      try {
        const conversationData: Omit<Conversation, 'createdAt' | 'updatedAt'> = {
          id: event.payload?.conversationId,
          userId: user!.id,
          type: event.payload?.type,
          title: event.payload?.title ?? null,
          avatarUrl: event.payload?.avatarUrl ?? null,
          createdBy: event.payload?.createdBy,
          adminDeviceIds: event.payload?.adminDeviceIds || [],
          isArchived: false,
          isPinned: false,
          muteUntil: null,
          unreadCount: 0,
          lastMessageId: null,
          lastMessageAt: null,
          lastMessageSenderId: null,
          syncStatus: 'SYNCED',
          lastSyncedAt: Date.now(),
          serverVersion: 1,
          deletedAt: null,
        };
        await conversationsRepository.create(conversationData);
      } catch (error) {
        console.error('[SyncIntegration] Failed to create conversation:', error);
      }
    });

    const unsubscribeConvUpdated = onEvent('CONVERSATION_UPDATED', async (event: RealtimeEvent) => {
      try {
        await conversationsRepository.update(event.payload?.conversationId, event.payload?.updates);
      } catch (error) {
        console.error('[SyncIntegration] Failed to update conversation:', error);
      }
    });

    const unsubscribeConvDeleted = onEvent('CONVERSATION_DELETED', async (event: RealtimeEvent) => {
      try {
        await conversationsRepository.update(event.payload?.conversationId, { deletedAt: Date.now() });
      } catch (error) {
        console.error('[SyncIntegration] Failed to delete conversation:', error);
      }
    });

    return () => {
      unsubscribeConvCreated();
      unsubscribeConvUpdated();
      unsubscribeConvDeleted();
    };
  }, [onEvent, user, state]);

  // Handle contact events
  useEffect(() => {
    if (state !== 'connected') return;

    const unsubscribeContactRequest = onEvent('CONTACT_REQUEST', async (event: RealtimeEvent) => {
      // Could show a notification for contact request
      console.log('[SyncIntegration] Contact request received:', event.payload);
    });

    const unsubscribeContactAccepted = onEvent('CONTACT_ACCEPTED', async (event: RealtimeEvent) => {
      try {
        // Add contact to local database
        await contactsRepository.create({
          userId: user!.id,
          contactAccountId: event.payload?.contactAccountId,
          contactDeviceId: event.payload?.contactDeviceId ?? null,
          displayName: event.payload?.displayName ?? null,
          avatarUrl: event.payload?.avatarUrl ?? null,
          identityKeyPublic: event.payload?.identityKeyPublic ?? '',
          signedPrekeyPublic: event.payload?.signedPrekeyPublic ?? null,
          signedPrekeySignature: event.payload?.signedPrekeySignature ?? null,
          verificationStatus: 'UNVERIFIED' as const,
          verifiedAt: null,
          safetyNumber: null,
          syncStatus: 'SYNCED',
          lastSyncedAt: Date.now(),
          serverVersion: 1,
          deletedAt: null,
        });
      } catch (error) {
        console.error('[SyncIntegration] Failed to add accepted contact:', error);
      }
    });

    const unsubscribeContactVerified = onEvent('CONTACT_VERIFIED', async (event: RealtimeEvent) => {
      try {
        await contactsRepository.update(event.payload?.contactId, {
          verificationStatus: 'VERIFIED',
          verifiedAt: event.payload?.verifiedAt,
          safetyNumber: event.payload?.safetyNumber,
        });
      } catch (error) {
        console.error('[SyncIntegration] Failed to update verified contact:', error);
      }
    });

    const unsubscribeContactBlocked = onEvent('CONTACT_BLOCKED', async (event: RealtimeEvent) => {
      try {
        await contactsRepository.update(event.payload?.contactId, {
          verificationStatus: 'BLOCKED',
        });
      } catch (error) {
        console.error('[SyncIntegration] Failed to block contact:', error);
      }
    });

    return () => {
      unsubscribeContactRequest();
      unsubscribeContactAccepted();
      unsubscribeContactVerified();
      unsubscribeContactBlocked();
    };
  }, [onEvent, user, state]);

  // Request sync when coming online
  useEffect(() => {
    if (state === 'connected' && user && accessToken) {
      // Request incremental sync
      const getLastSyncTime = async (userId: string): Promise<number | null> => {
        try {
          // This would typically come from a settings table
          return Date.now() - 24 * 60 * 60 * 1000; // Default to 24 hours ago
        } catch {
          return null;
        }
      };
      
      (async () => {
        const since = await getLastSyncTime(user.id);
        if (since) {
          // Trigger sync processor - would call syncProcessor.process() if available
          try {
            // syncProcessor.process(); // Uncomment when implemented
            console.log('[SyncIntegration] Would trigger incremental sync since', since);
          } catch (error) {
            console.error('[SyncIntegration] Failed to request sync:', error);
          }
        }
      })();
    }
  }, [state, user, accessToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      processingRef.current.clear();
    };
  }, []);
}

// Helper to process pending outgoing messages when connection is restored
export function useOutgoingMessageProcessor() {
  const { user, accessToken, device } = useAuthStore();
  const { state } = useRealtime();
  const processingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (state !== 'connected' || !user) return;

    const processOutgoingMessages = async () => {
      try {
        const pendingMessages = await messagesRepository.getPendingSync(100);
        
        for (const message of pendingMessages) {
          if (processingRef.current.has(message.id)) continue;
          
          processingRef.current.add(message.id);
          
          try {
            // Send message via API
            const result = await api.sendMessage({
              conversationId: message.conversationId,
              content: message.content,
              contentEncrypted: message.contentEncrypted,
              contentType: message.contentType,
              encryptionAlgorithm: message.encryptionAlgorithm,
              nonce: message.nonce,
              senderKeyId: message.senderKeyId,
            });

            // Update message with server ID
            await messagesRepository.markSynced(message.id, result.serverMessageId);
          } catch (error) {
            console.error('[OutgoingProcessor] Failed to send message:', message.id, error);
            await messagesRepository.updateStatus(message.id, 'FAILED');
            await messagesRepository.updateSyncStatus(message.id, 'FAILED', message.syncAttemptCount + 1);
          } finally {
            processingRef.current.delete(message.id);
          }
        }
      } catch (error) {
        console.error('[OutgoingProcessor] Failed to process pending messages:', error);
      }
    };

    // Process immediately on connect
    processOutgoingMessages();

    // Then process periodically
    const interval = setInterval(processOutgoingMessages, 10000);
    
    return () => clearInterval(interval);
  }, [state, user, accessToken]);
}