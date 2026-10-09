import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { DrizzleService, Database } from '../common/database/drizzle.service';
import { users, devices, deviceOneTimePreKeys, NewUser, NewDevice } from '../common/database/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '../common/utils/id';
import { OtpService } from './otp.service';

export interface TokenPayload {
  sub: string;
  userId: string;
  deviceId: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private jwt: JwtService,
    private config: ConfigService,
    private otp: OtpService,
  ) {}

  async sendOtp(identifier: string, identifierType: 'email' | 'phone'): Promise<void> {
    const normalized = this.normalizeIdentifier(identifier, identifierType);
    await this.otp.send(normalized, identifierType);
  }

  async verifyOtpAndRegister(
    identifier: string,
    identifierType: 'email' | 'phone',
    code: string,
    deviceData: {
      deviceName?: string;
      platform: 'ios' | 'android' | 'web';
      platformVersion?: string;
      appVersion?: string;
      identityKeyPublic: string;
      signingKeyPublic: string;
      signedPreKeyPublic: string;
      signedPreKeySignature: string;
      signedPreKeyId: number;
      oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
    },
  ): Promise<AuthTokens> {
    const normalized = this.normalizeIdentifier(identifier, identifierType);
    const valid = await this.otp.verify(normalized, identifierType, code);

    if (!valid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let user = await this.findUserByIdentifier(normalized);
    let isNewUser = false;

    if (!user) {
      user = await this.createUser(normalized, identifierType);
      isNewUser = true;
    }

    const device = await this.registerDevice(user.id, {
      ...deviceData,
      userId: user.id,
    });

    await this.otp.delete(normalized, identifierType);

    return this.generateTokens(user.id, device.id);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwt.verify<TokenPayload>(refreshToken, {
secret: this.config.get('JWT_REFRESH_SECRET') || this.config.get('JWT_SECRET') || 'dev-secret',
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const device = await this.drizzle.client.query.devices.findFirst({
        where: eq(devices.id, payload.deviceId),
      });

      if (!device || device.revokedAt) {
        throw new UnauthorizedException('Device revoked');
      }

      return this.generateTokens(payload.userId, payload.deviceId);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    await this.drizzle.client
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)));
  }

  async validateUser(userId: string, deviceId: string): Promise<boolean> {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: and(eq(devices.id, deviceId), eq(devices.userId, userId)),
    });
    return !!device && !device.revokedAt;
  }

  private async findUserByIdentifier(identifier: string) {
    return this.drizzle.client.query.users.findFirst({
      where: eq(users.identifier, identifier),
    });
  }

  private async createUser(identifier: string, identifierType: 'email' | 'phone'): Promise<typeof users.$inferSelect> {
    const [user] = await this.drizzle.client
      .insert(users)
      .values({
        identifier,
        identifierType,
        displayName: identifierType === 'email' ? identifier.split('@')[0] : identifier,
      })
      .returning();
    return user;
  }

  private async registerDevice(userId: string, data: NewDevice & { oneTimePreKeys?: Array<{ keyId: number; publicKey: string }> }): Promise<typeof devices.$inferSelect> {
    const [device] = await this.drizzle.client
      .insert(devices)
      .values({ ...data, userId })
      .returning();

    if (data.oneTimePreKeys?.length) {
      await this.drizzle.client.insert(deviceOneTimePreKeys).values(
        data.oneTimePreKeys.map((k) => ({
          deviceId: device.id,
          keyId: k.keyId,
          publicKey: k.publicKey,
        })),
      );
    }

    return device;
  }

  private generateTokens(userId: string, deviceId: string): AuthTokens {
    const accessPayload: TokenPayload = { sub: createId(), userId, deviceId, type: 'access' };
    const refreshPayload: TokenPayload = { sub: createId(), userId, deviceId, type: 'refresh' };

    const accessToken = this.jwt.sign(accessPayload);
    const refreshToken = this.jwt.sign(refreshPayload, {
      secret: this.config.get('JWT_REFRESH_SECRET') || this.config.get('JWT_SECRET') || 'dev-secret',
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '30d'),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
    };
  }

  private normalizeIdentifier(identifier: string, type: 'email' | 'phone'): string {
    if (type === 'email') return identifier.toLowerCase().trim();
    return identifier.replace(/\D/g, '');
  }
}