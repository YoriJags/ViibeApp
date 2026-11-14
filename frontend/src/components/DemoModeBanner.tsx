import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';

export default function DemoModeBanner() {
  const router = useRouter();
  const { isDemoMode, toggleDemoMode } = useVibeStore();

  if (!isDemoMode) return null;

  const handleExit = () => {
    toggleDemoMode();
    router.replace('/(public)');
  };

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <Ionicons name="flask" size={14} color="#FFF" />
        <Text style={styles.text}>DEMO MODE</Text>
      </View>
      <TouchableOpacity onPress={handleExit} style={styles.exitBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={styles.exitText}>Exit Demo</Text>
        <Ionicons name="close" size={14} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#D4A017',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 2,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  exitText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 12,
  },
});
