// src/features/auth/api.ts
import { api } from '@/api/client';
import type { AuthResponse } from './types';

export async function requestOtp(identifier: string, type: 'EMAIL' | 'SMS', purpose: string) {
  return api.requestOtp(identifier, type, purpose);
}

export async function verifyOtp(
  identifier: string,
  code: string,
  type: 'EMAIL' | 'SMS',
  purpose: string,
  deviceInfo: any
): Promise<AuthResponse> {
  return api.verifyOtp(identifier, code, type, purpose, deviceInfo);
}

export async function refreshToken(): Promise<{ accessToken: string }> {
  return api.refreshAccessToken();
}

export async function getMe(): Promise<any> {
  return api.getMe();
}

export async function getDevices(): Promise<any[]> {
  const result = await api.getDevices();
  return result as any[];
}

export async function updateDeviceKeys(deviceId: string, device: any): Promise<void> {
  return api.updateDeviceKeys(deviceId, device);
}