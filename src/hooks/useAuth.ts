// src/hooks/useAuth.ts
// Auth hook

import { useAuthStore } from '../store/auth';
import { api } from '../api/client';

export function useAuth() {
  const {
    user,
    device,
    isAuthenticated,
    isLoading,
    setAuth,
    clearAuth,
    setLoading,
    restoreSession,
  } = useAuthStore();

  const login = async (
    identifier: string,
    code: string,
    type: 'EMAIL' | 'SMS',
    purpose: string,
    deviceInfo: any
  ) => {
    setLoading(true);
    try {
      const response = await api.verifyOtp(identifier, code, type, purpose, deviceInfo);
      setAuth(response.user, response.device, response.accessToken, response.refreshToken);
      return response;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
  };

  return {
    user,
    device,
    isAuthenticated,
    isLoading,
    login,
    logout,
    restoreSession,
  };
}
