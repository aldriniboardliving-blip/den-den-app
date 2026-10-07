// src/features/realtime/types.ts

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export type RealtimeEventType = 
  | 'MESSAGE_NEW'
  | 'MESSAGE_DELIVERED'
  | 'MESSAGE_READ'
  | 'MESSAGE_DELETED'
  | 'CONVERSATION_CREATED'
  | 'CONVERSATION_UPDATED'
  | 'CONVERSATION_DELETED'
  | 'CONTACT_REQUEST'
  | 'CONTACT_ACCEPTED'
  | 'CONTACT_VERIFIED'
  | 'CONTACT_BLOCKED'
  | 'GROUP_INVITE'
  | 'GROUP_UPDATE'
  | 'GROUP_MEMBER_ADDED'
  | 'GROUP_MEMBER_REMOVED'
  | 'TYPING_START'
  | 'TYPING_STOP'
  | 'PRESENCE_ONLINE'
  | 'PRESENCE_OFFLINE'
  | 'KEY_ROTATION'
  | 'SYNC_REQUEST'
  | 'HEARTBEAT'
  | 'RECONNECT_NEEDED'
  | 'ERROR';

export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  payload: T;
  timestamp: number;
  messageId?: string;
}

export interface WebSocketMessage {
  type: RealtimeEventType;
  payload: any;
  requestId?: string;
  conversationId?: string;
}

export interface ConnectionConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectInterval: number;
  reconnectAttempts: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

export interface TypingIndicatorData {
  userId: string;
  conversationId: string;
  isTyping: boolean;
}

export interface PresenceUpdate {
  userId: string;
  isOnline: boolean;
  lastSeen?: number;
}

export interface MessageDeliveryReceipt {
  messageId: string;
  conversationId: string;
  recipientId: string;
  status: 'DELIVERED' | 'READ';
  timestamp: number;
}

export interface SyncRequest {
  type: 'FULL' | 'INCREMENTAL';
  since?: number;
  conversationIds?: string[];
}

export interface ServerConfig {
  wsUrl: string;
  apiUrl: string;
  reconnect: {
    initialDelay: number;
    maxDelay: number;
    maxAttempts: number;
    factor: number;
  };
  heartbeat: number;
  timeout: number;
}

export const DEFAULT_WS_CONFIG: ConnectionConfig = {
  url: '',
  reconnectInterval: 1000,
  maxReconnectInterval: 30000,
  reconnectAttempts: 10,
  heartbeatInterval: 30000,
  connectionTimeout: 10000,
};

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  wsUrl: '',
  apiUrl: '',
  reconnect: {
    initialDelay: 1000,
    maxDelay: 30000,
    maxAttempts: 10,
    factor: 2,
  },
  heartbeat: 30000,
  timeout: 10000,
};