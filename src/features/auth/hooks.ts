// src/features/auth/hooks.ts
import { useCallback } from 'react';
import { useAuthStore } from './store';
import { api } from '@/api/client';

export function useAuth() {
  const { user, device, isAuthenticated, isLoading, setAuth, logout, setLoading } = useAuthStore();

  const login = useCallback(
    async (identifier: string, code: string, deviceInfo: any) => {
      setLoading(true);
      try {
        const response = await api.verifyOtp(identifier, code, 'EMAIL', 'REGISTER', deviceInfo);
        setAuth(response.user, response.device, response.accessToken, response.refreshToken);
        return response;
      } finally {
        setLoading(false);
      }
    },
    [setAuth, setLoading]
  );

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  return {
    user,
    device,
    isAuthenticated,
    isLoading,
    login,
    logout: handleLogout,
  };
}