import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Platform, TextInput } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store';
import { useDeviceLink } from '../hooks/useMultidevice';
import * as Sodium from 'react-native-libsodium';

export default function LinkDeviceScreen() {
  const { device } = useAuthStore();
  const { challenge, loading, error, initiateLink, clearChallenge } = useDeviceLink();
  const [deviceName, setDeviceName] = useState('');
  const [step, setStep] = useState<'init' | 'waiting' | 'approved' | 'rejected'>('init');

  // Generate keys on mount
  const [keyPair, setKeyPair] = useState<{ publicKey: string; signingKey: string } | null>(null);

  useEffect(() => {
    const generateKeys = async () => {
      try {
        const identityKeyPair = await Sodium.crypto_box_keypair();
        const signKeyPair = await Sodium.crypto_sign_keypair();
        
        setKeyPair({
          publicKey: btoa(String.fromCharCode(...identityKeyPair.publicKey)),
          signingKey: btoa(String.fromCharCode(...signKeyPair.publicKey)),
        });
      } catch (err) {
        console.error('Failed to generate keys:', err);
      }
    };
    generateKeys();
  }, []);

  const handleLink = useCallback(async () => {
    if (!keyPair || !device) return;
    
    try {
      await initiateLink({
        newDevicePublicKey: keyPair.publicKey,
        newDeviceSigningKey: keyPair.signingKey,
        newDeviceName: deviceName || `${Platform.OS === 'ios' ? 'iOS' : 'Android'} Device`,
        platform: Platform.OS as 'ios' | 'android' | 'web',
        platformVersion: Platform.Version.toString(),
        appVersion: '1.0.0',
      });
      setStep('waiting');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to initiate linking');
    }
  }, [keyPair, device, deviceName, initiateLink]);

  const handleCancel = () => {
    if (challenge) {
      // In a real implementation, we'd cancel the challenge on the server
    }
    router.back();
  };

  if (step === 'waiting' && challenge) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleCancel} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Link Device</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          <Ionicons name="time-outline" size={80} color="#00d992" style={styles.icon} />
          <Text style={styles.title}>Waiting for Approval</Text>
          <Text style={styles.subtitle}>
            Please approve the device link request on your primary device.
          </Text>

          <View style={styles.challengeCard}>
            <Text style={styles.challengeLabel}>Challenge ID</Text>
            <Text style={styles.challengeValue}>{challenge.challengeId.slice(0, 16)}...</Text>
            <Text style={styles.challengeLabel}>Expires</Text>
            <Text style={styles.challengeValue}>
              {new Date(challenge.expiresAt).toLocaleTimeString()}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'approved') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Link Device</Text>
        </View>

        <View style={styles.content}>
          <Ionicons name="checkmark-circle-outline" size={80} color="#00d992" style={styles.icon} />
          <Text style={styles.title}>Device Linked Successfully</Text>
          <Text style={styles.subtitle}>
            Your new device is now linked and ready to use.
          </Text>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => router.replace('/settings/devices')}
            activeOpacity={0.7}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'rejected') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Link Device</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.content}>
          <Ionicons name="close-circle-outline" size={80} color="#ff453a" style={styles.icon} />
          <Text style={styles.title}>Request Rejected</Text>
          <Text style={styles.subtitle}>
            The device link request was rejected on your primary device.
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => { setStep('init'); clearChallenge(); }}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Link Device</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <Ionicons name="link-outline" size={80} color="#00d992" style={styles.icon} />
        <Text style={styles.title}>Link This Device</Text>
        <Text style={styles.subtitle}>
          Enter a name for this device, then confirm on your primary device.
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Device Name (e.g., John's iPhone)"
            value={deviceName}
            onChangeText={setDeviceName}
            placeholderTextColor="#8b949e"
            autoCapitalize="words"
            autoCorrect={false}
          />
        </View>

        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <TouchableOpacity
          style={[styles.linkButton, loading && styles.linkButtonLoading]}
          onPress={handleLink}
          disabled={loading || !deviceName.trim()}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#101010" size="small" />
          ) : (
            <Text style={styles.linkButtonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <View style={styles.infoText}>
          <Ionicons name="information-circle-outline" size={16} color="#8b949e" />
          <Text style={styles.infoTextContent}>
            A notification will be sent to your primary device. Approve it there to complete linking.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  icon: {
    alignSelf: 'center',
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
  challengeCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  challengeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b949e',
    marginBottom: 4,
  },
  challengeValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f2f2f2',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  cancelButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff453a',
  },
  doneButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101010',
  },
  retryButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101010',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  errorText: {
    fontSize: 14,
    color: '#ff453a',
    textAlign: 'center',
    marginBottom: 16,
  },
  linkButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  linkButtonLoading: {
    opacity: 0.7,
  },
  linkButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101010',
  },
  infoText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 24,
  },
  infoTextContent: {
    flex: 1,
    fontSize: 13,
    color: '#8b949e',
    lineHeight: 20,
  },
});