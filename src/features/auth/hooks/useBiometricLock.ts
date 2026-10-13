// src/features/auth/hooks/useBiometricLock.ts
// Biometric app lock using expo-local-authentication

import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '@/features/auth/store';
import { SecureStore } from '@/utils/secureStore';

const LOCK_STATE_KEY = 'app_lock_state';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const LOCK_TIMEOUT_KEY = 'lock_timeout';
const FAILED_ATTEMPTS_KEY = 'failed_attempts';

export interface LockState {
  isLocked: boolean;
  lastUnlockedAt: number | null;
  failedAttempts: number;
  lockoutUntil: number | null;
  requireBiometric: boolean;
}

export interface BiometricLockConfig {
  enabled: boolean;
  timeout: number; // milliseconds
  maxFailedAttempts: number;
  lockoutDuration: number; // milliseconds
}

const DEFAULT_CONFIG: BiometricLockConfig = {
  enabled: true,
  timeout: 5 * 60 * 1000, // 5 minutes
  maxFailedAttempts: 5,
  lockoutDuration: 30 * 60 * 1000, // 30 minutes
};

export function useBiometricLock() {
  const { user, device, logout } = useAuthStore();
  const [lockState, setLockState] = useState<LockState>({
    isLocked: false,
    lastUnlockedAt: null,
    failedAttempts: 0,
    lockoutUntil: null,
    requireBiometric: true,
  });
  const [config, setConfig] = useState<BiometricLockConfig>(DEFAULT_CONFIG);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<LocalAuthentication.AuthenticationType[]>([]);
  const [initializing, setInitializing] = useState(true);

  // Check biometric availability
  const checkBiometricAvailability = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      setIsBiometricAvailable(hasHardware && isEnrolled);
      setBiometricTypes(types);
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      setIsBiometricAvailable(false);
    }
  }, []);

  // Load lock state from secure storage
  const loadLockState = useCallback(async () => {
    try {
      const [state, cfg] = await Promise.all([
        SecureStore.getItem(LOCK_STATE_KEY),
        SecureStore.getItem(BIOMETRIC_ENABLED_KEY),
      ]);

      if (state) {
        setLockState(JSON.parse(state));
      }
      if (cfg) {
        setConfig(JSON.parse(cfg));
      }
    } catch (error) {
      console.error('Failed to load lock state:', error);
    }
  }, []);

  // Save lock state to secure storage
  const saveLockState = useCallback(async (state: Partial<LockState>) => {
    const newState = { ...lockState, ...state };
    setLockState(newState);
    try {
      await SecureStore.setItem(LOCK_STATE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.error('Failed to save lock state:', error);
    }
  }, [lockState]);

  // Save config
  const saveConfig = useCallback(async (newConfig: Partial<BiometricLockConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    setConfig(updatedConfig);
    try {
      await SecureStore.setItem(BIOMETRIC_ENABLED_KEY, JSON.stringify(updatedConfig));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }, [config]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      await Promise.all([
        checkBiometricAvailability(),
        loadLockState(),
      ]);
      setInitializing(false);
    };
    init();
  }, [checkBiometricAvailability, loadLockState]);

  // Check if app should be locked
  const checkAutoLock = useCallback(() => {
    if (!config.enabled || !lockState.requireBiometric) return false;
    if (!lockState.lastUnlockedAt) return true;
    
    const timeSinceUnlock = Date.now() - lockState.lastUnlockedAt;
    return timeSinceUnlock > config.timeout;
  }, [config.enabled, config.timeout, lockState.lastUnlockedAt, lockState.requireBiometric]);

  // Check if device is in lockout
  const isInLockout = useCallback(() => {
    if (!lockState.lockoutUntil) return false;
    return Date.now() < lockState.lockoutUntil;
  }, [lockState.lockoutUntil]);

  // Get remaining lockout time
  const getLockoutRemaining = useCallback(() => {
    if (!lockState.lockoutUntil) return 0;
    return Math.max(0, lockState.lockoutUntil - Date.now());
  }, [lockState.lockoutUntil]);

  // Authenticate with biometric
  const authenticate = useCallback(async (reason = 'Unlock Den Den'): Promise<boolean> => {
    if (!isBiometricAvailable) {
      console.warn('Biometric not available');
      return false;
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        await saveLockState({
          isLocked: false,
          lastUnlockedAt: Date.now(),
          failedAttempts: 0,
          lockoutUntil: null,
        });
        return true;
      }

      // Handle failure
      const newFailedAttempts = lockState.failedAttempts + 1;
      const updates: Partial<LockState> = { failedAttempts: newFailedAttempts };

      if (newFailedAttempts >= config.maxFailedAttempts) {
        updates.isLocked = true;
        updates.lockoutUntil = Date.now() + config.lockoutDuration;
      }

      await saveLockState(updates);
      return false;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }, [isBiometricAvailable, lockState.failedAttempts, config.maxFailedAttempts, config.lockoutDuration, saveLockState]);

  // Lock the app
  const lock = useCallback(async () => {
    await saveLockState({
      isLocked: true,
      lastUnlockedAt: null,
    });
  }, [saveLockState]);

  // Unlock the app (after successful auth)
  const unlock = useCallback(async () => {
    await saveLockState({
      isLocked: false,
      lastUnlockedAt: Date.now(),
      failedAttempts: 0,
      lockoutUntil: null,
    });
  }, [saveLockState]);

  // Enable/disable biometric lock
  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    await saveConfig({ enabled });
  }, [saveConfig]);

  // Set lock timeout
  const setTimeout = useCallback(async (timeout: number) => {
    await saveConfig({ timeout });
  }, [saveConfig]);

  // Set require biometric
  const setRequireBiometric = useCallback(async (require: boolean) => {
    await saveLockState({ requireBiometric: require });
  }, [saveLockState]);

  // Reset failed attempts (after successful auth)
  const resetFailedAttempts = useCallback(async () => {
    await saveLockState({ failedAttempts: 0, lockoutUntil: null });
  }, [saveLockState]);

  // Check if we should show lock screen
  const shouldShowLockScreen = useCallback(() => {
    if (!user || !device) return false;
    if (!config.enabled) return false;
    if (lockState.isLocked) return true;
    return checkAutoLock();
  }, [user, device, config.enabled, lockState.isLocked, checkAutoLock]);

  return {
    lockState,
    config,
    isBiometricAvailable,
    biometricTypes,
    initializing,
    authenticate,
    lock,
    unlock,
    setBiometricEnabled,
    setTimeout,
    setRequireBiometric,
    resetFailedAttempts,
    shouldShowLockScreen,
    isInLockout,
    getLockoutRemaining,
    checkAutoLock,
  };
}

// Lock screen component props
export interface LockScreenProps {
  onUnlock: () => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
}