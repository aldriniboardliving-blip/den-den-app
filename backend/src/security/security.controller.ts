import { Controller, Get, Post, Body, Param, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { ReplayProtectionService } from './replay-protection.service';
import { CertificatePinningService } from './certificate-pinning.service';
import { BiometricLockService } from './biometric-lock.service';
import { AuditLogService, AuditQuery } from './audit-log.service';
import { ThreatModelService } from './threat-model.service';
import { CurrentUser, CurrentDevice } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

@ApiTags('security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('security')
export class SecurityController {
  constructor(
    private security: SecurityService,
    private replay: ReplayProtectionService,
    private certPinning: CertificatePinningService,
    private biometric: BiometricLockService,
    private audit: AuditLogService,
    private threatModel: ThreatModelService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get security configuration' })
  @ApiResponse({ status: 200, description: 'Security config' })
  getConfig() {
    return this.security.getConfig();
  }

  @Get('audit')
  @ApiOperation({ summary: 'Query audit logs' })
  @ApiResponse({ status: 200, description: 'Audit log entries' })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('outcome') outcome?: 'SUCCESS' | 'FAILURE' | 'PARTIAL',
    @Query('severity') severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.query({
      userId,
      deviceId,
      action,
      resource,
      outcome,
      severity,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get('audit/stats')
  @ApiOperation({ summary: 'Get audit statistics' })
  @ApiResponse({ status: 200, description: 'Audit statistics' })
  async getAuditStats(
    @Query('userId') userId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('days') days?: string,
  ) {
    return this.audit.getStats(userId, deviceId, days ? parseInt(days) : 30);
  }

  @Get('audit/export')
  @ApiOperation({ summary: 'Export audit logs' })
  @ApiResponse({ status: 200, description: 'Exported audit logs' })
  async exportAuditLogs(
    @Query('format') format?: 'json' | 'csv',
    @Query('userId') userId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.audit.exportLogs({
      userId,
      deviceId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    }, format || 'json');
  }

  @Post('replay/check')
  @ApiOperation({ summary: 'Check message for replay' })
  @ApiResponse({ status: 200, description: 'Replay check result' })
  async checkReplay(
    @Body() body: {
      messageId: string;
      senderDeviceId: string;
      recipientDeviceId: string;
      timestamp: number;
      nonce: string;
    },
  ) {
    return this.replay.checkAndRecord(body);
  }

  @Get('replay/count')
  @ApiOperation({ summary: 'Get processed message count' })
  @ApiResponse({ status: 200, description: 'Message count' })
  async getReplayCount(
    @CurrentDevice('id') deviceId: string,
    @Query('windowMs') windowMs?: string,
  ) {
    return { count: await this.replay.getProcessedCount(deviceId, windowMs ? parseInt(windowMs) : 60 * 60 * 1000) };
  }

  @Get('cert-pins')
  @ApiOperation({ summary: 'Get configured certificate pins' })
  @ApiResponse({ status: 200, description: 'Certificate pins' })
  getCertPins() {
    return this.certPinning.getConfiguredHosts().map(h => ({
      hostname: h,
      ...this.certPinning.getPinInfo(h),
    }));
  }

  @Post('cert-pins/validate')
  @ApiOperation({ summary: 'Validate certificate pin' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validatePin(
    @Body() body: { hostname: string; certificate: string },
  ) {
    return this.certPinning.validatePin(body.hostname, body.certificate);
  }

  @Get('biometric/state')
  @ApiOperation({ summary: 'Get app lock state' })
  @ApiResponse({ status: 200, description: 'Lock state' })
  async getLockState(@CurrentDevice('id') deviceId: string) {
    return this.biometric.getLockState(deviceId);
  }

  @Post('biometric/lock')
  @ApiOperation({ summary: 'Lock the app' })
  @ApiResponse({ status: 200, description: 'App locked' })
  async lockApp(@CurrentDevice('id') deviceId: string) {
    return this.biometric.lockDevice(deviceId);
  }

  @Post('biometric/unlock')
  @ApiOperation({ summary: 'Unlock the app' })
  @ApiResponse({ status: 200, description: 'App unlocked' })
  async unlockApp(@CurrentDevice('id') deviceId: string) {
    return this.biometric.unlockDevice(deviceId);
  }

  @Get('biometric/credentials')
  @ApiOperation({ summary: 'List registered biometric credentials' })
  @ApiResponse({ status: 200, description: 'Biometric credentials' })
  async listBiometrics(@CurrentDevice('id') deviceId: string) {
    return this.biometric.listBiometrics(deviceId);
  }

  @Delete('biometric/credentials/:credentialId')
  @ApiOperation({ summary: 'Remove biometric credential' })
  @ApiResponse({ status: 200, description: 'Credential removed' })
  async removeBiometric(
    @CurrentDevice('id') deviceId: string,
    @Param('credentialId') credentialId: string,
  ) {
    return this.biometric.removeBiometric(deviceId, credentialId);
  }

  @Post('biometric/require')
  @ApiOperation({ summary: 'Set biometric requirement' })
  @ApiResponse({ status: 200, description: 'Requirement updated' })
  async setRequireBiometric(
    @CurrentDevice('id') deviceId: string,
    @Body() body: { require: boolean },
  ) {
    return this.biometric.setRequireBiometric(deviceId, body.require);
  }

  @Get('threats')
  @ApiOperation({ summary: 'Get threat model' })
  @ApiResponse({ status: 200, description: 'Threats' })
  async getThreats(
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.threatModel.getThreats(category as any, status);
  }

  @Get('threats/report')
  @ApiOperation({ summary: 'Generate threat model report' })
  @ApiResponse({ status: 200, description: 'Threat model report' })
  async getReport() {
    return this.threatModel.generateReport();
  }

  @Get('threats/export')
  @ApiOperation({ summary: 'Export threat model' })
  @ApiResponse({ status: 200, description: 'Exported threat model' })
  async exportModel() {
    return this.threatModel.exportModel();
  }
}