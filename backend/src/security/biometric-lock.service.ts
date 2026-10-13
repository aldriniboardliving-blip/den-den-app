import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { devices, encryptionKeys } from '../common/database/schema';
import { eq, and } from 'drizzle-orm';
import { createId } from '../common/utils/id';
import * as crypto from 'crypto';

export interface BiometricCredential {
  id: string;
  deviceId: string;
  credentialId: string;
  publicKey: string;
  signature: string;
  signCount: number;
  transports: string[];
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
}

export interface BiometricAuthRequest {
  deviceId: string;
  challenge: string;
  credentialId: string;
  signature: string;
  authenticatorData: string;
  clientDataJSON: string;
}

export interface BiometricAuthResult {
  success: boolean;
  credentialId?: string;
  signCount?: number;
  error?: string;
}

export interface AppLockState {
  deviceId: string;
  locked: boolean;
  lastUnlockAt: Date | null;
  failedAttempts: number;
  lockoutUntil: Date | null;
  requireBiometric: boolean;
}

@Injectable()
export class BiometricLockService {
  private readonly logger = new Logger(BiometricLockService.name);
  private readonly maxFailedAttempts = 5;
  private readonly lockoutDurationMs = 30 * 60 * 1000;
  private readonly requireBiometricForSensitive = true;

  constructor(
    private config: ConfigService,
    private drizzle: DrizzleService,
  ) {}

  async registerBiometric(
    deviceId: string,
    credential: Omit<BiometricCredential, 'id' | 'createdAt' | 'lastUsedAt' | 'isActive'>,
  ): Promise<BiometricCredential> {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });
    if (!device) throw new Error('Device not found');

    const bioCredential: BiometricCredential = {
      ...credential,
      id: createId(),
      createdAt: new Date(),
      lastUsedAt: new Date(),
      isActive: true,
    };

    await this.drizzle.client
      .insert(encryptionKeys)
      .values({
        id: `biometric_${bioCredential.credentialId}`,
        deviceId,
        keyType: 'BIOMETRIC_CREDENTIAL',
        publicKey: JSON.stringify(bioCredential),
        isActive: true,
      });

    await this.drizzle.client
      .update(devices)
      .set({ 
        updatedAt: new Date() 
      })
      .where(eq(devices.id, deviceId));

    this.logger.log(`Biometric credential registered for device ${deviceId}`);
    return bioCredential;
  }

  async authenticate(request: BiometricAuthRequest): Promise<BiometricAuthResult> {
    const lockState = await this.getLockState(request.deviceId);
    
    if (lockState.locked) {
      if (lockState.lockoutUntil && lockState.lockoutUntil > new Date()) {
        return {
          success: false,
          error: `Device locked. Try again in ${Math.ceil((lockState.lockoutUntil.getTime() - Date.now()) / 60000)} minutes`,
        };
      } else {
        await this.resetLockout(request.deviceId);
      }
    }

    const stored = await this.getCredential(request.deviceId, request.credentialId);
    if (!stored) {
      await this.recordFailedAttempt(request.deviceId);
      return { success: false, error: 'Credential not found' };
    }

    if (!stored.isActive) {
      return { success: false, error: 'Credential disabled' };
    }

    const expectedChallenge = crypto.createHash('sha256').update(request.challenge).digest('hex');
    const clientData = JSON.parse(Buffer.from(request.clientDataJSON, 'base64').toString());
    
    if (clientData.challenge !== expectedChallenge) {
      await this.recordFailedAttempt(request.deviceId);
      return { success: false, error: 'Invalid challenge' };
    }

    if (clientData.type !== 'webauthn.get') {
      await this.recordFailedAttempt(request.deviceId);
      return { success: false, error: 'Invalid client data type' };
    }

    const verified = await this.verifySignature(
      stored.publicKey,
      request.authenticatorData,
      request.clientDataJSON,
      request.signature,
    );

    if (!verified) {
      await this.recordFailedAttempt(request.deviceId);
      return { success: false, error: 'Invalid signature' };
    }

    if (request.signature !== stored.signature) {
      await this.recordFailedAttempt(request.deviceId);
      return { success: false, error: 'Signature mismatch' };
    }

    stored.signCount++;
    stored.lastUsedAt = new Date();
    await this.updateCredential(request.deviceId, request.credentialId, stored);

    await this.resetFailedAttempts(request.deviceId);
    await this.setUnlocked(request.deviceId);

    return {
      success: true,
      credentialId: stored.credentialId,
      signCount: stored.signCount,
    };
  }

  async lockDevice(deviceId: string): Promise<void> {
    const lockKey = `applock_${deviceId}`;
    await this.drizzle.client
      .insert(encryptionKeys)
      .values({
        id: lockKey,
        deviceId,
        keyType: 'APP_LOCK_STATE',
        publicKey: JSON.stringify({
          deviceId,
          locked: true,
          lastUnlockAt: null,
          failedAttempts: 0,
          lockoutUntil: null,
          requireBiometric: true,
        }),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: encryptionKeys.id,
        set: {
          publicKey: JSON.stringify({
            deviceId,
            locked: true,
            lastUnlockAt: null,
            failedAttempts: 0,
            lockoutUntil: null,
            requireBiometric: true,
          }),
          updatedAt: new Date(),
        },
      });

    this.logger.log(`Device ${deviceId} locked`);
  }

  async unlockDevice(deviceId: string): Promise<void> {
    const lockKey = `applock_${deviceId}`;
    await this.drizzle.client
      .update(encryptionKeys)
      .set({
        publicKey: JSON.stringify({
          deviceId,
          locked: false,
          lastUnlockAt: new Date(),
          failedAttempts: 0,
          lockoutUntil: null,
          requireBiometric: true,
        }),
        updatedAt: new Date(),
      })
      .where(eq(encryptionKeys.id, lockKey));

    this.logger.log(`Device ${deviceId} unlocked`);
  }

  async getLockState(deviceId: string): Promise<AppLockState> {
    const lockKey = `applock_${deviceId}`;
    const stored = await this.drizzle.client.query.encryptionKeys.findFirst({
      where: and(eq(encryptionKeys.id, lockKey), eq(encryptionKeys.isActive, true)),
    });

    if (!stored || !stored.publicKey) {
      return {
        deviceId,
        locked: false,
        lastUnlockAt: null,
        failedAttempts: 0,
        lockoutUntil: null,
        requireBiometric: true,
      };
    }

    return JSON.parse(stored.publicKey);
  }

  async setRequireBiometric(deviceId: string, require: boolean): Promise<void> {
    const state = await this.getLockState(deviceId);
    state.requireBiometric = require;
    
    const lockKey = `applock_${deviceId}`;
    await this.drizzle.client
      .update(encryptionKeys)
      .set({
        publicKey: JSON.stringify(state),
        updatedAt: new Date(),
      })
      .where(eq(encryptionKeys.id, lockKey));
  }

  async removeBiometric(deviceId: string, credentialId: string): Promise<void> {
    await this.drizzle.client
      .update(encryptionKeys)
      .set({ isActive: false, usedAt: new Date() })
      .where(and(
        eq(encryptionKeys.deviceId, deviceId),
        eq(encryptionKeys.keyType, 'BIOMETRIC_CREDENTIAL'),
        eq(encryptionKeys.id, `biometric_${credentialId}`),
      ));

    this.logger.log(`Biometric credential ${credentialId} removed from device ${deviceId}`);
  }

  async listBiometrics(deviceId: string): Promise<BiometricCredential[]> {
    const credentials = await this.drizzle.client.query.encryptionKeys.findMany({
      where: and(
        eq(encryptionKeys.deviceId, deviceId),
        eq(encryptionKeys.keyType, 'BIOMETRIC_CREDENTIAL'),
        eq(encryptionKeys.isActive, true),
      ),
    });

    return credentials
      .map(c => JSON.parse(c.publicKey || '{}'))
      .filter(c => c.credentialId);
  }

  private async getCredential(deviceId: string, credentialId: string): Promise<BiometricCredential | null> {
    const stored = await this.drizzle.client.query.encryptionKeys.findFirst({
      where: and(
        eq(encryptionKeys.deviceId, deviceId),
        eq(encryptionKeys.keyType, 'BIOMETRIC_CREDENTIAL'),
        eq(encryptionKeys.id, `biometric_${credentialId}`),
        eq(encryptionKeys.isActive, true),
      ),
    });

    if (!stored || !stored.publicKey) return null;
    return JSON.parse(stored.publicKey);
  }

  private async updateCredential(deviceId: string, credentialId: string, credential: BiometricCredential): Promise<void> {
    await this.drizzle.client
      .update(encryptionKeys)
      .set({
        publicKey: JSON.stringify(credential),
        updatedAt: new Date(),
      })
      .where(and(
        eq(encryptionKeys.deviceId, deviceId),
        eq(encryptionKeys.keyType, 'BIOMETRIC_CREDENTIAL'),
        eq(encryptionKeys.id, `biometric_${credentialId}`),
      ));
  }

  private async recordFailedAttempt(deviceId: string): Promise<void> {
    const state = await this.getLockState(deviceId);
    state.failedAttempts++;

    if (state.failedAttempts >= this.maxFailedAttempts) {
      state.locked = true;
      state.lockoutUntil = new Date(Date.now() + this.lockoutDurationMs);
      this.logger.warn(`Device ${deviceId} locked out after ${state.failedAttempts} failed attempts`);
    }

    const lockKey = `applock_${deviceId}`;
    await this.drizzle.client
      .update(encryptionKeys)
      .set({
        publicKey: JSON.stringify(state),
        updatedAt: new Date(),
      })
      .where(eq(encryptionKeys.id, lockKey));
  }

  private async resetFailedAttempts(deviceId: string): Promise<void> {
    const state = await this.getLockState(deviceId);
    state.failedAttempts = 0;
    state.lockoutUntil = null;

    const lockKey = `applock_${deviceId}`;
    await this.drizzle.client
      .update(encryptionKeys)
      .set({
        publicKey: JSON.stringify(state),
        updatedAt: new Date(),
      })
      .where(eq(encryptionKeys.id, lockKey));
  }

  private async resetLockout(deviceId: string): Promise<void> {
    const state = await this.getLockState(deviceId);
    state.locked = false;
    state.lockoutUntil = null;
    state.failedAttempts = 0;

    const lockKey = `applock_${deviceId}`;
    await this.drizzle.client
      .update(encryptionKeys)
      .set({
        publicKey: JSON.stringify(state),
        updatedAt: new Date(),
      })
      .where(eq(encryptionKeys.id, lockKey));
  }

  private async setUnlocked(deviceId: string): Promise<void> {
    const state = await this.getLockState(deviceId);
    state.locked = false;
    state.lastUnlockAt = new Date();
    state.failedAttempts = 0;

    const lockKey = `applock_${deviceId}`;
    await this.drizzle.client
      .update(encryptionKeys)
      .set({
        publicKey: JSON.stringify(state),
        updatedAt: new Date(),
      })
      .where(eq(encryptionKeys.id, lockKey));
  }

  private async verifySignature(
    publicKeyPem: string,
    authenticatorData: string,
    clientDataJSON: string,
    signature: string,
  ): Promise<boolean> {
    try {
      const publicKey = crypto.createPublicKey(publicKeyPem);
      const data = Buffer.concat([
        Buffer.from(authenticatorData, 'base64'),
        crypto.createHash('sha256').update(clientDataJSON).digest(),
      ]);
      
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }
}