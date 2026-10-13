// src/security/certificate-pinning.config.ts
// Certificate pinning configuration for production

export interface PinConfig {
  hostname: string;
  primaryFingerprint: string;
  backupFingerprints: string[];
  expiryDate: string; // ISO 8601
  enforceInProduction: boolean;
}

export const CERTIFICATE_PINS: PinConfig[] = [
  {
    hostname: 'api.den-den.app',
    primaryFingerprint: 'SHA256:PRIMARY_FINGERPRINT_HERE',
    backupFingerprints: [
      'SHA256:BACKUP_FINGERPRINT_1_HERE',
      'SHA256:BACKUP_FINGERPRINT_2_HERE',
    ],
    expiryDate: '2027-10-13T00:00:00.000Z',
    enforceInProduction: true,
  },
  {
    hostname: 'ws.den-den.app',
    primaryFingerprint: 'SHA256:WS_PRIMARY_FINGERPRINT_HERE',
    backupFingerprints: [
      'SHA256:WS_BACKUP_FINGERPRINT_1_HERE',
    ],
    expiryDate: '2027-10-13T00:00:00.000Z',
    enforceInProduction: true,
  },
];

export interface PinningConfig {
  enabled: boolean;
  pins: PinConfig[];
  reportOnly: boolean;
  logViolations: boolean;
}

export const PINNING_CONFIG: PinningConfig = {
  enabled: __DEV__ ? false : true, // Disabled in development
  pins: CERTIFICATE_PINS,
  reportOnly: false,
  logViolations: true,
};

export function getPinsForHost(hostname: string): PinConfig | undefined {
  return CERTIFICATE_PINS.find(pin => pin.hostname === hostname);
}

export function isPinExpired(pin: PinConfig): boolean {
  return new Date(pin.expiryDate) < new Date();
}

export function validatePinConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const pin of CERTIFICATE_PINS) {
    // Validate fingerprint format (SHA256:BASE64 or hex)
    const primaryValid = /^SHA256:[A-Za-z0-9+/=]+$/.test(pin.primaryFingerprint) ||
                         /^[A-F0-9]{64}$/i.test(pin.primaryFingerprint);
    if (!primaryValid) {
      errors.push(`Invalid primary fingerprint format for ${pin.hostname}`);
    }

    // Validate backup fingerprints
    for (const backup of pin.backupFingerprints) {
      const backupValid = /^SHA256:[A-Za-z0-9+/=]+$/.test(backup) ||
                          /^[A-F0-9]{64}$/i.test(backup);
      if (!backupValid) {
        errors.push(`Invalid backup fingerprint format for ${pin.hostname}: ${backup}`);
      }
    }

    // Check expiry
    if (isPinExpired(pin)) {
      errors.push(`Certificate pin expired for ${pin.hostname}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Example .env.production values:
/*
API_HOST=api.den-den.app
WS_HOST=ws.den-den.app
CERT_PIN_PRIMARY=SHA256:base64_encoded_sha256_fingerprint
CERT_PIN_BACKUP=SHA256:backup1,SHA256:backup2
WS_CERT_PIN_PRIMARY=SHA256:ws_base64_encoded_sha256_fingerprint
WS_CERT_PIN_BACKUP=SHA256:ws_backup1
ENABLE_CERT_PINNING=true
*/

export function loadPinsFromEnv(): PinConfig[] {
  const pins: PinConfig[] = [];

  // API pin
  const apiHost = (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_API_HOST'] || 'api.den-den.app';
  const apiPrimary = (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_CERT_PIN_PRIMARY'];
  const apiBackup = ((process.env as Record<string, string | undefined>)['EXPO_PUBLIC_CERT_PIN_BACKUP'] || '').split(',').filter(Boolean);

  if (apiPrimary) {
    pins.push({
      hostname: apiHost,
      primaryFingerprint: apiPrimary,
      backupFingerprints: apiBackup,
      expiryDate: (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_CERT_PIN_EXPIRY'] || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      enforceInProduction: true,
    });
  }

  // WebSocket pin
  const wsHost = (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_WS_HOST'] || 'ws.den-den.app';
  const wsPrimary = (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_WS_CERT_PIN_PRIMARY'];
  const wsBackup = ((process.env as Record<string, string | undefined>)['EXPO_PUBLIC_WS_CERT_PIN_BACKUP'] || '').split(',').filter(Boolean);

  if (wsPrimary) {
    pins.push({
      hostname: wsHost,
      primaryFingerprint: wsPrimary,
      backupFingerprints: wsBackup,
      expiryDate: (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_CERT_PIN_EXPIRY'] || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      enforceInProduction: true,
    });
  }

  return pins;
}