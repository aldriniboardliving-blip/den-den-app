// src/features/backup/screens/RestoreBackupScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBackups } from '../hooks/useBackup';
import { BackupProgressComponent } from '../components/BackupProgress';
import { RestoreBackupScreenProps } from '../types';

export function RestoreBackupScreen({ onSuccess, onCancel }: RestoreBackupScreenProps) {
  const { restoreBackup, progress } = useBackups();
  const [password, setPassword] = useState('');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = useCallback(() => {
    if (!fileUri) {
      setError('Please select a backup file');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    setError(null);
    return true;
  }, [fileUri, password]);

  const handlePickFile = useCallback(async () => {
    // In a real app, this would use expo-document-picker
    // For now, we'll simulate with an alert
    Alert.alert(
      'Select Backup File',
      'In a real app, this would open the document picker to select a .backup file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use Demo File',
          onPress: () => setFileUri('backup://demo.backup'),
        },
      ]
    );
  }, []);

  const handleRestore = useCallback(async () => {
    if (!validateForm()) return;

    const result = await restoreBackup({ password, fileUri: fileUri! });
    if (result.success) {
      Alert.alert(
        'Restore Complete',
        `Successfully restored ${result.restoredConversations} conversations, ${result.restoredMessages} messages, and ${result.restoredContacts} contacts.`,
        [{ text: 'OK', onPress: onSuccess }]
      );
    } else {
      setError(result.error || 'Restore failed');
    }
  }, [restoreBackup, fileUri, password, onSuccess, validateForm]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const isRestoring = progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error';
  const isComplete = progress.stage === 'complete';
  const hasError = progress.stage === 'error';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel} activeOpacity={0.7} disabled={isRestoring}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Restore Backup</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isRestoring && !isComplete && (
          <View style={styles.infoCard}>
            <Ionicons name="warning-outline" size={24} color="#ff9f0a" style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Restore Warning</Text>
              <Text style={styles.infoText}>
                Restoring a backup will replace all your current messages, conversations, and contacts with the data from the backup.
                This action cannot be undone. Make sure you have exported any important data first.
              </Text>
            </View>
          </View>
        )}

        {!isRestoring && !isComplete && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Backup File</Text>
            <Text style={styles.sectionDescription}>
              Select the encrypted backup file to restore
            </Text>

            <TouchableOpacity
              style={[
                styles.fileButton,
                fileUri && styles.fileButtonSelected,
              ]}
              onPress={handlePickFile}
              disabled={isRestoring}
              activeOpacity={0.7}
            >
              <Ionicons name={fileUri ? 'document-text-outline' : 'folder-open-outline'} size={24} color={fileUri ? '#00d992' : '#007aff'} style={styles.fileButtonIcon} />
              <Text style={[
                styles.fileButtonText,
                fileUri && styles.fileButtonTextSelected,
              ]}>
                {fileUri ? fileUri.replace('backup://', '').split('?')[0] : 'Choose backup file'}
              </Text>
              <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
            </TouchableOpacity>
          </View>
        )}

        {!isRestoring && !isComplete && fileUri && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Backup Password</Text>
            <Text style={styles.sectionDescription}>
              Enter the password used to encrypt this backup
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
            {error && <Text style={styles.formErrorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.restoreButton, { opacity: password ? 1 : 0.5 }]}
              onPress={handleRestore}
              disabled={!password || isRestoring}
              activeOpacity={0.7}
            >
              {isRestoring ? (
                <ActivityIndicator color="#f2f2f2" size="small" />
              ) : (
                <Text style={styles.restoreButtonText}>Restore Backup</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isRestoring && (
          <BackupProgressComponent progress={progress} />
        )}

        {isComplete && (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={48} color="#00d992" />
            </View>
            <Text style={styles.successTitle}>Restore Complete!</Text>
            <Text style={styles.successText}>
              Your data has been restored from the backup.
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
            <Text style={styles.errorTitle}>Restore Failed</Text>
            <Text style={styles.errorText}>{progress.error || 'An unknown error occurred'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => handleRestore()}>
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
    backgroundColor: 'rgba(255, 159, 10, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.2)',
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
    color: '#ff9f0a',
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
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  fileButtonSelected: {
    borderColor: '#00d992',
    backgroundColor: 'rgba(0, 217, 146, 0.1)',
  },
  fileButtonIcon: {
    marginRight: 12,
  },
  fileButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#8b949e',
  },
  fileButtonTextSelected: {
    color: '#00d992',
    fontWeight: '600',
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
  restoreButton: {
    backgroundColor: '#007aff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
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