// src/features/auth/components/DeviceRegistration.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store';

export function DeviceRegistration() {
  const { isLoading, error, setError, setLoading } = useAuthStore();
  const [deviceName, setDeviceName] = useState('');

  const handleRegister = async () => {
    setLoading(true);
    setError(null);

    try {
      // Device registration logic would go here
      // This would generate keys and register with the server
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Your Device</Text>
      <Text style={styles.subtitle}>
        Give this device a name to identify it across your account.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="e.g. iPhone 15, Pixel 8"
        placeholderTextColor="#8b949e"
        value={deviceName}
        onChangeText={setDeviceName}
        autoCapitalize="words"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, (!deviceName.trim() || isLoading) && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={!deviceName.trim() || isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#101010" />
        ) : (
          <Text style={styles.buttonText}>Complete Setup</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#101010',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f2f2f2',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#8b949e',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#3d3a39',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#f2f2f2',
    marginBottom: 16,
  },
  error: {
    color: '#ff453a',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00d992',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
});
