// src/features/notifications/types.ts

export type NotificationType = 
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_DELIVERED'
  | 'MESSAGE_READ'
  | 'CONTACT_REQUEST'
  | 'CONTACT_VERIFIED'
  | 'GROUP_INVITE'
  | 'GROUP_UPDATED'
  | 'BACKUP_COMPLETE'
  | 'BACKUP_FAILED'
  | 'SYSTEM';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  conversationId?: string;
  contactId?: string;
  messageId?: string;
  groupId?: string;
}

export interface PushToken {
  token: string;
  type: 'expo' | 'fcm' | 'apns';
  deviceId: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationSettings {
  enabled: boolean;
  showPreview: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
  messageNotifications: boolean;
  contactNotifications: boolean;
  groupNotifications: boolean;
  backupNotifications: boolean;
  systemNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string;   // HH:mm
}

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance: 'high' | 'default' | 'low' | 'min';
  sound?: string;
  vibrationPattern?: number[];
  lightColor?: string;
}

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'undetermined';
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: true,
  showPreview: true,
  soundEnabled: true,
  vibrationEnabled: true,
  badgeEnabled: true,
  messageNotifications: true,
  contactNotifications: true,
  groupNotifications: true,
  backupNotifications: true,
  systemNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
};

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    id: 'messages',
    name: 'Messages',
    description: 'New messages and delivery receipts',
    importance: 'high',
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: 'contacts',
    name: 'Contacts',
    description: 'Contact requests and verifications',
    importance: 'default',
    sound: 'default',
    vibrationPattern: [0, 250, 250],
  },
  {
    id: 'groups',
    name: 'Groups',
    description: 'Group invites and updates',
    importance: 'default',
    sound: 'default',
    vibrationPattern: [0, 250, 250],
  },
  {
    id: 'backup',
    name: 'Backups',
    description: 'Backup completion and failures',
    importance: 'low',
    sound: 'default',
  },
  {
    id: 'system',
    name: 'System',
    description: 'App updates and important notices',
    importance: 'default',
    sound: 'default',
  },
];