// src/features/auth/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/api/client';
import { AuthState, AuthStep, User, Device, AuthProvider } from './types';

const initialState: Omit<AuthState, keyof AuthState> & AuthState = {
  // Auth flow state
  step: 'IDENTIFIER' as AuthStep,
  identifier: '',
  provider: 'EMAIL' as AuthProvider,
  isLoading: false,
  error: null,
  otpSent: false,
  otpExpiresAt: null,
  deviceRegistered: false,
  
  // Authenticated state
  user: null,
  device: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  
  // Actions (will be defined below)
  setStep: () => {},
  setIdentifier: () => {},
  setProvider: () => {},
  setLoading: () => {},
  setError: () => {},
  setOtpSent: () => {},
  setOtpExpiresAt: () => {},
  setDeviceRegistered: () => {},
  setAuth: () => {},
  sendOtp: async () => {},
  verify: async () => {},
  logout: () => {},
  reset: () => {},
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      setStep: (step: AuthStep) => {
        set({ step });
      },
      
      setIdentifier: (identifier: string) => {
        set({ identifier });
      },
      
      setProvider: (provider: AuthProvider) => {
        set({ provider });
      },
      
      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },
      
      setError: (error: string | null) => {
        set({ error });
      },
      
      setOtpSent: (sent: boolean) => {
        set({ otpSent: sent });
      },
      
      setOtpExpiresAt: (expiresAt: number | null) => {
        set({ otpExpiresAt: expiresAt });
      },
      
      setDeviceRegistered: (registered: boolean) => {
        set({ deviceRegistered: registered });
      },
      
      sendOtp: async () => {
        const { identifier } = get();
        set({ isLoading: true, error: null });
        try {
          await api.requestOtp(identifier, 'EMAIL', 'REGISTER');
          set({ isLoading: false, otpSent: true, otpExpiresAt: Date.now() + 5 * 60 * 1000 });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to send OTP', isLoading: false });
          throw error;
        }
      },
      
      verify: async (code: string) => {
        const { identifier } = get();
        set({ isLoading: true, error: null });
        try {
          const deviceInfo = {
            deviceId: 'device-' + Date.now(),
            platform: 'mobile',
            appVersion: '1.0.0',
          };
          const response = await api.verifyOtp(identifier, code, 'EMAIL', 'REGISTER', deviceInfo);
          set({
            user: response.user,
            device: response.device,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            step: 'COMPLETE',
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Verification failed', isLoading: false });
          throw error;
        }
      },
      
      logout: () => {
        set({
          user: null,
          device: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          step: 'IDENTIFIER',
        });
      },
      
      setAuth: (user: User, device: Device, accessToken: string, refreshToken: string) => {
        set({
          user,
          device,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          step: 'COMPLETE',
        });
      },
      
      reset: () => {
        set({
          step: 'IDENTIFIER',
          identifier: '',
          provider: 'EMAIL',
          isLoading: false,
          error: null,
          otpSent: false,
          otpExpiresAt: null,
          deviceRegistered: false,
          user: null,
          device: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        device: state.device,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        step: state.step,
        identifier: state.identifier,
        provider: state.provider,
        deviceRegistered: state.deviceRegistered,
      }),
    }
  )
);