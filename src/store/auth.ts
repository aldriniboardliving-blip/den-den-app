// src/store/auth.ts
// Auth store using Zustand

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Device } from '../types';
import { api } from '../api/client';

interface AuthState {
  user: User | null;
  device: Device | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (user: User, device: Device, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (user: Partial<User>) => void;
  updateDevice: (device: Partial<Device>) => void;
  restoreSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      device: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (user, device, accessToken, refreshToken) => {
        api.setTokens(accessToken, refreshToken, device.id);
        set({
          user,
          device,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      clearAuth: () => {
        api.clearTokens();
        set({
          user: null,
          device: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      updateUser: user =>
        set(state => ({
          user: state.user ? { ...state.user, ...user } : null,
        })),

      updateDevice: device =>
        set(state => ({
          device: state.device ? { ...state.device, ...device } : null,
        })),

      restoreSession: async () => {
        const { accessToken, refreshToken, device } = get();
        if (!accessToken || !refreshToken || !device) return false;

        try {
          api.setTokens(accessToken, refreshToken, device.id);
          // Verify token still valid by fetching profile
          const user = await api.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
          return true;
        } catch {
          get().clearAuth();
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => ({
        getItem: async name => {
          // In React Native, use AsyncStorage or SecureStore
          // This is a placeholder
          return null;
        },
        setItem: async (name, value) => {},
        removeItem: async name => {},
      })),
      partialize: state => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        device: state.device,
        user: state.user,
      }),
    }
  )
);
