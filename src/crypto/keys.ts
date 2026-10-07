// src/crypto/keys.ts
// Key management: generation, rotation, storage

import * as Sodium from 'react-native-libsodium';
import { keystore } from './keystore';
import { IdentityKeys, OnetimePreKey, KeyBundle, SecureKeyPair, KeyPair } from './types';

export class KeyManager {
  private static instance: KeyManager;
  private currentIdentityKeys: IdentityKeys | null = null;
  
  static getInstance(): KeyManager {
    if (!KeyManager.instance) {
      KeyManager.instance = new KeyManager();
    }
    return KeyManager.instance;
  }
  
  // Initialize keys for new device
  async initializeDeviceKeys(): Promise<IdentityKeys> {
    // Generate identity key pair (X25519)
    const identityKeyPair = await Sodium.crypto_box_keypair();
    
    // Generate signed prekey pair (X25519)
    const signedPreKeyPair = await Sodium.crypto_box_keypair();
    
    // Generate Ed25519 signing key for signing the prekey
    const signKeyPair = await Sodium.crypto_sign_keypair();
    
    // Create signed prekey data to sign
    const signedPrekeyData = new Uint8Array(signedPreKeyPair.publicKey.length);
    signedPrekeyData.set(signedPreKeyPair.publicKey);
    
    const signedPreKeySignature = await Sodium.crypto_sign_detached(
      signedPrekeyData,
      signKeyPair.privateKey
    );
    
    // Generate onetime prekeys
    const onetimePreKeys = await keystore.generateOnetimePreKeys(100);
    
    const identityKeys: IdentityKeys = {
      identityKeyPair: {
        publicKey: identityKeyPair.publicKey,
        privateKey: identityKeyPair.privateKey,
        keyType: identityKeyPair.keyType,
      },
      signedPreKeyPair: {
        publicKey: signedPreKeyPair.publicKey,
        privateKey: signedPreKeyPair.privateKey,
        keyType: signedPreKeyPair.keyType,
      },
      signedPreKeySignature,
      signedPreKeyId: 1,
      signedPreKeyCreatedAt: Date.now(),
      onetimePreKeys,
    };
    
    this.currentIdentityKeys = identityKeys;
    return identityKeys;
  }
  
  // Get current identity keys
  getIdentityKeys(): IdentityKeys | null {
    return this.currentIdentityKeys;
  }
  
  // Rotate signed prekey (weekly)
  async rotateSignedPreKey(): Promise<{ keyPair: KeyPair; signature: Uint8Array; keyId: number }> {
    const newKeyPair = await Sodium.crypto_box_keypair();
    
    // For signing, we need an Ed25519 key
    // In production, this would come from the identity key's Ed25519 component
    const signKeyPair = await Sodium.crypto_sign_keypair();
    
    const signature = await Sodium.crypto_sign_detached(
      newKeyPair.publicKey,
      signKeyPair.privateKey
    );
    
    const identityKeys = this.currentIdentityKeys;
    if (!identityKeys) throw new Error('Identity keys not initialized');
    
    const newKeyId = (identityKeys.signedPreKeyId || 0) + 1;
    
    // Update stored keys
    identityKeys.signedPreKeyPair = {
      publicKey: newKeyPair.publicKey,
      privateKey: newKeyPair.privateKey,
      keyType: newKeyPair.keyType,
    };
    identityKeys.signedPreKeySignature = signature;
    identityKeys.signedPreKeyId = newKeyId;
    identityKeys.signedPreKeyCreatedAt = Date.now();
    
    return { keyPair: newKeyPair, signature, keyId: newKeyId };
  }
  
  // Get next available onetime prekey
  getNextOnetimePreKey(): OnetimePreKey | null {
    const identityKeys = this.currentIdentityKeys;
    if (!identityKeys) return null;
    
    const unused = identityKeys.onetimePreKeys.find(k => k.usedAt === null);
    if (!unused) return null;
    
    unused.usedAt = Date.now();
    return unused;
  }
  
  // Check if onetime prekeys need replenishment
  needsPrekeyReplenishment(threshold: number = 20): boolean {
    const identityKeys = this.currentIdentityKeys;
    if (!identityKeys) return true;
    
    const unused = identityKeys.onetimePreKeys.filter(k => k.usedAt === null).length;
    return unused < threshold;
  }
  
  // Replenish onetime prekeys
  async replenishOnetimePreKeys(count: number = 100): Promise<OnetimePreKey[]> {
    const identityKeys = this.currentIdentityKeys;
    if (!identityKeys) throw new Error('Identity keys not initialized');
    
    const newKeys = await keystore.generateOnetimePreKeys(count);
    
    // Remove used keys, keep some recent for in-flight messages
    const recentUsed = identityKeys.onetimePreKeys
      .filter(k => k.usedAt !== null)
      .slice(-10);
    
    identityKeys.onetimePreKeys = [...recentUsed, ...newKeys];
    
    return newKeys;
  }
  
  // Get key bundle for sharing with others
  getKeyBundle(deviceId: string): KeyBundle {
    const identityKeys = this.currentIdentityKeys;
    if (!identityKeys) throw new Error('Identity keys not initialized');
    
    const onetimePreKey = this.getNextOnetimePreKey();
    
    return {
      deviceId,
      identityKeyPublic: identityKeys.identityKeyPair.publicKey,
      signedPrekeyPublic: identityKeys.signedPreKeyPair.publicKey,
      signedPrekeySignature: identityKeys.signedPreKeySignature,
      signedPrekeyId: identityKeys.signedPreKeyId,
      onetimePrekeyPublic: onetimePreKey?.keyPair.publicKey || null,
      onetimePrekeyId: onetimePreKey?.id || null,
    };
  }
  
  // Generate sender key for group chats
  async generateSenderKey(): Promise<Uint8Array> {
    return Sodium.randombytes_buf(32);
  }
  
  // Encrypt sender key for a recipient
  async encryptSenderKey(
    senderKey: Uint8Array,
    recipientKeyBundle: KeyBundle,
    senderIdentityKeyPair: KeyPair
  ): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array; ephemeralPublic: Uint8Array }> {
    // Use X25519 + AES-256-GCM (crypto_box_easy)
    const nonce = Sodium.randombytes_buf(24);
    
    // Derive shared secret using X25519
    const ephemeralKeyPair = await Sodium.crypto_box_keypair();
    const sharedSecret = await Sodium.crypto_scalarmult(
      ephemeralKeyPair.privateKey,
      recipientKeyBundle.identityKeyPublic
    );
    
    // Derive encryption key
    const key = await Sodium.crypto_kdf_derive_from_key(
      32,
      1,
      'DenDen SenderKey v1',
      sharedSecret
    );
    
    // Encrypt sender key with AES-256-GCM (crypto_secretbox_easy)
    const ciphertext = Sodium.crypto_secretbox_easy(senderKey, nonce, key);
    
    return { ciphertext, nonce, ephemeralPublic: ephemeralKeyPair.publicKey };
  }
  
  // Decrypt sender key
  async decryptSenderKey(
    envelope: { ciphertext: Uint8Array; nonce: Uint8Array; ephemeralPublic: Uint8Array },
    identityKeys: IdentityKeys
  ): Promise<Uint8Array> {
    // Derive shared secret
    const sharedSecret = await Sodium.crypto_scalarmult(
      identityKeys.identityKeyPair.privateKey,
      envelope.ephemeralPublic
    );
    
    // Derive key
    const key = await Sodium.crypto_kdf_derive_from_key(
      32,
      1,
      'DenDen SenderKey v1',
      sharedSecret
    );
    
    // Decrypt
    const plaintext = Sodium.crypto_secretbox_open_easy(
      envelope.ciphertext,
      envelope.nonce,
      key
    );
    
    return plaintext;
  }
}

export const keyManager = KeyManager.getInstance();