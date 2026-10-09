import { Controller, Post, Get, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MultiDeviceService, LinkedDevice, DeviceLinkRequest } from './multidevice.service';
import { CurrentUser, CurrentDevice } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const initiateLinkSchema = z.object({
  newDevicePublicKey: z.string().length(64),
  newDeviceSigningKey: z.string().length(64),
  newDeviceName: z.string().max(100).optional(),
  platform: z.enum(['ios', 'android', 'web']),
  platformVersion: z.string().optional(),
  appVersion: z.string().optional(),
});

const approveLinkSchema = z.object({
  approve: z.boolean(),
});

const syncKeysSchema = z.object({
  conversationId: z.string().uuid(),
  senderKeys: z.record(z.string(), z.string()),
});

const registerSenderKeySchema = z.object({
  conversationId: z.string().uuid(),
  senderKey: z.string().length(88),
});

type InitiateLinkDto = z.infer<typeof initiateLinkSchema>;
type ApproveLinkDto = z.infer<typeof approveLinkSchema>;
type SyncKeysDto = z.infer<typeof syncKeysSchema>;
type RegisterSenderKeyDto = z.infer<typeof registerSenderKeySchema>;

@ApiTags('multidevice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('multidevice')
export class MultiDeviceController {
  constructor(private multidevice: MultiDeviceService) {}

  @Post('link/initiate')
  @ApiOperation({ summary: 'Initiate device linking from primary device' })
  @ApiResponse({ status: 201, description: 'Link challenge created' })
  async initiateLink(
    @CurrentDevice('id') primaryDeviceId: string,
    @Body(new ZodValidationPipe(initiateLinkSchema)) dto: InitiateLinkDto,
  ) {
    return this.multidevice.initiateDeviceLink(primaryDeviceId, dto);
  }

  @Post('link/approve/:challengeId')
  @ApiOperation({ summary: 'Approve or reject device link request' })
  @ApiResponse({ status: 200, description: 'Link challenge resolved' })
  async approveLink(
    @CurrentDevice('id') primaryDeviceId: string,
    @Param('challengeId') challengeId: string,
    @Body(new ZodValidationPipe(approveLinkSchema)) dto: ApproveLinkDto,
  ) {
    return this.multidevice.approveDeviceLink(primaryDeviceId, challengeId, dto.approve);
  }

  @Get('linked')
  @ApiOperation({ summary: 'List all linked devices for current user' })
  @ApiResponse({ status: 200, description: 'Linked devices', type: [Object] })
  async getLinkedDevices(@CurrentUser('id') userId: string): Promise<LinkedDevice[]> {
    return this.multidevice.getLinkedDevices(userId);
  }

  @Delete('linked/:deviceId')
  @ApiOperation({ summary: 'Revoke a linked device' })
  @ApiResponse({ status: 200, description: 'Device revoked' })
  async revokeDevice(
    @CurrentUser('id') userId: string,
    @CurrentDevice('id') requestingDeviceId: string,
    @Param('deviceId') deviceIdToRevoke: string,
  ) {
    return this.multidevice.revokeDevice(userId, deviceIdToRevoke, requestingDeviceId);
  }

  @Post('sync/keys')
  @ApiOperation({ summary: 'Sync sender keys for group conversations' })
  @ApiResponse({ status: 200, description: 'Keys synced' })
  async syncKeys(
    @CurrentDevice('id') deviceId: string,
    @Body(new ZodValidationPipe(syncKeysSchema)) dto: SyncKeysDto,
  ) {
    const senderKeys = new Map(Object.entries(dto.senderKeys));
    return this.multidevice.syncConversationKeys(deviceId, dto.conversationId, senderKeys);
  }

  @Post('sync/sender-key')
  @ApiOperation({ summary: 'Register sender key for a conversation' })
  @ApiResponse({ status: 200, description: 'Sender key registered' })
  async registerSenderKey(
    @CurrentDevice('id') deviceId: string,
    @Body(new ZodValidationPipe(registerSenderKeySchema)) dto: RegisterSenderKeyDto,
  ) {
    return this.multidevice.registerSenderKey(deviceId, dto.conversationId, dto.senderKey);
  }

  @Get('sync/history')
  @ApiOperation({ summary: 'Sync conversation history for new device' })
  @ApiResponse({ status: 200, description: 'Conversation history' })
  async syncHistory(
    @CurrentDevice('id') deviceId: string,
    @Query('conversationId') conversationId: string,
    @Query('since') since?: string,
  ) {
    return this.multidevice.syncConversationHistory(deviceId, conversationId, since ? new Date(since) : undefined);
  }

  @Get('sync/pending')
  @ApiOperation({ summary: 'Get pending sync operations' })
  @ApiResponse({ status: 200, description: 'Pending sync operations' })
  async getPendingSync(@CurrentDevice('id') deviceId: string, @Query('limit') limit?: string) {
    return this.multidevice.getPendingSyncOperations(deviceId, limit ? parseInt(limit) : 50);
  }
}