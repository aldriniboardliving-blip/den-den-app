// src/app/notifications/_layout.tsx
import { Stack } from 'expo-router';

export default function NotificationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="settings" />
    </Stack>
  );
}