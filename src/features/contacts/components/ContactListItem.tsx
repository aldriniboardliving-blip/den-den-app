// src/features/contacts/components/ContactListItem.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { ContactListItemProps } from '../types';
import { Avatar } from '@/features/chat/components/Avatar';
import { getVerificationStatusColor, getVerificationStatusLabel } from '../utils/verification';

export function ContactListItem({
  contact,
  onPress,
  onLongPress,
  showVerificationStatus = true,
}: ContactListItemProps) {
  const verificationColor = getVerificationStatusColor(contact.verificationStatus);
  const verificationLabel = getVerificationStatusLabel(contact.verificationStatus);

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(contact)}
      onLongPress={onLongPress ? () => onLongPress(contact) : undefined}
      activeOpacity={0.7}
      accessibilityLabel={`${contact.displayName || contact.contactAccountId}, ${verificationLabel}`}
    >
      <Avatar
        source={contact.avatarUrl ? { uri: contact.avatarUrl } : undefined}
        name={contact.displayName || contact.contactAccountId}
        size={56}
      />
      <View style={[styles.content, { flex: 1 }]}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>
            {contact.displayName || contact.contactAccountId}
          </Text>
          {showVerificationStatus && (
            <View style={[styles.verificationBadge, { backgroundColor: verificationColor }]}>
              <Text style={styles.verificationText}>{verificationLabel}</Text>
            </View>
          )}
        </View>
        <View style={styles.detailsRow}>
          <Text style={styles.accountId} numberOfLines={1}>
            {contact.contactAccountId}
          </Text>
          {contact.verificationStatus === 'VERIFIED' && contact.lastVerifiedAt && (
            <Text style={styles.verifiedAt}>
              Verified {formatRelativeTime(contact.lastVerifiedAt)}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.chevron} />
    </TouchableOpacity>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#101010',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
    flex: 1,
    marginRight: 8,
  },
  verificationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verificationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#101010',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountId: {
    fontSize: 13,
    color: '#8b949e',
    flex: 1,
  },
  verifiedAt: {
    fontSize: 12,
    color: '#00d992',
    marginLeft: 8,
  },
  chevron: {
    marginLeft: 8,
  },
});