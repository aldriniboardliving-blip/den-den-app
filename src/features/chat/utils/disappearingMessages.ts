// src/features/chat/utils/disappearingMessages.ts
import { messagesRepository } from '@/database/repositories/messages';
import { conversationsRepository } from '@/database/repositories/conversations';
import { getDatabase } from '@/database/connection';
import { DisappearingTimerDuration } from '@/types';

export async function checkAndDeleteExpiredMessages(): Promise<number> {
  const now = Date.now();
  let deletedCount = 0;

  // Get all conversations with disappearing messages enabled across all users
  const conversationsWithTimer = await conversationsRepository.getAllWithDisappearingTimerGlobal();

  for (const conv of conversationsWithTimer) {
    if (conv.disappearingMessagesTimer === 0) continue;
    
    const startAt = conv.disappearingMessagesStartAt || conv.createdAt;
    const expirationTime = startAt + conv.disappearingMessagesTimer;
    
    if (now >= expirationTime) {
      // Delete messages older than the expiration time
      const deleted = await deleteExpiredMessagesInConversation(
        conv.id,
        expirationTime
      );
      deletedCount += deleted;
    }
  }

  return deletedCount;
}

async function deleteExpiredMessagesInConversation(
  conversationId: string,
  expirationTime: number
): Promise<number> {
  const db = await getDatabase();
  
  const result = await db.runAsync(
    `UPDATE messages 
     SET deleted_at = ?, sync_status = 'PENDING' 
     WHERE conversation_id = ? 
     AND created_at < ? 
     AND deleted_at IS NULL`,
    Date.now(),
    conversationId,
    expirationTime
  );

  return (db as any).changes || 0;
}

// Function to be called when a new message is sent in a disappearing messages conversation
export async function setDisappearingStartTimeIfNeeded(
  conversationId: string,
  timerDuration: number
): Promise<void> {
  if (timerDuration === 0) return;

  const db = await getDatabase();
  const conversation = await db.getFirstAsync<{
    disappearingMessagesStartAt: number | null;
  }>(
    `SELECT disappearing_messages_start_at FROM conversations WHERE id = ?`,
    conversationId
  );

  if (!conversation?.disappearingMessagesStartAt) {
    await db.runAsync(
      `UPDATE conversations SET disappearing_messages_start_at = ? WHERE id = ?`,
      Date.now(),
      conversationId
    );
  }
}

// Function to calculate if a message should be deleted
export function isMessageExpired(
  messageCreatedAt: number,
  conversationTimer: DisappearingTimerDuration,
  conversationStartAt: number | null,
  conversationCreatedAt: number
): boolean {
  if (conversationTimer === 0) return false;
  
  const startAt = conversationStartAt || conversationCreatedAt;
  const expirationTime = startAt + conversationTimer;
  
  return Date.now() >= expirationTime && messageCreatedAt < expirationTime;
}