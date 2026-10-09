import { Controller, Post, Get, Param, Query, Body, HttpCode, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService, MessageEnvelope } from './messages.service';
import { CurrentUser, CurrentDevice } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const envelopeSchema = z.object({
  messageId: z.string().uuid(),
  senderDeviceId: z.string().uuid(),
  recipientDeviceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  ciphertext: z.string().min(1),
  nonce: z.string().min(1),
  ephemeralPublic: z.string().length(64),
  signedPreKeyId: z.number().int().positive(),
  onetimePreKeyId: z.number().int().positive().optional(),
  sentAt: z.string().datetime(),
});

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  type: z.enum(['TEXT', 'IMAGE', 'FILE', 'SYSTEM', 'EDIT', 'DELETE']).default('TEXT'),
  content: z.string().optional(),
  contentHash: z.string().length(64).optional(),
  editOfMessageId: z.string().uuid().optional(),
  envelopes: z.array(envelopeSchema).min(1),
});

const ackSchema = z.object({
  status: z.enum(['DELIVERED', 'READ']),
  clientMessageId: z.string().uuid().optional(),
});

const preKeyBundleSchema = z.object({
  deviceId: z.string().uuid(),
});

const rotatePreKeySchema = z.object({
  publicKey: z.string().length(64),
  signature: z.string().length(88),
  keyId: z.number().int().positive(),
});

const addPreKeysSchema = z.object({
  keys: z.array(z.object({
    keyId: z.number().int().positive(),
    publicKey: z.string().length(64),
    privateKey: z.string().length(64),
  })).min(1).max(100),
});

type SendMessageDto = z.infer<typeof sendMessageSchema>;
type AckDto = z.infer<typeof ackSchema>;
type PreKeyBundleDto = z.infer<typeof preKeyBundleSchema>;
type RotatePreKeyDto = z.infer<typeof rotatePreKeySchema>;
type AddPreKeysDto = z.infer<typeof addPreKeysSchema>;

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a message (encrypted envelope)' })
  @ApiResponse({ status: 201, description: 'Message sent and relayed' })
  async send(
    @CurrentDevice('id') senderDeviceId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
  ) {
    return this.messages.send(senderDeviceId, dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending messages for current device' })
  @ApiResponse({ status: 200, description: 'Pending relay messages' })
  async getPending(
    @CurrentDevice('id') deviceId: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.getPendingForDevice(deviceId, limit ? parseInt(limit) : 50);
  }

  @Post(':id/ack')
  @HttpCode(200)
  @ApiOperation({ summary: 'Acknowledge message delivery (triggers relay deletion)' })
  @ApiResponse({ status: 200, description: 'Acknowledged' })
  async ack(
    @CurrentDevice('id') deviceId: string,
    @Param('id') messageId: string,
    @Body(new ZodValidationPipe(ackSchema)) dto: AckDto,
  ) {
    return this.messages.ack(messageId, deviceId, dto.status, dto.clientMessageId);
  }

  @Get('conversations/:conversationId')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiResponse({ status: 200, description: 'Conversation messages' })
  async getConversationMessages(
    @CurrentDevice('id') deviceId: string,
    @Param('conversationId') conversationId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messages.getConversationMessages(
      conversationId,
      deviceId,
      before ? new Date(before) : undefined,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark message as read' })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  async markRead(@CurrentDevice('id') deviceId: string, @Param('id') messageId: string) {
    return this.messages.markAsRead(messageId, deviceId);
  }

  @Get('session/prekey-bundle')
  @ApiOperation({ summary: 'Get prekey bundle for session establishment' })
  @ApiResponse({ status: 200, description: 'Prekey bundle' })
  async getPreKeyBundle(
    @CurrentDevice('id') deviceId: string,
    @Query('deviceId') recipientDeviceId: string,
  ) {
    return this.messages.getPreKeyBundle(recipientDeviceId);
  }

  @Get('session/has')
  @ApiOperation({ summary: 'Check if session exists with device' })
  @ApiResponse({ status: 200, description: 'Session exists' })
  async hasSession(
    @CurrentDevice('id') senderDeviceId: string,
    @Query('deviceId') recipientDeviceId: string,
  ) {
    const has = await this.messages.hasSession(senderDeviceId, recipientDeviceId);
    return { hasSession: has };
  }

  @Patch('session/signed-prekey')
  @ApiOperation({ summary: 'Rotate signed prekey' })
  @ApiResponse({ status: 200, description: 'Prekey rotated' })
  async rotateSignedPreKey(
    @CurrentDevice('id') deviceId: string,
    @Body(new ZodValidationPipe(rotatePreKeySchema)) dto: RotatePreKeyDto,
  ) {
    return this.messages.rotateSignedPreKey(deviceId, dto);
  }

  @Post('session/onetime-prekeys')
  @ApiOperation({ summary: 'Add one-time prekeys' })
  @ApiResponse({ status: 200, description: 'Prekeys added' })
  async addOneTimePreKeys(
    @CurrentDevice('id') deviceId: string,
    @Body(new ZodValidationPipe(addPreKeysSchema)) dto: AddPreKeysDto,
  ) {
    return this.messages.addOneTimePreKeys(deviceId, dto.keys);
  }
}