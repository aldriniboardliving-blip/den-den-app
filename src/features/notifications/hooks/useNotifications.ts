// src/features/notifications/hooks/useNotifications.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '@/features/auth/store';
import { api } from '@/api/client';
import { settingsRepository } from '@/database/repositories/settings';
import { 
  NotificationSettings, 
  NotificationPayload, 
  NotificationPermissionStatus,
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_CHANNELS 
} from '../types';

const SETTINGS_KEY = 'notification_settings';
const PUSH_TOKEN_KEY = 'push_token';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useNotificationPermissions() {
  const [permission, setPermission] = useState<NotificationPermissionStatus>({
    granted: false,
    canAskAgain: true,
    status: 'undetermined',
  });
  const [loading, setLoading] = useState(true);

  const checkPermissions = useCallback(async () => {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    setPermission({
      granted: status === 'granted',
      canAskAgain,
      status: status as 'granted' | 'denied' | 'undetermined',
    });
    setLoading(false);
  }, []);

  const requestPermissions = useCallback(async () => {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return { status: 'denied' as const };
    }

    const { status, canAskAgain } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
      android: {
        channelId: 'messages',
      },
    });

    setPermission({
      granted: status === 'granted',
      canAskAgain,
      status: status as 'granted' | 'denied' | 'undetermined',
    });

    return { status, canAskAgain };
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  return { permission, loading, checkPermissions, requestPermissions };
}

export function usePushToken() {
  const { user } = useAuthStore();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { permission } = useNotificationPermissions();

  const registerPushToken = useCallback(async () => {
    if (!user || !permission.granted) return null;

    setLoading(true);
    try {
      const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenData.data;
      
      // Store locally
      await settingsRepository.set(user.id, PUSH_TOKEN_KEY, token);
      setPushToken(token);

      // Register with backend (method needs to be implemented in api)
      try {
        await (api as any).registerPushToken?.(token, user.id);
      } catch (e) {
        // Backend method not implemented yet
        console.log('Push token registered locally:', token);
      }

      return token;
    } catch (error) {
      console.error('Failed to register push token:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, permission.granted]);

  const unregisterPushToken = useCallback(async () => {
    if (!user || !pushToken) return;

    try {
      try {
        await (api as any).unregisterPushToken?.(pushToken);
      } catch (e) {
        // Backend method not implemented yet
      }
      await settingsRepository.delete(user.id, PUSH_TOKEN_KEY);
      setPushToken(null);
    } catch (error) {
      console.error('Failed to unregister push token:', error);
    }
  }, [user, pushToken]);

  // Load stored token on mount
  useEffect(() => {
    const loadToken = async () => {
      if (!user) return;
      try {
        const stored = await settingsRepository.get(user.id, PUSH_TOKEN_KEY);
        if (stored) {
          setPushToken(stored);
        }
      } catch (error) {
        console.error('Failed to load push token:', error);
      }
    };
    loadToken();
  }, [user]);

  // Re-register when permissions change
  useEffect(() => {
    if (permission.granted && user && !pushToken) {
      registerPushToken();
    }
  }, [permission.granted, user, pushToken, registerPushToken]);

  return { pushToken, loading, registerPushToken, unregisterPushToken };
}

export function useNotificationSettings() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const stored = await settingsRepository.get(user.id, SETTINGS_KEY);
      if (stored) {
        setSettings({ ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    if (!user) return;
    const updated = { ...settings, ...newSettings };
    try {
      await settingsRepository.set(user.id, SETTINGS_KEY, JSON.stringify(updated));
      setSettings(updated);
      
      // Update notification channels on Android
      if (Platform.OS === 'android') {
        await updateNotificationChannels(updated);
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }, [user, settings]);

  return { settings, loading, updateSettings };
}

async function updateNotificationChannels(settings: NotificationSettings) {
  for (const channel of NOTIFICATION_CHANNELS) {
    const enabled = getChannelEnabled(channel.id, settings);
    await Notifications.setNotificationChannelAsync(channel.id, {
      name: channel.name,
      description: channel.description,
      importance: getImportanceValue(channel.importance),
      sound: channel.sound,
      vibrationPattern: channel.vibrationPattern,
      lightColor: channel.lightColor,
      enableVibrate: settings.vibrationEnabled && enabled,
      enableLights: false,
      showBadge: settings.badgeEnabled && enabled,
      bypassDnd: channel.importance === 'high',
    });
  }
}

function getChannelEnabled(channelId: string, settings: NotificationSettings): boolean {
  switch (channelId) {
    case 'messages': return settings.messageNotifications;
    case 'contacts': return settings.contactNotifications;
    case 'groups': return settings.groupNotifications;
    case 'backup': return settings.backupNotifications;
    case 'system': return settings.systemNotifications;
    default: return true;
  }
}

function getImportanceValue(importance: 'high' | 'default' | 'low' | 'min'): number {
  switch (importance) {
    case 'high': return Notifications.AndroidImportance.HIGH;
    case 'default': return Notifications.AndroidImportance.DEFAULT;
    case 'low': return Notifications.AndroidImportance.LOW;
    case 'min': return Notifications.AndroidImportance.MIN;
    default: return Notifications.AndroidImportance.DEFAULT;
  }
}

export function useNotificationListeners(
  onNotification?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
  const notificationListener = useRef<ReturnType<typeof Notifications.addNotificationReceivedListener> | null>(null);
  const responseListener = useRef<ReturnType<typeof Notifications.addNotificationResponseReceivedListener> | null>(null);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      onNotification?.(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      onNotificationResponse?.(response);
    });

    return () => {
      notificationListener.current?.remove?.();
      responseListener.current?.remove?.();
    };
  }, [onNotification, onNotificationResponse]);
}

export function useLocalNotifications() {
  const { settings } = useNotificationSettings();
  const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);

  const scheduleNotification = useCallback(async (
    content: Notifications.NotificationContentInput,
    trigger: Notifications.NotificationTriggerInput
  ) => {
    if (!settings.enabled) return;

    // Check quiet hours
    if (settings.quietHoursEnabled && isQuietHours(settings)) {
      // Reschedule for after quiet hours
      const nextTrigger = getNextQuietHoursEnd(settings);
      if (trigger && 'date' in trigger && trigger.date) {
        trigger = { ...trigger, date: nextTrigger };
      }
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });

    setScheduledNotifications(prev => [...prev, { identifier, content, trigger } as any]);
    return identifier;
  }, [settings]);

  const cancelNotification = useCallback(async (identifier: string) => {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    setScheduledNotifications(prev => prev.filter(n => n.identifier !== identifier));
  }, []);

  const cancelAllNotifications = useCallback(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    setScheduledNotifications([]);
  }, []);

  const sendLocalNotification = useCallback(async (payload: NotificationPayload) => {
    if (!settings.enabled) return;

    // Check if this type is enabled
    if (!isNotificationTypeEnabled(payload.type, settings)) return;

    const content: Notifications.NotificationContentInput = {
      title: payload.title,
      body: settings.showPreview ? payload.body : 'New message',
      data: payload.data,
      sound: settings.soundEnabled ? 'default' : false,
      badge: settings.badgeEnabled ? 1 : 0,
      categoryIdentifier: payload.type,
    };

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null, // Immediate
    });
  }, [settings]);

  return { scheduleNotification, cancelNotification, cancelAllNotifications, sendLocalNotification, scheduledNotifications };
}

function isNotificationTypeEnabled(type: NotificationPayload['type'], settings: NotificationSettings): boolean {
  switch (type) {
    case 'MESSAGE_RECEIVED':
    case 'MESSAGE_DELIVERED':
    case 'MESSAGE_READ':
      return settings.messageNotifications;
    case 'CONTACT_REQUEST':
    case 'CONTACT_VERIFIED':
      return settings.contactNotifications;
    case 'GROUP_INVITE':
    case 'GROUP_UPDATED':
      return settings.groupNotifications;
    case 'BACKUP_COMPLETE':
    case 'BACKUP_FAILED':
      return settings.backupNotifications;
    case 'SYSTEM':
      return settings.systemNotifications;
    default:
      return true;
  }
}

function isQuietHours(settings: NotificationSettings): boolean {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const startParts = settings.quietHoursStart.split(':').map(Number);
  const endParts = settings.quietHoursEnd.split(':').map(Number);
  
  const startHour = startParts[0] ?? 22;
  const startMin = startParts[1] ?? 0;
  const endHour = endParts[0] ?? 8;
  const endMin = endParts[1] ?? 0;
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Overnight quiet hours (e.g., 22:00 - 08:00)
    return currentTime >= startTime || currentTime < endTime;
  }
}

function getNextQuietHoursEnd(settings: NotificationSettings): Date {
  const now = new Date();
  const endParts = settings.quietHoursEnd.split(':').map(Number);
  const endHour = endParts[0] ?? 8;
  const endMin = endParts[1] ?? 0;
  
  const endTime = new Date(now);
  endTime.setHours(endHour, endMin, 0, 0);
  
  if (endTime <= now) {
    endTime.setDate(endTime.getDate() + 1);
  }
  
  return endTime;
}

export function useBackgroundSync() {
  const { user } = useAuthStore();
  const { pushToken } = usePushToken();
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startBackgroundSync = useCallback(() => {
    if (syncIntervalRef.current) return;
    
    syncIntervalRef.current = setInterval(async () => {
      if (!user) return;
      
      try {
        // Process pending sync queue (method needs to be implemented in api)
        await (api as any).processSyncQueue?.();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, 30000); // Every 30 seconds
  }, [user]);

  const stopBackgroundSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (user && pushToken) {
      startBackgroundSync();
    } else {
      stopBackgroundSync();
    }

    return () => stopBackgroundSync();
  }, [user, pushToken, startBackgroundSync, stopBackgroundSync]);

  return { startBackgroundSync, stopBackgroundSync };
}