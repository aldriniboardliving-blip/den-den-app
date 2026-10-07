// src/app/backup/restore/index.tsx
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { RestoreBackupScreen } from '@/features/backup/screens/RestoreBackupScreen';

export default function RestoreBackupRoute() {
  return (
    <View style={{ flex: 1 }}>
      <RestoreBackupScreen
        onSuccess={() => {
          router.back();
        }}
        onCancel={() => {
          router.back();
        }}
      />
    </View>
  );
}