import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLinkedDevices } from '../hooks/useMultidevice';
import { LinkedDevice } from '../types';

export default function DeviceListScreen() {
  const { devices, loading, error, refresh, revokeDevice } = useLinkedDevices();
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRevoke = (device: LinkedDevice) => {
    Alert.alert(
      'Remove Device',
      `Are you sure you want to remove "${device.deviceName || 'Unknown Device'}"? You'll need to re-link it to use it again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRevokingId(device.id);
            try {
              await revokeDevice(device.id);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove device');
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]
    );
  };

  const handleLinkNewDevice = () => {
    router.push('/settings/devices/link');
  };

  if (loading && devices.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00d992" />
          <Text style={styles.loadingText}>Loading devices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Linked Devices</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        {devices.map((device) => (
          <DeviceItem
            key={device.id}
            device={device}
            onRevoke={handleRevoke}
            revoking={revokingId === device.id}
          />
        ))}
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.addDeviceButton}
          onPress={handleLinkNewDevice}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={24} color="#00d992" style={styles.addIcon} />
          <Text style={styles.addDeviceText}>Link New Device</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Ionicons name="information-circle-outline" size={20} color="#8b949e" />
        <Text style={styles.infoText}>
          Your messages are end-to-end encrypted. Each device has its own keys.
          When you link a new device, you'll verify it on your primary device.
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface DeviceItemProps {
  device: LinkedDevice;
  onRevoke: (device: LinkedDevice) => void;
  revoking: boolean;
}

function DeviceItem({ device, onRevoke, revoking }: DeviceItemProps) {
  const isCurrentDevice = false; // Would need current device ID from auth store

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getPlatformIcon = (platform: string): React.ComponentProps<typeof Ionicons>['name'] => {
    switch (platform) {
      case 'ios': return 'logo-apple';
      case 'android': return 'logo-android';
      case 'web': return 'globe';
      default: return 'phone-portrait';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.deviceItem, device.isPrimary && styles.deviceItemPrimary]}
      activeOpacity={0.7}
    >
      <View style={styles.deviceIconContainer}>
        <Ionicons name={getPlatformIcon(device.platform)} size={28} color="#00d992" />
        {device.isPrimary && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>Primary</Text>
          </View>
        )}
      </View>

      <View style={styles.deviceInfo}>
        <View style={styles.deviceNameRow}>
          <Text style={styles.deviceName}>{device.deviceName || 'Unnamed Device'}</Text>
          {device.isPrimary && (
            <Text style={styles.currentBadge}>This device</Text>
          )}
        </View>
        <Text style={styles.deviceMeta}>
          {device.platform} {device.platformVersion ? `(${device.platformVersion})` : ''}
          {device.appVersion && ` • v${device.appVersion}`}
        </Text>
        <Text style={styles.deviceMeta}>
          Linked: {formatDate(device.linkedAt)}
          {device.lastActiveAt && ` • Last active: ${formatDate(device.lastActiveAt)}`}
        </Text>
      </View>

      {!device.isPrimary && (
        <TouchableOpacity
          style={[styles.revokeButton, revoking && styles.revokeButtonLoading]}
          onPress={() => onRevoke(device)}
          disabled={revoking}
          activeOpacity={0.7}
        >
          {revoking ? (
            <ActivityIndicator size="small" color="#f2f2f2" />
          ) : (
            <Ionicons name="trash-outline" size={22} color="#ff453a" />
          )}
        </TouchableOpacity>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#8b949e',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#2a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff453a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#ff453a',
    fontSize: 14,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#ff453a',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#101010',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  deviceItemPrimary: {
    backgroundColor: '#16201a',
  },
  deviceIconContainer: {
    position: 'relative',
    marginRight: 16,
  },
  primaryBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#00d992',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#101010',
    lineHeight: 12,
  },
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  currentBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00d992',
    backgroundColor: 'rgba(0, 217, 146, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  deviceMeta: {
    fontSize: 12,
    color: '#8b949e',
    lineHeight: 18,
  },
  revokeButton: {
    padding: 8,
    marginLeft: 8,
  },
  revokeButtonLoading: {
    opacity: 0.7,
  },
  addDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  addIcon: {
    marginTop: 1,
  },
  addDeviceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d992',
  },
  infoSection: {
    marginTop: 24,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
    flexDirection: 'row',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#8b949e',
    lineHeight: 20,
  },
});