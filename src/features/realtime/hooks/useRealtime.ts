// src/features/realtime/hooks/useRealtime.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { api } from '@/api/client';
import { 
  ConnectionState, 
  RealtimeEvent, 
  RealtimeEventType, 
  WebSocketMessage,
  TypingIndicatorData,
  PresenceUpdate,
  MessageDeliveryReceipt,
  SyncRequest,
  DEFAULT_WS_CONFIG,
  ConnectionConfig 
} from '../types';

// Re-export types for components
export type { RealtimeEvent, RealtimeEventType } from '../types';

// Event listeners
type EventListener = (event: RealtimeEvent) => void;
type StateListener = (state: ConnectionState) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private config: ConnectionConfig;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private eventListeners = new Map<RealtimeEventType, Set<EventListener>>();
  private stateListeners = new Set<StateListener>();
  private pendingRequests = new Map<string, (response: any) => void>();
  private requestId = 0;

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = { ...DEFAULT_WS_CONFIG, ...config };
  }

  setConfig(config: Partial<ConnectionConfig>) {
    this.config = { ...this.config, ...config };
  }

  connect(token: string, deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setState('connecting');
      
      try {
        const wsUrl = `${this.config.url}?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(deviceId)}`;
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('[Realtime] Connected');
          this.reconnectAttempts = 0;
          this.setState('connected');
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('[Realtime] Disconnected:', event.code, event.reason);
          this.stopHeartbeat();
          
          if (this.state !== 'disconnected') {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Realtime] Error:', error);
          if (this.state === 'connecting') {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('[Realtime] Failed to parse message:', error);
          }
        };

        // Connection timeout
        setTimeout(() => {
          if (this.state === 'connecting') {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, this.config.connectionTimeout);

      } catch (error) {
        this.setState('failed');
        reject(error);
      }
    });
  }

  disconnect() {
    this.setState('disconnected');
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Reject pending requests
    this.pendingRequests.forEach((_, requestId) => {
      this.rejectPendingRequest(requestId, new Error('Disconnected'));
    });
    this.pendingRequests.clear();
  }

  send(message: WebSocketMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      return false;
    }
  }

  request<T>(type: RealtimeEventType, payload: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = `${++this.requestId}-${Date.now()}`;
      this.pendingRequests.set(requestId, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });

      this.send({
        type,
        payload,
        requestId,
      });

      // Request timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }

  on(eventType: RealtimeEventType, listener: EventListener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
    
    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  onStateChange(listener: StateListener) {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getState(): ConnectionState {
    return this.state;
  }

  // Typing indicators
  sendTyping(conversationId: string, isTyping: boolean) {
    this.send({
      type: isTyping ? 'TYPING_START' : 'TYPING_STOP',
      payload: { conversationId },
      conversationId,
    });
  }

  // Presence
  sendPresence(isOnline: boolean) {
    this.send({
      type: isOnline ? 'PRESENCE_ONLINE' : 'PRESENCE_OFFLINE',
      payload: { isOnline },
    });
  }

  // Message delivery
  sendDeliveryReceipt(receipt: MessageDeliveryReceipt) {
    this.send({
      type: 'MESSAGE_DELIVERED',
      payload: receipt,
      conversationId: receipt.conversationId,
    });
  }

  // Sync
  requestSync(syncRequest: SyncRequest) {
    return this.request<{ synced: number }>('SYNC_REQUEST', syncRequest);
  }

  private handleMessage(message: WebSocketMessage) {
    // Handle request responses
    if (message.requestId && this.pendingRequests.has(message.requestId)) {
      const resolver = this.pendingRequests.get(message.requestId)!;
      this.pendingRequests.delete(message.requestId);
      resolver(message.payload);
      return;
    }

    // Handle events
    const listeners = this.eventListeners.get(message.type);
    if (listeners) {
      const event: RealtimeEvent = {
        type: message.type,
        payload: message.payload,
        timestamp: Date.now(),
        messageId: message.payload?.messageId,
      };
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('[Realtime] Listener error:', error);
        }
      });
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      this.ws!.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'HEARTBEAT', payload: { timestamp: Date.now() } });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      console.log('[Realtime] Max reconnect attempts reached');
      this.setState('failed');
      return;
    }

    this.setState('reconnecting');
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );
    
    this.reconnectAttempts++;
    
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      // Reconnect will be handled by the parent component
      this.emitReconnectNeeded();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private emitReconnectNeeded() {
    const listeners = this.eventListeners.get('RECONNECT_NEEDED');
    if (listeners) {
      listeners.forEach(l => l({ type: 'RECONNECT_NEEDED', payload: {}, timestamp: Date.now() }));
    }
  }

  private setState(newState: ConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach(listener => listener(newState));
  }

  private rejectPendingRequest(requestId: string, error: Error) {
    const resolver = this.pendingRequests.get(requestId);
    if (resolver) {
      this.pendingRequests.delete(requestId);
      resolver({ error: error.message });
    }
  }
}

// Singleton instance
let realtimeClient: RealtimeClient | null = null;

export function getRealtimeClient(config?: Partial<ConnectionConfig>): RealtimeClient {
  if (!realtimeClient) {
    realtimeClient = new RealtimeClient(config);
  }
  return realtimeClient;
}

export function resetRealtimeClient() {
  if (realtimeClient) {
    realtimeClient.disconnect();
    realtimeClient = null;
  }
}

// React hook for realtime connection
export function useRealtime() {
  const { user, accessToken, device } = useAuthStore();
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [lastError, setLastError] = useState<Error | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const connect = useCallback(async () => {
    if (!user || !accessToken || !device) return;
    
    try {
      const client = getRealtimeClient({
        url: (api as any).getWsUrl?.() || 'wss://api.denden.app/ws',
      });
      clientRef.current = client;

      // Set up state listener
      const unsubscribeState = client.onStateChange((newState) => {
        if (mountedRef.current) {
          setState(newState);
        }
      });

      // Set up error listener
      const unsubscribeError = client.on('ERROR', (event) => {
        if (mountedRef.current) {
          setLastError(new Error(event.payload.message || 'Unknown error'));
        }
      });

      // Set up reconnect listener
      const unsubscribeReconnect = client.on('RECONNECT_NEEDED', () => {
        if (mountedRef.current && user && accessToken && device) {
          client.connect(accessToken, device.id).catch(() => {
            // Will trigger reconnect logic
          });
        }
      });

      await client.connect(accessToken, device.id);

      return () => {
        unsubscribeState();
        unsubscribeError();
        unsubscribeReconnect();
      };
    } catch (error) {
      if (mountedRef.current) {
        setLastError(error as Error);
        setState('failed');
      }
    }
  }, [user, accessToken, device]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    resetRealtimeClient();
    setState('disconnected');
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    return clientRef.current?.send(message) ?? false;
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    clientRef.current?.sendTyping(conversationId, isTyping);
  }, []);

  const sendDeliveryReceipt = useCallback((receipt: MessageDeliveryReceipt) => {
    clientRef.current?.sendDeliveryReceipt(receipt);
  }, []);

  const requestSync = useCallback((syncRequest: SyncRequest) => {
    return clientRef.current?.requestSync(syncRequest);
  }, []);

  const onEvent = useCallback(<T,>(eventType: RealtimeEventType, listener: (event: RealtimeEvent<T>) => void) => {
    return clientRef.current?.on(eventType, listener as any) ?? (() => {});
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (user && accessToken && device) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      if (mountedRef.current) {
        disconnect();
      }
    };
  }, [user, accessToken, device, connect, disconnect]);

  return {
    state,
    lastError,
    connect,
    disconnect,
    sendMessage,
    sendTyping,
    sendDeliveryReceipt,
    requestSync,
    onEvent,
  };
}