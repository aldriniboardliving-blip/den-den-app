// src/features/auth/components/LoginForm.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store';

export function LoginForm() {
  const { identifier, provider, isLoading, error, setIdentifier, setProvider, sendOtp } = useAuthStore();
  const [localIdentifier, setLocalIdentifier] = useState(identifier);

  const handleSubmit = () => {
    setIdentifier(localIdentifier);
    sendOtp();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Den Den</Text>
      <Text style={styles.subtitle}>Enter your email or phone number to get started</Text>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.toggleButton, provider === 'EMAIL' && styles.toggleButtonActive]}
          onPress={() => setProvider('EMAIL')}
        >
          <Text style={[styles.toggleText, provider === 'EMAIL' && styles.toggleTextActive]}>
            Email
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, provider === 'SMS' && styles.toggleButtonActive]}
          onPress={() => setProvider('SMS')}
        >
          <Text style={[styles.toggleText, provider === 'SMS' && styles.toggleTextActive]}>
            SMS
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder={provider === 'EMAIL' ? 'Enter your email' : 'Enter your phone number'}
        placeholderTextColor="#8b949e"
        value={localIdentifier}
        onChangeText={setLocalIdentifier}
        keyboardType={provider === 'EMAIL' ? 'email-address' : 'phone-pad'}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isLoading || !localIdentifier.trim()}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'Sending...' : 'Continue'}
        </Text>
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
    marginBottom: 32,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#00d992',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8b949e',
  },
  toggleTextActive: {
    color: '#101010',
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
