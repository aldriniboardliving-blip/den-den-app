// src/features/chat/components/ChatHeader.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ChatHeaderProps } from '../types';
import { Avatar } from './Avatar';

export function ChatHeader({
  title,
  subtitle,
  avatar,
  onPress,
  actions,
}: ChatHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerContent}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Avatar
          source={avatar ? { uri: avatar } : undefined}
          name={title}
          size={36}
        />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </TouchableOpacity>
      {actions && <View style={styles.actions}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#101010',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  titleContainer: {
    marginLeft: 10,
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
    maxWidth: '100%',
  },
  subtitle: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});