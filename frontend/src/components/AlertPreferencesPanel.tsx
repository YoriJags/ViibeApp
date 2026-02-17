/**
 * AlertPreferencesPanel - Toggle switches for notification types
 */
import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;

interface AlertPrefs {
  lobby_alerts: boolean;
  streak_reminders: boolean;
  crew_alerts: boolean;
  nearby_alerts: boolean;
}

interface AlertPreferencesPanelProps {
  prefs: AlertPrefs;
  onToggle: (key: keyof AlertPrefs, value: boolean) => void;
}

const PREF_OPTIONS: {
  key: keyof AlertPrefs;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'lobby_alerts',
    label: 'Lobby Alerts',
    description: 'When a saved venue goes electric',
    icon: 'bookmark',
  },
  {
    key: 'streak_reminders',
    label: 'Streak Reminders',
    description: 'Reminder before your streak expires',
    icon: 'flame',
  },
  {
    key: 'crew_alerts',
    label: 'Crew Updates',
    description: 'When a crew member checks in',
    icon: 'people',
  },
  {
    key: 'nearby_alerts',
    label: 'Nearby Vibes',
    description: 'When a venue near you starts popping',
    icon: 'location',
  },
];

export default function AlertPreferencesPanel({ prefs, onToggle }: AlertPreferencesPanelProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {PREF_OPTIONS.map((option) => (
        <View key={option.key} style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name={option.icon} size={18} color={colors.primary} />
          </View>
          <View style={styles.textWrap}>
            <Text style={styles.label}>{option.label}</Text>
            <Text style={styles.description}>{option.description}</Text>
          </View>
          <Switch
            value={prefs[option.key]}
            onValueChange={(val) => onToggle(option.key, val)}
            trackColor={{ false: '#333', true: `${colors.primary}60` }}
            thumbColor={prefs[option.key] ? colors.primary : '#666'}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  description: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },
});
