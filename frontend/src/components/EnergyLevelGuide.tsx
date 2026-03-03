/**
 * EnergyLevelGuide - Compact horizontal strip explaining the 5 energy levels
 *
 * Educates users about what Quiet, Chill, Warming, Lit, and Peak mean.
 * Positioned between Vibe Intel and the Podium on the trending page.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;

const LEVELS = [
  {
    key: 'quiet',
    icon: 'remove-circle-outline' as keyof typeof Ionicons.glyphMap,
    label: 'Quiet',
    desc: 'Nothing happening',
    color: '#555E6E',
  },
  {
    key: 'chill',
    icon: 'moon' as keyof typeof Ionicons.glyphMap,
    label: 'Chill',
    desc: 'Low key vibes',
    color: '#3399FF',
  },
  {
    key: 'warming',
    icon: 'thermometer' as keyof typeof Ionicons.glyphMap,
    label: 'Warming',
    desc: 'Something building',
    color: '#9B59B6',
  },
  {
    key: 'lit',
    icon: 'flash' as keyof typeof Ionicons.glyphMap,
    label: 'Lit',
    desc: 'Energy is real',
    color: '#FF9933',
  },
  {
    key: 'peak',
    icon: 'flame' as keyof typeof Ionicons.glyphMap,
    label: 'Peak',
    desc: 'Max send',
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
