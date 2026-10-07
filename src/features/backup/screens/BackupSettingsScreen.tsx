// src/features/backup/screens/BackupSettingsScreen.tsx
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBackupSettings } from '../hooks/useBackup';

export default function BackupSettingsScreen() {
  const { settings, loading, updateSettings } = useBackupSettings();

  const handleToggleAutoBackup = useCallback(async (enabled: boolean) => {
    await updateSettings({ autoBackupEnabled: enabled });
  }, [updateSettings]);

  const handleFrequencyChange = useCallback(async (frequency: 'daily' | 'weekly' | 'monthly') => {
    await updateSettings({ autoBackupFrequency: frequency });
  }, [updateSettings]);

  const handleCloudToggle = useCallback(async (enabled: boolean) => {
    await updateSettings({ backupToCloud: enabled });
  }, [updateSettings]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Backup Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Auto Backup</Text>
              <Text style={styles.settingDescription}>
                Automatically create encrypted backups on a schedule
              </Text>
            </View>
            <Switch
              value={settings.autoBackupEnabled}
              onValueChange={handleToggleAutoBackup}
              trackColor={{ false: '#3d3a39', true: '#00d992' }}
              thumbColor={settings.autoBackupEnabled ? '#101010' : '#f2f2f2'}
            />
          </View>

          {settings.autoBackupEnabled && (
            <>
            <View style={styles.subSettingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Frequency</Text>
                <Text style={styles.settingDescription}>
                  How often to create automatic backups
                </Text>
              </View>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => Alert.alert(
                  'Backup Frequency',
                  'Choose how often to create backups',
                  [
                    { text: 'Daily', onPress: () => handleFrequencyChange('daily') },
                    { text: 'Weekly', onPress: () => handleFrequencyChange('weekly') },
                    { text: 'Monthly', onPress: () => handleFrequencyChange('monthly') },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                )}
                activeOpacity={0.7}
              >
                <Text style={styles.selectButtonText}>{settings.autoBackupFrequency.charAt(0).toUpperCase() + settings.autoBackupFrequency.slice(1)}</Text>
                <Ionicons name="chevron-forward" size={20} color="#3d3a39" />
              </TouchableOpacity>
            </View>

            <View style={styles.subSettingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Time</Text>
                <Text style={styles.settingDescription}>
                  Time of day to create backup (24-hour format)
                </Text>
              </View>
              <Text style={styles.timeDisplay}>{settings.autoBackupTime}</Text>
            </View>
            </>
          )}

          <View style={styles.divider} />
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Cloud Backup</Text>
              <Text style={styles.settingDescription}>
                Upload encrypted backups to cloud storage (Google Drive, iCloud)
              </Text>
            </View>
            <Switch
              value={settings.backupToCloud}
              onValueChange={handleCloudToggle}
              trackColor={{ false: '#3d3a39', true: '#00d992' }}
              thumbColor={settings.backupToCloud ? '#101010' : '#f2f2f2'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/backup/list')}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-outline" size={24} color="#007aff" style={styles.actionIcon} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Manage Backups</Text>
              <Text style={styles.actionSubtitle}>View, verify, export, or delete backups</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/backup/create')}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={24} color="#00d992" style={styles.actionIcon} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create New Backup</Text>
              <Text style={styles.actionSubtitle}>Manually create an encrypted backup now</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/backup/restore')}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-download-outline" size={24} color="#ff9f0a" style={styles.actionIcon} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Restore Backup</Text>
              <Text style={styles.actionSubtitle}>Restore from an encrypted backup file</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Backups</Text>
          <Text style={styles.aboutText}>
            Den Den creates encrypted backups using AES-256-GCM with Argon2id key derivation.
            Your backup password is never stored and cannot be recovered if lost.
            Backups include all messages, conversations, contacts, and device keys.
            Media files are not included in backups to keep them small and fast.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8b949e',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  subSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingLeft: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  settingInfo: {
    flex: 1,
    minWidth: 0,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  settingDescription: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#101010',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  selectButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  timeDisplay: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00d992',
  },
  divider: {
    height: 1,
    backgroundColor: '#3d3a39',
    marginHorizontal: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  actionIcon: {
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b949e',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 14,
    color: '#8b949e',
    marginHorizontal: 16,
    paddingVertical: 16,
    lineHeight: 20,
  },
});