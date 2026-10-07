// src/features/backup/components/BackupListItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackupWithStatus } from '../types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface BackupListItemProps {
  backup: BackupWithStatus;
  onPress: (backup: BackupWithStatus) => void;
  onVerify?: (backupId: string) => void;
  onDelete?: (backupId: string) => void;
  onExport?: (backupId: string) => void;
  verifying?: boolean;
}

export function BackupListItem({
  backup,
  onPress,
  onVerify,
  onDelete,
  onExport,
  verifying,
}: BackupListItemProps) {
  const statusColors: Record<string, string> = {
    CREATED: '#00d992',
    VERIFIED: '#00d992',
    EXPORTED: '#007aff',
    IMPORTED: '#af52de',
    FAILED: '#ff453a',
  };

  const statusColor = statusColors[backup.status] || '#8b949e';

  return (
    <TouchableOpacity style={styles.item} onPress={() => onPress(backup)} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name="cloud-done-outline" size={32} color={statusColor} />
      </View>
      <View style={[styles.content, { flex: 1 }]}>
        <View style={styles.header}>
          <Text style={styles.fileName} numberOfLines={1}>{backup.filePath.split('/').pop() || backup.id}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: statusColor },
          ]}>
            <Text style={styles.statusText}>{backup.status}</Text>
          </View>
        </View>
        <View style={styles.detailsRow}>
          <Text style={styles.detail}>{formatBytes(backup.fileSizeBytes)}</Text>
          <Text style={styles.detail}>{formatDate(backup.createdAt)}</Text>
          {backup.verifiedAt && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#00d992" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        {backup.status !== 'FAILED' && !verifying && (
          <TouchableOpacity style={styles.actionButton} onPress={() => onVerify?.(backup.id)}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#00d992" />
          </TouchableOpacity>
        )}
        {backup.status === 'CREATED' && (
          <TouchableOpacity style={styles.actionButton} onPress={() => onExport?.(backup.id)}>
            <Ionicons name="share-outline" size={22} color="#007aff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionButtonDestructive} onPress={() => onDelete?.(backup.id)}>
          <Ionicons name="trash-bin-outline" size={22} color="#ff453a" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#101010',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  detail: {
    fontSize: 13,
    color: '#8b949e',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(0, 217, 146, 0.15)',
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#00d992',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  actionButtonDestructive: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
  },
});