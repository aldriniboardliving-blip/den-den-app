// src/crypto/backup.ts
// Backup encryption/decryption using Argon2id + AES-256-GCM

import * as Sodium from 'react-native-libsodium';

export interface BackupHeader {
  magic: string;
  version: number;
  algorithm: number;
  kdf: number;
  salt: Uint8Array;
  kdfMemoryKib: number;
  kdfIterations: number;
  kdfParallelism: number;
  nonce: Uint8Array;
}

const HEADER_SIZE = 112;
const MAGIC = 'DENDEN_BACKUP_V1\0\0\0\0\0';
const CURRENT_VERSION = 1;

export class BackupEncryption {
  static async encrypt(
    sqlDump: string,
    password: string
  ): Promise<Uint8Array> {
    const salt = Sodium.randombytes_buf(32);
    const nonce = Sodium.randombytes_buf(24);

    const backupKey = await Sodium.crypto_pwhash(
      32,
      password,
      salt,
      3,
      65536,
      Sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    const payload = JSON.stringify({ sqlDump });
    const payloadBytes = new TextEncoder().encode(payload);
    const ciphertext = Sodium.crypto_secretbox_easy(payloadBytes, nonce, backupKey);

    const header = this.buildHeader(salt, nonce);
    return new Uint8Array([...header, ...ciphertext]);
  }

  static async decrypt(
    fileData: Uint8Array,
    password: string
  ): Promise<{ sqlDump: string }> {
    if (fileData.length < HEADER_SIZE) {
      throw new Error('Invalid backup file: too small');
    }

    const header = this.parseHeader(fileData);

    if (header.magic !== MAGIC) {
      throw new Error('Invalid backup file: wrong magic');
    }

    if (header.version > CURRENT_VERSION) {
      throw new Error(`Backup from newer version (${header.version}). Please update app.`);
    }

    const backupKey = await Sodium.crypto_pwhash(
      32,
      password,
      header.salt,
      header.kdfIterations ?? 3,
      header.kdfMemoryKib ?? 65536,
      Sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    const ciphertext = fileData.slice(HEADER_SIZE);
    const payloadBytes = Sodium.crypto_secretbox_open_easy(
      ciphertext,
      header.nonce,
      backupKey
    );
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));

    return { sqlDump: payload.sqlDump };
  }

  private static buildHeader(salt: Uint8Array, nonce: Uint8Array): Uint8Array {
    const header = new Uint8Array(HEADER_SIZE);
    const view = new DataView(header.buffer);

    new TextEncoder().encodeInto(MAGIC, new Uint8Array(header.buffer, 0, 16));

    view.setUint32(16, CURRENT_VERSION, true);
    header[20] = 1;
    header[21] = 1;

    header.set(salt, 24);

    view.setUint32(56, 65536, true);
    view.setUint32(60, 3, true);
    view.setUint32(64, 4, true);

    header.set(nonce, 68);

    return header;
  }

  private static parseHeader(fileData: Uint8Array): BackupHeader {
    const view = new DataView(fileData.buffer, fileData.byteOffset + 16, HEADER_SIZE - 16);

    const magic = new TextDecoder().decode(fileData.slice(0, 16));
    const version = view.getUint32(0, true);
    const algorithm = fileData[36] ?? 1;
    const kdf = fileData[37] ?? 1;
    const salt = fileData.slice(40, 72);
    const kdfMemoryKib = view.getUint32(40, true);
    const kdfIterations = view.getUint32(44, true);
    const kdfParallelism = view.getUint32(48, true);
    const nonce = fileData.slice(84, 108);

    return {
      magic,
      version,
      algorithm,
      kdf,
      salt,
      kdfMemoryKib,
      kdfIterations,
      kdfParallelism,
      nonce,
    };
  }
}