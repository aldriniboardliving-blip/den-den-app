import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinkedDevice } from '../types';

interface DeviceItemProps {
  device: LinkedDevice;
  onPress?: () => void;
  onRevoke?: (device: LinkedDevice) => void;
  revoking?: boolean;
}

export function DeviceItem({ device, onPress, onRevoke, revoking }: DeviceItemProps) {
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
      onPress={onPress}
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

      {!device.isPrimary && onRevoke && (
        <TouchableOpacity
          style={[styles.revokeButton, revoking && styles.revokeButtonLoading]}
          onPress={() => onRevoke(device)}
          disabled={revoking}
          activeOpacity={0.7}
        >
          {revoking ? (
            <Text style={styles.revokeButtonText}>Removing...</Text>
          ) : (
            <Ionicons name="trash-outline" size={22} color="#ff453a" />
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  revokeButtonText: {
    fontSize: 12,
    color: '#f2f2f2',
  },
});