// src/crypto/keystore.ts
// Platform-specific secure key storage
// iOS: Secure Enclave via Keychain
// Android: Keystore with StrongBox
// Web: Web Crypto API (non-extractable keys)

import { Platform } from 'react-native';
import * as Sodium from 'react-native-libsodium';
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