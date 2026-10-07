// src/features/chat/components/ContactSelector.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { ContactSelectorProps } from '../types';
import { Avatar } from './Avatar';
import { Contact } from '@/types';

export function ContactSelector({
  contacts,
  onSelect,
  selectedContactIds = [],
  multiSelect = false,
  title = 'Select contacts',
}: ContactSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredContacts = contacts.filter(c =>
    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactAccountId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelected = (contactId: string) => selectedContactIds.includes(contactId);

  const handlePress = (contact: Contact) => {
    onSelect(contact);
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[styles.item, isSelected(item.id) && styles.itemSelected]}
      onPress={() => handlePress(item)}
      activeOpacity={0.7}
    >
      <Avatar
        source={item.avatarUrl ? { uri: item.avatarUrl } : undefined}
        name={item.displayName || item.contactAccountId}
        size={48}
      />
      <View style={[styles.content, { flex: 1 }]}>
        <Text style={styles.name} numberOfLines={1}>
          {item.displayName || item.contactAccountId}
        </Text>
        <Text style={styles.accountId} numberOfLines={1}>
          {item.contactAccountId}
        </Text>
      </View>
      {multiSelect && (
        <View
          style={[
            styles.checkContainer,
            isSelected(item.id) && styles.checkContainerSelected,
          ]}
        >
          {isSelected(item.id) && <Text style={styles.checkMark}>✓</Text>}
        </View>
      )}
    </TouchableOpacity>
  );

  if (contacts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No contacts found</Text>
        <Text style={styles.emptySubtext}>
          Add contacts to start messaging
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search contacts..."
        placeholderTextColor="#8b949e"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={filteredContacts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matching contacts</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    fontSize: 16,
    color: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  itemSelected: {
    backgroundColor: 'rgba(0, 217, 146, 0.1)',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  accountId: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3d3a39',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkContainerSelected: {
    backgroundColor: '#00d992',
    borderColor: '#00d992',
  },
  checkMark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#101010',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f2f2f2',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8b949e',
    textAlign: 'center',
  },
});