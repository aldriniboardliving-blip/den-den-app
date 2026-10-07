// src/features/notifications/screens/NotificationSettingsScreen.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationSettings, useNotificationPermissions, usePushToken } from '../hooks/useNotifications';
import { NotificationSettingsItem, NotificationTimePicker } from '../components/NotificationSettingsItem';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types';

export default function NotificationSettingsScreen() {
  const { settings, loading, updateSettings } = useNotificationSettings();
  const { permission, requestPermissions } = useNotificationPermissions();
  const { pushToken } = usePushToken();
  const [showPermissionAlert, setShowPermissionAlert] = useState(false);

  const handleMasterToggle = useCallback(async (enabled: boolean) => {
    if (enabled && !permission.granted) {
      setShowPermissionAlert(true);
      return;
    }
    await updateSettings({ enabled });
  }, [permission.granted, updateSettings]);

  const handlePermissionRequest = useCallback(async () => {
    const result = await requestPermissions();
    if (result.status === 'granted') {
      updateSettings({ enabled: true });
    }
  }, [requestPermissions, updateSettings]);

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
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      {showPermissionAlert && (
        <View style={styles.permissionAlert}>
          <Text style={styles.permissionAlertText}>
            Notifications require system permission to work. Please enable them in Settings.
          </Text>
          <View style={styles.permissionAlertButtons}>
            <TouchableOpacity style={styles.permissionAlertButton} onPress={() => setShowPermissionAlert(false)}>
              <Text style={styles.permissionAlertButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.permissionAlertButton, styles.permissionAlertButtonPrimary]} onPress={handlePermissionRequest}>
              <Text style={styles.permissionAlertButtonTextPrimary}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <NotificationSettingsItem
            title="Enable Notifications"
            description="Receive notifications for messages and events"
            icon="notifications-outline"
            iconColor="#007aff"
            value={settings.enabled}
            onChange={handleMasterToggle}
          />

          <NotificationSettingsItem
            title="Message Preview"
            description="Show message content in notifications"
            icon="eye-outline"
            iconColor="#00d992"
            value={settings.showPreview}
            onChange={enabled => updateSettings({ showPreview: enabled })}
            disabled={!settings.enabled}
          />

          <NotificationSettingsItem
            title="Sound"
            description="Play sound for notifications"
            icon="volume-high-outline"
            iconColor="#ff9f0a"
            value={settings.soundEnabled}
            onChange={enabled => updateSettings({ soundEnabled: enabled })}
            disabled={!settings.enabled}
          />

          <NotificationSettingsItem
            title="Vibration"
            description="Vibrate on notification"
            icon="radio-button-on-outline"
            iconColor="#af52de"
            value={settings.vibrationEnabled}
            onChange={enabled => updateSettings({ vibrationEnabled: enabled })}
            disabled={!settings.enabled}
          />

          <NotificationSettingsItem
            title="Badge Count"
            description="Show unread count on app icon"
            icon="notifications-outline"
            iconColor="#ff2d92"
            value={settings.badgeEnabled}
            onChange={enabled => updateSettings({ badgeEnabled: enabled })}
            disabled={!settings.enabled}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Categories</Text>
          
          <NotificationSettingsItem
            title="Messages"
            description="New messages, delivery & read receipts"
            icon="chatbubble-outline"
            iconColor="#007aff"
            value={settings.messageNotifications}
            onChange={enabled => updateSettings({ messageNotifications: enabled })}
            disabled={!settings.enabled}
          />

          <NotificationSettingsItem
            title="Contacts"
            description="Contact requests and verifications"
            icon="person-add-outline"
            iconColor="#00d992"
            value={settings.contactNotifications}
            onChange={enabled => updateSettings({ contactNotifications: enabled })}
            disabled={!settings.enabled}
          />

          <NotificationSettingsItem
            title="Groups"
            description="Group invites and updates"
            icon="people-outline"
            iconColor="#ff9f0a"
            value={settings.groupNotifications}
            onChange={enabled => updateSettings({ groupNotifications: enabled })}
            disabled={!settings.enabled}
          />

          <NotificationSettingsItem
            title="Backups"
            description="Backup completion and failures"
            icon="cloud-outline"
            iconColor="#af52de"
            value={settings.backupNotifications}
            onChange={enabled => updateSettings({ backupNotifications: enabled })}
            disabled={!settings.enabled}
          />

          <NotificationSettingsItem
            title="System"
            description="App updates and important notices"
            icon="information-circle-outline"
            iconColor="#ff2d92"
            value={settings.systemNotifications}
            onChange={enabled => updateSettings({ systemNotifications: enabled })}
            disabled={!settings.enabled}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          
          <NotificationSettingsItem
            title="Enable Quiet Hours"
            description="Silence notifications during specified hours"
            icon="moon-outline"
            iconColor="#ff9f0a"
            value={settings.quietHoursEnabled}
            onChange={enabled => updateSettings({ quietHoursEnabled: enabled })}
            disabled={!settings.enabled}
          />

          {settings.quietHoursEnabled && settings.enabled && (
            <>
              <NotificationTimePicker
                title="Start Time"
                description="When to start silencing notifications"
                value={settings.quietHoursStart}
                onChange={value => updateSettings({ quietHoursStart: value })}
                icon="time-outline"
                iconColor="#007aff"
              />

              <NotificationTimePicker
                title="End Time"
                description="When to resume notifications"
                value={settings.quietHoursEnd}
                onChange={value => updateSettings({ quietHoursEnd: value })}
                icon="time-outline"
                iconColor="#00d992"
              />
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Token</Text>
          
          <View style={styles.tokenInfo}>
            <View style={styles.tokenRow}>
              <Ionicons name={pushToken ? 'checkmark-circle' : 'close-circle'} size={24} color={pushToken ? '#00d992' : '#ff453a'} />
              <Text style={styles.tokenStatus}>
                {pushToken ? 'Registered' : 'Not Registered'}
              </Text>
            </View>
            {pushToken && (
              <TouchableOpacity
                style={styles.tokenButton}
                onPress={() => Alert.alert('Push Token', pushToken, [{ text: 'Copy', onPress: () => Alert.alert('Copied!') }])}
              >
                <Text style={styles.tokenButtonText}>View Token</Text>
              </TouchableOpacity>
            )}
            {!pushToken && permission.granted && settings.enabled && (
              <TouchableOpacity style={styles.tokenButton} onPress={() => {}}>
                <Text style={styles.tokenButtonText}>Register Push Token</Text>
              </TouchableOpacity>
            )}
            {!permission.granted && (
              <TouchableOpacity style={styles.tokenButton} onPress={handlePermissionRequest}>
                <Text style={styles.tokenButtonText}>Enable Permissions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Notifications</Text>
          
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => {
              // Send test notification
            }}
            activeOpacity={0.7}
            disabled={!settings.enabled || !permission.granted}
          >
            <Ionicons name="send-outline" size={22} color="#00d992" style={styles.testButtonIcon} />
            <Text style={styles.testButtonText}>Send Test Notification</Text>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reset</Text>
          
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              Alert.alert(
                'Reset Notification Settings',
                'Are you sure you want to reset all notification settings to defaults?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => updateSettings(DEFAULT_NOTIFICATION_SETTINGS),
                  },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={22} color="#ff453a" style={styles.resetButtonIcon} />
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
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
  permissionAlert: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255, 159, 10, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.2)',
  },
  permissionAlertText: {
    fontSize: 14,
    color: '#ff9f0a',
    marginBottom: 12,
    lineHeight: 20,
  },
  permissionAlertButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  permissionAlertButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  permissionAlertButtonPrimary: {
    backgroundColor: '#ff9f0a',
  },
  permissionAlertButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  permissionAlertButtonTextPrimary: {
    color: '#101010',
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b949e',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  tokenInfo: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tokenStatus: {
    fontSize: 15,
    fontWeight: '500',
    color: '#f2f2f2',
    marginLeft: 12,
  },
  tokenButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#101010',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d3a39',
    alignItems: 'center',
  },
  tokenButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d992',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  testButtonIcon: {
    marginRight: 16,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#00d992',
    flex: 1,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  resetButtonIcon: {
    marginRight: 16,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ff453a',
  },
});