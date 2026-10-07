// src/app/backup/create/index.tsx
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { CreateBackupScreen } from '@/features/backup/screens/CreateBackupScreen';

export default function CreateBackupRoute() {
  return (
    <View style={{ flex: 1 }}>
      <CreateBackupScreen
        onSuccess={(backup) => {
          router.push(`/backup/list`);
        }}
        onCancel={() => {
          router.back();
        }}
      />
    </View>
  );
}