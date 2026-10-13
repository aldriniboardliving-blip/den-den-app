import { Injectable, Logger } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private redisClient: RedisClientType | null = null;

  constructor(
    private drizzle: DrizzleService,
    private config: ConfigService,
  ) {
    this.initRedis();
  }

  private initRedis() {
    const redisUrl = this.config.get('REDIS_URL');
    if (redisUrl) {
      try {
        this.redisClient = createClient({ url: redisUrl });
        this.redisClient.on('error', (err) => {
          this.logger.error('Redis client error', err);
        });
        this.redisClient.connect().catch((err) => {
          this.logger.error('Failed to connect to Redis', err);
        });
      } catch (error) {
        this.logger.error('Failed to initialize Redis client', error);
      }
    }
  }

  async checkLiveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  async checkReadiness() {
    const checks: Record<string, string> = {};
    let allHealthy = true;

    // Check database
    try {
      await this.drizzle.client.execute(sql`SELECT 1`);
      checks.database = 'healthy';
    } catch (error) {
      this.logger.error('Database health check failed', error);
      checks.database = 'unhealthy';
      allHealthy = false;
    }

    // Check Redis
    if (this.redisClient) {
      try {
        await this.redisClient.ping();
        checks.redis = 'healthy';
      } catch (error) {
        this.logger.error('Redis health check failed', error);
        checks.redis = 'unhealthy';
        allHealthy = false;
      }
    } else {
      checks.redis = 'not configured';
    }

    // Check S3/MinIO (optional)
    const s3Endpoint = this.config.get('S3_ENDPOINT');
    if (s3Endpoint) {
      checks.storage = 'configured';
    } else {
      checks.storage = 'not configured';
    }

    return {
      status: allHealthy ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  async getInfo() {
    return {
      name: 'Den Den Backend',
      version: this.config.get('npm_package_version', '0.1.0'),
      environment: this.config.get('NODE_ENV', 'development'),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}