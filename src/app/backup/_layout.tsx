// src/app/backup/_layout.tsx
import { Stack } from 'expo-router';

export default function BackupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="list" />
      <Stack.Screen name="create" />
      <Stack.Screen name="restore" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}