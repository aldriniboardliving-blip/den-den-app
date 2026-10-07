// src/features/notifications/components/NotificationSettingsItem.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface NotificationSettingsItemProps {
  title: string;
  description: string;
  icon: IconName;
  iconColor: string;
  value: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  showChevron?: boolean;
  onPress?: () => void;
}

export function NotificationSettingsItem({
  title,
  description,
  icon,
  iconColor,
  value,
  onChange,
  disabled = false,
  showChevron = false,
  onPress,
}: NotificationSettingsItemProps) {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        disabled && styles.containerDisabled,
        onPress && styles.containerPressable,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled && !onPress}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color={disabled ? '#3d3a39' : iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, disabled && styles.titleDisabled]}>{title}</Text>
        <Text style={[styles.description, disabled && styles.descriptionDisabled]}>{description}</Text>
      </View>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={22} color="#3d3a39" />
      ) : (
        <Switch
          value={value}
          onValueChange={disabled ? undefined : onChange}
          disabled={disabled}
          trackColor={{ false: '#3d3a39', true: '#00d992' }}
          thumbColor={value ? '#101010' : '#f2f2f2'}
        />
      )}
    </TouchableOpacity>
  );
}

interface NotificationTimePickerProps {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  icon: IconName;
  iconColor: string;
}

export function NotificationTimePicker({
  title,
  description,
  value,
  onChange,
  icon,
  iconColor,
}: NotificationTimePickerProps) {
  return (
    <TouchableOpacity style={styles.timeContainer} onPress={() => onChange(value)} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.timeDisplay}>
        <Text style={styles.timeValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={20} color="#3d3a39" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  containerDisabled: {
    opacity: 0.5,
  },
  containerPressable: {
    backgroundColor: '#1a1a1a',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#101010',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#f2f2f2',
  },
  titleDisabled: {
    color: '#8b949e',
  },
  description: {
    fontSize: 13,
    color: '#8b949e',
    marginTop: 2,
  },
  descriptionDisabled: {
    color: '#3d3a39',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingLeft: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  timeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#00d992',
  },
});