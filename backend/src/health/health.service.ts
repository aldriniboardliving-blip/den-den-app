import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';

@Injectable()
export class HealthService {
  constructor(
    private drizzle: DrizzleService,
    private config: ConfigService,
  ) {}

  async checkLiveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  async checkReadiness() {
    try {
      await this.drizzle.client.execute(sql`SELECT 1`);
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy',
        },
      };
    } catch (error) {
      return {
        status: 'not ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unhealthy',
        },
      };
    }
  }

  async getInfo() {
    return {
      name: 'Den Den Backend',
      version: this.config.get('npm_package_version', '0.1.0'),
      environment: this.config.get('NODE_ENV', 'development'),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}