/**
 * StoryBubble - Circular story indicator (like Instagram)
 * Shows gradient ring around avatar/venue initial
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { publicTheme, typography } from '../theme/floors';

const { colors } = publicTheme;

interface StoryBubbleProps {
  username: string;
  onPress: () => void;
  isViewed?: boolean;
  size?: number;
}

export default function StoryBubble({ username, onPress, isViewed = false, size = 56 }: StoryBubbleProps) {
  const initial = (username ?? '?').charAt(0).toUpperCase();
  const gradientColors = isViewed
    ? ['#444', '#333'] as const
    : ['#FF3366', '#FF6B35', '#FFD700'] as const;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={gradientColors}
        style={[styles.ring, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}
      >
        <View style={[styles.inner, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initial, { fontSize: size * 0.36 }]}>{initial}</Text>
        </View>
      </LinearGradient>
      <Text style={styles.name} numberOfLines={1}>{username}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ring: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    backgroundColor: colors.background.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    color: colors.text.primary,
    fontWeight: typography.fontWeight.bold,
  },
  name: {
    color: colors.text.muted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 60,
  },
});
