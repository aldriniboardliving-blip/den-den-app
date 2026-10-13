// src/features/multidevice/__tests__/useMultidevice.test.js
// Unit tests for useMultidevice hook

import { describe, it, expect, vi, beforeEach, act } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLinkedDevices, useDeviceLink } from '../hooks/useMultidevice';

// Mock dependencies
vi.mock('@/features/auth/store', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', accountId: 'den_test' },
    device: { id: 'device-1' },
    isAuthenticated: true,
    isLoading: false,
    setAuth: vi.fn(),
    logout: vi.fn(),
    setLoading: vi.fn(),
  }),
}));

vi.mock('@/api/client', () => ({
  api: {
    getLinkedDevices: vi.fn().mockResolvedValue({
      devices: [
        {
          id: 'device-1',
          deviceName: 'iPhone 15',
          platform: 'ios',
          platformVersion: '17.2',
          appVersion: '1.0.0',
          linkedAt: new Date('2024-01-01'),
          lastActiveAt: new Date('2024-01-15'),
          isPrimary: true,
        },
        {
          id: 'device-2',
          deviceName: 'iPad Pro',
          platform: 'ios',
          platformVersion: '17.2',
          appVersion: '1.0.0',
          linkedAt: new Date('2024-01-10'),
          lastActiveAt: new Date('2024-01-14'),
          isPrimary: false,
        },
      ],
    }),
    revokeDevice: vi.fn().mockResolvedValue({ success: true }),
    initiateDeviceLink: vi.fn().mockResolvedValue({
      challengeId: 'challenge-123',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }),
    approveDeviceLink: vi.fn().mockResolvedValue({
      success: true,
      deviceId: 'device-3',
    }),
  },
}));

describe('useLinkedDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load devices on mount', async () => {
    const { result } = renderHook(() => useLinkedDevices());
    
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    expect(result.current.devices).toHaveLength(2);
    expect(result.current.devices[0].id).toBe('device-1');
    expect(result.current.devices[0].isPrimary).toBe(true);
    expect(result.current.devices[1].isPrimary).toBe(false);
  });

  it('should refresh devices', async () => {
    const { result } = renderHook(() => useLinkedDevices());
    
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    await act(async () => {
      await result.current.refresh();
    });
    
    expect(result.current.devices).toHaveLength(2);
  });

  it('should revoke device', async () => {
    const { result } = renderHook(() => useLinkedDevices());
    
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    await act(async () => {
      await result.current.revokeDevice('device-2');
    });
    
    expect(result.current.devices).toHaveLength(1);
    expect(result.current.devices.find(d => d.id === 'device-2')).toBeUndefined();
  });

  it('should handle revoke error', async () => {
    const { api } = await import('@/api/client');
    api.revokeDevice).mockRejectedValueOnce(new Error('Failed to revoke'));
    
    const { result } = renderHook(() => useLinkedDevices());
    
    await waitFor(() => expect(result.current.loading).toBe(false));
    
    await expect(
      act(async () => {
        await result.current.revokeDevice('device-2');
      })
    ).rejects.toThrow('Failed to revoke');
  });
});

describe('useDeviceLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initiate device link', async () => {
    const { result } = renderHook(() => useDeviceLink());
    
    await act(async () => {
      await result.current.initiateLink({
        newDevicePublicKey: 'pubkey-123',
        newDeviceSigningKey: 'signkey-123',
        newDeviceName: 'New iPhone',
        platform: 'ios',
        platformVersion: '17.2',
        appVersion: '1.0.0',
      });
    });
    
    expect(result.current.challenge).toBeDefined();
    expect(result.current.challenge.challengeId).toBe('challenge-123');
    expect(result.current.challenge.status).toBe('PENDING');
  });

  it('should approve device link', async () => {
    const { result } = renderHook(() => useDeviceLink());
    
    // First initiate
    await act(async () => {
      await result.current.initiateLink({
        newDevicePublicKey: 'pubkey-123',
        newDeviceSigningKey: 'signkey-123',
        platform: 'ios',
      });
    });
    
    // Then approve
    await act(async () => {
      await result.current.approveLink('challenge-123', true);
    });
    
    expect(result.current.challenge).toBeNull();
  });

  it('should reject device link', async () => {
    const { result } = renderHook(() => useDeviceLink());
    
    await act(async () => {
      await result.current.initiateLink({
        newDevicePublicKey: 'pubkey-123',
        newDeviceSigningKey: 'signkey-123',
        platform: 'ios',
      });
    });
    
    await act(async () => {
      await result.current.approveLink('challenge-123', false);
    });
    
    expect(result.current.challenge).toBeNull();
  });

  it('should clear challenge', async () => {
    const { result } = renderHook(() => useDeviceLink());
    
    await act(async () => {
      await result.current.initiateLink({
        newDevicePublicKey: 'pubkey-123',
        newDeviceSigningKey: 'signkey-123',
        platform: 'ios',
      });
    });
    
    act(() => {
      result.current.clearChallenge();
    });
    
    expect(result.current.challenge).toBeNull();
    expect(result.current.error).toBeNull();
  });
});