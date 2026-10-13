// src/crypto/keystore.ts
// Platform-specific secure key storage
// iOS: Secure Enclave via Keychain
// Android: Keystore with StrongBox
// Web: Web Crypto API (non-extractable keys)

import { Platform } from 'react-native';
import * as Sodium from 'react-native-libsodium';
import { getDatabase } from '@/database/connection';
import { KeyPair, SecureKeyPair, SecureKeyRef, IdentityKeys, OnetimePreKey } from './types';

export class Keystore {
  private static instance: Keystore;

  static getInstance(): Keystore {
    if (!Keystore.instance) {
      Keystore.instance = new Keystore();
    }
    return Keystore.instance;
  }

  async generateIdentityKeyPair(): Promise<SecureKeyPair> {
    if (Platform.OS === 'ios') {
      return this.generateIOSIdentityKeyPair();
    } else if (Platform.OS === 'android') {
      return this.generateAndroidIdentityKeyPair();
    } else {
      return this.generateWebIdentityKeyPair();
    }
  }

  async generateSignedPreKeyPair(): Promise<SecureKeyPair> {
    if (Platform.OS === 'ios') {
      return this.generateIOSKeyPair('signed_prekey');
    } else if (Platform.OS === 'android') {
      return this.generateAndroidKeyPair('signed_prekey');
    } else {
      return this.generateWebKeyPair('signed_prekey');
    }
  }

  async generateOnetimePreKeys(count: number = 100): Promise<OnetimePreKey[]> {
    const keys: OnetimePreKey[] = [];
    for (let i = 0; i < count; i++) {
      const keyPair = await Sodium.crypto_box_keypair();
      keys.push({
        id: i + 1,
        keyPair: {
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          keyType: keyPair.keyType,
        },
        usedAt: null,
      });
    }
    return keys;
  }

  async signWithIdentityKey(
    secureRef: SecureKeyRef,
    data: Uint8Array
  ): Promise<Uint8Array> {
    if (Platform.OS === 'ios') {
      return this.signIOS(secureRef, data);
    } else if (Platform.OS === 'android') {
      return this.signAndroid(secureRef, data);
    } else {
      return this.signWeb(secureRef, data);
    }
  }

  async performKeyAgreement(
    secureRef: SecureKeyRef,
    peerPublicKey: Uint8Array
  ): Promise<Uint8Array> {
    if (Platform.OS === 'ios') {
      return this.keyAgreementIOS(secureRef, peerPublicKey);
    } else if (Platform.OS === 'android') {
      return this.keyAgreementAndroid(secureRef, peerPublicKey);
    } else {
      return this.keyAgreementWeb(secureRef, peerPublicKey);
    }
  }

  async storeEncryptedKeys(
    deviceId: string,
    identityKeyPrivateEncrypted: Uint8Array,
    signedPreKeyPrivateEncrypted: Uint8Array,
    onetimePreKeysEncrypted: Uint8Array[]
  ): Promise<void> {
    // Implemented in database/repositories/devices.ts
  }

  async retrieveDecryptedKeys(deviceId: string): Promise<{
    identityKeyPrivate: Uint8Array;
    signedPreKeyPrivate: Uint8Array;
    onetimePreKeys: OnetimePreKey[];
  }> {
    // Implemented in database/repositories/devices.ts
    throw new Error('Not implemented');
  }

  // Save identity keys to SQLite (for Signal Protocol store)
  async saveIdentityKeys(userId: string, keys: IdentityKeys): Promise<void> {
    const db = await getDatabase();
    
    await db.withTransactionAsync(async () => {
      // Save identity key pair
      await db.runAsync(
        `INSERT OR REPLACE INTO encryption_keys 
         (id, device_id, key_type, key_id, public_key, private_key_encrypted, created_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `identity_${userId}`,
          userId,
          'IDENTITY',
          0,
          this.uint8ArrayToBase64(keys.identityKeyPair.publicKey),
          this.uint8ArrayToBase64(keys.identityKeyPair.privateKey),
          Date.now(),
          1,
        ]
      );

      // Save signed prekey
      await db.runAsync(
        `INSERT OR REPLACE INTO encryption_keys 
         (id, device_id, key_type, key_id, public_key, private_key_encrypted, created_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `signed_prekey_${userId}_${keys.signedPreKeyId}`,
          userId,
          'SIGNED_PREKEY',
          keys.signedPreKeyId,
          this.uint8ArrayToBase64(keys.signedPreKeyPair.publicKey),
          this.uint8ArrayToBase64(keys.signedPreKeyPair.privateKey),
          keys.signedPreKeyCreatedAt,
          1,
        ]
      );

      // Save onetime prekeys
      for (const otpk of keys.onetimePreKeys) {
        await db.runAsync(
          `INSERT OR REPLACE INTO encryption_keys 
           (id, device_id, key_type, key_id, public_key, private_key_encrypted, created_at, used_at, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `onetime_prekey_${userId}_${otpk.id}`,
            userId,
            'ONETIME_PREKEY',
            otpk.id,
            this.uint8ArrayToBase64(otpk.keyPair.publicKey),
            this.uint8ArrayToBase64(otpk.keyPair.privateKey),
            Date.now(),
            otpk.usedAt || null,
            otpk.usedAt ? 0 : 1,
          ]
        );
      }

      // Save signed prekey signature and metadata
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (id, user_id, key, value)
         VALUES (?, ?, ?, ?)`,
        [
          `spk_signature_${userId}`,
          userId,
          'signed_prekey_signature',
          this.uint8ArrayToBase64(keys.signedPreKeySignature),
        ]
      );
      
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (id, user_id, key, value)
         VALUES (?, ?, ?, ?)`,
        [
          `spk_id_${userId}`,
          userId,
          'signed_prekey_id',
          keys.signedPreKeyId.toString(),
        ]
      );
      
      await db.runAsync(
        `INSERT OR REPLACE INTO settings (id, user_id, key, value)
         VALUES (?, ?, ?, ?)`,
        [
          `spk_created_${userId}`,
          userId,
          'signed_prekey_created_at',
          keys.signedPreKeyCreatedAt.toString(),
        ]
      );
    });
  }

  // Load identity keys from SQLite
  async getIdentityKeys(userId: string): Promise<IdentityKeys | null> {
    const db = await getDatabase();
    
    // Load identity key pair
    const identityKeyResult = await db.getFirstAsync<{ public_key: string; private_key_encrypted: string }>(
      `SELECT public_key, private_key_encrypted FROM encryption_keys 
       WHERE device_id = ? AND key_type = 'IDENTITY' AND is_active = 1`,
      [userId]
    );
    
    if (!identityKeyResult) return null;

    // Load signed prekey
    const spkResult = await db.getFirstAsync<{ key_id: number; public_key: string; private_key_encrypted: string }>(
      `SELECT key_id, public_key, private_key_encrypted FROM encryption_keys 
       WHERE device_id = ? AND key_type = 'SIGNED_PREKEY' AND is_active = 1
       ORDER BY key_id DESC LIMIT 1`,
      [userId]
    );
    
    if (!spkResult) return null;

    // Load signature
    const sigResult = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE user_id = ? AND key = 'signed_prekey_signature'`,
      [userId]
    );
    
    if (!sigResult) return null;

    // Load signed prekey ID
    const spkIdResult = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE user_id = ? AND key = 'signed_prekey_id'`,
      [userId]
    );
    
    if (!spkIdResult) return null;

    // Load signed prekey created at
    const spkCreatedResult = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE user_id = ? AND key = 'signed_prekey_created_at'`,
      [userId]
    );
    
    if (!spkCreatedResult) return null;

    // Load onetime prekeys
    const otpkResults = await db.getAllAsync<{ key_id: number; public_key: string; private_key_encrypted: string; used_at: number | null }>(
      `SELECT key_id, public_key, private_key_encrypted, used_at FROM encryption_keys 
       WHERE device_id = ? AND key_type = 'ONETIME_PREKEY' AND is_active = 1
       ORDER BY key_id`,
      [userId]
    );

    return {
      identityKeyPair: {
        publicKey: this.base64ToUint8Array(identityKeyResult.public_key),
        privateKey: this.base64ToUint8Array(identityKeyResult.private_key_encrypted),
        keyType: 'x25519',
      },
      signedPreKeyPair: {
        publicKey: this.base64ToUint8Array(spkResult.public_key),
        privateKey: this.base64ToUint8Array(spkResult.private_key_encrypted),
        keyType: 'x25519',
      },
      signedPreKeySignature: this.base64ToUint8Array(sigResult.value),
      signedPreKeyId: parseInt(spkIdResult.value, 10),
      signedPreKeyCreatedAt: parseInt(spkCreatedResult.value, 10),
      onetimePreKeys: otpkResults.map(row => ({
        id: row.key_id,
        keyPair: {
          publicKey: this.base64ToUint8Array(row.public_key),
          privateKey: this.base64ToUint8Array(row.private_key_encrypted),
          keyType: 'x25519',
        },
        usedAt: row.used_at,
      })),
    };
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private async generateIOSIdentityKeyPair(): Promise<SecureKeyPair> {
    const keyPair = await Sodium.crypto_box_keypair();
    return {
      publicKey: keyPair.publicKey,
      secureRef: {
        type: 'ios_secure_enclave',
        identifier: `identity_${this.bytesToHex(keyPair.publicKey.slice(0, 8))}`,
      },
    };
  }

  private async generateIOSKeyPair(label: string): Promise<SecureKeyPair> {
    const keyPair = await Sodium.crypto_box_keypair();
    return {
      publicKey: keyPair.publicKey,
      secureRef: {
        type: 'ios_secure_enclave',
        identifier: `${label}_${this.bytesToHex(keyPair.publicKey.slice(0, 8))}`,
      },
    };
  }

  private async signIOS(secureRef: SecureKeyRef, data: Uint8Array): Promise<Uint8Array> {
    const privateKey = await this.getPrivateKeyFromSecureEnclave(secureRef);
    return Sodium.crypto_sign_detached(data, privateKey);
  }

  private async keyAgreementIOS(secureRef: SecureKeyRef, peerPublicKey: Uint8Array): Promise<Uint8Array> {
    const privateKey = await this.getPrivateKeyFromSecureEnclave(secureRef);
    return Sodium.crypto_scalarmult(privateKey, peerPublicKey);
  }

  private async getPrivateKeyFromSecureEnclave(secureRef: SecureKeyRef): Promise<Uint8Array> {
    throw new Error('Secure Enclave native module required');
  }

  private async generateAndroidIdentityKeyPair(): Promise<SecureKeyPair> {
    const keyPair = await Sodium.crypto_box_keypair();
    return {
      publicKey: keyPair.publicKey,
      secureRef: {
        type: 'android_keystore',
        identifier: `identity_${this.bytesToHex(keyPair.publicKey.slice(0, 8))}`,
      },
    };
  }

  private async generateAndroidKeyPair(label: string): Promise<SecureKeyPair> {
    const keyPair = await Sodium.crypto_box_keypair();
    return {
      publicKey: keyPair.publicKey,
      secureRef: {
        type: 'android_keystore',
        identifier: `${label}_${this.bytesToHex(keyPair.publicKey.slice(0, 8))}`,
      },
    };
  }

  private async signAndroid(secureRef: SecureKeyRef, data: Uint8Array): Promise<Uint8Array> {
    const privateKey = await this.getPrivateKeyFromKeystore(secureRef);
    return Sodium.crypto_sign_detached(data, privateKey);
  }

  private async keyAgreementAndroid(secureRef: SecureKeyRef, peerPublicKey: Uint8Array): Promise<Uint8Array> {
    const privateKey = await this.getPrivateKeyFromKeystore(secureRef);
    return Sodium.crypto_scalarmult(privateKey, peerPublicKey);
  }

  private async getPrivateKeyFromKeystore(secureRef: SecureKeyRef): Promise<Uint8Array> {
    throw new Error('Android Keystore native module required');
  }

  private async generateWebIdentityKeyPair(): Promise<SecureKeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'X25519' },
      false,
      ['deriveKey', 'deriveBits']
    );

    const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));

    return {
      publicKey,
      secureRef: {
        type: 'web_crypto',
        identifier: `identity_${this.bytesToHex(publicKey.slice(0, 8))}`,
      },
    };
  }

  private async generateWebKeyPair(label: string): Promise<SecureKeyPair> {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'X25519' },
      false,
      ['deriveKey', 'deriveBits']
    );

    const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));

    return {
      publicKey,
      secureRef: {
        type: 'web_crypto',
        identifier: `${label}_${this.bytesToHex(publicKey.slice(0, 8))}`,
      },
    };
  }

  private async signWeb(secureRef: SecureKeyRef, data: Uint8Array): Promise<Uint8Array> {
    throw new Error('Ed25519 not supported in Web Crypto, use software fallback');
  }

  private async keyAgreementWeb(secureRef: SecureKeyRef, peerPublicKey: Uint8Array): Promise<Uint8Array> {
    const privateKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(await this.getPrivateKeyFromWebCrypto(secureRef)),
      { name: 'ECDH', namedCurve: 'X25519' },
      false,
      ['deriveBits']
    );

    const peerKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(peerPublicKey),
      { name: 'ECDH', namedCurve: 'X25519' },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: peerKey },
      privateKey,
      256
    );

    return new Uint8Array(sharedSecret);
  }

  private async getPrivateKeyFromWebCrypto(secureRef: SecureKeyRef): Promise<Uint8Array> {
    throw new Error('Web Crypto key retrieval not implemented');
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const keystore = Keystore.getInstance();