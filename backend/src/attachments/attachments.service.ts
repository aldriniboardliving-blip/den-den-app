import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { attachments, syncOperations, messages } from '../common/database/schema';
import { eq, and, desc, lt, isNull } from 'drizzle-orm';
import { createId } from '../common/utils/id';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ThumbnailService } from './thumbnail.service';
import {
  AttachmentMetadata,
  UploadInitiationData,
  UploadInitiationResult,
  getAttachmentType,
  MAX_ATTACHMENT_SIZE,
} from './attachments.types';

export type { UploadInitiationResult };

@Injectable()
export class AttachmentsService {
  private s3: S3Client;
  private bucket: string;

  constructor(
    private drizzle: DrizzleService,
    private config: ConfigService,
    private thumbnailService: ThumbnailService,
  ) {
    this.s3 = new S3Client({
      region: this.config.get('S3_REGION', 'us-east-1'),
      endpoint: this.config.get('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.get('S3_ACCESS_KEY', ''),
        secretAccessKey: this.config.get('S3_SECRET_KEY', ''),
      },
    });
    this.bucket = this.config.get('S3_BUCKET', 'den-den-attachments');
  }

  async initiateUpload(
    uploaderDeviceId: string,
    data: UploadInitiationData,
    userId: string,
  ): Promise<UploadInitiationResult> {
    if (data.sizeBytes > MAX_ATTACHMENT_SIZE) {
      throw new BadRequestException(`File size exceeds maximum of ${MAX_ATTACHMENT_SIZE} bytes`);
    }

    const attachmentType = getAttachmentType(data.mimeType);
    const key = `attachments/${uploaderDeviceId}/${createId()}-${data.filename}`;
    const expiresIn = 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: data.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });

    const [attachment] = await this.drizzle.client
      .insert(attachments)
      .values({
        uploaderDeviceId,
        messageId: data.messageId || null,
        filename: data.filename,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        encryptedKey: data.encryptedKey,
        nonce: data.nonce,
        storageUrl: key,
        storageProvider: 's3',
        uploadStatus: 'PENDING',
        expiresAt,
        metadata: {
          type: attachmentType,
          hasThumbnail: false,
        } as AttachmentMetadata,
      })
      .returning();

    if (data.messageId) {
      await this.queueSyncOperation(userId, uploaderDeviceId, {
        operationType: 'ATTACHMENT_UPLOAD',
        entityType: 'attachments',
        entityId: attachment.id,
        payload: { attachmentId: attachment.id, messageId: data.messageId },
      });
    }

    return {
      attachmentId: attachment.id,
      uploadUrl,
      expiresAt,
    };
  }

  async confirmUpload(
    attachmentId: string,
    uploaderDeviceId: string,
    userId: string,
  ): Promise<any> {
    const attachment = await this.drizzle.client.query.attachments.findFirst({
      where: and(eq(attachments.id, attachmentId), eq(attachments.uploaderDeviceId, uploaderDeviceId)),
    });

    if (!attachment) throw new NotFoundException('Attachment not found');

    const updated = await this.drizzle.client
      .update(attachments)
      .set({ 
        uploadStatus: 'COMPLETED', 
        uploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(attachments.id, attachmentId))
      .returning();

    if (attachment.messageId) {
      await this.queueSyncOperation(userId, uploaderDeviceId, {
        operationType: 'ATTACHMENT_UPLOAD',
        entityType: 'attachments',
        entityId: attachmentId,
        payload: { attachmentId, messageId: attachment.messageId, status: 'COMPLETED' },
      });
    }

    return updated[0];
  }

  async processUploadCompletion(
    attachmentId: string,
    uploaderDeviceId: string,
    userId: string,
  ): Promise<any> {
    const attachment = await this.drizzle.client.query.attachments.findFirst({
      where: and(eq(attachments.id, attachmentId), eq(attachments.uploaderDeviceId, uploaderDeviceId)),
    });

    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.uploadStatus === 'COMPLETED') {
      return attachment;
    }

    const type = getAttachmentType(attachment.mimeType);
    let thumbnailResult = null;

    if (type === 'image') {
      thumbnailResult = await this.thumbnailService.generateThumbnail(attachment.storageUrl!, attachment.mimeType);
    }

    const metadata: AttachmentMetadata = {
      type,
      hasThumbnail: !!thumbnailResult,
      thumbnailKey: thumbnailResult?.thumbnailKey,
      thumbnailWidth: thumbnailResult?.width,
      thumbnailHeight: thumbnailResult?.height,
    };

    const [updated] = await this.drizzle.client
      .update(attachments)
      .set({ 
        uploadStatus: 'COMPLETED', 
        uploadedAt: new Date(),
        updatedAt: new Date(),
        metadata,
      })
      .where(eq(attachments.id, attachmentId))
      .returning();

    if (attachment.messageId) {
      await this.queueSyncOperation(userId, uploaderDeviceId, {
        operationType: 'ATTACHMENT_UPLOAD',
        entityType: 'attachments',
        entityId: attachmentId,
        payload: { attachmentId, messageId: attachment.messageId, status: 'COMPLETED', metadata },
      });
    }

    return updated;
  }

  async getDownloadUrl(attachmentId: string, deviceId: string): Promise<{ downloadUrl: string; attachment: any }> {
    const attachment = await this.drizzle.client.query.attachments.findFirst({
      where: eq(attachments.id, attachmentId),
    });

    if (!attachment) throw new NotFoundException('Attachment not found');
    if (!attachment.storageUrl) throw new NotFoundException('Attachment storage URL not available');

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: attachment.storageUrl,
    });

    const downloadUrl = await getSignedUrl(this.s3, command, { expiresIn: 3600 });

    let thumbnailUrl: string | null = null;
    if (attachment.metadata && typeof attachment.metadata === 'object' && (attachment.metadata as AttachmentMetadata).thumbnailKey) {
      thumbnailUrl = await this.thumbnailService.getThumbnailUrl((attachment.metadata as AttachmentMetadata).thumbnailKey!);
    }

    return { 
      downloadUrl, 
      attachment: { ...attachment, thumbnailUrl },
    };
  }

  async getMessageAttachments(messageId: string): Promise<any[]> {
    const results = await this.drizzle.client.query.attachments.findMany({
      where: eq(attachments.messageId, messageId),
      orderBy: desc(attachments.createdAt),
    });

    const withThumbnails = await Promise.all(
      results.map(async (a) => {
        let thumbnailUrl: string | null = null;
        if (a.metadata && typeof a.metadata === 'object' && (a.metadata as AttachmentMetadata).thumbnailKey) {
          thumbnailUrl = await this.thumbnailService.getThumbnailUrl((a.metadata as AttachmentMetadata).thumbnailKey!);
        }
        return { ...a, thumbnailUrl };
      })
    );

    return withThumbnails;
  }

  async deleteAttachment(attachmentId: string, uploaderDeviceId: string): Promise<{ success: boolean }> {
    const attachment = await this.drizzle.client.query.attachments.findFirst({
      where: and(eq(attachments.id, attachmentId), eq(attachments.uploaderDeviceId, uploaderDeviceId)),
    });

    if (!attachment) throw new NotFoundException('Attachment not found');

    if (attachment.storageUrl) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.storageUrl }));
    }

    if (attachment.metadata && typeof attachment.metadata === 'object' && (attachment.metadata as AttachmentMetadata).thumbnailKey) {
      await this.thumbnailService.deleteThumbnail((attachment.metadata as AttachmentMetadata).thumbnailKey!);
    }

    await this.drizzle.client.delete(attachments).where(eq(attachments.id, attachmentId));
    return { success: true };
  }

  async cleanupExpiredAttachments(): Promise<number> {
    const expired = await this.drizzle.client.query.attachments.findMany({
      where: and(lt(attachments.expiresAt, new Date()), eq(attachments.uploadStatus, 'PENDING')),
    });

    for (const attachment of expired) {
      if (attachment.storageUrl) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.storageUrl }));
      }
      if (attachment.metadata && typeof attachment.metadata === 'object' && (attachment.metadata as AttachmentMetadata).thumbnailKey) {
        await this.thumbnailService.deleteThumbnail((attachment.metadata as AttachmentMetadata).thumbnailKey!);
      }
      await this.drizzle.client.delete(attachments).where(eq(attachments.id, attachment.id));
    }

    return expired.length;
  }

  async getAttachmentMetadata(attachmentId: string): Promise<AttachmentMetadata | null> {
    const attachment = await this.drizzle.client.query.attachments.findFirst({
      where: eq(attachments.id, attachmentId),
    });

    if (!attachment || !attachment.metadata) return null;
    return attachment.metadata as AttachmentMetadata;
  }

  async updateAttachmentMetadata(attachmentId: string, metadata: Partial<AttachmentMetadata>): Promise<any> {
    const existing = await this.drizzle.client.query.attachments.findFirst({
      where: eq(attachments.id, attachmentId),
    });

    if (!existing) throw new NotFoundException('Attachment not found');

    const currentMetadata = (existing.metadata as AttachmentMetadata) || { type: getAttachmentType(existing.mimeType), hasThumbnail: false };
    const mergedMetadata = { ...currentMetadata, ...metadata };

    const [updated] = await this.drizzle.client
      .update(attachments)
      .set({ metadata: mergedMetadata, updatedAt: new Date() })
      .where(eq(attachments.id, attachmentId))
      .returning();

    return updated;
  }

  async getPendingUploads(deviceId: string): Promise<any[]> {
    return this.drizzle.client.query.attachments.findMany({
      where: and(
        eq(attachments.uploaderDeviceId, deviceId),
        eq(attachments.uploadStatus, 'PENDING'),
      ),
      orderBy: desc(attachments.createdAt),
    });
  }

  async retryFailedUpload(attachmentId: string, uploaderDeviceId: string, userId: string): Promise<UploadInitiationResult> {
    const attachment = await this.drizzle.client.query.attachments.findFirst({
      where: and(eq(attachments.id, attachmentId), eq(attachments.uploaderDeviceId, uploaderDeviceId)),
    });

    if (!attachment) throw new NotFoundException('Attachment not found');
    if (attachment.uploadStatus !== 'FAILED' && attachment.uploadStatus !== 'PENDING') {
      throw new BadRequestException('Only failed or pending uploads can be retried');
    }

    const expiresIn = 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: attachment.storageUrl!,
      ContentType: attachment.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });

    const [updated] = await this.drizzle.client
      .update(attachments)
      .set({ 
        uploadStatus: 'PENDING', 
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(attachments.id, attachmentId))
      .returning();

    if (attachment.messageId) {
      await this.queueSyncOperation(userId, uploaderDeviceId, {
        operationType: 'ATTACHMENT_UPLOAD',
        entityType: 'attachments',
        entityId: attachmentId,
        payload: { attachmentId, messageId: attachment.messageId },
      });
    }

    return {
      attachmentId: attachment.id,
      uploadUrl,
      expiresAt,
    };
  }

  private async queueSyncOperation(
    userId: string,
    deviceId: string,
    data: { operationType: string; entityType: string; entityId: string; payload: any },
  ): Promise<void> {
    await this.drizzle.client.insert(syncOperations).values({
      userId,
      deviceId,
      operationType: data.operationType,
      entityType: data.entityType,
      entityId: data.entityId,
      payload: data.payload,
      idempotencyKey: `${data.operationType}:${data.entityType}:${data.entityId}:${Date.now()}`,
      status: 'PENDING',
      maxAttempts: 5,
    });
  }
}