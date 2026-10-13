// src/security/secure-websocket.ts
// Secure WebSocket wrapper with certificate pinning

import { CertificatePinningService, certificatePinningService } from './certificate-pinning';

export interface SecureWebSocketConfig {
  url: string;
  protocols?: string | string[];
  certificatePinning?: CertificatePinningService;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export interface SecureWebSocketEventMap {
  open: Event;
  close: CloseEvent;
  error: Event;
  message: MessageEvent;
}

export type SecureWebSocketEventType = keyof SecureWebSocketEventMap;

export class SecureWebSocket {
  private ws: WebSocket | null = null;
  private config: Required<SecureWebSocketConfig>;
  private certPinning: CertificatePinningService;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messageQueue: string[] = [];
  private eventListeners = new Map<string, Set<EventListener>>();
  private state: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed' = 'disconnected';
  private stateListeners = new Set<(state: string) => void>();

  constructor(config: SecureWebSocketConfig) {
    this.config = {
      url: config.url,
      protocols: config.protocols,
      certificatePinning: config.certificatePinning || certificatePinningService,
      reconnectInterval: config.reconnectInterval ?? 1000,
      maxReconnectInterval: config.maxReconnectInterval ?? 30000,
      reconnectAttempts: config.reconnectAttempts ?? 10,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      connectionTimeout: config.connectionTimeout ?? 10000,
    };
    this.certPinning = this.config.certificatePinning;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setState('connecting');

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);
        
        this.ws.onopen = async () => {
          console.log('[SecureWS] Connected');
          
          // Validate certificate pinning
          const isValid = await this.config.certificatePinning.validateConnection(
            new URL(this.config.url).hostname,
            this.ws!
          );
          
          if (!this.config.certificatePinning.enablePinning || (await this.config.certificatePinning.validateConnection(
            new URL(this.config.url).hostname,
            this.ws!
          ))) {
            this.reconnectAttempts = 0;
            this.setState('connected');
            this.startHeartbeat();
            this.flushMessageQueue();
            resolve();
          } else {
            console.error('[SecureWS] Certificate pinning validation failed');
            this.ws?.close();
            reject(new Error('Certificate pinning validation failed'));
          }
        };

        this.ws.onclose = (event) => {
          console.log('[SecureWS] Disconnected:', event.code, event.reason);
          this.stopHeartbeat();
          
          if (this.state !== 'disconnected') {
            this.scheduleReconnect();
          }
          this.setState('disconnected');
        };

        this.ws.onerror = (error) => {
          console.error('[SecureWS] Error:', error);
          if (this.state === 'connecting') {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[SecureWS] Failed to parse message:', error);
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

  disconnect(): void {
    this.setState('disconnected');
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Reject pending requests
    this.eventListeners.clear();
  }

  send(data: string | object): boolean {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    } else {
      // Queue message for later
      this.messageQueue.push(typeof data === 'string' ? data : JSON.stringify(data));
      return false;
    }
  }

  addEventListener(type: string, listener: EventListener): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
    
    return () => {
      this.eventListeners.get(type)?.delete(listener);
    };
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  on(type: string, listener: EventListener): () => void {
    return this.addEventListener(type, listener);
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.eventListeners.get(type)?.delete(listener);
  }

  onOpen(listener: (event: Event) => void): () => void {
    return this.addEventListener('open', listener);
  }

  onClose(listener: (event: CloseEvent) => void): () => void {
    return this.addEventListener('close', listener);
  }

  onError(listener: (event: Event) => void): () => void {
    return this.addEventListener('error', listener);
  }

  onMessage(listener: (event: MessageEvent) => void): () => void {
    return this.addEventListener('message', listener);
  }

  getState(): string {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  private async handleMessage(message: any): Promise<void> {
    const listeners = this.eventListeners.get(message.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener({ type: message.type, data: message.payload });
        } catch (error) {
          console.error('[SecureWS] Listener error:', error);
        }
      }
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      this.ws!.send(message);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'HEARTBEAT', payload: { timestamp: Date.now() } });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      console.log('[SecureWS] Max reconnect attempts reached');
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
      this.connect().catch(() => {
        // Will trigger reconnect logic
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(newState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'): void {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach(listener => listener(newState));
  }

  onStateChange(listener: (state: string) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  getState(): string {
    return this.state;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  getConfig(): Required<SecureWebSocketConfig> {
    return { ...this.config };
  }
}

export function createSecureWebSocket(config: SecureWebSocketConfig): SecureWebSocket {
  return new SecureWebSocket(config);
}