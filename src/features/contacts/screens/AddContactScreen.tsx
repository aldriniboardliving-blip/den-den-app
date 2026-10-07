// src/features/contacts/screens/AddContactScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNewContact } from '../hooks/useContacts';
import { AddContactScreenProps } from '../types';
import { ContactWithVerification } from '../types';

export function AddContactScreen({ onSuccess, onCancel }: AddContactScreenProps) {
  const { accountId, setAccountId, loading, error, searchByAccountId, reset } = useNewContact();
  const [foundContact, setFoundContact] = useState<ContactWithVerification | null>(null);
  const [adding, setAdding] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!accountId.trim()) {
      Alert.alert('Error', 'Please enter an account ID');
      return;
    }
    
    const contact = await searchByAccountId(accountId.trim());
    if (contact) {
      setFoundContact(contact as ContactWithVerification);
    }
  }, [accountId, searchByAccountId]);

  const handleAdd = useCallback(async () => {
    if (!foundContact) return;
    
    setAdding(true);
    try {
      // The contact was already created during search
      onSuccess(foundContact);
      reset();
      setFoundContact(null);
    } catch (err) {
      Alert.alert('Error', 'Failed to add contact');
    } finally {
      setAdding(false);
    }
  }, [foundContact, onSuccess, reset]);

  const handleCancel = useCallback(() => {
    onCancel();
    reset();
  }, [onCancel, reset]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Contact</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Find by Account ID</Text>
          <Text style={styles.sectionDescription}>
            Enter the account ID of the person you want to add.
          </Text>
          
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Account ID (e.g., user_abc123)"
              placeholderTextColor="#8b949e"
              value={accountId}
              onChangeText={setAccountId}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
            />
            <TouchableOpacity
              style={[styles.searchButton, loading && styles.searchButtonLoading]}
              onPress={handleSearch}
              disabled={loading || !accountId.trim()}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#101010" size="small" />
              ) : (
                <Ionicons name="search" size={24} color="#101010" />
              )}
            </TouchableOpacity>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}
        </View>

        {foundContact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Found</Text>
            
            <View style={styles.foundContactCard}>
              <View style={styles.foundContactInfo}>
                <View style={styles.foundContactAvatar}>
                  <Text style={styles.foundContactAvatarText}>
                    {foundContact.displayName?.[0] || foundContact.contactAccountId[0]}
                  </Text>
                </View>
                <View style={styles.foundContactDetails}>
                  <Text style={styles.foundContactName}>
                    {foundContact.displayName || 'Unknown'}
                  </Text>
                  <Text style={styles.foundContactId}>
                    {foundContact.contactAccountId}
                  </Text>
                  <View style={styles.foundContactVerification}>
                    <View style={[
                      styles.verificationDot,
                      { backgroundColor: foundContact.verificationStatus === 'VERIFIED' ? '#00d992' : '#8b949e' }
                    ]} />
                    <Text style={styles.foundContactVerificationText}>
                      {foundContact.verificationStatus === 'VERIFIED' ? 'Verified' : 'Unverified'}
                    </Text>
                  </View>
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.addButton, adding && styles.addButtonLoading]}
                onPress={handleAdd}
                disabled={adding}
                activeOpacity={0.7}
              >
                {adding ? (
                  <ActivityIndicator color="#101010" size="small" />
                ) : (
                  <Text style={styles.addButtonText}>Add Contact</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Or Scan QR Code</Text>
          <Text style={styles.sectionDescription}>
            Scan a contact's QR code to add them instantly.
          </Text>
          
          <TouchableOpacity
            style={styles.qrButton}
            onPress={() => router.push('/contacts/scan')}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={28} color="#00d992" style={styles.qrButtonIcon} />
            <Text style={styles.qrButtonText}>Scan QR Code</Text>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// Need to import ScrollView
import { ScrollView } from 'react-native';

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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f2f2f2',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#8b949e',
    marginBottom: 16,
    lineHeight: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f2f2f2',
  },
  searchButton: {
    padding: 12,
    backgroundColor: '#00d992',
    borderRadius: 12,
    margin: 8,
  },
  searchButtonLoading: {
    opacity: 0.7,
  },
  errorText: {
    fontSize: 14,
    color: '#ff453a',
    marginTop: 8,
  },
  foundContactCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  foundContactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  foundContactAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  foundContactAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#101010',
  },
  foundContactDetails: {
    flex: 1,
  },
  foundContactName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  foundContactId: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  foundContactVerification: {
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
  foundContactVerificationText: {
    fontSize: 12,
    color: '#8b949e',
  },
  addButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonLoading: {
    opacity: 0.7,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  qrButtonIcon: {
    marginRight: 12,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d992',
    flex: 1,
  },
});