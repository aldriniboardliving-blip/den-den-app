// src/features/chat/screens/CreateGroupScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNewChat } from '../hooks/useConversations';
import { Contact } from '@/types';
import { Avatar } from '../components/Avatar';
import { CreateGroupParams } from '../types';

export function CreateGroupScreen() {
  const { contacts, loading, searchQuery, setSearchQuery, refresh } = useNewChat();
  const { selectedContacts: selectedContactsParam } = useLocalSearchParams<{ selectedContacts?: string }>();
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedContactsParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(selectedContactsParam)) as Contact[];
        if (parsed.length > 0) {
          setSelectedContacts(parsed);
        }
      } catch (e) {
        console.error('Failed to parse selected contacts:', e);
      }
    }
  }, [selectedContactsParam]);

  const handleSelectContact = useCallback((contact: Contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.some(c => c.id === contact.id);
      if (isSelected) {
        return prev.filter(c => c.id !== contact.id);
      }
      return [...prev, contact];
    });
  }, []);

  const isSelected = (contactId: string) => selectedContacts.some(c => c.id === contactId);

  const validateForm = useCallback(() => {
    if (!groupTitle.trim()) {
      setTitleError('Group name is required');
      return false;
    }
    if (groupTitle.trim().length > 50) {
      setTitleError('Group name must be 50 characters or less');
      return false;
    }
    if (selectedContacts.length < 2) {
      Alert.alert('Add Members', 'A group must have at least 2 members (including you)');
      return false;
    }
    setTitleError(null);
    return true;
  }, [groupTitle, selectedContacts.length]);

  const handleCreate = useCallback(async () => {
    if (!validateForm()) return;

    setCreating(true);
    try {
      const memberAccountIds = selectedContacts.map(c => c.contactAccountId);
      
      const params: CreateGroupParams = {
        title: groupTitle.trim(),
        memberAccountIds,
      };

      // TODO: Call API to create group
      // const group = await api.createGroup(params);
      // router.push(`/chat/${group.id}`);

      // For now, simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert(
        'Group Created',
        `"${groupTitle.trim()}" has been created with ${selectedContacts.length} members.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [validateForm, groupTitle, selectedContacts]);

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  const filteredContacts = contacts.filter(c =>
    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactAccountId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel} activeOpacity={0.7} disabled={creating}>
          <Ionicons name="chevron-back" size={28} color="#f2f2f2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={creating || !groupTitle.trim() || selectedContacts.length < 2}
          activeOpacity={0.7}
        >
          {creating ? (
            <ActivityIndicator color="#101010" size="small" />
          ) : (
            <Text style={[
              styles.createButtonText,
              (!groupTitle.trim() || selectedContacts.length < 2) && styles.createButtonTextDisabled,
            ]}>
              Create
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Info</Text>
          
          {(() => {
            const avatarContent = groupAvatar ? (
              <Image source={{ uri: groupAvatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="people-outline" size={40} color="#8b949e" />
              </View>
            );
            return (
              <TouchableOpacity style={styles.avatarPicker} onPress={() => Alert.alert('Not implemented', 'Avatar picker coming soon')} activeOpacity={0.7}>
                <View style={styles.avatarPreview}>
                  {avatarContent}
                  <View style={styles.cameraOverlay}>
                    <Ionicons name="camera-outline" size={24} color="#f2f2f2" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Group name (optional)"
                placeholderTextColor="#8b949e"
                value={groupTitle}
                onChangeText={text => {
                  setGroupTitle(text);
                  setTitleError(null);
                }}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={50}
                textContentType="none"
              />
              {titleError && <Text style={styles.errorText}>{titleError}</Text>}
            </View>
          </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.memberCount}>{selectedContacts.length + 1} members</Text>
          </View>
          
          <TouchableOpacity style={styles.addMemberButton} onPress={() => {}} activeOpacity={0.7}>
            <Ionicons name="person-add-outline" size={22} color="#00d992" style={styles.addMemberIcon} />
            <Text style={styles.addMemberText}>Add Members</Text>
            <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
          </TouchableOpacity>

          {selectedContacts.length > 0 && (
            <View style={styles.selectedMembers}>
              {selectedContacts.map((contact, index) => (
                <View key={contact.id} style={styles.selectedMember}>
                  <Avatar
                    source={contact.avatarUrl ? { uri: contact.avatarUrl } : undefined}
                    name={contact.displayName || contact.contactAccountId}
                    size={40}
                  />
                  <View style={styles.selectedMemberInfo}>
                    <Text style={styles.selectedMemberName}>{contact.displayName || contact.contactAccountId}</Text>
                    <Text style={styles.selectedMemberId}>{contact.contactAccountId}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => setSelectedContacts(prev => prev.filter(c => c.id !== contact.id))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={18} color="#ff453a" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.hintText}>You are automatically added as a member</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.searchWrapper}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              placeholderTextColor="#8b949e"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Ionicons name="search" size={22} color="#8b949e" style={styles.searchIcon} />
          </View>

          {loading ? (
            <View style={styles.loadingContacts}>
              <ActivityIndicator color="#00d992" size="small" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Text style={styles.emptyText}>No contacts found</Text>
            </View>
          ) : (
            <View style={styles.contactsList}>
              {filteredContacts.map(contact => (
                <TouchableOpacity
                  key={contact.id}
                  style={[
                    styles.contactItem,
                    isSelected(contact.id) && styles.contactItemSelected,
                  ]}
                  onPress={() => handleSelectContact(contact)}
                  activeOpacity={0.7}
                >
                  <Avatar
                    source={contact.avatarUrl ? { uri: contact.avatarUrl } : undefined}
                    name={contact.displayName || contact.contactAccountId}
                    size={48}
                  />
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.displayName || contact.contactAccountId}</Text>
                    <Text style={styles.contactId}>{contact.contactAccountId}</Text>
                  </View>
                  {isSelected(contact.id) && (
                    <View style={styles.checkMark}>
                      <Ionicons name="checkmark" size={24} color="#00d992" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: '#00d992',
    borderRadius: 20,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#101010',
  },
  createButtonTextDisabled: {
    color: '#3d3a39',
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
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPicker: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#3d3a39',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00d992',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#101010',
  },
  inputWrapper: {
    width: '100%',
    maxWidth: 300,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#3d3a39',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#ff453a',
    marginTop: 6,
    textAlign: 'center',
  },
  memberCount: {
    fontSize: 14,
    color: '#00d992',
    fontWeight: '600',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
    marginBottom: 16,
  },
  addMemberIcon: {
    marginRight: 12,
  },
  addMemberText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#00d992',
    flex: 1,
  },
  selectedMembers: {
    marginBottom: 8,
  },
  selectedMember: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 8,
  },
  selectedMemberInfo: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  selectedMemberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f2f2f2',
  },
  selectedMemberId: {
    fontSize: 12,
    color: '#8b949e',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  searchWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 48,
    paddingVertical: 12,
    paddingLeft: 16,
    fontSize: 16,
    color: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
  },
  loadingContacts: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#8b949e',
    marginTop: 8,
  },
  emptyContacts: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8b949e',
  },
  contactsList: {
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
  checkMark: {
    padding: 8,
  },
});