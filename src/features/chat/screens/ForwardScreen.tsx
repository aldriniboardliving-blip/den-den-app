// src/features/chat/screens/ForwardScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/store';
import { contactsRepository } from '@/database/repositories/contacts';
import { conversationsRepository } from '@/database/repositories/conversations';
import { Contact } from '@/types';
import { Avatar } from '../components/Avatar';

export default function ForwardScreen() {
  const { messageId, conversationId } = useLocalSearchParams<{ messageId: string; conversationId: string }>();
  const { user } = useAuthStore();
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedContacts, setSelectedContacts] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  const loadContacts = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userContacts = await contactsRepository.getAll(user.id);
      setContacts(userContacts);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = contacts.filter(c =>
    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactAccountId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (contactId: string) => selectedContacts.includes(contactId);

  const handleSelectContact = React.useCallback((contact: Contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.includes(contact.id);
      if (isSelected) {
        return prev.filter(id => id !== contact.id);
      }
      return [...prev, contact.id];
    });
  }, []);

  const handleForward = React.useCallback(async () => {
    if (selectedContacts.length === 0) return;
    
    try {
      // Forward the message to selected contacts
      // This would integrate with the message forwarding API
      for (const contactId of selectedContacts) {
        // Forward logic would go here
        console.log('Forwarding message to:', contactId);
      }
      
      Alert.alert('Forwarded', `Message forwarded to ${selectedContacts.length} contact(s)`);
      router.back();
    } catch (error) {
      console.error('Failed to forward message:', error);
      Alert.alert('Error', 'Failed to forward message');
    }
  }, [selectedContacts]);

  const handleCancel = React.useCallback(() => {
    router.back();
  }, []);

  const isSelectedContact = (contactId: string) => selectedContacts.includes(contactId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Forward Message</Text>
        <TouchableOpacity
          style={styles.forwardButton}
          onPress={handleForward}
          disabled={selectedContacts.length === 0}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.forwardButtonText,
            selectedContacts.length === 0 && styles.forwardButtonTextDisabled,
          ]}>
            Forward
          </Text>
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
        data={filteredContacts}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.contactItem, isSelected(item.id) && styles.contactItemSelected]}
            onPress={() => handleSelectContact(item)}
            activeOpacity={0.7}
          >
            <Avatar
              source={item.avatarUrl ? { uri: item.avatarUrl } : undefined}
              name={item.displayName || item.contactAccountId}
              size={48}
            />
            <View style={[styles.contactInfo, { flex: 1 }]}>
              <Text style={styles.contactName} numberOfLines={1}>
                {item.displayName || item.contactAccountId}
              </Text>
              <Text style={styles.contactId} numberOfLines={1}>
                {item.contactAccountId}
              </Text>
            </View>
            {isSelected(item.id) && (
              <View style={styles.checkContainer}>
                <Ionicons name="checkmark" size={20} color="#00d992" />
              </View>
            )}
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contacts found</Text>
          </View>
        }
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
  forwardButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  forwardButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#00d992',
  },
  forwardButtonTextDisabled: {
    color: '#3d3a39',
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
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  contactItemSelected: {
    backgroundColor: 'rgba(0, 217, 146, 0.1)',
  },
  contactInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  contactId: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#8b949e',
  },
});