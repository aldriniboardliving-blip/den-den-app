// src/app/contacts/index.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ContactsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Contacts</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/chat/new')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={28} color="#00d992" />
        </TouchableOpacity>
      </View>
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color="#3d3a39" />
        <Text style={styles.emptyTitle}>No contacts yet</Text>
        <Text style={styles.emptySubtitle}>
          Add contacts to start secure messaging
        </Text>
        <TouchableOpacity
          style={styles.addContactButton}
          onPress={() => router.push('/chat/new')}
        >
          <Text style={styles.addContactButtonText}>Add Contact</Text>
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
});