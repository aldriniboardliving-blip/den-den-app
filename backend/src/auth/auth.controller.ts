import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService, AuthTokens } from './auth.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const sendOtpSchema = z.object({
  identifier: z.string().min(1),
  identifierType: z.enum(['email', 'phone']),
});

const verifyOtpSchema = z.object({
  identifier: z.string().min(1),
  identifierType: z.enum(['email', 'phone']),
  code: z.string().length(6),
  device: z.object({
    deviceName: z.string().optional(),
    platform: z.enum(['ios', 'android', 'web']),
    platformVersion: z.string().optional(),
    appVersion: z.string().optional(),
    identityKeyPublic: z.string().length(64),
    signingKeyPublic: z.string().length(64),
    signedPreKeyPublic: z.string().length(64),
    signedPreKeySignature: z.string().length(88),
    signedPreKeyId: z.number().int().positive(),
    oneTimePreKeys: z.array(z.object({ keyId: z.number().int().positive(), publicKey: z.string().length(64) })).min(1).max(100),
  }),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

type SendOtpDto = z.infer<typeof sendOtpSchema>;
type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
type RefreshDto = z.infer<typeof refreshSchema>;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to email or phone' })
  @ApiResponse({ status: 200, description: 'OTP sent' })
  @ApiResponse({ status: 400, description: 'Invalid identifier' })
  async sendOtp(@Body(new ZodValidationPipe(sendOtpSchema)) dto: SendOtpDto) {
    await this.auth.sendOtp(dto.identifier, dto.identifierType);
    return { success: true };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and register device' })
  @ApiResponse({ status: 200, description: 'Authentication successful', type: Object })
  @ApiResponse({ status: 401, description: 'Invalid OTP' })
  async verifyOtp(@Body(new ZodValidationPipe(verifyOtpSchema)) dto: VerifyOtpDto): Promise<AuthTokens> {
    return this.auth.verifyOtpAndRegister(
      dto.identifier,
      dto.identifierType,
      dto.code,
      dto.device,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed', type: Object })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto): Promise<AuthTokens> {
    return this.auth.refreshTokens(dto.refreshToken);
  }
}