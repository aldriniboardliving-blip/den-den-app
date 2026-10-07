// src/features/contacts/utils/verification.ts
export type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'BLOCKED' | 'PENDING';

export function getVerificationStatusColor(status: VerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return '#00d992';
    case 'BLOCKED':
      return '#ff453a';
    case 'PENDING':
      return '#ff9f0a';
    case 'UNVERIFIED':
    default:
      return '#8b949e';
  }
}

export function getVerificationStatusLabel(status: VerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'Verified';
    case 'BLOCKED':
      return 'Blocked';
    case 'PENDING':
      return 'Pending';
    case 'UNVERIFIED':
    default:
      return 'Unverified';
  }
}

export function formatSafetyNumber(safetyNumber: string): string {
  // Format as groups of 4 characters separated by spaces
  return safetyNumber.match(/.{1,4}/g)?.join(' ') || safetyNumber;
}

export function parseSafetyNumber(formatted: string): string {
  return formatted.replace(/\s/g, '');
}

export function generateQRCodeData(
  accountId: string,
  deviceId: string,
  identityKeyPublic: string,
  safetyNumber: string
): string {
  const data = {
    type: 'contact_verification',
    accountId,
    deviceId,
    identityKeyPublic,
    safetyNumber,
    timestamp: Date.now(),
  };
  return JSON.stringify(data);
}

export function parseQRCodeData(qrData: string): {
  type: string;
  accountId: string;
  deviceId: string;
  identityKeyPublic: string;
  safetyNumber: string;
  timestamp: number;
} | null {
  try {
    const parsed = JSON.parse(qrData);
    if (parsed.type !== 'contact_verification') return null;
    return parsed;
  } catch {
    return null;
  }
}