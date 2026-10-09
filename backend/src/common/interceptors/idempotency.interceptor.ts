import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
} from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { DrizzleService, Database } from '../database/drizzle.service';
import { syncOperations } from '../database/schema';
import { eq } from 'drizzle-orm';
import { createId } from '../utils/id';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private drizzle: DrizzleService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
      return next.handle();
    }

    return from(this.checkAndStoreIdempotencyKey(idempotencyKey, request)).pipe(
      mergeMap((existing) => {
        if (existing) {
          if (existing.status === 'COMPLETED') {
            return from(Promise.resolve(existing.payload));
          }
          throw new ConflictException('Request with this idempotency key is already being processed');
        }
        return next.handle();
      }),
    );
  }

  private async checkAndStoreIdempotencyKey(key: string, request: any) {
    const existing = await this.drizzle.client.query.syncOperations.findFirst({
      where: eq(syncOperations.idempotencyKey, key),
    });

    if (existing) {
      return existing;
    }

    await this.drizzle.client.insert(syncOperations).values({
      id: createId(),
      userId: request.user?.id || 'unknown',
      deviceId: request.device?.id || 'unknown',
      operationType: 'API_REQUEST',
      entityType: 'REQUEST',
      entityId: createId(),
      payload: { method: request.method, path: request.path },
      idempotencyKey: key,
      status: 'PROCESSING',
    });

    return null;
  }
}