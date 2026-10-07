// src/features/backup/screens/BackupListScreen.tsx
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBackups } from '../hooks/useBackup';
import { BackupListItem } from '../components/BackupListItem';
import { BackupWithStatus } from '../types';

export default function BackupListScreen() {
  const { backups, loading, progress, createBackup, deleteBackup, verifyBackup, refresh } = useBackups();
  const [creating, setCreating] = React.useState(false);

  const handleCreateBackup = useCallback(() => {
    router.push('/backup/create');
  }, []);

  const handleVerify = useCallback(async (backupId: string) => {
    const success = await verifyBackup(backupId);
    Alert.alert(success ? 'Verified' : 'Verification Failed', success ? 'Backup integrity verified!' : 'Backup verification failed. File may be corrupted.');
  }, [verifyBackup]);

  const handleDelete = useCallback((backupId: string) => {
    Alert.alert(
      'Delete Backup',
      'Are you sure you want to delete this backup? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteBackup(backupId) },
      ]
    );
  }, [deleteBackup]);

  const handleExport = useCallback((backupId: string) => {
    Alert.alert('Export', 'Export functionality would share the backup file via system share sheet.');
  }, []);

  const renderItem = ({ item }: { item: BackupWithStatus }) => (
    <BackupListItem
      backup={item}
      onPress={() => {}}
      onVerify={handleVerify}
      onDelete={handleDelete}
      onExport={handleExport}
      verifying={progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error'}
    />
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00d992" size="large" />
        <Text style={styles.loadingText}>Loading backups...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Backups</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateBackup}
          disabled={creating}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color="#00d992" />
        </TouchableOpacity>
      </View>

      {progress.stage !== 'idle' && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressHeader}>Backup in Progress</Text>
          {/* Progress component would go here */}
        </View>
      )}

      <FlatList
        data={backups}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={progress.stage !== 'idle'}
            onRefresh={refresh}
            colors={['#00d992']}
            progressBackgroundColor="#101010"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-outline" size={64} color="#3d3a39" />
            <Text style={styles.emptyTitle}>No backups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first encrypted backup to protect your messages
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleCreateBackup}>
              <Text style={styles.emptyButtonText}>Create Backup</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  createButton: {
    padding: 8,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  progressHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d992',
  },
  listContent: {
    paddingBottom: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginLeft: 76,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f2f2f2',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
});