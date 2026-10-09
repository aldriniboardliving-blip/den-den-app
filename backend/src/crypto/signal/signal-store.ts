import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../common/database/drizzle.service';
import { encryptionKeys, devices } from '../../common/database/schema';
import { eq, and } from 'drizzle-orm';
import { StorageType, KeyPairType, SignalProtocolAddressType, Direction, SessionRecordType } from 'libsignal-protocol-typescript';
import { createId } from '../../common/utils/id';

@Injectable()
export class SignalStore implements StorageType {
  constructor(private drizzle: DrizzleService) {}

  async getIdentityKeyPair(): Promise<KeyPairType | undefined> {
    const key = await this.getKey('identity_key');
    if (!key) return undefined;
    return {
      pubKey: key.publicKey,
      privKey: key.privateKey,
    };
  }

  async getLocalRegistrationId(): Promise<number | undefined> {
    const regId = await this.getKey('registration_id');
    if (!regId) return undefined;
    return regId.value as number;
  }

  async isTrustedIdentity(
    identifier: string,
    identityKey: ArrayBuffer,
    direction: Direction,
  ): Promise<boolean> {
    const keyName = `identity_${identifier}`;
    const stored = await this.getKey(keyName);
    if (!stored) return true;
    return Buffer.from(stored.publicKey).equals(Buffer.from(identityKey));
  }

  async saveIdentity(
    encodedAddress: string,
    publicKey: ArrayBuffer,
    nonblockingApproval?: boolean,
  ): Promise<boolean> {
    const keyName = `identity_${encodedAddress}`;
    await this.setKey(keyName, {
      keyType: 'REMOTE_IDENTITY',
      publicKey: new Uint8Array(publicKey),
      createdAt: new Date(),
    });
    return true;
  }

  async loadPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const key = await this.getKey(`prekey_${keyId}`);
    if (!key) return undefined;
    return {
      pubKey: key.publicKey,
      privKey: key.privateKey,
    };
  }

  async storePreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await this.setKey(`prekey_${keyId}`, {
      keyId: Number(keyId),
      publicKey: new Uint8Array(keyPair.pubKey),
      privateKey: new Uint8Array(keyPair.privKey),
      keyType: 'PREKEY',
    });
  }

  async removePreKey(keyId: number | string): Promise<void> {
    await this.deleteKey(`prekey_${keyId}`);
  }

  async loadSignedPreKey(keyId: number | string): Promise<KeyPairType | undefined> {
    const key = await this.getKey(`signed_prekey_${keyId}`);
    if (!key) return undefined;
    return {
      pubKey: key.publicKey,
      privKey: key.privateKey,
    };
  }

  async storeSignedPreKey(keyId: number | string, keyPair: KeyPairType): Promise<void> {
    await this.setKey(`signed_prekey_${keyId}`, {
      keyId: Number(keyId),
      publicKey: new Uint8Array(keyPair.pubKey),
      privateKey: new Uint8Array(keyPair.privKey),
      keyType: 'SIGNED_PREKEY',
    });
  }

  async removeSignedPreKey(keyId: number | string): Promise<void> {
    await this.deleteKey(`signed_prekey_${keyId}`);
  }

  async loadSession(encodedAddress: string): Promise<SessionRecordType | undefined> {
    const session = await this.getKey(`session_${encodedAddress}`);
    if (!session) return undefined;
    return session.record;
  }

  async storeSession(encodedAddress: string, record: SessionRecordType): Promise<void> {
    await this.setKey(`session_${encodedAddress}`, {
      record,
      keyType: 'SESSION',
    });
  }

  async getPreKeyBundle(deviceId: string): Promise<any> {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });
    if (!device) return null;

    const preKeys = await this.drizzle.client.query.encryptionKeys.findMany({
      where: and(
        eq(encryptionKeys.deviceId, deviceId),
        eq(encryptionKeys.keyType, 'ONETIME_PREKEY'),
        eq(encryptionKeys.isActive, true),
      ),
      limit: 1,
    });

    const identityKey = Buffer.from(device.identityKeyPublic, 'base64');
    const signedPreKeyPublic = Buffer.from(device.signedPreKeyPublic, 'base64');
    const signedPreKeySignature = Buffer.from(device.signedPreKeySignature, 'base64');

    return {
      registrationId: parseInt(deviceId.slice(-8), 16),
      deviceId: parseInt(deviceId.slice(-8), 16),
      identityKey,
      signedPreKey: {
        keyId: device.signedPreKeyId,
        publicKey: signedPreKeyPublic,
        signature: signedPreKeySignature,
      },
      preKey: preKeys[0]
        ? {
            keyId: preKeys[0].keyId!,
            publicKey: Buffer.from(preKeys[0].publicKey!, 'base64'),
          }
        : null,
    };
  }

  private async getKey(keyName: string): Promise<any> {
    const key = await this.drizzle.client.query.encryptionKeys.findFirst({
      where: and(eq(encryptionKeys.id, keyName), eq(encryptionKeys.isActive, true)),
    });
    return key;
  }

  private async setKey(keyName: string, data: any): Promise<void> {
    await this.drizzle.client
      .insert(encryptionKeys)
      .values({
        id: keyName,
        deviceId: data.deviceId || 'system',
        keyType: data.keyType,
        keyId: data.keyId,
        publicKey: data.publicKey ? Buffer.from(data.publicKey).toString('base64') : null,
        privateKeyEncrypted: data.privateKey ? Buffer.from(data.privateKey).toString('base64') : null,
        signature: data.signature ? Buffer.from(data.signature).toString('base64') : null,
        isActive: true,
        record: data.record || null,
      })
      .onConflictDoUpdate({
        target: encryptionKeys.id,
        set: {
          keyType: data.keyType,
          keyId: data.keyId,
          publicKey: data.publicKey ? Buffer.from(data.publicKey).toString('base64') : null,
          privateKeyEncrypted: data.privateKey ? Buffer.from(data.privateKey).toString('base64') : null,
          signature: data.signature ? Buffer.from(data.signature).toString('base64') : null,
          record: data.record || null,
          updatedAt: new Date(),
        },
      });
  }

  private async deleteKey(keyName: string): Promise<void> {
    await this.drizzle.client
      .update(encryptionKeys)
      .set({ isActive: false, usedAt: new Date() })
      .where(eq(encryptionKeys.id, keyName));
  }
}