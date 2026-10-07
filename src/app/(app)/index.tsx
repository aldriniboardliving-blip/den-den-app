// src/app/(app)/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '@/features/auth/store';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const handleLogout = () => {
    logout();
    router.replace('/(auth)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Den Den</Text>
      {user && <Text style={styles.subtitle}>Hello, {user.displayName || user.accountId}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#101010',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f2f2f2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b949e',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#00d992',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    minWidth: 200,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
});