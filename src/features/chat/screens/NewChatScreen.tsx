// src/features/chat/screens/NewChatScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNewChat } from '../hooks/useConversations';
import { ContactSelector } from '../components';
import { Contact } from '@/types';

export default function NewChatScreen() {
  const { contacts, loading, searchQuery, setSearchQuery, refresh } = useNewChat();
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);

  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      }
      return [...prev, contact];
    });
  }, []);

  const handleCreateChat = useCallback(async () => {
    if (selectedContacts.length === 0) return;
    
    if (selectedContacts.length === 1) {
      // Direct message - navigate to existing or create new conversation
      const contact = selectedContacts[0];
      // TODO: Check if conversation exists, create if not
      router.back();
      // For now, just go back - conversation creation would be in a separate step
    } else {
      // Group chat - navigate to group creation screen
      router.push('/chat/create-group', { selectedContacts: JSON.stringify(selectedContacts) } as any);
    }
  }, [selectedContacts]);

  const isSelected = (contactId: string) => selectedContacts.some(c => c.id === contactId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateChat}
          disabled={selectedContacts.length === 0}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.createButtonText,
            selectedContacts.length === 0 && styles.createButtonTextDisabled,
          ]}>
            {selectedContacts.length === 1 ? 'Next' : 'Create Group'}
          </Text>
        </TouchableOpacity>
      </View>
      
      <ContactSelector
        contacts={contacts}
        onSelect={handleSelectContact}
        selectedContactIds={selectedContacts.map(c => c.id)}
        multiSelect={true}
        title="Select contacts"
      />
      
      {selectedContacts.length > 0 && (
        <View style={styles.selectedBar}>
          <View style={styles.selectedAvatars}>
            {selectedContacts.slice(0, 5).map((contact, index) => (
              <View
                key={contact.id}
                style={[
                  styles.selectedAvatar,
                  { zIndex: 5 - index },
                ]}
              >
                <Text style={styles.selectedAvatarText}>
                  {contact.displayName?.[0] || contact.contactAccountId[0]}
                </Text>
              </View>
            ))}
            {selectedContacts.length > 5 && (
              <View style={styles.selectedAvatarMore}>
                <Text style={styles.selectedAvatarMoreText}>
                  +{selectedContacts.length - 5}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
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
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#00d992',
  },
  createButtonTextDisabled: {
    color: '#3d3a39',
  },
  selectedBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  selectedAvatars: {
    flexDirection: 'row',
  },
  selectedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  selectedAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101010',
  },
  selectedAvatarMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3d3a39',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  selectedAvatarMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b949e',
  },
});