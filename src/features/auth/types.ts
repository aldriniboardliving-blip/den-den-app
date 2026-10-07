// src/features/auth/types.ts

export type AuthProvider = 'EMAIL' | 'SMS' | 'PASSKEY';

export type AuthStep = 'IDENTIFIER' | 'OTP' | 'DEVICE_REGISTRATION' | 'COMPLETE';

export interface User {
  id: string;
  accountId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Device {
  id: string;
  deviceName: string | null;
  platform: string;
  isPrimary: boolean;
  registeredAt: number;
}

export interface AuthState {
  // Auth flow state
  step: AuthStep;
  identifier: string;
  provider: AuthProvider;
  isLoading: boolean;
  error: string | null;
  otpSent: boolean;
  otpExpiresAt: number | null;
  deviceRegistered: boolean;
  
  // Authenticated state
  user: User | null;
  device: Device | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  
  // Actions
  setStep: (step: AuthStep) => void;
  setIdentifier: (identifier: string) => void;
  setProvider: (provider: AuthProvider) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setOtpSent: (sent: boolean) => void;
  setOtpExpiresAt: (expiresAt: number | null) => void;
  setDeviceRegistered: (registered: boolean) => void;
  setAuth: (user: User, device: Device, accessToken: string, refreshToken: string) => void;
  sendOtp: () => Promise<void>;
  verify: (code: string) => Promise<void>;
  logout: () => void;
  reset: () => void;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  device: Device;
}

export interface OtpRequest {
  identifier: string;
  type: 'EMAIL' | 'SMS';
  purpose: string;
}

export interface OtpVerifyRequest {
  identifier: string;
  code: string;
  type: 'EMAIL' | 'SMS';
  purpose: string;
  deviceInfo: any;
}