// src/features/contacts/components/SafetyNumberDisplay.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafetyNumberDisplayProps } from '../types';
import { formatSafetyNumber } from '../utils/verification';

export function SafetyNumberDisplay({
  safetyNumber,
  qrCodeData,
  onCopy,
  onShare,
}: SafetyNumberDisplayProps) {
  const formatted = formatSafetyNumber(safetyNumber);
  const groups = formatted.split(' ');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Safety Number</Text>
      <Text style={styles.subtitle}>
        Verify this number with your contact to ensure your conversation is secure.
      </Text>
      
      <View style={styles.numberContainer}>
        {groups.map((group, index) => (
          <View key={index} style={styles.numberGroup}>
            <Text style={styles.numberText}>{group}</Text>
          </View>
        ))}
      </View>

      <View style={styles.qrContainer}>
        <Text style={styles.qrLabel}>QR Code</Text>
        <View style={styles.qrCode}>
          <Image
            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeData)}` }}
            style={styles.qrImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.qrHint}>Scan with contact's camera to verify</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={onCopy}>
          <Text style={styles.actionButtonText}>Copy Number</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={onShare}>
          <Text style={styles.actionButtonText}>Share QR</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#101010',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f2f2f2',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  numberContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  numberGroup: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  numberText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f2f2f2',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
    marginBottom: 16,
  },
  qrCode: {
    backgroundColor: '#f2f2f2',
    borderRadius: 12,
    padding: 16,
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrHint: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 12,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
});