// src/features/auth/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store';

export function LoginScreen() {
  const router = useRouter();
  const { sendOtp, isLoading, error, setError } = useAuthStore();
  const [identifier, setIdentifier] = useState('');

  const handleSubmit = async () => {
    setError(null);
    
    if (!identifier.trim()) {
      setError('Please enter your email or phone number');
      return;
    }
    
    try {
      await sendOtp();
      router.push('/otp');
    } catch (err) {
      // Error is handled by the store
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Den Den</Text>
      <Text style={styles.subtitle}>Enter your email or phone number to get started</Text>

      <TextInput
        style={styles.input}
        placeholder="Email or phone number"
        placeholderTextColor="#8b949e"
        value={identifier}
        onChangeText={setIdentifier}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading || !identifier.trim()}
      >
        {isLoading ? (
          <ActivityIndicator color="#101010" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
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
    fontSize: 32,
    fontWeight: '700',
    color: '#f2f2f2',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 32,
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
