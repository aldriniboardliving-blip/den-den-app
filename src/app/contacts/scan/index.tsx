// src/app/contacts/scan/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '@/features/auth/store';
import { contactsRepository } from '@/database/repositories/contacts';
import { api } from '@/api/client';
import { parseQRCodeData } from '@/features/contacts/utils/verification';

export default function ScanQRScreen() {
  const { user } = useAuthStore();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permissionStatus, requestPermission] = useCameraPermissions();

  useEffect(() => {
    setHasPermission(permissionStatus?.granted ?? false);
  }, [permissionStatus]);

  const handlePermissionPress = async () => {
    await requestPermission();
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || scanning) return;
    if (!user) return;
    
    const parsed = parseQRCodeData(data);
    if (!parsed) {
      Alert.alert('Invalid QR Code', 'This QR code is not a valid contact verification code.');
      return;
    }

    setScanned(true);
    setScanning(true);

    try {
      // Verify the contact exists on server
      const serverContact = await api.getContact(parsed.accountId);
      if (!serverContact) {
        Alert.alert('Contact Not Found', 'This contact does not exist on the server.');
        setScanned(false);
        setScanning(false);
        return;
      }

      // Check if already in contacts
      const existing = await contactsRepository.getByAccountId(user.id, parsed.accountId);
      if (existing) {
        Alert.alert(
          'Contact Exists',
          'This contact is already in your contacts.',
          [{ text: 'OK', onPress: () => router.push(`/contacts/${existing.id}`) }]
        );
        setScanned(false);
        setScanning(false);
        return;
      }

      // Add contact
      const newContact = await contactsRepository.create({
        userId: user.id,
        contactAccountId: serverContact.accountId,
        contactDeviceId: serverContact.deviceId,
        displayName: serverContact.displayName,
        avatarUrl: serverContact.avatarUrl,
        identityKeyPublic: serverContact.identityKeyPublic,
        signedPrekeyPublic: serverContact.signedPrekeyPublic,
        signedPrekeySignature: serverContact.signedPrekeySignature,
        verificationStatus: 'PENDING',
        verifiedAt: null,
        safetyNumber: null,
        syncStatus: 'SYNCED',
        lastSyncedAt: Date.now(),
        serverVersion: 1,
        deletedAt: null,
      });

      Alert.alert(
        'Contact Added',
        'Contact added successfully. You can now verify the safety number.',
        [{ text: 'OK', onPress: () => router.push(`/contacts/${newContact.id}`) }]
      );
    } catch (error) {
      console.error('Failed to add contact from QR:', error);
      Alert.alert('Error', 'Failed to add contact from QR code');
    } finally {
      setScanned(false);
      setScanning(false);
    }
  };

  if (permissionStatus === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permissionStatus.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.noPermissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#3d3a39" />
          <Text style={styles.noPermissionTitle}>Camera Permission Required</Text>
          <Text style={styles.noPermissionText}>
            Please enable camera access in settings to scan QR codes.
          </Text>
          <TouchableOpacity style={styles.settingsButton} onPress={handlePermissionPress}>
            <Text style={styles.settingsButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
        <View style={styles.scanOverlay}>
          <View style={styles.scanFrame}>
            <View style={styles.corner} />
            <View style={styles.corner} />
            <View style={styles.corner} />
            <View style={styles.corner} />
          </View>
          <Text style={styles.scanHint}>Align QR code within frame</Text>
        </View>
      </View>

      <View style={styles.flashButtonContainer}>
        <TouchableOpacity style={styles.flashButton} onPress={() => {}} activeOpacity={0.7}>
          <Ionicons name="flash-outline" size={28} color="#f2f2f2" />
        </TouchableOpacity>
      </View>
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00d992',
    borderRadius: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: '#00d992',
  },
  scanHint: {
    marginTop: 24,
    fontSize: 16,
    color: '#f2f2f2',
    textAlign: 'center',
  },
  flashButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  flashButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16,16,16,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPermissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noPermissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#f2f2f2',
    marginTop: 16,
    marginBottom: 8,
  },
  noPermissionText: {
    fontSize: 15,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
});