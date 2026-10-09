import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { attachments } from '../common/database/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { createId } from '../common/utils/id';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class AttachmentsService {
  private s3: S3Client;
  private bucket: string;

  constructor(
    private drizzle: DrizzleService,
    private config: ConfigService,
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

  async createUploadUrl(
    uploaderDeviceId: string,
    data: { filename: string; mimeType: string; sizeBytes: number; encryptedKey: string; nonce: string },
  ) {
    const key = `attachments/${uploaderDeviceId}/${createId()}-${data.filename}`;
    const expiresIn = 3600;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: data.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const [attachment] = await this.drizzle.client
      .insert(attachments)
      .values({
        uploaderDeviceId,
        filename: data.filename,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        encryptedKey: data.encryptedKey,
        nonce: data.nonce,
        storageUrl: key,
        uploadStatus: 'PENDING',
        expiresAt,
      })
      .returning();

    return { attachment, uploadUrl };
  }

  async confirmUpload(attachmentId: string, uploaderDeviceId: string) {
    const [attachment] = await this.drizzle.client
      .update(attachments)
      .set({ uploadStatus: 'COMPLETED', updatedAt: new Date() })
      .where(and(eq(attachments.id, attachmentId), eq(attachments.uploaderDeviceId, uploaderDeviceId)))
      .returning();

    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async getDownloadUrl(attachmentId: string, deviceId: string) {
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
    return { downloadUrl, attachment };
  }

  async getMessageAttachments(messageId: string) {
    return this.drizzle.client.query.attachments.findMany({
      where: eq(attachments.messageId, messageId),
      orderBy: desc(attachments.createdAt),
    });
  }

  async deleteAttachment(attachmentId: string, uploaderDeviceId: string) {
    const attachment = await this.drizzle.client.query.attachments.findFirst({
      where: and(eq(attachments.id, attachmentId), eq(attachments.uploaderDeviceId, uploaderDeviceId)),
    });

    if (!attachment) throw new NotFoundException('Attachment not found');
    if (!attachment.storageUrl) throw new NotFoundException('Attachment storage URL not available');

    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.storageUrl }));

    await this.drizzle.client.delete(attachments).where(eq(attachments.id, attachmentId));
    return { success: true };
  }

  async cleanupExpiredAttachments() {
    const expired = await this.drizzle.client.query.attachments.findMany({
      where: and(lt(attachments.expiresAt, new Date()), eq(attachments.uploadStatus, 'PENDING')),
    });

    for (const attachment of expired) {
      if (attachment.storageUrl) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.storageUrl }));
      }
      await this.drizzle.client.delete(attachments).where(eq(attachments.id, attachment.id));
    }

    return expired.length;
  }
}