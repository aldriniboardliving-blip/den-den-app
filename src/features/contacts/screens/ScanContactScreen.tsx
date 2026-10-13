// src/features/contacts/screens/ScanContactScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  ScrollView,
} from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@/features/auth/store';
import { api } from '@/api/client';
import { useContactVerification } from '../hooks/useContacts';
import { parseQRCodeData, formatSafetyNumber } from '../utils/verification';
import { contactsRepository } from '@/database/repositories/contacts';

export default function ScanContactScreen() {
  const { user } = useAuthStore();
  const { verifySafetyNumber } = useContactVerification();
  const [hasPermission, setHasPermission] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<any>(null);
  const scannerRef = useRef<BarCodeScanner>(null);
  const torchOn = useRef(false);

  // Request camera permissions
  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleBarCodeScanned = useCallback((data: any) => {
    if (scanned || verifying) return;
    
    setScanned(true);
    setScanning(false);
    
    try {
      const parsed = parseQRCodeData(data.data);
      if (!parsed) {
        setError('Invalid QR code format. Please scan a valid Den Den contact QR code.');
        setTimeout(() => setScanned(false), 3000);
        return;
      }
      
      setScannedData(parsed);
    } catch (error) {
      setError('Failed to parse QR code');
      setTimeout(() => setScanned(false), 3000);
    }
  }, [verifying]);

  const handleVerify = useCallback(async () => {
    if (!scannedData || verifying) return;
    
    setVerifying(true);
    setError(null);
    
    try {
      // Fetch the contact from server to verify identity key and get safety number
      const response = await api.getContact(scannedData.accountId);
      
      if (!response) {
        throw new Error('Contact not found on server');
      }
      
      // Verify the identity key matches
      if (response.identityKeyPublic !== scannedData.identityKeyPublic) {
        throw new Error('Identity key mismatch. This QR code may be fraudulent.');
      }
      
      // Check safety number matches
      if (!response.safetyNumber) {
        throw new Error('Contact has no safety number yet');
      }
      
      // Verify safety number matches
      const expectedSafetyNumber = scannedData.safetyNumber.toLowerCase().replace(/-/g, '');
      const actualSafetyNumber = response.safetyNumber.toLowerCase().replace(/-/g, '');
      
      if (expectedSafetyNumber !== actualSafetyNumber) {
        throw new Error('Safety number mismatch. The contact may have been compromised.');
      }
      
      // Safety number matches - mark contact as verified
      // First, check if contact exists locally
      const existingContact = await contactsRepository.getByAccountId(user!.id, scannedData.accountId);
      
      if (existingContact) {
        // Update existing contact as verified
        await contactsRepository.update(existingContact.id, {
          verificationStatus: 'VERIFIED',
          verifiedAt: Date.now(),
          safetyNumber: response.safetyNumber,
        });
      } else {
        // Create new verified contact
        await contactsRepository.create({
          userId: user!.id,
          contactAccountId: response.accountId,
          contactDeviceId: response.deviceId ?? null,
          displayName: response.displayName ?? null,
          avatarUrl: response.avatarUrl ?? null,
          identityKeyPublic: response.identityKeyPublic,
          signedPrekeyPublic: response.signedPrekeyPublic ?? null,
          signedPrekeySignature: response.signedPrekeySignature ?? null,
          verificationStatus: 'VERIFIED',
          verifiedAt: Date.now(),
          safetyNumber: response.safetyNumber,
          syncStatus: 'SYNCED',
          lastSyncedAt: Date.now(),
          serverVersion: 1,
          deletedAt: null,
        });
      }
      
      // Safety number matches - mark contact as verified
      Alert.alert(
        'Verification Successful!',
        `Contact verified successfully.\n\nSafety Number: ${formatSafetyNumber(response.safetyNumber)}`,
        [
          { text: 'OK', onPress: () => router.back() },
        ]
      );
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }, [scannedData]);

  const handleRetry = useCallback(() => {
    setScanned(false);
    setScannedData(null);
    setError(null);
    setScanning(true);
  }, []);

  const toggleTorch = useCallback(() => {
    torchOn.current = !torchOn.current;
    scannerRef.current?.setTorchMode(torchOn.current ? 'on' : 'off');
  }, []);

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Contact QR</Text>
          <View style={{ width: 44 }} />
        </View>
        
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#8b949e" style={styles.permissionIcon} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            Den Den needs camera access to scan contact QR codes.
            Please enable camera permissions in your device settings.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={() => BarCodeScanner.requestPermissionsAsync()} activeOpacity={0.7}>
            <Text style={styles.permissionButtonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (scanned && scannedData && !verifying) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => handleRetry()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify Contact</Text>
          <View style={{ width: 44 }} />
        </View>
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.section}>
            <View style={styles.contactCard}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {scannedData.accountId[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>
                  {scannedData.accountId}
                </Text>
                <Text style={styles.contactId}>
                  Device: {scannedData.deviceId.slice(0, 12)}...
                </Text>
              </View>
              <View style={styles.verificationStatus}>
                <View style={[
                  styles.verificationDot,
                  { backgroundColor: '#00d992' }
                ]} />
                <Text style={styles.verificationText}>
                  Identity Key Matches
                </Text>
              </View>
            </View>
            
            <View style={styles.safetyNumberPreview}>
              <Text style={styles.safetyNumberLabel}>Safety Number</Text>
              <Text style={styles.safetyNumberValue}>
                {formatSafetyNumber(scannedData.safetyNumber)}
              </Text>
              <Text style={styles.safetyNumberHint}>
                Compare this with your contact&apos;s safety number
              </Text>
            </View>
            
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            
            <TouchableOpacity
              style={[styles.verifyButton, verifying && styles.verifyButtonLoading]}
              onPress={handleVerify}
              disabled={verifying}
              activeOpacity={0.7}
            >
              {verifying ? (
                <ActivityIndicator color="#101010" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Contact</Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleRetry}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Contact QR</Text>
        <TouchableOpacity style={styles.torchButton} onPress={toggleTorch} activeOpacity={0.7}>
          <Ionicons name={torchOn.current ? 'flash-on' : 'flash-off'} size={28} color="#f2f2f2" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.scannerContainer}>
        <BarCodeScanner
          ref={scannerRef}
          onBarCodeScanned={handleBarCodeScanned}
          barCodeTypes={['qr']}
          style={StyleSheet.absoluteFill}
          cameraType={BarCodeScanner.Constants.CameraType.back}
        />
        
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={styles.corner} style={styles.cornerTopLeft} />
            <View style={styles.corner} style={styles.cornerTopRight} />
            <View style={styles.corner} style={styles.cornerBottomLeft} />
            <View style={styles.corner} style={styles.cornerBottomRight} />
          </View>
          
          <Text style={styles.scanInstruction}>
            Align the QR code within the frame
          </Text>
        </View>
        
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={styles.torchButton}
            onPress={toggleTorch}
            activeOpacity={0.7}
          >
            <Ionicons name={torchOn.current ? 'flash-on' : 'flash-off'} size={28} color="#f2f2f2" />
            <Text style={styles.torchLabel}>{torchOn.current ? 'Flash Off' : 'Flash On'}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.bottomHint}>
          <Text style={styles.hintText}>
            Ask your contact to show their QR code from Settings > Safety Number
          </Text>
        </View>
      </View>
    </View>
  );
}

// Need to import View, Text, etc. at the top
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, PermissionsAndroid, ScrollView } from 'react-native';

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
  torchButton: {
    padding: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionIcon: {
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f2f2f2',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 16,
    color: '#8b949e',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
  scannerContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: '#00d992',
    borderRadius: 16,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: '#00d992',
  },
  cornerTopLeft: {
    top: -3,
    left: -3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: -3,
    right: -3,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  scanInstruction: {
    marginTop: 24,
    fontSize: 16,
    color: '#f2f2f2',
    textAlign: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  torchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  torchLabel: {
    color: '#f2f2f2',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomHint: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  hintText: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
  },
  // Verification result styles
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  contactCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  contactAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101010',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  contactId: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  verificationText: {
    fontSize: 13,
    color: '#8b949e',
  },
  safetyNumberPreview: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  safetyNumberLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 8,
  },
  safetyNumberValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2f2f2',
    textAlign: 'center',
    letterSpacing: 1,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  safetyNumberHint: {
    fontSize: 12,
    color: '#8b949e',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#ff453a',
    textAlign: 'center',
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 24,
  },
  verifyButtonLoading: {
    opacity: 0.7,
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101010',
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#8b949e',
  },
});

export default ScanContactScreen;