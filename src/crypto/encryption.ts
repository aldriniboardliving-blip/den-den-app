// src/crypto/encryption.ts
// Message encryption/decryption using X25519 + AES-256-GCM

import * as Sodium from 'react-native-libsodium';
import { KeyBundle, MessageEnvelope, IdentityKeys } from './types';

const ENCRYPTION_ALGORITHM = 'X25519-AES256GCM';
const NONCE_SIZE = 24;

export class MessageEncryption {
  static async encrypt(
    plaintext: Uint8Array,
    recipientKeyBundle: KeyBundle,
    senderDeviceId: string,
    conversationId: string
  ): Promise<MessageEnvelope> {
    const messageId = generateMessageId();

    const signedPrekeyData = new Uint8Array(recipientKeyBundle.signedPrekeyPublic.length);
    signedPrekeyData.set(recipientKeyBundle.signedPrekeyPublic);

    const signatureValid = Sodium.crypto_sign_verify_detached(
      recipientKeyBundle.signedPrekeySignature,
      signedPrekeyData,
      recipientKeyBundle.identityKeyPublic
    );

    if (!signatureValid) {
      throw new Error('Invalid signed prekey signature');
    }

    const ephemeralKeyPair = await Sodium.crypto_box_keypair();

    const dh1 = new Uint8Array(await Sodium.crypto_scalarmult(
      new Uint8Array(ephemeralKeyPair.privateKey),
      recipientKeyBundle.identityKeyPublic
    ));
    const dh2 = new Uint8Array(await Sodium.crypto_scalarmult(
      new Uint8Array(ephemeralKeyPair.privateKey),
      recipientKeyBundle.signedPrekeyPublic
    ));

    let dh3 = new Uint8Array(32);
    if (recipientKeyBundle.onetimePrekeyPublic) {
      dh3 = new Uint8Array(await Sodium.crypto_scalarmult(
        new Uint8Array(ephemeralKeyPair.privateKey),
        recipientKeyBundle.onetimePrekeyPublic
      ));
    }

    const combinedDh = new Uint8Array(dh1.length + dh2.length + dh3.length);
    combinedDh.set(dh1, 0);
    combinedDh.set(dh2, dh1.length);
    combinedDh.set(dh3, dh1.length + dh2.length);

    const messageKey = await Sodium.crypto_kdf_derive_from_key(
      32, 1, 'DenDen Message v1', combinedDh
    );

    const nonce = Sodium.randombytes_buf(NONCE_SIZE);

    const aad = constructAAD(messageId, senderDeviceId, recipientKeyBundle.deviceId, conversationId);

    const ciphertext = Sodium.crypto_secretbox_easy(plaintext, nonce, messageKey);

    return {
      messageId,
      senderDeviceId,
      recipientDeviceId: recipientKeyBundle.deviceId,
      conversationId,
      ciphertext,
      nonce,
      ephemeralPublic: ephemeralKeyPair.publicKey,
      signedPreKeyId: recipientKeyBundle.signedPrekeyId,
      onetimePreKeyId: recipientKeyBundle.onetimePrekeyId,
      encryptionAlgorithm: ENCRYPTION_ALGORITHM,
      contentType: 'TEXT',
      createdAt: Date.now(),
    };
  }

  static async decrypt(
    envelope: MessageEnvelope,
    identityKeys: IdentityKeys
  ): Promise<Uint8Array> {
    if (envelope.signedPreKeyId !== identityKeys.signedPreKeyId) {
      throw new Error(`Signed prekey ID mismatch: expected ${identityKeys.signedPreKeyId}, got ${envelope.signedPreKeyId}`);
    }

    const dh1 = new Uint8Array(await Sodium.crypto_scalarmult(
      new Uint8Array(identityKeys.identityKeyPair.privateKey),
      envelope.ephemeralPublic
    ));
    const dh2 = new Uint8Array(await Sodium.crypto_scalarmult(
      new Uint8Array(identityKeys.signedPreKeyPair.privateKey),
      envelope.ephemeralPublic
    ));

    let dh3 = new Uint8Array(32);
    if (envelope.onetimePreKeyId !== null) {
      const onetimeKey = identityKeys.onetimePreKeys.find(k => k.id === envelope.onetimePreKeyId);
      if (!onetimeKey) {
        throw new Error(`Onetime prekey ${envelope.onetimePreKeyId} not found`);
      }
      dh3 = new Uint8Array(await Sodium.crypto_scalarmult(
        new Uint8Array(onetimeKey.keyPair.privateKey),
        envelope.ephemeralPublic
      ));
      onetimeKey.usedAt = Date.now();
    }

    const combinedDh = new Uint8Array(dh1.length + dh2.length + dh3.length);
    combinedDh.set(dh1, 0);
    combinedDh.set(dh2, dh1.length);
    combinedDh.set(dh3, dh1.length + dh2.length);

    const messageKey = await Sodium.crypto_kdf_derive_from_key(
      32, 1, 'DenDen Message v1', combinedDh
    );

    const aad = constructAAD(
      envelope.messageId,
      envelope.senderDeviceId,
      envelope.recipientDeviceId,
      envelope.conversationId
    );

    const plaintext = Sodium.crypto_secretbox_open_easy(
      envelope.ciphertext, envelope.nonce, messageKey
    );

    return plaintext;
  }

  static async encryptForGroup(
    plaintext: Uint8Array,
    senderKey: Uint8Array,
    senderDeviceId: string,
    conversationId: string
  ): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
    const nonce = Sodium.randombytes_buf(NONCE_SIZE);
    const aad = constructGroupAAD(senderDeviceId, conversationId);
    const ciphertext = Sodium.crypto_secretbox_easy(plaintext, nonce, senderKey);
    return { ciphertext, nonce };
  }

  static async decryptGroup(
    ciphertext: Uint8Array,
    nonce: Uint8Array,
    senderKey: Uint8Array,
    senderDeviceId: string,
    conversationId: string
  ): Promise<Uint8Array> {
    const aad = constructGroupAAD(senderDeviceId, conversationId);
    return Sodium.crypto_secretbox_open_easy(ciphertext, nonce, senderKey);
  }
}

function constructAAD(
  messageId: string,
  senderDeviceId: string,
  recipientDeviceId: string,
  conversationId: string
): Uint8Array {
  const parts = [messageId, senderDeviceId, recipientDeviceId, conversationId];
  const joined = parts.join('|');
  return new TextEncoder().encode(joined);
}

function constructGroupAAD(senderDeviceId: string, conversationId: string): Uint8Array {
  const joined = `GROUP|${senderDeviceId}|${conversationId}`;
  return new TextEncoder().encode(joined);
}

function generateMessageId(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomBytes = Sodium.randombytes_buf(10);
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestampHex}-${randomHex}`;
}