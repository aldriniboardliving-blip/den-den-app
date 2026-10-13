export interface LinkedDevice {
  id: string;
  deviceName: string | null;
  platform: 'ios' | 'android' | 'web';
  platformVersion: string | null;
  appVersion: string | null;
  linkedAt: Date;
  lastActiveAt: Date | null;
  isPrimary: boolean;
}

export interface DeviceLinkRequest {
  primaryDeviceId: string;
  newDevicePublicKey: string;
  newDeviceSigningKey: string;
  newDeviceName?: string;
  platform: 'ios' | 'android' | 'web';
  platformVersion?: string;
  appVersion?: string;
}

export interface DeviceLinkChallenge {
  challengeId: string;
  primaryDeviceId: string;
  newDevicePublicKey: string;
  newDeviceSigningKey: string;
  newDeviceName?: string;
  platform: string;
  platformVersion?: string;
  appVersion?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: Date;
  expiresAt: Date;
  approvedAt?: Date;
}

export interface SyncKeyBundle {
  deviceId: string;
  identityKey: string;
  signedPreKey: { keyId: number; publicKey: string; signature: string };
  oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
}

export interface DeviceLinkInitiateResponse {
  challengeId: string;
  expiresAt: Date;
}

export interface DeviceLinkApproveResponse {
  success: boolean;
  deviceId?: string;
}

export interface LinkedDevicesResponse {
  devices: LinkedDevice[];
}

export interface RevokeDeviceResponse {
  success: boolean;
}