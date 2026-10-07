// src/features/backup/components/BackupProgress.tsx
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BackupProgress } from '../types';

const iconNames: Record<BackupProgress['stage'], React.ComponentProps<typeof Ionicons>['name']> = {
  idle: 'cloud-outline',
  dumping: 'document-outline',
  encrypting: 'lock-closed-outline',
  saving: 'save-outline',
  uploading: 'cloud-upload-outline',
  complete: 'checkmark-circle-outline',
  error: 'alert-circle-outline',
};

const stageLabels: Record<BackupProgress['stage'], string> = {
  idle: 'Ready',
  dumping: 'Creating database dump',
  encrypting: 'Encrypting backup',
  saving: 'Saving backup file',
  uploading: 'Uploading to cloud',
  complete: 'Backup complete',
  error: 'Error occurred',
};

interface BackupProgressProps {
  progress: BackupProgress;
  animated?: boolean;
}

export function BackupProgressComponent({ progress, animated = true }: BackupProgressProps) {
  const progressAnim = React.useRef(new Animated.Value(progress.progress)).current;

  React.useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: progress.progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(progress.progress);
    }
  }, [progress.progress, animated, progressAnim]);

  const iconName = iconNames[progress.stage];
  const label = stageLabels[progress.stage];

  return (
    <View style={styles.container}>
      <Animated.View style={[{ opacity: progress.stage === 'idle' ? 0 : 1 }]}>
        <View style={styles.iconWrapper}>
          <Animated.View
            style={[
              styles.iconBackground,
              {
                backgroundColor: progress.stage === 'error' ? 'rgba(255, 69, 58, 0.2)' :
                                 progress.stage === 'complete' ? 'rgba(0, 217, 146, 0.2)' :
                                 'rgba(0, 122, 255, 0.2)',
              },
            ]}
          >
            <Ionicons name={iconName} size={28} color={
              progress.stage === 'error' ? '#ff453a' :
              progress.stage === 'complete' ? '#00d992' : '#007aff'
            } />
          </Animated.View>
        </View>

        <Text style={styles.stageLabel}>{label}</Text>

        {progress.message && (
          <Text style={styles.message}>{progress.message}</Text>
        )}

        {progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error' && (
          <View style={styles.progressContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
              ]}
            />
            <Text style={styles.progressText}>{Math.round(progress.progress)}%</Text>
          </View>
        )}

        {progress.error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#ff453a" style={styles.errorIcon} />
            <Text style={styles.errorText}>{progress.error}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: 16,
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBackground: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f2f2f2',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#3d3a39',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d992',
    minWidth: 40,
    textAlign: 'right',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 8,
    marginTop: 16,
  },
  errorIcon: {
    marginTop: 1,
  },
  errorText: {
    fontSize: 13,
    color: '#ff453a',
    flex: 1,
  },
});