import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { pushTokens } from '../common/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createId } from '../common/utils/id';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private drizzle: DrizzleService,
    private config: ConfigService,
  ) {}

  async registerToken(deviceId: string, token: string, platform: 'expo' | 'fcm' | 'apns') {
    await this.drizzle.client
      .insert(pushTokens)
      .values({ deviceId, token, platform, active: true })
      .onConflictDoUpdate({
        target: [pushTokens.deviceId, pushTokens.token],
        set: { active: true, lastUsedAt: new Date() },
      });
  }

  async unregisterToken(deviceId: string, token: string) {
    await this.drizzle.client
      .update(pushTokens)
      .set({ active: false })
      .where(and(eq(pushTokens.deviceId, deviceId), eq(pushTokens.token, token)));
  }

  async getActiveTokens(deviceId: string) {
    return this.drizzle.client.query.pushTokens.findMany({
      where: and(eq(pushTokens.deviceId, deviceId), eq(pushTokens.active, true)),
      orderBy: desc(pushTokens.lastUsedAt),
    });
  }

  async sendToDevice(deviceId: string, payload: PushPayload) {
    const tokens = await this.getActiveTokens(deviceId);
    if (tokens.length === 0) return { sent: 0, failed: 0 };

    const results = await Promise.allSettled(
      tokens.map((t) => this.sendViaProvider(t, payload)),
    );

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const token = tokens[i];

      if (result.status === 'fulfilled') {
        sent++;
        await this.drizzle.client
          .update(pushTokens)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushTokens.id, token.id));
      } else {
        failed++;
        console.error(`Push failed for token ${token.id}:`, result.reason);
        if (this.isTokenInvalid(result.reason)) {
          await this.drizzle.client
            .update(pushTokens)
            .set({ active: false })
            .where(eq(pushTokens.id, token.id));
        }
      }
    }

    return { sent, failed };
  }

  private async sendViaProvider(token: any, payload: PushPayload): Promise<void> {
    const provider = token.platform;

    switch (provider) {
      case 'expo':
        await this.sendExpo(token.token, payload);
        break;
      case 'fcm':
        await this.sendFcm(token.token, payload);
        break;
      case 'apns':
        await this.sendApns(token.token, payload);
        break;
    }
  }

  private async sendExpo(token: string, payload: PushPayload): Promise<void> {
    const expoUrl = 'https://exp.host/--/api/v2/push/send';
    const response = await fetch(expoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Expo push failed: ${JSON.stringify(error)}`);
    }
  }

  private async sendFcm(token: string, payload: PushPayload): Promise<void> {
    const serverKey = this.config.get('FCM_SERVER_KEY');
    if (!serverKey) throw new Error('FCM_SERVER_KEY not configured');

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`FCM push failed: ${JSON.stringify(error)}`);
    }
  }

  private async sendApns(token: string, payload: PushPayload): Promise<void> {
    console.log(`[APNS] Would send to ${token}:`, payload);
  }

  private isTokenInvalid(error: any): boolean {
    const message = error?.message || '';
    return (
      message.includes('InvalidRegistration') ||
      message.includes('NotRegistered') ||
      message.includes('DeviceTokenNotForTopic') ||
      message.includes('Unregistered')
    );
  }
}