// src/features/auth/screens/AuthScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store';

export function AuthScreen() {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { sendOtp } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async () => {
    if (!identifier.trim()) return;

    setIsLoading(true);
    try {
      await sendOtp();
      router.push('/otp');
    } catch (error) {
      console.error('Failed to send OTP:', error);
    } finally {
      setIsLoading(false);
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
    marginBottom: 8,
    textAlign: 'center',
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