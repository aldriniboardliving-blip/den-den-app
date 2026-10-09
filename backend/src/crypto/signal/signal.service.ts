import { Injectable, NotFoundException } from '@nestjs/common';
import { SignalStore } from './signal-store';
import {
  SignalProtocolAddress,
  SessionBuilder,
  SessionCipher,
} from 'libsignal-protocol-typescript';
import { DrizzleService } from '../../common/database/drizzle.service';
import { devices, deviceOneTimePreKeys, encryptionKeys } from '../../common/database/schema';
import { eq, and } from 'drizzle-orm';

export interface EncryptedMessage {
  type: number;
  body: string; // base64
}

export interface DecryptedMessage {
  body: string;
  type: number;
}

@Injectable()
export class SignalService {
  constructor(
    private signalStore: SignalStore,
    private drizzle: DrizzleService,
  ) {}

  async createSession(
    senderDeviceId: string,
    recipientDeviceId: string,
    recipientPreKeyBundle: any,
  ): Promise<void> {
    const senderAddress = new SignalProtocolAddress(senderDeviceId, parseInt(senderDeviceId.slice(-8), 16));
    const recipientAddress = new SignalProtocolAddress(recipientDeviceId, parseInt(recipientDeviceId.slice(-8), 16));

    const sessionBuilder = new SessionBuilder(this.signalStore, recipientAddress);
    await sessionBuilder.processPreKey(recipientPreKeyBundle);
  }

  async encryptMessage(
    senderDeviceId: string,
    recipientDeviceId: string,
    plaintext: string,
  ): Promise<EncryptedMessage> {
    const senderAddress = new SignalProtocolAddress(senderDeviceId, parseInt(senderDeviceId.slice(-8), 16));
    const recipientAddress = new SignalProtocolAddress(recipientDeviceId, parseInt(recipientDeviceId.slice(-8), 16));

    const sessionCipher = new SessionCipher(this.signalStore, recipientAddress);
    const plaintextBuffer = new TextEncoder().encode(plaintext);
    const ciphertext = await sessionCipher.encrypt(plaintextBuffer.buffer.slice(plaintextBuffer.byteOffset, plaintextBuffer.byteOffset + plaintextBuffer.byteLength) as ArrayBuffer);

    const body = ciphertext.body as string | ArrayBuffer;
    const bodyBase64 = typeof body === 'string' ? body : Buffer.from(body).toString('base64');

    return {
      type: ciphertext.type,
      body: bodyBase64,
    };
  }

  async decryptMessage(
    recipientDeviceId: string,
    senderDeviceId: string,
    encryptedMessage: EncryptedMessage,
  ): Promise<DecryptedMessage> {
    const senderAddress = new SignalProtocolAddress(senderDeviceId, parseInt(senderDeviceId.slice(-8), 16));
    const recipientAddress = new SignalProtocolAddress(recipientDeviceId, parseInt(recipientDeviceId.slice(-8), 16));

    const sessionCipher = new SessionCipher(this.signalStore, senderAddress);
    const messageBuffer = Buffer.from(encryptedMessage.body, 'base64');
    const plaintext = await sessionCipher.decryptWhisperMessage(messageBuffer.buffer.slice(messageBuffer.byteOffset, messageBuffer.byteOffset + messageBuffer.byteLength) as ArrayBuffer);

    return {
      body: new TextDecoder().decode(plaintext),
      type: encryptedMessage.type,
    };
  }

  async getPreKeyBundle(deviceId: string): Promise<any | null> {
    return this.signalStore.getPreKeyBundle(deviceId);
  }

  async consumeOneTimePreKey(deviceId: string, keyId: number): Promise<void> {
    await this.drizzle.client
      .update(deviceOneTimePreKeys)
      .set({ usedAt: new Date() })
      .where(and(eq(deviceOneTimePreKeys.deviceId, deviceId), eq(deviceOneTimePreKeys.keyId, keyId)));
  }

  async rotateSignedPreKey(
    deviceId: string,
    data: { publicKey: string; signature: string; keyId: number },
  ): Promise<void> {
    await this.drizzle.client
      .update(devices)
      .set({
        signedPreKeyPublic: data.publicKey,
        signedPreKeySignature: data.signature,
        signedPreKeyId: data.keyId,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, deviceId));

    await this.drizzle.client
      .insert(encryptionKeys)
      .values({
        id: `signed_prekey_${data.keyId}`,
        deviceId,
        keyType: 'SIGNED_PREKEY',
        keyId: data.keyId,
        publicKey: data.publicKey,
        privateKeyEncrypted: null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: encryptionKeys.id,
        set: {
          publicKey: data.publicKey,
          privateKeyEncrypted: null,
          updatedAt: new Date(),
        },
      });
  }

  async addOneTimePreKeys(
    deviceId: string,
    keys: Array<{ keyId: number; publicKey: string; privateKey: string }>,
  ): Promise<void> {
    await this.drizzle.client.insert(deviceOneTimePreKeys).values(
      keys.map((k) => ({
        deviceId,
        keyId: k.keyId,
        publicKey: k.publicKey,
      })),
    );

    await this.drizzle.client.insert(encryptionKeys).values(
      keys.map((k) => ({
        id: `prekey_${k.keyId}`,
        deviceId,
        keyType: 'ONETIME_PREKEY',
        keyId: k.keyId,
        publicKey: k.publicKey,
        privateKeyEncrypted: k.privateKey,
        isActive: true,
      })),
    );
  }

  async hasSession(senderDeviceId: string, recipientDeviceId: string): Promise<boolean> {
    const recipientAddress = new SignalProtocolAddress(
      recipientDeviceId,
      parseInt(recipientDeviceId.slice(-8), 16),
    );
    const session = await this.signalStore.loadSession(recipientAddress.toString());
    return !!session;
  }

  async deleteSession(senderDeviceId: string, recipientDeviceId: string): Promise<void> {
    const recipientAddress = new SignalProtocolAddress(
      recipientDeviceId,
      parseInt(recipientDeviceId.slice(-8), 16),
    );
    await this.signalStore.removeSignedPreKey(recipientAddress.toString());
  }
}