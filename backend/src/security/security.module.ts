import { Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { SecurityController } from './security.controller';
import { RateLimitGuard } from './rate-limit.guard';
import { ReplayProtectionService } from './replay-protection.service';
import { CertificatePinningService } from './certificate-pinning.service';
import { BiometricLockService } from './biometric-lock.service';
import { AuditLogService } from './audit-log.service';
import { ThreatModelService } from './threat-model.service';

@Module({
  providers: [
    SecurityService,
    RateLimitGuard,
    ReplayProtectionService,
    CertificatePinningService,
    BiometricLockService,
    AuditLogService,
    ThreatModelService,
  ],
  controllers: [SecurityController],
  exports: [
    SecurityService,
    RateLimitGuard,
    ReplayProtectionService,
    CertificatePinningService,
    BiometricLockService,
    AuditLogService,
    ThreatModelService,
  ],
})
export class SecurityModule {}