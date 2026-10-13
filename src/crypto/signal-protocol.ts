// src/crypto/signal-protocol.ts
// Signal Protocol wrapper - provides unified interface for E2EE
// Currently uses X3DH (ephemeral key per message) with path to full Double Ratchet
// TODO: Implement full Signal Protocol Double Ratchet when libsignal-protocol-typescript matures
// or use native libsignal via JSI

import * as Sodium from 'react-native-libsodium';
import { keyManager } from './keys';
import { keystore } from './keystore';
import { getDatabase } from '@/database/connection';
import { IdentityKeys, KeyBundle, MessageEnvelope, OnetimePreKey, KeyPair } from './types';

interface SignalAddress {
  name: string;
  deviceId: number;
}

// Convert Uint8Array to base64
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// Convert base64 to Uint8Array
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Signal Protocol Store - persists sessions, keys, and identities to SQLite
 * This provides the storage layer for future full Signal Protocol implementation
 */
export class SignalProtocolStore {
  private userId: string;
  private deviceId: number;

  constructor(userId: string, deviceId: number) {
    this.userId = userId;
    this.deviceId = deviceId;
  }

  async getIdentityKeyPair(): Promise<{ pubKey: Uint8Array; privKey: Uint8Array }> {
    const keys = await keystore.getIdentityKeys(this.userId);
    if (!keys) throw new Error('Identity keys not initialized');
    
    return {
      pubKey: keys.identityKeyPair.publicKey,
      privKey: keys.identityKeyPair.privateKey,
    };
  }

  async getLocalRegistrationId(): Promise<number> {
    return this.deviceId;
  }

  async saveIdentity(address: SignalAddress, identityKey: Uint8Array): Promise<boolean> {
    const existing = await this.isTrustedIdentity(address, identityKey);
    if (existing) return false;

    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO remote_identities (user_id, device_id, name, identity_key, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [this.userId, address.deviceId, address.name, toBase64(identityKey), Date.now()]
    );
    return true;
  }

  async isTrustedIdentity(address: SignalAddress, identityKey: Uint8Array): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ identity_key: string }>(
      `SELECT identity_key FROM remote_identities WHERE user_id = ? AND name = ? AND device_id = ?`,
      [this.userId, address.name, address.deviceId]
    );
    
    if (!result) return false;
    
    const stored = fromBase64(result.identity_key);
    const incoming = identityKey;
    
    if (stored.length !== incoming.length) return false;
    for (let i = 0; i < stored.length; i++) {
      if (stored[i] !== incoming[i]) return false;
    }
    return true;
  }

  async storeSession(address: SignalAddress, sessionData: Uint8Array): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO signal_sessions (user_id, device_id, name, session_data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [this.userId, address.deviceId, address.name, toBase64(sessionData), Date.now(), Date.now()]
    );
  }

  async loadSession(address: SignalAddress): Promise<Uint8Array | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ session_data: string }>(
      `SELECT session_data FROM signal_sessions WHERE user_id = ? AND name = ? AND device_id = ?`,
      [this.userId, address.name, address.deviceId]
    );

    if (!result) return null;
    return fromBase64(result.session_data);
  }

  async deleteSession(address: SignalAddress): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM signal_sessions WHERE user_id = ? AND name = ? AND device_id = ?`,
      [this.userId, address.name, address.deviceId]
    );
  }

  async deleteAllSessions(address: SignalAddress): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `DELETE FROM signal_sessions WHERE user_id = ? AND name = ?`,
      [this.userId, address.name]
    );
  }

  async loadSignedPreKey(): Promise<{ keyId: number; keyPair: { pubKey: Uint8Array; privKey: Uint8Array }; signature: Uint8Array }> {
    const keys = await keystore.getIdentityKeys(this.userId);
    if (!keys) throw new Error('Identity keys not initialized');

    return {
      keyId: keys.signedPreKeyId,
      keyPair: {
        pubKey: keys.signedPreKeyPair.publicKey,
        privKey: keys.signedPreKeyPair.privateKey,
      },
      signature: keys.signedPreKeySignature,
    };
  }
}

/**
 * High-level Signal Protocol wrapper
 * Currently uses X3DH (ephemeral key per message) via existing implementation
 * Provides interface compatible with future Double Ratchet upgrade
 */
export class SignalProtocolManager {
  private store: SignalProtocolStore;
  private userId: string;
  private deviceId: number;

  constructor(userId: string, deviceId: number) {
    this.userId = userId;
    this.deviceId = deviceId;
    this.store = new SignalProtocolStore(userId, deviceId);
  }

  /**
   * Initialize a session with a remote user (X3DH key agreement)
   * Uses existing X3DH implementation for now
   */
  async initializeSession(remoteAddress: string, remoteDeviceId: number, theirKeyBundle: KeyBundle): Promise<void> {
    // Verify their key bundle
    const signedPrekeyData = new Uint8Array(theirKeyBundle.signedPrekeyPublic.length);
    signedPrekeyData.set(theirKeyBundle.signedPrekeyPublic);

    const signatureValid = Sodium.crypto_sign_verify_detached(
      theirKeyBundle.signedPrekeySignature,
      signedPrekeyData,
      theirKeyBundle.identityKeyPublic
    );

    if (!signatureValid) {
      throw new Error('Invalid signed prekey signature');
    }

    // Store their identity key for trust verification
    const address = { name: remoteAddress, deviceId: remoteDeviceId };
    await this.store.saveIdentity(address, theirKeyBundle.identityKeyPublic);
    
    // In full Signal Protocol, this would create a SessionRecord with Double Ratchet state
    // For now, we just verify and store their identity
    console.log(`Signal session initialized with ${remoteAddress}:${remoteDeviceId}`);
  }

  /**
   * Encrypt a message for a remote user
   * Currently uses X3DH (ephemeral key per message)
   * Future: Double Ratchet encryption
   */
  async encrypt(remoteAddress: string, remoteDeviceId: number, plaintext: Uint8Array): Promise<Uint8Array> {
    const identityKeys = await keystore.getIdentityKeys(this.userId);
    if (!identityKeys) throw new Error('Identity keys not initialized');

    const theirKeyBundle: KeyBundle = {
      deviceId: remoteDeviceId.toString(),
      identityKeyPublic: (await this.store.loadSession({ name: remoteAddress, deviceId: remoteDeviceId })) 
        ? (await this.getRemoteIdentityKey(remoteAddress, remoteDeviceId))!
        : identityKeys.identityKeyPair.publicKey, // Fallback
      signedPrekeyPublic: identityKeys.signedPreKeyPair.publicKey,
      signedPrekeySignature: identityKeys.signedPreKeySignature,
      signedPrekeyId: identityKeys.signedPreKeyId,
      onetimePrekeyPublic: null,
      onetimePrekeyId: null,
    };

    // Use existing X3DH encryption
    return keyManager.encryptForContact(plaintext, remoteAddress, remoteDeviceId);
  }

  /**
   * Decrypt a message from a remote user
   * Currently uses X3DH decryption
   * Future: Double Ratchet decryption
   */
  async decrypt(remoteAddress: string, remoteDeviceId: number, ciphertext: Uint8Array): Promise<Uint8Array> {
    return keyManager.decryptFromContact(ciphertext, remoteAddress, remoteDeviceId);
  }

  private async getRemoteIdentityKey(remoteAddress: string, remoteDeviceId: number): Promise<Uint8Array | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<{ identity_key: string }>(
      `SELECT identity_key FROM remote_identities WHERE user_id = ? AND name = ? AND device_id = ?`,
      [this.userId, remoteAddress, remoteDeviceId]
    );
    
    if (!result) return null;
    return fromBase64(result.identity_key);
  }

  async getMyKeyBundle(): Promise<KeyBundle> {
    const identityKeys = await keystore.getIdentityKeys(this.userId);
    if (!identityKeys) throw new Error('Identity keys not initialized');

    const onetimePreKey = identityKeys.onetimePreKeys.find(k => k.usedAt === null);
    
    return {
      deviceId: this.deviceId.toString(),
      identityKeyPublic: identityKeys.identityKeyPair.publicKey,
      signedPrekeyPublic: identityKeys.signedPreKeyPair.publicKey,
      signedPrekeySignature: identityKeys.signedPreKeySignature,
      signedPrekeyId: identityKeys.signedPreKeyId,
      onetimePrekeyPublic: onetimePreKey?.keyPair.publicKey || null,
      onetimePrekeyId: onetimePreKey?.id || null,
    };
  }

  async hasSession(remoteAddress: string, remoteDeviceId: number): Promise<boolean> {
    const session = await this.store.loadSession({ name: remoteAddress, deviceId: remoteDeviceId });
    return session !== null;
  }

  async deleteSession(remoteAddress: string, remoteDeviceId: number): Promise<void> {
    await this.store.deleteSession({ name: remoteAddress, deviceId: remoteDeviceId });
  }
}

// Add helper methods to KeyManager for contact-based encryption
// These will be added to keys.ts

// Create manager instance
let signalProtocolManager: SignalProtocolManager | null = null;

export function getSignalProtocolManager(userId: string, deviceId: number): SignalProtocolManager {
  if (!signalProtocolManager) {
    signalProtocolManager = new SignalProtocolManager(userId, deviceId);
  }
  return signalProtocolManager;
}

export function resetSignalProtocolManager(): void {
  signalProtocolManager = null;
}