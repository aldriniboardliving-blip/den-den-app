import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { CurrentUser, CurrentDevice } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const rotatePreKeySchema = z.object({
  publicKey: z.string().length(64),
  signature: z.string().length(88),
  keyId: z.number().int().positive(),
});

const addPreKeysSchema = z.object({
  keys: z.array(z.object({ keyId: z.number().int().positive(), publicKey: z.string().length(64) })).min(1).max(100),
});

type RotatePreKeyDto = z.infer<typeof rotatePreKeySchema>;
type AddPreKeysDto = z.infer<typeof addPreKeysSchema>;

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private devices: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'List current user devices' })
  @ApiResponse({ status: 200, description: 'User devices' })
  async list(@CurrentUser('id') userId: string) {
    return this.devices.listUserDevices(userId);
  }

  @Get(':deviceId/prekey-bundle')
  @ApiOperation({ summary: 'Get prekey bundle for a device (for X3DH)' })
  @ApiResponse({ status: 200, description: 'Prekey bundle' })
  @ApiResponse({ status: 404, description: 'Device not found or revoked' })
  async getPreKeyBundle(@Param('deviceId') deviceId: string) {
    return this.devices.getPreKeyBundle(deviceId);
  }

  @Patch(':deviceId/signed-prekey')
  @ApiOperation({ summary: 'Rotate signed prekey' })
  @ApiResponse({ status: 200, description: 'Prekey rotated' })
  async rotateSignedPreKey(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
    @Body(new ZodValidationPipe(rotatePreKeySchema)) dto: RotatePreKeyDto,
  ) {
    const device = await this.devices.findById(deviceId);
    if (device.userId !== userId) throw new Error('Not your device');
    return this.devices.rotateSignedPreKey(deviceId, dto);
  }

  @Post(':deviceId/onetime-prekeys')
  @ApiOperation({ summary: 'Add one-time prekeys' })
  @ApiResponse({ status: 200, description: 'Prekeys added' })
  async addOneTimePreKeys(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
    @Body(new ZodValidationPipe(addPreKeysSchema)) dto: AddPreKeysDto,
  ) {
    const device = await this.devices.findById(deviceId);
    if (device.userId !== userId) throw new Error('Not your device');
    return this.devices.addOneTimePreKeys(deviceId, dto.keys);
  }

  @Delete(':deviceId')
  @ApiOperation({ summary: 'Revoke a device' })
  @ApiResponse({ status: 200, description: 'Device revoked' })
  async revoke(@CurrentUser('id') userId: string, @Param('deviceId') deviceId: string) {
    return this.devices.revoke(userId, deviceId);
  }

  @Post('update-activity')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update device last active timestamp' })
  async updateActivity(@CurrentDevice('id') deviceId: string) {
    return this.devices.updateLastActive(deviceId);
  }
}