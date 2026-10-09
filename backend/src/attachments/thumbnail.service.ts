import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { ThumbnailGenerationResult, AttachmentType, getAttachmentType } from './attachments.types';

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
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

  async generateThumbnail(
    attachmentKey: string,
    mimeType: string,
  ): Promise<ThumbnailGenerationResult | null> {
    const type = getAttachmentType(mimeType);
    
    if (type !== 'image' && type !== 'video') {
      return null;
    }

    try {
      const downloadUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: attachmentKey }),
        { expiresIn: 3600 },
      );

      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      let thumbnailBuffer: Buffer;
      let width: number;
      let height: number;

      if (type === 'image') {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;

        thumbnailBuffer = await sharp(buffer)
          .rotate()
          .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: THUMBNAIL_QUALITY })
          .toBuffer();
      } else {
        // Video thumbnail - extract first frame
        // Note: This requires ffmpeg. For now, return a placeholder.
        // In production, use fluent-ffmpeg or similar
        return null;
      }

      const thumbnailKey = `thumbnails/${attachmentKey.replace(/\.[^.]+$/, '')}-thumb.jpg`;
      
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        }),
      );

      const thumbMetadata = await sharp(thumbnailBuffer).metadata();

      return {
        thumbnailKey,
        width: thumbMetadata.width || 0,
        height: thumbMetadata.height || 0,
        sizeBytes: thumbnailBuffer.length,
      };
    } catch (error) {
      this.logger.warn(`Failed to generate thumbnail for ${attachmentKey}: ${error.message}`);
      return null;
    }
  }

  async generateThumbnailFromBuffer(
    buffer: Buffer,
    mimeType: string,
    originalKey: string,
  ): Promise<ThumbnailGenerationResult | null> {
    const type = getAttachmentType(mimeType);
    
    if (type !== 'image') {
      return null;
    }

    try {
      const metadata = await sharp(buffer).metadata();
      
      const thumbnailBuffer = await sharp(buffer)
        .rotate()
        .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: THUMBNAIL_QUALITY })
        .toBuffer();

      const thumbnailKey = `thumbnails/${originalKey.replace(/\.[^.]+$/, '')}-thumb.jpg`;
      
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailKey,
          Body: thumbnailBuffer,
          ContentType: 'image/jpeg',
        }),
      );

      const thumbMetadata = await sharp(thumbnailBuffer).metadata();

      return {
        thumbnailKey,
        width: thumbMetadata.width || 0,
        height: thumbMetadata.height || 0,
        sizeBytes: thumbnailBuffer.length,
      };
    } catch (error) {
      this.logger.warn(`Failed to generate thumbnail from buffer: ${error.message}`);
      return null;
    }
  }

  async getThumbnailUrl(thumbnailKey: string): Promise<string | null> {
    if (!thumbnailKey) return null;

    try {
      const downloadUrl = await getSignedUrl(
        this.s3,
        new GetObjectCommand({ Bucket: this.bucket, Key: thumbnailKey }),
        { expiresIn: 3600 },
      );
      return downloadUrl;
    } catch (error) {
      this.logger.warn(`Failed to get thumbnail URL: ${error.message}`);
      return null;
    }
  }

  async deleteThumbnail(thumbnailKey: string): Promise<void> {
    if (!thumbnailKey) return;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: thumbnailKey,
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to delete thumbnail: ${error.message}`);
    }
  }
}

const THUMBNAIL_MAX_DIMENSION = 320;
const THUMBNAIL_QUALITY = 80;