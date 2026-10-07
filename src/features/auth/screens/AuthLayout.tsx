// src/features/auth/screens/AuthLayout.tsx
import { Stack } from 'expo-router';

export function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="otp" />
    </Stack>
  );
}