// src/features/chat/components/DisappearingTimerPicker.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DisappearingTimerDuration } from '@/types';

interface DisappearingTimerPickerProps {
  visible: boolean;
  onClose: () => void;
  currentTimer: DisappearingTimerDuration;
  onSelect: (timer: DisappearingTimerDuration) => void;
}

const TIMER_OPTIONS: { duration: DisappearingTimerDuration; label: string; description: string }[] = [
  { duration: 0, label: 'Off', description: 'Messages do not disappear' },
  { duration: 86400000, label: '24 hours', description: 'Messages disappear after 24 hours' },
  { duration: 604800000, label: '7 days', description: 'Messages disappear after 7 days' },
  { duration: 7776000000, label: '90 days', description: 'Messages disappear after 90 days' },
];

export function DisappearingTimerPicker({
  visible,
  onClose,
  currentTimer,
  onSelect,
}: DisappearingTimerPickerProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Disappearing Messages</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#f2f2f2" />
          </TouchableOpacity>
        </View>
        <View style={styles.optionsContainer}>
          {TIMER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.duration}
              style={[
                styles.option,
                currentTimer === option.duration && styles.optionSelected,
              ]}
              onPress={() => {
                onSelect(option.duration);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                {currentTimer === option.duration && (
                  <Ionicons name="checkmark" size={24} color="#00d992" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3a39',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f2f2f2',
  },
  optionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  option: {
    backgroundColor: '#101010',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3d3a39',
  },
  optionSelected: {
    borderColor: '#00d992',
    backgroundColor: 'rgba(0, 217, 146, 0.1)',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#f2f2f2',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#8b949e',
  },
});