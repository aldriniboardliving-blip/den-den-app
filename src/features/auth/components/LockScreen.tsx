// src/features/auth/components/LockScreen.tsx
// Biometric lock screen component

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useBiometricLock, LockScreenProps } from '../hooks/useBiometricLock';

export const LockScreen: React.FC<LockScreenProps> = ({
  onUnlock,
  onCancel,
  title = 'Unlock Den Den',
  subtitle = 'Use biometric authentication to access your messages',
}) => {
  const {
    authenticate,
    lockState,
    config,
    isBiometricAvailable,
    biometricTypes,
    isInLockout,
    getLockoutRemaining,
    resetFailedAttempts,
  } = useBiometricLock();

  const [authenticating, setAuthenticating] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showPasscodeFallback, setShowPasscodeFallback] = useState(false);

  useEffect(() => {
    if (isInLockout()) {
      const interval = setInterval(() => {
        setLockoutTime(getLockoutRemaining());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isInLockout, getLockoutRemaining]);

  const handleAuthenticate = async () => {
    if (authenticating) return;
    
    setAuthenticating(true);
    try {
      const success = await authenticate();
      if (success) {
        onUnlock();
      }
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePasscodeFallback = () => {
    setShowPasscodeFallback(true);
  };

  const handlePasscodeSubmit = (passcode: string) => {
    // In a real implementation, verify the passcode
    // For now, we'll just unlock
    onUnlock();
    setShowPasscodeFallback(false);
  };

  const getBiometricTypeLabel = () => {
    if (biometricTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (biometricTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Fingerprint';
    }
    if (biometricTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris Scan';
    }
    return 'Biometric';
  };

  const formatLockoutTime = (ms: number) => {
    const minutes = Math.ceil(ms / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  };

  if (!lockState.isLocked && !isInLockout()) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed-outline" size={80} color="#00d992" style={styles.icon} />
        
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {isInLockout() && (
          <View style={styles.lockoutContainer}>
            <Ionicons name="timer-outline" size={32} color="#ff453a" style={styles.lockoutIcon} />
            <Text style={styles.lockoutText}>
              Too many failed attempts. Try again in {formatLockoutTime(lockoutTime)}.
            </Text>
          </View>
        )}

        {!isInLockout() && isBiometricAvailable && (
          <TouchableOpacity
            style={[styles.authButton, authenticating && styles.authButtonLoading]}
            onPress={handleAuthenticate}
            disabled={authenticating}
            activeOpacity={0.7}
          >
            {authenticating ? (
              <ActivityIndicator color="#101010" size="small" />
            ) : (
              <>
                <Ionicons name={getBiometricTypeIcon()} size={28} color="#101010" style={styles.authIcon} />
                <Text style={styles.authButtonText}>Unlock with {getBiometricTypeLabel()}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!isBiometricAvailable && !isInLockout() && (
          <View style={styles.unavailableContainer}>
            <Text style={styles.unavailableText}>
              Biometric authentication is not available on this device.
            </Text>
            <TouchableOpacity
              style={styles.passcodeButton}
              onPress={handlePasscodeFallback}
              activeOpacity={0.7}
            >
              <Text style={styles.passcodeButtonText}>Use Passcode</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isInLockout() && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              if (onCancel) onCancel();
              else Alert.alert('App Locked', 'You need to unlock to continue.');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {showPasscodeFallback && (
          <PasscodeFallbackScreen onSubmit={handlePasscodeSubmit} onCancel={() => setShowPasscodeFallback(false)} />
        )}
      </View>
    </View>
  );
};

function PasscodeFallbackScreen({ onSubmit, onCancel }: { onSubmit: (passcode: string) => void; onCancel: () => void }) {
  const [passcode, setPasscode] = useState('');

  const handleNumber = (num: string) => {
    if (passcode.length < 6) {
      setPasscode(passcode + num);
    }
  };

  const handleDelete = () => {
    setPasscode(passcode.slice(0, -1));
  };

  const handleSubmit = () => {
    if (passcode.length >= 4) {
      onSubmit(passcode);
    }
  };

  return (
    <View style={styles.passcodeOverlay}>
      <View style={styles.passcodeContainer}>
        <Ionicons name="close-outline" size={28} color="#f2f2f2" style={styles.passcodeClose} onPress={onCancel} />
        
        <Text style={styles.passcodeTitle}>Enter Passcode</Text>
        
        <View style={styles.passcodeDots}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[
              styles.passcodeDot,
              i < passcode.length && styles.passcodeDotFilled
            ]} />
          ))}
        </View>

        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <TouchableOpacity key={num} style={styles.key} onPress={() => handleNumber(num)} activeOpacity={0.7}>
              <Text style={styles.keyText}>{num}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity key="empty" style={styles.key} activeOpacity={0.7}>
            <View style={styles.keyEmpty} />
          </TouchableOpacity>
          <TouchableOpacity key="0" style={styles.key} onPress={() => handleNumber('0')} activeOpacity={0.7}>
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity key="delete" style={styles.key} onPress={handleDelete} activeOpacity={0.7}>
            <Ionicons name="backspace-outline" size={24} color="#f2f2f2" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getBiometricTypeIcon = (): React.ComponentProps<typeof Ionicons>['name'] => {
  // This would be dynamic based on biometricTypes
  return 'lock-closed';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f2f2f2',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  lockoutContainer: {
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ff453a',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockoutIcon: {
    marginTop: 2,
  },
  lockoutText: {
    flex: 1,
    fontSize: 14,
    color: '#ff453a',
    lineHeight: 20,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minWidth: 280,
  },
  authButtonLoading: {
    opacity: 0.7,
  },
  authIcon: {
    marginRight: 4,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101010',
  },
  unavailableContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  unavailableText: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 12,
  },
  passcodeButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  passcodeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d992',
  },
  cancelButton: {
    marginTop: 24,
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    color: '#8b949e',
  },
  passcodeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  passcodeContainer: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  passcodeClose: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  passcodeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f2f2f2',
    textAlign: 'center',
    marginBottom: 24,
  },
  passcodeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  passcodeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#8b949e',
    backgroundColor: 'transparent',
  },
  passcodeDotFilled: {
    backgroundColor: '#00d992',
    borderColor: '#00d992',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#101010',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  keyEmpty: {
    width: 24,
    height: 24,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#f2f2f2',
  },
});