// src/crypto/verification.ts
// Safety number computation and QR code generation
// Uses crypto_generichash (BLAKE2b) for deterministic output

import * as Sodium from 'react-native-libsodium';

export interface SafetyNumberResult {
  number: string;
  qrCodeData: string;
}

const SAFETY_NUMBER_PREFIX = 'DenDen Safety Number v1';
const GROUP_SIZE = 4;

export class Verification {
  static async computeSafetyNumber(
    myIdentityKeyPublic: Uint8Array,
    contactIdentityKeyPublic: Uint8Array
  ): Promise<SafetyNumberResult> {
    const keys = [myIdentityKeyPublic, contactIdentityKeyPublic].sort((a, b) =>
      this.compareBuffers(a, b)
    );

    const key0 = keys[0];
    const key1 = keys[1];
    if (!key0 || !key1) {
      throw new Error('Invalid keys for safety number computation');
    }

    const prefixBytes = new TextEncoder().encode(SAFETY_NUMBER_PREFIX);
    const input = new Uint8Array(prefixBytes.length + key0.length + key1.length);
    input.set(prefixBytes, 0);
    input.set(key0, prefixBytes.length);
    input.set(key1, prefixBytes.length + key0.length);

    const hash = Sodium.crypto_generichash(32, input, null) as Uint8Array;

    const safetyNumberBytes = hash.slice(0, 30);

    const hex = Array.from(safetyNumberBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const match = hex.match(new RegExp(`.{${GROUP_SIZE}}`, 'g'));
    const displayFormat = match ? match.join('-') : hex;
    void displayFormat;

    const qrCodeData = this.toBase64(safetyNumberBytes);

    return {
      number: hex,
      qrCodeData,
    };
  }

  static async verifySafetyNumber(
    myIdentityKeyPublic: Uint8Array,
    contactIdentityKeyPublic: Uint8Array,
    expectedNumber: string
  ): Promise<boolean> {
    const result = await this.computeSafetyNumber(myIdentityKeyPublic, contactIdentityKeyPublic);
    return result.number.toLowerCase() === expectedNumber.toLowerCase().replace(/-/g, '');
  }

  static generateQRCodeSVG(qrCodeData: string, size: number = 256): string {
    return `data:image/svg+xml;base64,${this.toBase64(new TextEncoder().encode(`<svg>${qrCodeData}</svg>`))}`;
  }

  private static compareBuffers(a: Uint8Array, b: Uint8Array): number {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const ai = a[i]!;
      const bi = b[i]!;
      if (ai !== bi) {
        return ai - bi;
      }
    }
    return a.length - b.length;
  }

  private static toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }
}