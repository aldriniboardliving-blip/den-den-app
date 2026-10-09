// src/app/settings/privacy.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store';
import { DisappearingTimerDuration } from '@/types';
import { DisappearingTimerPicker } from '@/features/chat/components/DisappearingTimerPicker';
import { useConversations } from '@/features/chat/hooks/useConversations';

export default function PrivacySettingsScreen() {
  const { user } = useAuthStore();
  const { conversations, isLoading: conversationsLoading } = useConversations();
  const [screenLockEnabled, setScreenLockEnabled] = useState(false);
  const [showDisappearingPicker, setShowDisappearingPicker] = useState(false);
  const [disappearingTimer, setDisappearingTimer] = useState<DisappearingTimerDuration>(0);
  const [defaultDisappearingTimer, setDefaultDisappearingTimer] = useState<DisappearingTimerDuration>(0);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      // Load screen lock setting
      // const screenLock = await settingsRepository.get(user.id, 'screen_lock');
      // setScreenLockEnabled(screenLock === 'true');
      
      // Load default disappearing messages timer
      // const timer = await settingsRepository.get(user.id, 'default_disappearing_timer');
      // setDefaultDisappearingTimer(timer ? parseInt(timer) : 0);
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleDisappearingTimerSelect = useCallback(async (timer: DisappearingTimerDuration) => {
    setDisappearingTimer(timer);
    setShowDisappearingPicker(false);
    
    // This would be the default for new conversations
    // await settingsRepository.set(user.id, 'default_disappearing_timer', timer.toString());
  }, []);

  const handleToggleScreenLock = useCallback(async (enabled: boolean) => {
    setScreenLockEnabled(enabled);
    // await settingsRepository.set(user.id, 'screen_lock', enabled.toString());
  }, []);

  const TIMER_LABELS: Record<number, string> = {
    0: 'Off',
    86400000: '24 hours',
    604800000: '7 days',
    7776000000: '90 days',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Security</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => handleToggleScreenLock(!screenLockEnabled)}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Screen Lock</Text>
              <Text style={styles.settingDescription}>
                Require Face ID / Touch ID / PIN to open app
              </Text>
            </View>
            <Switch
              value={screenLockEnabled}
              onValueChange={handleToggleScreenLock}
              trackColor={{ false: '#3d3a39', true: '#00d992' }}
              thumbColor={screenLockEnabled ? '#101010' : '#f2f2f2'}
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/settings/blocked-contacts')}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Blocked Contacts</Text>
              <Text style={styles.settingDescription}>
                Manage blocked contacts
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/settings/safety-numbers')}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Safety Numbers</Text>
              <Text style={styles.settingDescription}>
                Verify contact safety numbers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disappearing Messages</Text>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setShowDisappearingPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Default Message Timer</Text>
              <Text style={styles.settingDescription}>
                New messages in chats will disappear after this time
              </Text>
            </View>
            <View style={styles.timerDisplay}>
              <Text style={styles.timerValue}>{TIMER_LABELS[defaultDisappearingTimer]}</Text>
              <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/settings/clear-history')}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Clear History</Text>
              <Text style={styles.settingDescription}>
                Delete all messages and media from device
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Permissions</Text>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/settings/data-usage')}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Data Usage</Text>
              <Text style={styles.settingDescription}>
                Manage media auto-download, storage
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/settings/permissions')}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Permissions</Text>
              <Text style={styles.settingDescription}>
                Camera, microphone, contacts, notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>

        <DisappearingTimerPicker
          visible={showDisappearingPicker}
          onClose={() => setShowDisappearingPicker(false)}
          currentTimer={defaultDisappearingTimer}
          onSelect={(timer) => {
            setDefaultDisappearingTimer(timer);
            setShowDisappearingPicker(false);
          }}
        />
      </ScrollView>
    </View>
  );
}

const TIMER_LABELS: Record<number, string> = {
  0: 'Off',
  86400000: '24 hours',
  604800000: '7 days',
  7776000000: '90 days',
};

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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  timerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00d992',
  },
});