// src/features/auth/__tests__/useBiometricLock.test.js
// Unit tests for useBiometricLock hook

import { describe, it, expect, vi, beforeEach, act } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBiometricLock } from '../hooks/useBiometricLock';

// Mock expo-local-authentication
vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn().mockResolvedValue(true),
  isEnrolledAsync: vi.fn().mockResolvedValue(true),
  supportedAuthenticationTypesAsync: vi.fn().mockResolvedValue([1, 2]),
  authenticateAsync: vi.fn().mockResolvedValue({ success: true }),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

// Mock SecureStore
vi.mock('../../../utils/secureStore', () => ({
  SecureStore: {
    setItem: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockResolvedValue(null),
    deleteItem: vi.fn().mockResolvedValue(undefined),
    setObject: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn().mockResolvedValue(null),
  },
}));

// Mock useAuthStore
vi.mock('../store', () => ({
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

describe('useBiometricLock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default config', async () => {
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    expect(result.current.config).toEqual({
      enabled: true,
      timeout: 5 * 60 * 1000,
      maxFailedAttempts: 5,
      lockoutDuration: 30 * 60 * 1000,
    });
  });

  it('should check biometric availability', async () => {
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    expect(result.current.isBiometricAvailable).toBe(true);
    expect(result.current.biometricTypes).toEqual([1, 2]);
  });

  it('should authenticate successfully', async () => {
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    let success = false;
    await act(async () => {
      success = await result.current.authenticate('Test unlock');
    });
    
    expect(success).toBe(true);
    expect(result.current.lockState.isLocked).toBe(false);
    expect(result.current.lockState.failedAttempts).toBe(0);
  });

  it('should handle failed authentication', async () => {
    const { LocalAuthentication } = await import('expo-local-authentication');
    LocalAuthentication.authenticateAsync).mockResolvedValueOnce({ success: false });
    
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    let success = true;
    await act(async () => {
      success = await result.current.authenticate('Test unlock');
    });
    
    expect(success).toBe(false);
    expect(result.current.lockState.failedAttempts).toBe(1);
  });

  it('should lock device after max failed attempts', async () => {
    const { LocalAuthentication } = await import('expo-local-authentication');
    LocalAuthentication.authenticateAsync).mockResolvedValue({ success: false });
    
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    // Fail 5 times
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await result.current.authenticate('Test unlock');
      });
    }
    
    expect(result.current.lockState.failedAttempts).toBe(5);
    expect(result.current.lockState.isLocked).toBe(true);
    expect(result.current.lockState.lockoutUntil).not.toBeNull();
  });

  it('should lock and unlock manually', async () => {
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    await act(async () => {
      await result.current.lock();
    });
    
    expect(result.current.lockState.isLocked).toBe(true);
    
    await act(async () => {
      await result.current.unlock();
    });
    
    expect(result.current.lockState.isLocked).toBe(false);
    expect(result.current.lockState.lastUnlockedAt).not.toBeNull();
  });

  it('should enable/disable biometric', async () => {
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    await act(async () => {
      await result.current.setBiometricEnabled(false);
    });
    
    expect(result.current.config.enabled).toBe(false);
    
    await act(async () => {
      await result.current.setBiometricEnabled(true);
    });
    
    expect(result.current.config.enabled).toBe(true);
  });

  it('should set custom timeout', async () => {
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    await act(async () => {
      await result.current.setTimeout(10 * 60 * 1000); // 10 minutes
    });
    
    expect(result.current.config.timeout).toBe(10 * 60 * 1000);
  });

  it('should reset failed attempts', async () => {
    const { LocalAuthentication } = await import('expo-local-authentication');
    LocalAuthentication.authenticateAsync).mockResolvedValueOnce({ success: false });
    
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    await act(async () => {
      await result.current.authenticate('Test unlock');
    });
    
    expect(result.current.lockState.failedAttempts).toBe(1);
    
    await act(async () => {
      await result.current.resetFailedAttempts();
    });
    
    expect(result.current.lockState.failedAttempts).toBe(0);
    expect(result.current.lockState.lockoutUntil).toBeNull();
  });

  it('should check auto-lock based on timeout', async () => {
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    // Initially not locked and no lastUnlock time
    expect(result.current.checkAutoLock()).toBe(true);
    
    await act(async () => {
      await result.current.unlock();
    });
    
    // Just unlocked, should not auto-lock
    expect(result.current.checkAutoLock()).toBe(false);
  });

  it('should check lockout status', async () => {
    const { LocalAuthentication } = await import('expo-local-authentication');
    LocalAuthentication.authenticateAsync).mockResolvedValue({ success: false });
    
    const { result } = renderHook(() => useBiometricLock());
    
    await waitFor(() => expect(result.current.initializing).toBe(false));
    
    // Not in lockout initially
    expect(result.current.isInLockout()).toBe(false);
    expect(result.current.getLockoutRemaining()).toBe(0);
    
    // Fail 5 times to trigger lockout
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await result.current.authenticate('Test unlock');
      });
    }
    
    expect(result.current.isInLockout()).toBe(true);
    expect(result.current.getLockoutRemaining()).toBeGreaterThan(0);
  });
});