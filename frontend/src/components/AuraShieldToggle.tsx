/**
 * AuraShieldToggle - Aura Shield configuration for merchant settings
 * Toggle + threshold slider + alert type selection
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = merchantTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AuraShieldToggleProps {
  venueId: string;
  getAuthHeaders: () => Record<string, string>;
}

const ALERT_TYPES = [
  { key: 'score_drop', label: 'Score Drop', icon: 'trending-down' as const, color: '#FF5252' },
  { key: 'gate_blocked', label: 'Gate Blocked', icon: 'close-circle' as const, color: '#FF9800' },
  { key: 'capacity_full', label: 'Over Capacity', icon: 'people' as const, color: '#2196F3' },
];

const THRESHOLD_PRESETS = [30, 40, 50, 60, 70];

export default function AuraShieldToggle({ venueId, getAuthHeaders }: AuraShieldToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(50);
  const [alertOn, setAlertOn] = useState<string[]>(['score_drop']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/merchant/venue/${venueId}/aura-shield`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setEnabled(data.enabled || false);
        setThreshold(data.threshold || 50);
        setAlertOn(data.alert_on || ['score_drop']);
      }
    } catch (e) {
      console.error('Error fetching aura shield:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (updates: { enabled?: boolean; threshold?: number; alert_on?: string[] }) => {
    const newEnabled = updates.enabled ?? enabled;
    const newThreshold = updates.threshold ?? threshold;
    const newAlertOn = updates.alert_on ?? alertOn;

    setSaving(true);
    try {
      await fetch(
        `${API_URL}/api/merchant/venue/${venueId}/aura-shield`,
        {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            enabled: newEnabled,
            threshold: newThreshold,
            alert_on: newAlertOn,
          }),
        }
      );
    } catch (e) {
      console.error('Error saving aura shield:', e);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = (val: boolean) => {
    setEnabled(val);
    saveConfig({ enabled: val });
  };

  const selectThreshold = (val: number) => {
    setThreshold(val);
    saveConfig({ threshold: val });
  };

  const toggleAlert = (key: string) => {
    const newAlerts = alertOn.includes(key)
      ? alertOn.filter(a => a !== key)
      : [...alertOn, key];
    if (newAlerts.length === 0) return; // Must have at least one
    setAlertOn(newAlerts);
    saveConfig({ alert_on: newAlerts });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header + Toggle */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.shieldIcon, { backgroundColor: enabled ? '#4CAF5020' : '#66666620' }]}>
            <Ionicons
              name="shield-checkmark"
              size={24}
              color={enabled ? '#4CAF50' : '#666'}
            />
          </View>
          <View>
            <Text style={styles.title}>Aura Shield</Text>
            <Text style={styles.subtitle}>
              {enabled ? 'Protecting your vibe' : 'Shield inactive'}
            </Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggleEnabled}
          trackColor={{ false: '#333', true: '#4CAF5060' }}
          thumbColor={enabled ? '#4CAF50' : '#666'}
        />
      </View>

      {enabled && (
        <>
          {/* Threshold */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Alert when score drops below</Text>
            <View style={styles.thresholdRow}>
              {THRESHOLD_PRESETS.map(val => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.thresholdButton,
                    threshold === val && styles.thresholdActive,
                  ]}
                  onPress={() => selectThreshold(val)}
                >
                  <Text style={[
                    styles.thresholdText,
                    threshold === val && styles.thresholdTextActive,
                  ]}>
                    {val}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Alert Types */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Alert on</Text>
            {ALERT_TYPES.map(type => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.alertRow,
                  alertOn.includes(type.key) && { borderColor: type.color + '40' },
                ]}
                onPress={() => toggleAlert(type.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={type.icon} size={18} color={type.color} />
                <Text style={styles.alertLabel}>{type.label}</Text>
                <Ionicons
                  name={alertOn.includes(type.key) ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={alertOn.includes(type.key) ? type.color : '#444'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {saving && (
            <Text style={styles.savingText}>Saving...</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shieldIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  thresholdRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thresholdButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.elevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thresholdActive: {
    backgroundColor: colors.gold + '20',
    borderColor: colors.gold + '40',
  },
  thresholdText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.muted,
  },
  thresholdTextActive: {
    color: colors.gold,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alertLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  savingText: {
    fontSize: typography.fontSize.xs,
    color: colors.gold,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
