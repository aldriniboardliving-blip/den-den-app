import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { createId } from '../common/utils/id';

interface OtpRecord {
  id: string;
  identifier: string;
  identifierType: 'email' | 'phone';
  code: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
}

@Injectable()
export class OtpService {
  private store = new Map<string, OtpRecord>();

  constructor(
    private config: ConfigService,
    private drizzle: DrizzleService,
  ) {
    setInterval(() => this.cleanup(), 60000);
  }

  async send(identifier: string, type: 'email' | 'phone'): Promise<void> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const record: OtpRecord = {
      id: createId(),
      identifier,
      identifierType: type,
      code: await this.hashCode(code),
      expiresAt,
      attempts: 0,
      createdAt: new Date(),
    };

    this.store.set(`${type}:${identifier}`, record);

    await this.sendViaProvider(identifier, type, code);
  }

  async verify(identifier: string, type: 'email' | 'phone', code: string): Promise<boolean> {
    const key = `${type}:${identifier}`;
    const record = this.store.get(key);

    if (!record) return false;
    if (record.expiresAt < new Date()) {
      this.store.delete(key);
      return false;
    }
    if (record.attempts >= 5) {
      this.store.delete(key);
      return false;
    }

    record.attempts++;
    const valid = await this.compareCode(code, record.code);

    if (valid) {
      this.store.delete(key);
    }

    return valid;
  }

  async delete(identifier: string, type: 'email' | 'phone'): Promise<void> {
    this.store.delete(`${type}:${identifier}`);
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async hashCode(code: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async compareCode(code: string, hash: string): Promise<boolean> {
    const hashed = await this.hashCode(code);
    return hashed === hash;
  }

  private async sendViaProvider(identifier: string, type: 'email' | 'phone', code: string): Promise<void> {
    const provider = this.config.get('OTP_PROVIDER', 'console');

    switch (provider) {
      case 'console':
        console.log(`[OTP] ${type.toUpperCase()} to ${identifier}: ${code}`);
        break;
      case 'twilio':
        // await this.twilioClient.messages.create({ to: identifier, body: `Your Den Den code: ${code}` });
        break;
      case 'sendgrid':
        // await this.sendgridClient.send({ to: identifier, subject: 'Den Den Verification', text: `Code: ${code}` });
        break;
      default:
        console.log(`[OTP] ${type.toUpperCase()} to ${identifier}: ${code}`);
    }
  }

  private cleanup(): void {
    const now = new Date();
    for (const [key, record] of this.store.entries()) {
      if (record.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }
}