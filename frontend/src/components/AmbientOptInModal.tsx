/**
 * AmbientOptInModal
 *
 * Explains ambient sound metering before asking for mic permission.
 * Shown once — user's choice is persisted via AsyncStorage.
 */
import React from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function AmbientOptInModal({ visible, onAccept, onDecline }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <Ionicons name="mic-outline" size={32} color="#a855f7" />
          </View>

          <Text style={styles.title}>Sound Level Detection</Text>
          <Text style={styles.body}>
            VIIBE can measure how loud the room is to verify the energy — like a dB meter.
          </Text>
          <Text style={styles.body}>
            <Text style={styles.bold}>No audio is ever recorded or stored.</Text>
            {' '}Only a single number (sound level) is sent, then discarded.
          </Text>
          <Text style={styles.note}>
            You can turn this off anytime in Settings.
          </Text>

          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Text style={styles.acceptText}>Turn on sound sensing</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
            <Text style={styles.declineText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F0F1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 44,
    gap: 12,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(168,85,247,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 0.3,
  },
  body: {
    fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 21,
  },
  bold: {
    color: 'rgba(255,255,255,0.9)', fontWeight: '700',
  },
  note: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500',
  },
  acceptBtn: {
    backgroundColor: '#a855f7',
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 8,
  },
  acceptText: {
    fontSize: 15, fontWeight: '700', color: '#fff',
  },
  declineBtn: {
    alignItems: 'center', paddingVertical: 10,
  },
  declineText: {
    fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '600',
  },
});
