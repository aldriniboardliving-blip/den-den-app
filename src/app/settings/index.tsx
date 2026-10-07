// src/app/settings/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store';

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      
      <View style={styles.section}>
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.displayName?.[0] || user?.accountId?.[0] || '?'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.displayName || 'Unknown'}</Text>
            <Text style={styles.userId}>{user?.accountId || ''}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <SettingsItem
          icon="person-outline"
          title="Profile"
          subtitle="Edit your name, avatar, status"
          onPress={() => {}}
        />
        <SettingsItem
          icon="shield-outline"
          title="Privacy & Security"
          subtitle="Block contacts, safety numbers, screen lock"
          onPress={() => {}}
        />
        <SettingsItem
          icon="notifications-outline"
          title="Notifications"
          subtitle="Message sounds, vibration, preview"
          onPress={() => router.push('/notifications/settings')}
        />
        <SettingsItem
          icon="cloud-outline"
          title="Backup & Restore"
          subtitle="Encrypted backups, auto-backup"
          onPress={() => {}}
        />
        <SettingsItem
          icon="wifi-outline"
          title="Data & Storage"
          subtitle="Media auto-download, storage usage"
          onPress={() => {}}
        />
      </View>

      <View style={styles.section}>
        <SettingsItem
          icon="information-circle-outline"
          title="About"
          subtitle="Version, open source licenses, privacy policy"
          onPress={() => {}}
        />
      </View>

      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color="#ff453a" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface SettingsItemProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}

function SettingsItem({ icon, title, subtitle, onPress }: SettingsItemProps) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={24} color="#8b949e" style={styles.icon} />
      <View style={styles.itemText}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
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
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#101010',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  userId: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  icon: {
    marginRight: 16,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  logoutSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff453a',
  },
});