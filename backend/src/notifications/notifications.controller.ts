import { Controller, Post, Delete, Body, Param, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, CurrentDevice } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['expo', 'fcm', 'apns']),
});

const sendNotificationSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  data: z.record(z.string(), z.any()).optional(),
});

type RegisterTokenDto = z.infer<typeof registerTokenSchema>;
type SendNotificationDto = z.infer<typeof sendNotificationSchema>;

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push-tokens')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Register push token' })
  @ApiResponse({ status: 201, description: 'Token registered' })
  async register(
    @CurrentDevice('id') deviceId: string,
    @Body(new ZodValidationPipe(registerTokenSchema)) dto: RegisterTokenDto,
  ) {
    return this.notifications.registerToken(deviceId, dto.token, dto.platform);
  }

  @Delete(':token')
  @ApiOperation({ summary: 'Unregister push token' })
  @ApiResponse({ status: 200, description: 'Token unregistered' })
  async unregister(
    @CurrentDevice('id') deviceId: string,
    @Param('token') token: string,
  ) {
    return this.notifications.unregisterToken(deviceId, token);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send push notification to current user' })
  @ApiResponse({ status: 200, description: 'Notification sent' })
  async sendToSelf(
    @CurrentUser('id') userId: string,
    @Body(new ZodValidationPipe(sendNotificationSchema)) dto: SendNotificationDto,
  ) {
    return this.notifications.sendToUser(userId, dto);
  }
}