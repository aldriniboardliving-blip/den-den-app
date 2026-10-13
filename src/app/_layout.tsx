// src/app/_layout.tsx
import { Stack } from 'expo-router';
import { useAuthStore } from '@/features/auth/store';
import { SyncProvider } from '@/features/sync/SyncProvider';

export default function RootLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <SyncProvider>
        {isAuthenticated ? (
          <Stack.Screen name="(app)" />
        ) : (
          <Stack.Screen name="(auth)" />
        )}
      </SyncProvider>
    </Stack>
  );
}