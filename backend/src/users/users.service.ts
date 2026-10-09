import { Injectable, NotFoundException } from '@nestjs/common';
import { DrizzleService } from '../common/database/drizzle.service';
import { users, devices, contacts } from '../common/database/schema';
import { eq, and, desc, or, ilike, isNull } from 'drizzle-orm';
import { createId } from '../common/utils/id';

@Injectable()
export class UsersService {
  constructor(private drizzle: DrizzleService) {}

  async findById(id: string) {
    const user = await this.drizzle.client.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByIdentifier(identifier: string) {
    return this.drizzle.client.query.users.findFirst({
      where: eq(users.identifier, identifier),
    });
  }

  async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    const [user] = await this.drizzle.client
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async searchUsers(query: string, currentUserId: string, limit = 20) {
    return this.drizzle.client
      .select()
      .from(users)
      .where(
        and(
          or(ilike(users.identifier, `%${query}%`), ilike(users.displayName, `%${query}%`)),
          isNull(users.deletedAt),
        ),
      )
      .limit(limit);
  }

  async getDevices(userId: string) {
    return this.drizzle.client.query.devices.findMany({
      where: and(eq(devices.userId, userId), isNull(devices.revokedAt)),
      orderBy: desc(devices.lastActiveAt),
    });
  }

  async getContacts(userId: string) {
    return this.drizzle.client.query.contacts.findMany({
      where: and(eq(contacts.userId, userId), isNull(contacts.blockedAt)),
      with: {
        contactUser: true,
      },
    });
  }
}