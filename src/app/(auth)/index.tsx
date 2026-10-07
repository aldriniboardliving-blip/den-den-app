// src/app/(auth)/index.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAuthStore } from '@/features/auth/store';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { OTPInput } from '@/features/auth/components/OTPInput';
import { DeviceRegistration } from '@/features/auth/components/DeviceRegistration';

export default function AuthScreen() {
  const { step } = useAuthStore();

  return (
    <View style={styles.container}>
      {step === 'IDENTIFIER' && <LoginForm />}
      {step === 'OTP' && <OTPInput />}
      {step === 'DEVICE_REGISTRATION' && <DeviceRegistration />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
});
