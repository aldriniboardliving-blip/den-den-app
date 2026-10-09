import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Database = NodePgDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  public db: Database;

  constructor(private config: ConfigService) {
    this.pool = new Pool({
      host: this.config.get('DB_HOST', 'localhost'),
      port: this.config.get('DB_PORT', 5432),
      user: this.config.get('DB_USER', 'postgres'),
      password: this.config.get('DB_PASSWORD', 'postgres'),
      database: this.config.get('DB_NAME', 'den_den'),
      max: this.config.get('DB_POOL_MAX', 20),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.db = drizzle(this.pool, { schema, logger: this.config.get('NODE_ENV') === 'development' });
  }

  async onModuleInit() {
    try {
      await this.pool.query('SELECT 1');
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
    console.log('🔌 Database disconnected');
  }

  get client() {
    return this.db;
  }
}