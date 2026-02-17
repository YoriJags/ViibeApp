/**
 * EnergyLevelGuide - Compact horizontal strip explaining the 4 energy levels
 *
 * Educates users about what Chill, Moderate, Popping, and Electric mean.
 * Positioned between Vibe Intel and the Podium on the trending page.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;

const LEVELS = [
  {
    key: 'chill',
    icon: 'moon' as keyof typeof Ionicons.glyphMap,
    label: 'Chill',
    desc: 'Relaxed & lowkey',
    color: '#4FC3F7',
  },
  {
    key: 'moderate',
    icon: 'musical-notes' as keyof typeof Ionicons.glyphMap,
    label: 'Moderate',
    desc: 'Building up',
    color: '#FFD54F',
  },
  {
    key: 'popping',
    icon: 'flame' as keyof typeof Ionicons.glyphMap,
    label: 'Popping',
    desc: 'Vibes are hot',
    color: '#FF9800',
  },
  {
    key: 'electric',
    icon: 'flash' as keyof typeof Ionicons.glyphMap,
    label: 'Electric',
    desc: 'Maximum energy!',
    color: '#FF3366',
  },
];

export default function EnergyLevelGuide() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Energy Levels</Text>
      <View style={styles.strip}>
        {LEVELS.map((level) => (
          <View key={level.key} style={styles.item}>
            <View style={[styles.iconCircle, { backgroundColor: level.color + '20' }]}>
              <Ionicons name={level.icon} size={14} color={level.color} />
            </View>
            <Text style={[styles.itemLabel, { color: level.color }]}>{level.label}</Text>
            <Text style={styles.itemDesc}>{level.desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  strip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  itemDesc: {
    fontSize: 9,
    color: colors.text.muted,
    marginTop: 1,
    textAlign: 'center',
  },
});
