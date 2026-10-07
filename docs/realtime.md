# Den Den Realtime Communication

## Overview

WebSocket-based realtime communication for instant message delivery, with push notification fallback for offline devices.

## Connection

### Endpoint
```
wss://api.den-den.app/realtime
```

### Authentication
```
wss://api.den-den.app/realtime?token=<access_token>&deviceId=<device_uuid>
```

- Token validated on connect
- Device ID must match authenticated user's registered device
- Reconnection uses same token

### Connection Lifecycle

```
CONNECTING
    │
    ├─▶ Auth success → CONNECTED
    │                  │
    │                  ├─▶ PING/PONG (30s interval)
    │                  │
    │                  ├─▶ Network change → RECONNECTING
    │                  │
    │                  └─▶ Close → DISCONNECTED
    │
    └─▶ Auth fail → ERROR → DISCONNECTED
```

---

## Protocol

### Message Format

```json
{
  "type": "MESSAGE_NEW",
  "payload": { ... },
  "timestamp": "2026-01-15T10:30:00.000Z",
  "id": "ws_msg_uuid"
}
```

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `MESSAGE_NEW` | `{envelope, conversationId}` | New message received |
| `MESSAGE_DELIVERED` | `{serverMessageId, recipientDeviceId}` | Delivery confirmed |
| `MESSAGE_READ` | `{serverMessageId, readAt}` | Read receipt |
| `MESSAGE_DELETED` | `{serverMessageId}` | Message deleted |
| `CONVERSATION_UPDATED` | `{conversationId, changes}` | Metadata changed |
| `CONTACT_ADDED` | `{contact}` | New contact |
| `CONTACT_REMOVED` | `{contactId}` | Contact removed |
| `DEVICE_ADDED` | `{device}` | New device registered |
| `DEVICE_REVOKED` | `{deviceId}` | Device revoked |
| `KEY_ROTATION` | `{deviceId, newPrekeys[]}` | Prekeys rotated |
| `SYNC_REQUIRED` | `{reason}` | Full sync needed |
| `PING` | `{}` | Keepalive (every 30s) |
| `ERROR` | `{code, message}` | Protocol error |

### Client → Server Messages

| Message | Payload | Description |
|---------|---------|-------------|
| `PONG` | `{}` | Respond to ping |
| `ACK` | `{serverMessageId, status}` | Message acknowledgment |
| `READ` | `{serverMessageId}` | Read receipt |
| `SYNC_REQUEST` | `{since, conversationId}` | Request sync |
| `TYPING_START` | `{conversationId}` | Typing indicator |
| `TYPING_STOP` | `{conversationId}` | Stop typing |
| `FETCH_PREKEYS` | `{deviceIds[]}` | Request key bundles |

---

## Implementation

### Client (React Native)

```typescript
// src/realtime/connection.ts
import { io, Socket } from 'socket.io-client';
import NetInfo from '@react-native-community/netinfo';

class RealtimeConnection {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  
  connect(token: string, deviceId: string) {
    this.socket = io('wss://api.den-den.app/realtime', {
      auth: { token, deviceId },
      transports: ['websocket'],
      reconnection: false, // We handle manually
      timeout: 10000,
    });
    
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
    });
    
    this.socket.on('disconnect', (reason) => {
      this.handleDisconnect(reason);
    });
    
    this.socket.on('PING', () => this.socket?.emit('PONG'));
    
    // Register event handlers
    this.registerHandlers();
  }
  
  private handleDisconnect(reason: string) {
    if (reason === 'io server disconnect') {
      // Server closed connection - don't reconnect automatically
      this.emit('error', new Error('Server disconnected'));
      return;
    }
    
    // Network issue - reconnect with backoff
    this.scheduleReconnect();
  }
  
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }
    
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      this.maxReconnectDelay
    );
    
    this.reconnectAttempts++;
    setTimeout(() => this.connect(this.token, this.deviceId), delay);
  }
  
  private registerHandlers() {
    this.socket?.on('MESSAGE_NEW', (data) => this.handleMessageNew(data));
    this.socket?.on('MESSAGE_DELIVERED', (data) => this.emit('messageDelivered', data));
    this.socket?.on('MESSAGE_READ', (data) => this.emit('messageRead', data));
    this.socket?.on('SYNC_REQUIRED', (data) => this.emit('syncRequired', data));
    // ... other handlers
  }
  
  private async handleMessageNew(data: MessageNewPayload) {
    // 1. Decrypt message
    const plaintext = await decryptMessage(data.envelope);
    
    // 2. Persist to local DB
    await database.insertMessage({ ...data.envelope, plaintext, status: 'DELIVERED' });
    
    // 3. Send ACK
    this.socket?.emit('ACK', { serverMessageId: data.envelope.serverMessageId, status: 'PERSISTED_LOCALLY' });
    
    // 4. Notify UI
    this.emit('messageReceived', { conversationId: data.conversationId, message: plaintext });
  }
  
  sendAck(serverMessageId: string) {
    this.socket?.emit('ACK', { serverMessageId, status: 'PERSISTED_LOCALLY' });
  }
  
  sendReadReceipt(serverMessageId: string) {
    this.socket?.emit('READ', { serverMessageId });
  }
  
  requestSync(since: number, conversationId?: string) {
    this.socket?.emit('SYNC_REQUEST', { since, conversationId });
  }
  
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
```

### Network Awareness

```typescript
// src/realtime/network.ts
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { realtime } from './connection';

export function setupNetworkMonitoring() {
  NetInfo.addEventListener((state: NetInfoState) => {
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;
    
    if (isOnline && !realtime.isConnected()) {
      // Network restored - reconnect
      realtime.connect(getToken(), getDeviceId());
    } else if (!isOnline && realtime.isConnected()) {
      // Network lost - socket will handle disconnect
    }
  });
}
```

---

## Push Notification Fallback

### When to Use Push

| Scenario | Mechanism |
|----------|-----------|
| App foreground, WS connected | WebSocket |
| App background, WS connected | WebSocket (iOS: background task) |
| App background, WS disconnected | Push notification |
| App killed | Push notification |
| Device offline | Push notification (delivered when online) |

### Push Payload (NO MESSAGE CONTENT)

```json
{
  "aps": {
    "alert": {
      "title": "New message",
      "body": "You have a new message"
    },
    "badge": 1,
    "sound": "default",
    "content-available": 1
  },
  "data": {
    "type": "MESSAGE_NEW",
    "conversationId": "conv_uuid",
    "senderId": "device_uuid",
    "messageType": "TEXT"
  }
}
```

**Critical:** Push payload contains ONLY metadata. Never message content.

### Push Registration

```typescript
// src/realtime/push.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

export async function registerForPush() {
  if (!Device.isDevice) return;
  
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const { status: newStatus } = await Notifications.requestPermissionsAsync();
    if (newStatus !== 'granted') return;
  }
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Send to backend
  await api.post('/api/v1/push/token', { token, platform: Device.osName });
  
  // Handle incoming notifications
  Notifications.addNotificationReceivedListener(handleNotification);
  Notifications.addNotificationResponseReceivedListener(handleResponse);
}

function handleNotification(notification: Notifications.Notification) {
  if (notification.request.content.data?.type === 'MESSAGE_NEW') {
    // Wake up sync processor
    syncQueue.processQueue();
  }
}
```

---

## Server Implementation (NestJS)

```typescript
// backend/src/realtime/realtime.gateway.ts
@WebSocketGateway({
  cors: { origin: ['https://den-den.app', 'exp://*'] },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  
  private userSockets = new Map<string, Set<Socket>>(); // userId -> sockets
  private deviceSockets = new Map<string, Socket>();    // deviceId -> socket
  
  afterInit(server: Server) {
    server.use(this.authMiddleware.bind(this));
  }
  
  async handleConnection(client: Socket) {
    const userId = client.data.userId;
    const deviceId = client.data.deviceId;
    
    // Track connections
    if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
    this.userSockets.get(userId)!.add(client);
    this.deviceSockets.set(deviceId, client);
    
    // Update device last_active
    await this.devicesService.updateLastActive(deviceId);
    
    // Send any pending messages
    await this.deliverPendingMessages(deviceId, client);
  }
  
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const deviceId = client.data.deviceId;
    
    this.userSockets.get(userId)?.delete(client);
    this.deviceSockets.delete(deviceId);
  }
  
  @SubscribeMessage('ACK')
  handleAck(client: Socket, payload: AckPayload) {
    return this.deliveryService.processAck(payload.serverMessageId, payload.status, client.data.deviceId);
  }
  
  @SubscribeMessage('READ')
  handleRead(client: Socket, payload: ReadPayload) {
    return this.deliveryService.processRead(payload.serverMessageId, client.data.deviceId);
  }
  
  @SubscribeMessage('SYNC_REQUEST')
  handleSync(client: Socket, payload: SyncPayload) {
    return this.syncService.getMessagesSince(payload.since, payload.conversationId, client.data.deviceId);
  }
  
  // Broadcast to all user's devices
  async broadcastToUser(userId: string, event: string, payload: any) {
    const sockets = this.userSockets.get(userId);
    sockets?.forEach(socket => socket.emit(event, payload));
  }
  
  // Send to specific device
  async sendToDevice(deviceId: string, event: string, payload: any) {
    const socket = this.deviceSockets.get(deviceId);
    if (socket?.connected) {
      socket.emit(event, payload);
    } else {
      // Queue for later or send push
      await this.queueForDevice(deviceId, event, payload);
      await this.pushService.send(deviceId, event, payload);
    }
  }
}
```

---

## Message Delivery Flow

```
Sender                          Server                          Recipient
  │                               │                                 │
  │── Send envelope ─────────────▶│                                 │
  │                               │── MESSAGE_NEW ────────────────▶│
  │                               │                                 │
  │                               │◀── ACK (PERSISTED_LOCALLY) ────│
  │                               │                                 │
  │                               │── Update status: ACKNOWLEDGED  │
  │                               │                                 │
  │                               │── Delete from relay ──────────▶│
  │                               │                                 │
  │◀── DELIVERED status ──────────│                                 │
```

---

## Reliability

### Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| At-least-once delivery | Server retries until ACK |
| No message loss | Persistent relay + client ACK required before delete |
| Order preservation | UUIDv7 timestamps + conversation sequencing |
| Duplicate protection | Idempotency keys + client deduplication |

### Offline Handling

1. **Sender offline**: Message queued locally → sync when online
2. **Recipient offline**: Server stores in relay (72hr TTL) → push notification → WebSocket when online
3. **Both offline**: Local queues on both sides → sync when both online

---

## References

- [Architecture](architecture.md)
- [API Design](api.md)
- [Offline-First](offline-first.md)
- [Backend](backend.md)
- [Encryption](encryption.md)