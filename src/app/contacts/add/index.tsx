// src/app/contacts/add/index.tsx
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AddContactScreen } from '@/features/contacts/screens/AddContactScreen';

export default function AddContactRoute() {
  return (
    <View style={{ flex: 1 }}>
      <AddContactScreen
        onSuccess={(contact) => {
          router.push(`/contacts/${contact.id}`);
        }}
        onCancel={() => {
          router.back();
        }}
      />
    </View>
  );
}