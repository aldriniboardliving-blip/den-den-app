// src/database/repositories/devices.ts
// Devices repository

import { getDatabase } from '../connection';
import { Device, OnetimePrekey } from '../../types';

export class DevicesRepository {
  private static instance: DevicesRepository;

  static getInstance(): DevicesRepository {
    if (!DevicesRepository.instance) {
      DevicesRepository.instance = new DevicesRepository();
    }
    return DevicesRepository.instance;
  }

  async getAll(userId: string): Promise<Device[]> {
    const db = await getDatabase();
    const devices = await db.getAllAsync<Device & { onetime_prekeys: string }>(
      `SELECT * FROM devices WHERE user_id = ? ORDER BY is_primary DESC, registered_at ASC`,
      userId
    );

    return devices.map(d => ({
      ...d,
      onetimePrekeys: JSON.parse(d.onetime_prekeys) as OnetimePrekey[],
    }));
  }

  async getPrimary(userId: string): Promise<Device | null> {
    const db = await getDatabase();
    const device = await db.getFirstAsync<Device & { onetime_prekeys: string }>(
      `SELECT * FROM devices WHERE user_id = ? AND is_primary = 1 LIMIT 1`,
      userId
    );

    if (!device) return null;

    return {
      ...device,
      onetimePrekeys: JSON.parse(device.onetime_prekeys) as OnetimePrekey[],
    };
  }

  async getById(id: string): Promise<Device | null> {
    const db = await getDatabase();
    const device = await db.getFirstAsync<Device & { onetime_prekeys: string }>(
      `SELECT * FROM devices WHERE id = ?`,
      id
    );

    if (!device) return null;

    return {
      ...device,
      onetimePrekeys: JSON.parse(device.onetime_prekeys) as OnetimePrekey[],
    };
  }

  async create(device: Omit<Device, 'id' | 'registeredAt' | 'onetimePrekeys'> & { 
    id?: string;
    onetimePrekeys: OnetimePrekey[];
  }): Promise<Device> {
    const db = await getDatabase();
    const id = device.id || generateId();
    const now = Date.now();

    await db.runAsync(
      `INSERT INTO devices (
        id, user_id, device_name, platform, platform_version, app_version,
        identity_key_public, identity_key_private, signed_prekey_public,
        signed_prekey_private, signed_prekey_signature, signed_prekey_created_at,
        onetime_prekeys, registered_at, last_active_at, is_primary,
        push_token, push_token_updated_at, sync_status, last_synced_at, server_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      device.userId,
      device.deviceName ?? '',
      device.platform,
      device.platformVersion ?? '',
      device.appVersion ?? '',
      device.identityKeyPublic,
      device.identityKeyPrivate,
      device.signedPrekeyPublic,
      device.signedPrekeyPrivate,
      device.signedPrekeySignature,
      device.signedPrekeyCreatedAt,
      JSON.stringify(device.onetimePrekeys),
      now,
      device.lastActiveAt ?? 0,
      device.isPrimary ? 1 : 0,
      device.pushToken ?? '',
      device.pushTokenUpdatedAt ?? 0,
      device.syncStatus,
      device.lastSyncedAt ?? 0,
      device.serverVersion
    );

    return this.getById(id) as Promise<Device>;
  }

  async update(id: string, updates: Partial<Device>): Promise<void> {
    const db = await getDatabase();

    const fields: string[] = [];
    const params: (string | number | boolean)[] = [];

    if (updates.deviceName !== undefined) { fields.push('device_name = ?'); params.push(updates.deviceName ?? ''); }
    if (updates.platformVersion !== undefined) { fields.push('platform_version = ?'); params.push(updates.platformVersion ?? ''); }
    if (updates.appVersion !== undefined) { fields.push('app_version = ?'); params.push(updates.appVersion ?? ''); }
    if (updates.lastActiveAt !== undefined) { fields.push('last_active_at = ?'); params.push(updates.lastActiveAt ?? 0); }
    if (updates.isPrimary !== undefined) { fields.push('is_primary = ?'); params.push(updates.isPrimary ? 1 : 0); }
    if (updates.pushToken !== undefined) { 
      fields.push('push_token = ?'); 
      params.push(updates.pushToken ?? '');
      fields.push('push_token_updated_at = ?'); 
      params.push(Date.now());
    }
    if (updates.onetimePrekeys !== undefined) { 
      fields.push('onetime_prekeys = ?'); 
      params.push(JSON.stringify(updates.onetimePrekeys));
    }
    if (updates.syncStatus !== undefined) { fields.push('sync_status = ?'); params.push(updates.syncStatus); }
    if (updates.lastSyncedAt !== undefined) { fields.push('last_synced_at = ?'); params.push(updates.lastSyncedAt ?? 0); }
    if (updates.serverVersion !== undefined) { fields.push('server_version = ?'); params.push(updates.serverVersion); }

    if (fields.length === 0) return;

    params.push(id);

    await db.runAsync(
      `UPDATE devices SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  async markPrekeyUsed(id: string, prekeyId: number): Promise<void> {
    const device = await this.getById(id);
    if (!device) return;

    const updatedPrekeys = device.onetimePrekeys.map(k => 
      k.id === prekeyId ? { ...k, usedAt: Date.now() } : k
    );

    await this.update(id, { onetimePrekeys: updatedPrekeys });
  }

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM devices WHERE id = ?`, id);
  }

  async setPrimary(userId: string, deviceId: string): Promise<void> {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE devices SET is_primary = 0 WHERE user_id = ?`, userId);
      await db.runAsync(`UPDATE devices SET is_primary = 1 WHERE id = ?`, deviceId);
    });
  }
}

function generateId(): string {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${timestampHex}-${randomHex}`;
}

export const devicesRepository = DevicesRepository.getInstance();