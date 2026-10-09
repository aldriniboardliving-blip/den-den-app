import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { devices, deviceOneTimePreKeys } from '../common/database/schema';
import { eq, and, desc, gte, lt, isNull, sql } from 'drizzle-orm';
import { createId } from '../common/utils/id';

@Injectable()
export class DevicesService {
  constructor(private drizzle: DrizzleService) {}

  async findById(id: string) {
    const device = await this.drizzle.client.query.devices.findFirst({
      where: eq(devices.id, id),
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async findByIdentityKey(identityKey: string) {
    return this.drizzle.client.query.devices.findFirst({
      where: and(eq(devices.identityKeyPublic, identityKey), isNull(devices.revokedAt)),
    });
  }

  async getPreKeyBundle(deviceId: string) {
    const device = await this.findById(deviceId);
    if (device.revokedAt) throw new NotFoundException('Device revoked');

    const preKeys = await this.drizzle.client.query.deviceOneTimePreKeys.findMany({
      where: and(eq(deviceOneTimePreKeys.deviceId, deviceId), isNull(deviceOneTimePreKeys.usedAt)),
      limit: 1,
    });

    return {
      identityKey: device.identityKeyPublic,
      signingKey: device.signingKeyPublic,
      signedPreKey: {
        keyId: device.signedPreKeyId,
        publicKey: device.signedPreKeyPublic,
        signature: device.signedPreKeySignature,
      },
      oneTimePreKey: preKeys[0]
        ? { keyId: preKeys[0].keyId, publicKey: preKeys[0].publicKey }
        : null,
    };
  }

  async consumeOneTimePreKey(deviceId: string, keyId: number) {
    await this.drizzle.client
      .update(deviceOneTimePreKeys)
      .set({ usedAt: new Date() })
      .where(and(eq(deviceOneTimePreKeys.deviceId, deviceId), eq(deviceOneTimePreKeys.keyId, keyId)));
  }

  async updateLastActive(deviceId: string) {
    await this.drizzle.client
      .update(devices)
      .set({ lastActiveAt: new Date() })
      .where(eq(devices.id, deviceId));
  }

  async rotateSignedPreKey(
    deviceId: string,
    data: { publicKey: string; signature: string; keyId: number },
  ) {
    await this.drizzle.client
      .update(devices)
      .set({
        signedPreKeyPublic: data.publicKey,
        signedPreKeySignature: data.signature,
        signedPreKeyId: data.keyId,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, deviceId));
  }

  async addOneTimePreKeys(deviceId: string, keys: Array<{ keyId: number; publicKey: string }>) {
    await this.drizzle.client.insert(deviceOneTimePreKeys).values(
      keys.map((k) => ({
        deviceId,
        keyId: k.keyId,
        publicKey: k.publicKey,
      })),
    );
  }

  async revoke(userId: string, deviceId: string) {
    const device = await this.findById(deviceId);
    if (device.userId !== userId) throw new ConflictException('Cannot revoke another user device');

    await this.drizzle.client
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(eq(devices.id, deviceId));
  }

  async listUserDevices(userId: string) {
    return this.drizzle.client.query.devices.findMany({
      where: and(eq(devices.userId, userId), isNull(devices.revokedAt)),
      orderBy: desc(devices.lastActiveAt),
    });
  }

  async getDevicesNeedingPreKeys(threshold = 10) {
    return this.drizzle.client
      .select({ deviceId: devices.id, count: sql<number>`count(${deviceOneTimePreKeys.id})` })
      .from(devices)
      .leftJoin(
        deviceOneTimePreKeys,
        and(eq(deviceOneTimePreKeys.deviceId, devices.id), isNull(deviceOneTimePreKeys.usedAt)),
      )
      .where(and(isNull(devices.revokedAt)))
      .groupBy(devices.id)
      .having(({ count }) => lt(count, threshold));
  }
}