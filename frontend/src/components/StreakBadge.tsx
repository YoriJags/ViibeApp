/**
 * StreakBadge - Shows user's current streak with flame icon
 * Color intensifies with streak length:
 * 0: hidden, 1-2: gray, 3-6: orange, 7-13: red, 14+: gold
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, borderRadius, typography, spacing } from '../theme/floors';

const { colors } = publicTheme;

interface StreakBadgeProps {
  streak: number;
  multiplier?: number;
  size?: 'sm' | 'md' | 'lg';
}

function getStreakColor(streak: number): string {
  if (streak >= 14) return '#FFD700';
  if (streak >= 7) return '#FF3366';
  if (streak >= 3) return '#FF9800';
  return '#888';
}

export default function StreakBadge({ streak, multiplier = 1.0, size = 'md' }: StreakBadgeProps) {
  if (streak <= 0) return null;

  const color = getStreakColor(streak);
  const iconSize = size === 'lg' ? 20 : size === 'md' ? 16 : 12;
  const fontSize = size === 'lg' ? typography.fontSize.lg : size === 'md' ? typography.fontSize.md : typography.fontSize.sm;

  return (
    <View style={[styles.container, { backgroundColor: `${color}15` }]}>
      <Ionicons name="flame" size={iconSize} color={color} />
      <Text style={[styles.count, { color, fontSize }]}>{streak}</Text>
      {multiplier > 1.0 && (
        <View style={[styles.multiplierBadge, { backgroundColor: `${color}25` }]}>
          <Text style={[styles.multiplierText, { color }]}>{multiplier.toFixed(1)}x</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  count: {
    fontWeight: typography.fontWeight.bold,
  },
  multiplierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: 2,
  },
  multiplierText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
});
