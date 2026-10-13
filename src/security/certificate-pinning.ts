// src/security/certificate-pinning.ts
// Certificate pinning utilities for WebSocket connections

import * as crypto from 'crypto';

export interface PinnedCertificate {
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

export class CertificatePinningService {
  private pins = new Map<string, PinnedCertificate>();
  private readonly enablePinning: boolean;

  constructor(enablePinning = true) {
    this.enablePinning = enablePinning;
    this.loadDefaultPins();
  }

  private loadDefaultPins(): void {
    // Default pins for production endpoints
    // These should be configured via environment variables in production
    const apiHost = process.env.API_HOST || 'api.den-den.app';
    const wsHost = process.env.WS_HOST || 'api.den-den.app';
    
    const primaryPin = process.env.CERT_PIN_PRIMARY;
    const backupPins = process.env.CERT_PIN_BACKUP?.split(',').filter(Boolean) || [];
    
    if (primaryPin) {
      this.addPin({
        id: 'api-primary',
        hostname: apiHost,
        sha256Fingerprint: primaryPin.toUpperCase(),
        backupFingerprints: backupPins.map(p => p.toUpperCase()),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        isActive: true,
      });
    }

    const wsPrimaryPin = process.env.WS_CERT_PIN_PRIMARY;
    const wsBackupPins = process.env.WS_CERT_PIN_BACKUP?.split(',').filter(Boolean) || [];

    if (wsPrimaryPin) {
      this.addPin({
        id: 'ws-primary',
        hostname: wsHost,
        sha256Fingerprint: wsPrimaryPin.toUpperCase(),
        backupFingerprints: wsBackupPins.map(p => p.toUpperCase()),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        isActive: true,
      });
    }
  }

  addPin(pin: PinnedCertificate): void {
    if (!this.isFingerprintValid(pin.sha256Fingerprint)) {
      throw new Error(`Invalid primary fingerprint format: ${pin.sha256Fingerprint}`);
    }
    for (const backup of pin.backupFingerprints) {
      if (!this.isFingerprintValid(backup)) {
        throw new Error(`Invalid backup fingerprint: ${backup}`);
      }
    }
    this.pins.set(pin.hostname, pin);
    this.persistPin(pin);
  }

  private isFingerprintValid(fingerprint: string): boolean {
    return /^[A-F0-9]{64}$/i.test(fingerprint);
  }

  private async persistPin(pin: PinnedCertificate): Promise<void> {
    // In a real implementation, this would persist to secure storage
    // For now, we keep it in memory
  }

  async validatePin(hostname: string, certificate: string | Buffer): Promise<PinValidationResult> {
    if (!this.enablePinning) {
      return { valid: true, hostname, presentedFingerprint: '', expectedFingerprint: '' };
    }

    const pin = this.pins.get(hostname);
    if (!pin) {
      return {
        valid: false,
        hostname,
        presentedFingerprint: '',
        expectedFingerprint: '',
        error: 'No certificate pin configured for hostname',
      };
    }

    if (pin.expiryDate < new Date()) {
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
        return { valid: true, hostname, presentedFingerprint, expectedFingerprint: backup };
      }
    }

    return {
      valid: false,
      hostname,
      presentedFingerprint,
      expectedFingerprint: pin.sha256Fingerprint,
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
        return false;
      }

      const result = await this.validatePin(hostname, peerCert.raw);
      return result.valid;
    } catch (error) {
      return false;
    }
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
  }

  async revokePin(hostname: string): Promise<void> {
    const pin = this.pins.get(hostname);
    if (pin) {
      pin.isActive = false;
      await this.persistPin(pin);
      this.pins.delete(hostname);
    }
  }

  getConfiguredHosts(): string[] {
    return Array.from(this.pins.keys());
  }

  getPinInfo(hostname: string): PinnedCertificate | undefined {
    return this.pins.get(hostname);
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

export const certificatePinningService = new CertificatePinningService(
  process.env.ENABLE_CERT_PINNING !== 'false'
);