// src/features/chat/utils/disappearingMessagesTask.ts
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { checkAndDeleteExpiredMessages } from './disappearingMessages';

const DISAPPEARING_MESSAGES_TASK = 'disappearing-messages-cleanup';

TaskManager.defineTask(DISAPPEARING_MESSAGES_TASK, async () => {
  try {
    console.log('[DisappearingMessages] Running background cleanup task');
    const deletedCount = await checkAndDeleteExpiredMessages();
    console.log(`[DisappearingMessages] Deleted ${deletedCount} expired messages`);
    return 'new-data';
  } catch (error) {
    console.error('[DisappearingMessages] Background task failed:', error);
    return 'failed';
  }
});

export async function registerDisappearingMessagesTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(DISAPPEARING_MESSAGES_TASK);
  
  if (!isRegistered) {
    await BackgroundFetch.registerTaskAsync(DISAPPEARING_MESSAGES_TASK, {
      minimumInterval: 60 * 60, // 1 hour
      stopOnTerminate: false,
      startOnBoot: true,
    });
    console.log('[DisappearingMessages] Background task registered');
  }
}

export async function unregisterDisappearingMessagesTask(): Promise<void> {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(DISAPPEARING_MESSAGES_TASK);
  
  if (isRegistered) {
    await BackgroundFetch.unregisterTaskAsync(DISAPPEARING_MESSAGES_TASK);
    console.log('[DisappearingMessages] Background task unregistered');
  }
}