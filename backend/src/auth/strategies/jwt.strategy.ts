import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../../common/database/drizzle.service';
import { devices } from '../../common/database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private drizzle: DrizzleService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'dev-secret-change-in-production'),
      issuer: 'den-den',
      audience: 'den-den-client',
    });
  }

  async validate(payload: { sub: string; userId: string; deviceId: string; type: string }) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, payload.deviceId),
    });

    if (!device || device.revokedAt) {
      throw new UnauthorizedException('Device revoked or not found');
    }

    return {
      userId: payload.userId,
      deviceId: payload.deviceId,
      tokenId: payload.sub,
    };
  }
}