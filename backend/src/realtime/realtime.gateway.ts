import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { devices, pushTokens } from '../common/database/schema';
import { eq, and, isNull } from 'drizzle-orm';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  deviceId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private deviceSockets = new Map<string, Set<string>>(); // deviceId -> Set<socketId>

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private drizzle: DrizzleService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      const deviceId = client.handshake.auth?.deviceId || client.handshake.query?.deviceId;

      if (!token || !deviceId) {
        client.disconnect();
        return;
      }

      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_SECRET'),
        issuer: 'den-den',
        audience: 'den-den-client',
      });

      if (payload.type !== 'access') {
        client.disconnect();
        return;
      }

      const device = await this.drizzle.client.query.devices.findFirst({
        where: and(eq(devices.id, deviceId), eq(devices.userId, payload.userId), isNull(devices.revokedAt)),
      });

      if (!device) {
        client.disconnect();
        return;
      }

      client.userId = payload.userId;
      client.deviceId = deviceId;

      if (!this.deviceSockets.has(deviceId)) {
        this.deviceSockets.set(deviceId, new Set());
      }
      this.deviceSockets.get(deviceId)!.add(client.id);

      await this.drizzle.client
        .update(devices)
        .set({ lastActiveAt: new Date() })
        .where(eq(devices.id, deviceId));

      console.log(`🔌 Device ${deviceId} connected (socket: ${client.id})`);
    } catch (error) {
      console.error('WebSocket auth failed:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.deviceId) {
      const sockets = this.deviceSockets.get(client.deviceId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.deviceSockets.delete(client.deviceId);
        }
      }
      console.log(`🔌 Device ${client.deviceId} disconnected (socket: ${client.id})`);
    }
  }

  @SubscribeMessage('ACK')
  async handleAck(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { serverMessageId: string; status: 'PERSISTED_LOCALLY' },
  ) {
    if (!client.deviceId) return { success: false, error: 'Not authenticated' };

    console.log(`✅ ACK from ${client.deviceId} for message ${data.serverMessageId}`);
    return { success: true };
  }

  @SubscribeMessage('READ')
  async handleRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { serverMessageId: string },
  ) {
    if (!client.deviceId) return { success: false, error: 'Not authenticated' };
    console.log(`📖 READ from ${client.deviceId} for message ${data.serverMessageId}`);
    return { success: true };
  }

  @SubscribeMessage('SYNC_REQUEST')
  async handleSyncRequest(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { since?: string },
  ) {
    if (!client.deviceId) return { success: false, error: 'Not authenticated' };
    console.log(`🔄 SYNC_REQUEST from ${client.deviceId}`);
    return { success: true, message: 'Sync triggered' };
  }

  @SubscribeMessage('TYPING_START')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.deviceId) return { success: false, error: 'Not authenticated' };
    this.broadcastToConversation(data.conversationId, 'TYPING_START', {
      deviceId: client.deviceId,
      conversationId: data.conversationId,
    }, client.id);
    return { success: true };
  }

  @SubscribeMessage('TYPING_STOP')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!client.deviceId) return { success: false, error: 'Not authenticated' };
    this.broadcastToConversation(data.conversationId, 'TYPING_STOP', {
      deviceId: client.deviceId,
      conversationId: data.conversationId,
    }, client.id);
    return { success: true };
  }

  sendToDevice(deviceId: string, event: string, data: any) {
    const sockets = this.deviceSockets.get(deviceId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }

  broadcastToConversation(conversationId: string, event: string, data: any, excludeSocketId?: string) {
    this.server.to(`conversation:${conversationId}`).except(excludeSocketId || '').emit(event, data);
  }

  async joinConversation(socket: AuthenticatedSocket, conversationId: string) {
    socket.join(`conversation:${conversationId}`);
  }

  async leaveConversation(socket: AuthenticatedSocket, conversationId: string) {
    socket.leave(`conversation:${conversationId}`);
  }

  async broadcastNewMessage(messageId: string, recipientDeviceIds: string[]) {
    for (const deviceId of recipientDeviceIds) {
      this.sendToDevice(deviceId, 'MESSAGE_NEW', { messageId });
    }
  }

  getConnectedDevices(): string[] {
    return Array.from(this.deviceSockets.keys());
  }

  isDeviceOnline(deviceId: string): boolean {
    return this.deviceSockets.has(deviceId);
  }
}