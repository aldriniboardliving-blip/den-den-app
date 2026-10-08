// src/features/chat/components/MessageContextMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '@/features/chat/types';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  isOwnOnly?: boolean;
  destructive?: boolean;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'reply', label: 'Reply', icon: 'chatbubble-outline' },
  { id: 'copy', label: 'Copy', icon: 'copy-outline' },
  { id: 'forward', label: 'Forward', icon: 'send-outline' },
  { id: 'edit', label: 'Edit', icon: 'create-outline', isOwnOnly: true },
  { id: 'delete', label: 'Delete', icon: 'trash-outline', destructive: true },
];

interface MessageContextMenuProps {
  message: ChatMessage;
  isOwn: boolean;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  visible: boolean;
  anchorPosition: { x: number; y: number };
  onClose: () => void;
}

export function MessageContextMenu({
  message,
  isOwn,
  onEdit,
  onDelete,
  onCopy,
  onReply,
  onForward,
  visible,
  anchorPosition,
  onClose,
}: MessageContextMenuProps) {
  const [animation, setAnimation] = React.useState(new Animated.Value(0));
  const menuRef = useRef<View>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(animation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }).start(() => onClose());
    }
  }, [visible, animation, onClose]);

  if (!visible) return null;

  const filteredItems = MENU_ITEMS.filter(item => !item.isOwnOnly || isOwn);

  const handleItemPress = (itemId: string) => {
    switch (itemId) {
      case 'reply':
        onReply(message);
        break;
      case 'copy':
        onCopy(message);
        break;
      case 'forward':
        onForward(message);
        break;
      case 'edit':
        onEdit(message);
        break;
      case 'delete':
        onDelete(message);
        break;
    }
    onClose();
  };

  return (
    <TouchableOpacity
      style={styles.backdrop}
      onPress={onClose}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.menu,
          {
            transform: [
              { translateX: animation.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
              { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            ],
            opacity: animation,
          },
        ]}
      >
        <View style={styles.arrow} />
        <View style={styles.menuContent}>
          {filteredItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                item.destructive && styles.menuItemDestructive,
              ]}
              onPress={() => handleItemPress(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color={item.destructive ? '#ff453a' : '#f2f2f2'} style={styles.menuItemIcon} />
              <Text style={[styles.menuItemText, item.destructive && styles.menuItemTextDestructive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  menu: {
    position: 'absolute',
    minWidth: 160,
    maxWidth: 240,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
    bottom: -8,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#1a1a1a',
  },
  menuContent: {
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemDestructive: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  menuItemIcon: {
    marginRight: 4,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  menuItemTextDestructive: {
    color: '#ff453a',
  },
});