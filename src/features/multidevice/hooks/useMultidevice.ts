import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { api } from '@/api/client';
import { LinkedDevice, DeviceLinkChallenge, DeviceLinkRequest } from '../types';

export function useLinkedDevices() {
  const { user } = useAuthStore();
  const [devices, setDevices] = useState<LinkedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getLinkedDevices();
      setDevices(response.devices as LinkedDevice[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const revokeDevice = useCallback(async (deviceId: string) => {
    if (!user) return;
    try {
      await api.revokeDevice(deviceId);
      await loadDevices();
    } catch (err) {
      throw err;
    }
  }, [user, loadDevices]);

  return {
    devices,
    loading,
    error,
    refresh: loadDevices,
    revokeDevice,
  };
}

export function useDeviceLink() {
  const { device } = useAuthStore();
  const [challenge, setChallenge] = useState<DeviceLinkChallenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateLink = useCallback(async (request: Omit<DeviceLinkRequest, 'primaryDeviceId'>) => {
    if (!device) throw new Error('No current device');
    setLoading(true);
    setError(null);
    try {
      const response = await api.initiateDeviceLink(request);
      setChallenge({
        challengeId: response.challengeId,
        primaryDeviceId: device.id,
        newDevicePublicKey: request.newDevicePublicKey,
        newDeviceSigningKey: request.newDeviceSigningKey,
        newDeviceName: request.newDeviceName,
        platform: request.platform,
        platformVersion: request.platformVersion,
        appVersion: request.appVersion,
        status: 'PENDING',
        createdAt: new Date(),
        expiresAt: response.expiresAt,
      });
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate device link');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [device]);

  const approveLink = useCallback(async (challengeId: string, approve: boolean) => {
    if (!device) throw new Error('No current device');
    setLoading(true);
    setError(null);
    try {
      const response = await api.approveDeviceLink(challengeId, approve);
      if (response.success) {
        setChallenge(null);
      }
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve device link');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [device]);

  const clearChallenge = useCallback(() => {
    setChallenge(null);
    setError(null);
  }, []);

  return {
    challenge,
    loading,
    error,
    initiateLink,
    approveLink,
    clearChallenge,
  };
}

export function useDeviceLinkListener() {
  const { user } = useAuthStore();
  const [pendingChallenge, setPendingChallenge] = useState<DeviceLinkChallenge | null>(null);

  useEffect(() => {
    if (!user) return;

    const handleLinkRequest = (data: any) => {
      setPendingChallenge({
        challengeId: data.challengeId,
        primaryDeviceId: data.primaryDeviceId,
        newDevicePublicKey: '',
        newDeviceSigningKey: '',
        newDeviceName: data.newDeviceName,
        platform: data.platform,
        platformVersion: undefined,
        appVersion: undefined,
        status: 'PENDING',
        createdAt: new Date(),
        expiresAt: new Date(data.expiresAt),
      });
    };

    // In a real implementation, this would subscribe to realtime events
    // For now, we'll use a polling mechanism or the realtime hook
    
    return () => {
      // Cleanup
    };
  }, [user]);

  return { pendingChallenge, setPendingChallenge };
}