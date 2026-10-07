// src/sync/processor.ts
// Sync queue processor with operation handlers

import { syncQueueRepository } from '../database/repositories/syncQueue';
import { messagesRepository } from '../database/repositories/messages';
import { devicesRepository } from '../database/repositories/devices';
import { contactsRepository } from '../database/repositories/contacts';
import { keyManager } from '../crypto/keys';
import { api } from '../api/client';
import type { SyncOperation, SyncOperationType } from '../types';

export class SyncProcessor {
  private static instance: SyncProcessor;
  private isProcessing = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  static getInstance(): SyncProcessor {
    if (!SyncProcessor.instance) {
      SyncProcessor.instance = new SyncProcessor();
    }
    return SyncProcessor.instance;
  }

  async start(): Promise<void> {
    if (this.pollInterval) return;

    await this.processQueue();

    this.pollInterval = setInterval(() => this.processQueue(), 5000);
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const userId = await this.getCurrentUserId();
      if (!userId) return;

      const operations = await syncQueueRepository.getPending(userId, 10);

      for (const op of operations) {
        await this.executeOperation(op);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async getCurrentUserId(): Promise<string | null> {
    const db = await (await import('../database/connection')).getDatabase();
    const user = await db.getFirstAsync<{ id: string }>('SELECT id FROM users LIMIT 1');
    return user?.id || null;
  }

  private async executeOperation(op: SyncOperation): Promise<void> {
    await syncQueueRepository.markProcessing(op.id);

    try {
      const handler = this.getHandler(op.operation);
      await handler(op);

      await syncQueueRepository.markCompleted(op.id);
    } catch (error) {
      const err = error as Error;
      await syncQueueRepository.markFailed(op.id, err, err.name, op.attemptCount + 1 < op.maxAttempts);
    }
  }

  private getHandler(operation: SyncOperationType): (op: SyncOperation) => Promise<void> {
    const handlers: Record<SyncOperationType, (op: SyncOperation) => Promise<void>> = {
      MESSAGE_CREATE: this.handleMessageCreate.bind(this),
      MESSAGE_SEND: this.handleMessageSend.bind(this),
      MESSAGE_ACK: this.handleMessageAck.bind(this),
      MESSAGE_READ: this.handleMessageRead.bind(this),
      ATTACHMENT_UPLOAD: this.handleAttachmentUpload.bind(this),
      ATTACHMENT_DOWNLOAD: this.handleAttachmentDownload.bind(this),
      CONTACT_SYNC: this.handleContactSync.bind(this),
      CONVERSATION_SYNC: this.handleConversationSync.bind(this),
      DEVICE_SYNC: this.handleDeviceSync.bind(this),
      KEY_ROTATION: this.handleKeyRotation.bind(this),
      BACKUP_CREATE: this.handleBackupCreate.bind(this),
      BACKUP_RESTORE: this.handleBackupRestore.bind(this),
    };

    return (
      handlers[operation] ||
      (() => Promise.reject(new Error(`Unknown operation: ${operation}`)))
    );
  }

  private async handleMessageCreate(op: SyncOperation): Promise<void> {
    await this.handleMessageSend(op);
  }

  private async handleMessageSend(op: SyncOperation): Promise<void> {
    const payload = JSON.parse(op.payload || '{}');
    const { messageId, recipientDeviceIds } = payload;

    const message = await messagesRepository.getById(messageId);
    if (!message) throw new Error(`Message ${messageId} not found`);
    const userId = await this.getCurrentUserId();
    const senderDevice = userId ? await devicesRepository.getPrimary(userId) : null;
    if (!senderDevice) throw new Error('No primary device');

    for (const recipientDeviceId of recipientDeviceIds) {
      const keyBundle = await api.getKeyBundle(recipientDeviceId);
      const plaintext = new TextEncoder().encode(message.content || '');
      const envelope = await this.encryptMessage(plaintext, keyBundle, message.senderDeviceId);
      const response = await api.sendMessage(envelope);
      await messagesRepository.markSynced(messageId, response.serverMessageId);
    }
  }

  private async encryptMessage(
    plaintext: Uint8Array,
    keyBundle: any,
    senderDeviceId: string
  ): Promise<any> {
    const { MessageEncryption } = await import('../crypto/encryption');
    return MessageEncryption.encrypt(plaintext, keyBundle, senderDeviceId, 'temp-conversation');
  }

  private async handleMessageAck(op: SyncOperation): Promise<void> {
    const payload = JSON.parse(op.payload || '{}');
    const { serverMessageId, status } = payload;
    await api.acknowledgeMessage(serverMessageId, status);
  }

  private async handleMessageRead(op: SyncOperation): Promise<void> {
    const payload = JSON.parse(op.payload || '{}');
    const { serverMessageId } = payload;
    await api.sendReadReceipt(serverMessageId);
  }

  private async handleAttachmentUpload(op: SyncOperation): Promise<void> {
    // Upload logic would go here
  }

  private async handleAttachmentDownload(op: SyncOperation): Promise<void> {
    // Download logic would go here
  }

  private async handleContactSync(op: SyncOperation): Promise<void> {
    const payload = JSON.parse(op.payload || '{}');
    const { accountId } = payload;
    const contact = await api.getContact(accountId);
    if (contact) {
      const userId = await this.getCurrentUserId();
      if (userId) {
        await contactsRepository.create({
          userId,
          contactAccountId: contact.accountId,
          contactDeviceId: contact.deviceId ?? null,
          displayName: contact.displayName ?? null,
          avatarUrl: contact.avatarUrl ?? null,
          identityKeyPublic: contact.identityKeyPublic,
          signedPrekeyPublic: contact.signedPrekeyPublic ?? null,
          signedPrekeySignature: contact.signedPrekeySignature ?? null,
          verificationStatus: 'UNVERIFIED',
          verifiedAt: null,
          safetyNumber: null,
          syncStatus: 'SYNCED',
          lastSyncedAt: Date.now(),
          serverVersion: 1,
          deletedAt: null,
        });
      }
    }
  }

  private async handleConversationSync(op: SyncOperation): Promise<void> {
    // Sync logic would go here
  }

  private async handleDeviceSync(op: SyncOperation): Promise<void> {
    // Device sync logic would go here
  }

  private async handleKeyRotation(op: SyncOperation): Promise<void> {
    await keyManager.rotateSignedPreKey();
    if (keyManager.needsPrekeyReplenishment()) {
      await keyManager.replenishOnetimePreKeys();
    }
    const userId = await this.getCurrentUserId();
    const device = userId ? await devicesRepository.getPrimary(userId) : null;
    if (device) {
      await api.updateDeviceKeys(device.id, device);
    }
  }

  private async handleBackupCreate(op: SyncOperation): Promise<void> {
    // Backup creation logic would go here
  }

  private async handleBackupRestore(op: SyncOperation): Promise<void> {
    // Backup restore logic would go here
  }
}

export const syncProcessor = SyncProcessor.getInstance();
