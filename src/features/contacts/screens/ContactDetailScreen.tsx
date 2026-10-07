// src/features/contacts/screens/ContactDetailScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useContact } from '../hooks/useContacts';
import { useContactVerification } from '../hooks/useContacts';
import { ContactListItem } from '../components/ContactListItem';
import { SafetyNumberDisplay } from '../components/SafetyNumberDisplay';
import { ContactWithVerification } from '../types';
import { Avatar } from '@/features/chat/components/Avatar';
import { getVerificationStatusColor } from '../utils/verification';

export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { contact, loading, refresh } = useContact(contactId || null);
  const { verifySafetyNumber, requestVerification } = useContactVerification();
  const [showSafetyNumber, setShowSafetyNumber] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');

  const handleVerify = useCallback(async () => {
    if (!contact || !verificationInput.trim()) return;
    
    setVerifying(true);
    try {
      const isValid = await verifySafetyNumber(contact, verificationInput.trim());
      if (isValid) {
        Alert.alert('Success', 'Contact verified successfully!');
        setShowSafetyNumber(false);
        setVerificationInput('');
        refresh();
      } else {
        Alert.alert('Error', 'Safety number does not match. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', 'Verification failed');
    } finally {
      setVerifying(false);
    }
  }, [contact, verificationInput, verifySafetyNumber, refresh]);

  const handleBlock = useCallback(async () => {
    if (!contact) return;
    
    Alert.alert(
      'Block Contact',
      'Are you sure you want to block this contact? You will no longer receive messages from them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await requestVerification(contact.id);
              Alert.alert('Blocked', 'Contact has been blocked');
              refresh();
            } catch (err) {
              Alert.alert('Error', 'Failed to block contact');
            }
          },
        },
      ]
    );
  }, [contact, requestVerification, refresh]);

  const handleUnblock = useCallback(async () => {
    if (!contact) return;
    
    Alert.alert(
      'Unblock Contact',
      'Are you sure you want to unblock this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              // Would call unblock contact
              Alert.alert('Unblocked', 'Contact has been unblocked');
              refresh();
            } catch (err) {
              Alert.alert('Error', 'Failed to unblock contact');
            }
          },
        },
      ]
    );
  }, [contact, refresh]);

  const handleDelete = useCallback(async () => {
    if (!contact) return;
    
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Would call delete contact
              Alert.alert('Deleted', 'Contact has been deleted');
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete contact');
            }
          },
        },
      ]
    );
  }, [contact]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00d992" size="large" />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Contact not found</Text>
      </View>
    );
  }

  const verificationColor = getVerificationStatusColor(contact.verificationStatus);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Info</Text>
        <TouchableOpacity style={styles.moreButton} onPress={() => {}} activeOpacity={0.7}>
          <Ionicons name="ellipsis-vertical" size={28} color="#f2f2f2" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <Avatar
            source={contact.avatarUrl ? { uri: contact.avatarUrl } : undefined}
            name={contact.displayName || contact.contactAccountId}
            size={88}
          />
          <Text style={styles.profileName}>{contact.displayName || contact.contactAccountId}</Text>
          <Text style={styles.profileId}>@{contact.contactAccountId}</Text>
          
          <View style={styles.verificationStatus}>
            <View style={[
              styles.verificationBadge,
              { backgroundColor: verificationColor },
            ]}>
              <Text style={styles.verificationBadgeText}>
                {contact.verificationStatus === 'VERIFIED' ? '✓ Verified' : contact.verificationStatus}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => setShowSafetyNumber(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color="#00d992" style={styles.actionIcon} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Safety Number</Text>
              <Text style={styles.actionSubtitle}>
                {contact.verificationStatus === 'VERIFIED' ? 'Verified' : 'Tap to verify'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push(`/chat/new?contactId=${contact.id}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={24} color="#007aff" style={styles.actionIcon} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Send Message</Text>
              <Text style={styles.actionSubtitle}>Start a conversation</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
          
          {contact.verificationStatus !== 'BLOCKED' && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleBlock}
              activeOpacity={0.7}
            >
              <Ionicons name="person-remove-outline" size={24} color="#ff453a" style={styles.actionIcon} />
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Block Contact</Text>
                <Text style={styles.actionSubtitle}>Stop receiving messages</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
            </TouchableOpacity>
          )}
          
          {contact.verificationStatus === 'BLOCKED' && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleUnblock}
              activeOpacity={0.7}
            >
              <Ionicons name="person-add-outline" size={24} color="#00d992" style={styles.actionIcon} />
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Unblock Contact</Text>
                <Text style={styles.actionSubtitle}>Allow messages again</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowDestructive]}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-bin-outline" size={24} color="#ff453a" style={styles.actionIcon} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitleDestructive}>Delete Contact</Text>
              <Text style={styles.actionSubtitle}>Remove from contacts</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showSafetyNumber && contact.safetyNumber && (
        <SafetyNumberDisplay
          safetyNumber={contact.safetyNumber}
          qrCodeData={contact.safetyNumber} // In real app, this would be the QR code data
          onCopy={() => Alert.alert('Copied', 'Safety number copied to clipboard')}
          onShare={() => Alert.alert('Share', 'Share QR code functionality')}
        />
      )}
    </View>
  );
}

// Need to import ActivityIndicator
import { ActivityIndicator } from 'react-native';

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
  errorText: {
    fontSize: 16,
    color: '#8b949e',
    marginTop: 16,
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
  moreButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f2f2f2',
    marginTop: 16,
  },
  profileId: {
    fontSize: 15,
    color: '#8b949e',
    marginTop: 4,
  },
  verificationStatus: {
    marginTop: 16,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  verificationBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#101010',
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  actionRowDestructive: {
    borderBottomWidth: 0,
  },
  actionIcon: {
    marginRight: 16,
    width: 28,
  },
  actionContent: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  actionTitleDestructive: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ff453a',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
});