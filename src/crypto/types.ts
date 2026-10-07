// src/crypto/types.ts

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyType: string;
}

export interface SecureKeyPair {
  publicKey: Uint8Array;
  // Private key never leaves secure hardware
  // Reference/handle to secure element
  secureRef: SecureKeyRef;
}

export interface SecureKeyRef {
  type: 'ios_secure_enclave' | 'android_keystore' | 'web_crypto';
  identifier: string;
}

export interface IdentityKeys {
  identityKeyPair: KeyPair;
  signedPreKeyPair: KeyPair;
  signedPreKeySignature: Uint8Array;
  signedPreKeyId: number;
  signedPreKeyCreatedAt: number;
  onetimePreKeys: OnetimePreKey[];
}

export interface OnetimePreKey {
  id: number;
  keyPair: KeyPair;
  usedAt: number | null;
}

export interface KeyBundle {
  deviceId: string;
  identityKeyPublic: Uint8Array;
  signedPrekeyPublic: Uint8Array;
  signedPrekeySignature: Uint8Array;
  signedPrekeyId: number;
  onetimePrekeyPublic: Uint8Array | null;
  onetimePrekeyId: number | null;
}

export interface EncryptionResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublic: Uint8Array;
  signedPreKeyId: number;
  onetimePreKeyId: number | null;
}

export interface DecryptionResult {
  plaintext: Uint8Array;
}

export interface MessageEnvelope {
  messageId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  conversationId: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  ephemeralPublic: Uint8Array;
  signedPreKeyId: number;
  onetimePreKeyId: number | null;
  encryptionAlgorithm: string;
  contentType: string;
  createdAt: number;
}

export interface BackupEncryptionParams {
  algorithm: 'AES-256-GCM';
  kdf: 'ARGON2ID';
  memoryKib: number;
  iterations: number;
  parallelism: number;
  salt: Uint8Array;
  nonce: Uint8Array;
}

export interface SafetyNumberData {
  number: string;
  qrCodeData: string;
}