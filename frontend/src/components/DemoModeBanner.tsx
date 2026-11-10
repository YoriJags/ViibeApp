/**
 * The demo marker for screens without their own top bar. Quiet, not a yellow
 * alarm: demo is marked once, with a way out.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';
import { DemoPill } from './ui';
import { color, space, type } from '../theme/tokens';

export default function DemoModeBanner() {
  const router = useRouter();
  const { isDemoMode, toggleDemoMode } = useVibeStore();
  if (!isDemoMode) return null;
  return (
    <View style={s.bar}>
      <DemoPill />
      <Text style={s.text}>Sample data</Text>
      <Pressable onPress={() => { toggleDemoMode(); router.replace('/(public)'); }} hitSlop={12} accessibilityRole="button" style={s.exit}>
        <Text style={s.exitText}>Exit demo</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 44,
    backgroundColor: color.bg, borderBottomWidth: 1, borderBottomColor: color.line,
  },
  text: { ...type.label, color: color.inkSoft, flex: 1 },
  exit: { minHeight: 44, justifyContent: 'center' },
  exitText: { ...type.labelStrong, color: color.ink },
});
