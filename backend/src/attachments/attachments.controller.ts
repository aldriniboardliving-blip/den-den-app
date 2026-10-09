import { Controller, Post, Get, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AttachmentsService, UploadInitiationResult } from './attachments.service';
import { CurrentUser, CurrentDevice } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const createUploadSchema = z.object({
  filename: z.string().max(255),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
  encryptedKey: z.string().length(88),
  nonce: z.string().length(24),
  messageId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

type CreateUploadDto = z.infer<typeof createUploadSchema>;

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private attachments: AttachmentsService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Initiate attachment upload (get presigned URL)' })
  @ApiResponse({ status: 201, description: 'Upload URL generated' })
  async initiateUpload(
    @CurrentDevice('id') deviceId: string,
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(createUploadSchema)) dto: CreateUploadDto,
  ): Promise<UploadInitiationResult> {
    return this.attachments.initiateUpload(deviceId, dto, userId);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm attachment upload completed (client-side)' })
  @ApiResponse({ status: 200, description: 'Upload confirmed' })
  async confirmUpload(
    @CurrentDevice('id') deviceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') attachmentId: string,
  ) {
    return this.attachments.confirmUpload(attachmentId, deviceId, userId);
  }

  @Post(':id/process')
  @ApiOperation({ summary: 'Process upload completion (generate thumbnail, etc.)' })
  @ApiResponse({ status: 200, description: 'Upload processed' })
  async processUpload(
    @CurrentDevice('id') deviceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') attachmentId: string,
  ) {
    return this.attachments.processUploadCompletion(attachmentId, deviceId, userId);
  }

  @Get(':id/download-url')
  @ApiOperation({ summary: 'Get presigned URL for attachment download' })
  @ApiResponse({ status: 200, description: 'Download URL generated' })
  async getDownloadUrl(@Param('id') attachmentId: string, @CurrentDevice('id') deviceId: string) {
    return this.attachments.getDownloadUrl(attachmentId, deviceId);
  }

  @Get('messages/:messageId')
  @ApiOperation({ summary: 'Get attachments for a message' })
  @ApiResponse({ status: 200, description: 'Message attachments' })
  async getMessageAttachments(@Param('messageId') messageId: string) {
    return this.attachments.getMessageAttachments(messageId);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending uploads for current device' })
  @ApiResponse({ status: 200, description: 'Pending uploads' })
  async getPendingUploads(@CurrentDevice('id') deviceId: string) {
    return this.attachments.getPendingUploads(deviceId);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry failed upload' })
  @ApiResponse({ status: 200, description: 'Upload retried' })
  async retryUpload(
    @CurrentDevice('id') deviceId: string,
    @CurrentUser('id') userId: string,
    @Param('id') attachmentId: string,
  ): Promise<UploadInitiationResult> {
    return this.attachments.retryFailedUpload(attachmentId, deviceId, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an attachment' })
  @ApiResponse({ status: 200, description: 'Attachment deleted' })
  async delete(
    @CurrentDevice('id') deviceId: string,
    @Param('id') attachmentId: string,
  ) {
    return this.attachments.deleteAttachment(attachmentId, deviceId);
  }
}