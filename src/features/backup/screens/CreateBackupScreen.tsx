// src/features/backup/screens/CreateBackupScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBackups } from '../hooks/useBackup';
import { BackupProgressComponent } from '../components/BackupProgress';
import { CreateBackupScreenProps } from '../types';

export function CreateBackupScreen({ onSuccess, onCancel }: CreateBackupScreenProps) {
  const { createBackup, progress } = useBackups();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const validateForm = useCallback(() => {
    const newErrors: { password?: string; confirm?: string } = {};
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!confirmPassword) {
      newErrors.confirm = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirm = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [password, confirmPassword]);

  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;
    
    const result = await createBackup({ password, confirmPassword });
    if (result) {
      onSuccess(result);
    } else if (progress.error) {
      Alert.alert('Backup Failed', progress.error);
    }
  }, [createBackup, onSuccess, progress.error, validateForm]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const isCreating = progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error';
  const isComplete = progress.stage === 'complete';
  const hasError = progress.stage === 'error';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel} activeOpacity={0.7} disabled={isCreating}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Backup</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isCreating && !isComplete && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color="#007aff" style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Encrypted Backup</Text>
              <Text style={styles.infoText}>
                Your backup will be encrypted with AES-256-GCM using a password derived from your passphrase via Argon2id.
                The password is never stored and cannot be recovered if lost.
              </Text>
            </View>
          </View>
        )}

        {!isCreating && !isComplete && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Backup Password</Text>
            <Text style={styles.sectionDescription}>
              Choose a strong password to encrypt your backup
            </Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#8b949e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color="#8b949e" />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.formErrorText}>{errors.password}</Text>}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor="#8b949e"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color="#8b949e" />
              </TouchableOpacity>
            </View>
            {errors.confirm && <Text style={styles.formErrorText}>{errors.confirm}</Text>}

            <TouchableOpacity
              style={[styles.createButton, { opacity: (password && confirmPassword) ? 1 : 0.5 }]}
              onPress={handleCreate}
              disabled={!password || !confirmPassword || isCreating}
              activeOpacity={0.7}
            >
              {isCreating ? (
                <ActivityIndicator color="#101010" size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create Encrypted Backup</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isCreating && (
          <BackupProgressComponent progress={progress} />
        )}

        {isComplete && (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#00d992" />
            </View>
            <Text style={styles.successTitle}>Backup Created!</Text>
            <Text style={styles.successText}>
              Your encrypted backup has been created successfully.
              Store the password in a safe place - it cannot be recovered.
            </Text>
            <TouchableOpacity style={styles.doneButton} onPress={onCancel}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasError && (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle" size={48} color="#ff453a" />
            </View>
            <Text style={styles.errorTitle}>Backup Failed</Text>
            <Text style={styles.errorText}>{progress.error || 'An unknown error occurred'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => handleCreate()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007aff',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#8b949e',
    lineHeight: 18,
  },
  formSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2f2f2',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8b949e',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
    marginBottom: 16,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f2f2f2',
  },
  eyeButton: {
    padding: 12,
    paddingRight: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#ff453a',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  createButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
  formErrorText: {
    fontSize: 13,
    color: '#ff453a',
    marginTop: -12,
    marginBottom: 16,
    marginLeft: 4,
  },
  successCard: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 24,
    backgroundColor: 'rgba(0, 217, 146, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 146, 0.2)',
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00d992',
    marginBottom: 8,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
  errorCard: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 24,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
    alignItems: 'center',
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ff453a',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorCardText: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#ff453a',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
  },
});