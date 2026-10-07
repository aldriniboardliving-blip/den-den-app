// src/features/chat/components/Avatar.tsx
import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle, ImageSourcePropType } from 'react-native';

interface AvatarProps {
  source?: { uri: string };
  name: string;
  size?: number;
  isGroup?: boolean;
  style?: ViewStyle;
}

export function Avatar({ source, name, size = 40, isGroup = false, style }: AvatarProps) {
  const backgroundColor = getColorFromName(name);
  const initials = getInitials(name);

  if (source?.uri) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Image
          source={source}
          style={[
            styles.image,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
          resizeMode="cover"
        />
        {isGroup && (
          <View style={[
            styles.groupBadge,
            { bottom: size * 0.05, right: size * 0.05 },
          ]}>
            <Text style={[
              styles.groupBadgeText,
              { fontSize: size * 0.25 },
            ]}>
              👥
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}
    >
      <Text style={[
        styles.text,
        { fontSize: size * 0.35, lineHeight: size * 0.4 },
      ]}>
        {initials}
      </Text>
      {isGroup && (
        <View style={[
          styles.groupBadge,
          { bottom: size * 0.05, right: size * 0.05 },
        ]}>
          <Text style={[
            styles.groupBadgeText,
            { fontSize: size * 0.25 },
          ]}>
            👥
          </Text>
        </View>
      )}
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] || '';
    const last = parts[parts.length - 1]?.[0] || '';
    return (first + last).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    '#00d992', '#007aff', '#ff453a', '#ff9f0a', '#af52de',
    '#ff2d92', '#5ac8fa', '#30d158', '#bf5af2', '#ff375f',
  ] as const;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index]!;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    borderRadius: 9999,
  },
  text: {
    color: '#101010',
    fontWeight: '700',
  },
  groupBadge: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#101010',
  },
  groupBadgeText: {
    lineHeight: 14,
  },
});