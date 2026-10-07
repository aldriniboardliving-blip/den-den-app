// src/features/contacts/screens/ContactsListScreen.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useContacts } from '../hooks/useContacts';
import { ContactListItem } from '../components/ContactListItem';
import { ContactWithVerification } from '../types';

export default function ContactsListScreen() {
  const {
    contacts,
    allContacts,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery,
    refresh,
    addContact,
  } = useContacts();
  const [showAddContact, setShowAddContact] = useState(false);

  const handleAddContact = useCallback(async () => {
    setShowAddContact(true);
  }, []);

  const handleContactPress = useCallback((contact: ContactWithVerification) => {
    router.push(`/contacts/${contact.id}`);
  }, []);

  const renderItem = ({ item }: { item: ContactWithVerification }) => (
    <ContactListItem
      contact={item}
      onPress={handleContactPress}
      showVerificationStatus={true}
    />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={64} color="#3d3a39" />
      <Text style={styles.emptyTitle}>No contacts yet</Text>
      <Text style={styles.emptySubtitle}>
        Add contacts to start secure messaging
      </Text>
      <TouchableOpacity style={styles.addContactButton} onPress={handleAddContact}>
        <Text style={styles.addContactButtonText}>Add Contact</Text>
      </TouchableOpacity>
    </View>
  );

  if (allContacts.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contacts</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddContact}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={28} color="#00d992" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1 }}>{renderEmpty()}</View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddContact}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color="#00d992" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor="#8b949e"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={contacts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            colors={['#00d992']}
            progressBackgroundColor="#101010"
          />
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {showAddContact && (
        <AddContactModal onClose={() => setShowAddContact(false)} onSuccess={() => setShowAddContact(false)} />
      )}
    </View>
  );
}

// Need to import TextInput
import { TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { AddContactScreen } from './AddContactScreen';

function AddContactModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <AddContactScreen onSuccess={onSuccess} onCancel={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
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
  addButton: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#3d3a39',
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
  addContactButton: {
    backgroundColor: '#00d992',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  addContactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#101010',
    borderRadius: 16,
    maxHeight: '90%',
    width: '100%',
  },
});