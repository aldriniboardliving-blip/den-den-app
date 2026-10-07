// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { useAuthStore } from '@/features/auth/store';

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="(app)" />
      ) : (
        <Stack.Screen name="(auth)" />
      )}
    </Stack>
  );
}