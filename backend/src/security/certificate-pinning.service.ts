import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { encryptionKeys, devices } from '../common/database/schema';
import { eq, and } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface PinnedCertificate {
  id: string;
  hostname: string;
  sha256Fingerprint: string;
  backupFingerprints: string[];
  expiryDate: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface PinValidationResult {
  valid: boolean;
  hostname: string;
  presentedFingerprint: string;
  expectedFingerprint: string;
  error?: string;
}

@Injectable()
export class CertificatePinningService {
  private readonly logger = new Logger(CertificatePinningService.name);
  private pins = new Map<string, PinnedCertificate>();
  private readonly enablePinning: boolean;

  constructor(
    private config: ConfigService,
    private drizzle: DrizzleService,
  ) {
    this.enablePinning = this.config.get('SECURITY_CERT_PINNING', true);
    this.loadDefaultPins();
  }

  private loadDefaultPins(): void {
    const apiHost = this.config.get('API_HOST', 'api.den-den.app');
    const primaryPin = this.config.get('CERT_PIN_PRIMARY');
    const backupPins = this.config.get('CERT_PIN_BACKUP', '').split(',').filter(Boolean);

    if (primaryPin) {
      this.addPin({
        id: 'api-primary',
        hostname: apiHost,
        sha256Fingerprint: primaryPin.toUpperCase(),
        backupFingerprints: backupPins.map((p: string) => p.toUpperCase()),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        isActive: true,
      });
    }

    const wsHost = this.config.get('WS_HOST', 'api.den-den.app');
    const wsPrimaryPin = this.config.get('WS_CERT_PIN_PRIMARY');
    const wsBackupPins = this.config.get('WS_CERT_PIN_BACKUP', '').split(',').filter(Boolean);

    if (wsPrimaryPin) {
      this.addPin({
        id: 'ws-primary',
        hostname: wsHost,
        sha256Fingerprint: wsPrimaryPin.toUpperCase(),
        backupFingerprints: wsBackupPins.map((p: string) => p.toUpperCase()),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        isActive: true,
      });
    }

    this.loadFromDatabase();
  }

  private async loadFromDatabase(): Promise<void> {
    try {
      const stored = await this.drizzle.client.query.encryptionKeys.findMany({
        where: and(
          eq(encryptionKeys.keyType, 'CERT_PIN'),
          eq(encryptionKeys.isActive, true),
        ),
      });

      for (const pin of stored) {
        if (pin.publicKey) {
          const pinData: PinnedCertificate = JSON.parse(pin.publicKey);
          this.pins.set(pinData.hostname, pinData);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load certificate pins from database', error);
    }
  }

  addPin(pin: PinnedCertificate): void {
    if (this.isFingerprintValid(pin.sha256Fingerprint)) {
      for (const backup of pin.backupFingerprints) {
        if (!this.isFingerprintValid(backup)) {
          throw new Error(`Invalid backup fingerprint: ${backup}`);
        }
      }
      this.pins.set(pin.hostname, pin);
      this.persistPin(pin);
    } else {
      throw new Error(`Invalid primary fingerprint format: ${pin.sha256Fingerprint}`);
    }
  }

  private isFingerprintValid(fingerprint: string): boolean {
    return /^[A-F0-9]{64}$/i.test(fingerprint);
  }

  private async persistPin(pin: PinnedCertificate): Promise<void> {
    await this.drizzle.client
      .insert(encryptionKeys)
      .values({
        id: `cert_pin_${pin.id}`,
        deviceId: 'system',
        keyType: 'CERT_PIN',
        publicKey: JSON.stringify(pin),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: encryptionKeys.id,
        set: {
          publicKey: JSON.stringify(pin),
          updatedAt: new Date(),
        },
      });
  }

  async validatePin(hostname: string, certificate: string | Buffer): Promise<PinValidationResult> {
    if (!this.enablePinning) {
      return { valid: true, hostname, presentedFingerprint: '', expectedFingerprint: '' };
    }

    const pin = this.pins.get(hostname);
    if (!pin) {
      this.logger.warn(`No certificate pin configured for ${hostname}`);
      return {
        valid: false,
        hostname,
        presentedFingerprint: '',
        expectedFingerprint: '',
        error: 'No pin configured for hostname',
      };
    }

    if (pin.expiryDate < new Date()) {
      this.logger.warn(`Certificate pin expired for ${hostname}`);
      return {
        valid: false,
        hostname,
        presentedFingerprint: '',
        expectedFingerprint: pin.sha256Fingerprint,
        error: 'Certificate pin expired',
      };
    }

    const presentedFingerprint = this.calculateFingerprint(certificate).toUpperCase();
    const expectedFingerprint = pin.sha256Fingerprint.toUpperCase();

    if (presentedFingerprint === expectedFingerprint) {
      return { valid: true, hostname, presentedFingerprint, expectedFingerprint };
    }

    for (const backup of pin.backupFingerprints) {
      if (presentedFingerprint === backup.toUpperCase()) {
        this.logger.log(`Certificate validated with backup pin for ${hostname}`);
        return { valid: true, hostname, presentedFingerprint, expectedFingerprint: backup };
      }
    }

    this.logger.error(`Certificate pin validation failed for ${hostname}`);
    return {
      valid: false,
      hostname,
      presentedFingerprint,
      expectedFingerprint,
      error: 'Certificate fingerprint mismatch',
    };
  }

  private calculateFingerprint(certificate: string | Buffer): string {
    const certBuffer = Buffer.isBuffer(certificate) ? certificate : Buffer.from(certificate);
    
    let derBuffer: Buffer;
    if (certBuffer.toString().includes('-----BEGIN CERTIFICATE-----')) {
      const pem = certBuffer.toString();
      const b64 = pem
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\s/g, '');
      derBuffer = Buffer.from(b64, 'base64');
    } else {
      derBuffer = certBuffer;
    }

    return crypto.createHash('sha256').update(derBuffer).digest('hex').toUpperCase();
  }

  async validateConnection(hostname: string, socket: any): Promise<boolean> {
    if (!this.enablePinning) return true;

    try {
      const peerCert = socket.getPeerCertificate(true);
      if (!peerCert || !peerCert.raw) {
        this.logger.warn(`No peer certificate for ${hostname}`);
        return false;
      }

      const result = await this.validatePin(hostname, peerCert.raw);
      return result.valid;
    } catch (error) {
      this.logger.error(`Certificate validation error for ${hostname}`, error);
      return false;
    }
  }

  getConfiguredHosts(): string[] {
    return Array.from(this.pins.keys());
  }

  getPinInfo(hostname: string): PinnedCertificate | undefined {
    return this.pins.get(hostname);
  }

  async rotatePin(hostname: string, newPrimaryFingerprint: string, newBackupFingerprints: string[]): Promise<void> {
    const existing = this.pins.get(hostname);
    if (!existing) {
      throw new Error(`No existing pin for ${hostname}`);
    }

    if (!this.isFingerprintValid(newPrimaryFingerprint)) {
      throw new Error('Invalid new primary fingerprint');
    }

    const updated: PinnedCertificate = {
      ...existing,
      sha256Fingerprint: newPrimaryFingerprint.toUpperCase(),
      backupFingerprints: newBackupFingerprints.map(f => f.toUpperCase()),
      createdAt: new Date(),
    };

    this.addPin(updated);
    this.logger.log(`Certificate pin rotated for ${hostname}`);
  }

  async revokePin(hostname: string): Promise<void> {
    const pin = this.pins.get(hostname);
    if (pin) {
      pin.isActive = false;
      await this.persistPin(pin);
      this.pins.delete(hostname);
      this.logger.log(`Certificate pin revoked for ${hostname}`);
    }
  }

  exportPins(): PinnedCertificate[] {
    return Array.from(this.pins.values());
  }

  importPins(pins: PinnedCertificate[]): void {
    for (const pin of pins) {
      if (pin.isActive && pin.expiryDate > new Date()) {
        this.addPin(pin);
      }
    }
  }
}