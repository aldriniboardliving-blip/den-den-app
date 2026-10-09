import { SignalProtocolAddress } from 'libsignal-protocol-typescript';

export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface PreKeyPair {
  keyId: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SignedPreKeyPair {
  keyId: number;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  signature: Uint8Array;
}

export interface PreKeyBundle {
  registrationId: number;
  deviceId: number;
  identityKey: Uint8Array;
  signedPreKey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  };
  preKey: {
    keyId: number;
    publicKey: Uint8Array;
  } | null;
}

export interface SessionState {
  sessionVersion: number;
  localIdentityKey: Uint8Array;
  remoteIdentityKey: Uint8Array;
  rootKey: Uint8Array;
  senderChain: ChainState;
  receiverChains: Map<number, ChainState>;
  pendingKeyExchange: PendingKeyExchange | null;
  localRegistrationId: number;
  remoteRegistrationId: number;
  needsRefresh: boolean;
  aliceBaseKey: Uint8Array | null;
}

export interface ChainState {
  chainKey: Uint8Array;
  messageNumber: number;
}

export interface PendingKeyExchange {
  preKeyId: number | null;
  signedPreKeyId: number;
  baseKey: Uint8Array;
  localIdentityKey: Uint8Array;
  localRegistrationId: number;
}

export interface MessageKeys {
  cipherKey: Uint8Array;
  macKey: Uint8Array;
  iv: Uint8Array;
}

export interface CiphertextMessage {
  type: number;
  body: Uint8Array;
}

export interface PreKeySignalMessage extends CiphertextMessage {
  preKeyId: number | null;
  signedPreKeyId: number;
  baseKey: Uint8Array;
  identityKey: Uint8Array;
  message: Uint8Array;
}

export interface SignalMessage extends CiphertextMessage {
  mac: Uint8Array;
  senderRatchetKey: Uint8Array;
  counter: number;
  previousCounter: number;
  message: Uint8Array;
}

export type { SignalProtocolAddress };

export const SIGNAL_PROTOCOL_VERSION = 3;
export const MESSAGE_KEYS_BYTES = 80;
export const MAC_LENGTH = 32;
export const IV_LENGTH = 16;
export const CURVE_PRIVATE_KEY_LENGTH = 32;
export const CURVE_PUBLIC_KEY_LENGTH = 32;

export function serializeSignalProtocolAddress(address: SignalProtocolAddress): string {
  return `${address.getName()}:${address.getDeviceId()}`;
}

export function deserializeSignalProtocolAddress(serialized: string): SignalProtocolAddress {
  const [name, deviceId] = serialized.split(':');
  return new SignalProtocolAddress(name, parseInt(deviceId, 10));
}