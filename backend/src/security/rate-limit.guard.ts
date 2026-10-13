import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { SecurityService } from './security.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private security: SecurityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';
    const path = request.route?.path || request.url;
    const method = request.method;

    const identifier = `${ip}:${method}:${path}`;

    const limits = this.getLimitsForPath(path);

    const { allowed, remaining, resetAt } = await this.security.checkRateLimit(
      identifier,
      `ratelimit:${path}`,
      limits.maxRequests,
      limits.windowMs,
    );

    request.headers['x-ratelimit-limit'] = limits.maxRequests.toString();
    request.headers['x-ratelimit-remaining'] = remaining.toString();
    request.headers['x-ratelimit-reset'] = Math.ceil(resetAt.getTime() / 1000).toString();

    if (!allowed) {
      throw new HttpException({
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000),
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private getLimitsForPath(path: string): { maxRequests: number; windowMs: number } {
    if (path.includes('/auth/')) {
      return { maxRequests: 10, windowMs: 60 * 1000 };
    }
    if (path.includes('/messages')) {
      return { maxRequests: 100, windowMs: 60 * 1000 };
    }
    if (path.includes('/attachments')) {
      return { maxRequests: 20, windowMs: 60 * 1000 };
    }
    if (path.includes('/multidevice/link')) {
      return { maxRequests: 5, windowMs: 60 * 1000 };
    }
    return { maxRequests: 200, windowMs: 60 * 1000 };
  }
}