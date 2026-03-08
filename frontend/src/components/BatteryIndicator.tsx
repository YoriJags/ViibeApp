/**
 * BatteryIndicator — shows device battery level as icon + percentage.
 * Used in the crew screen header (own device) and on crew map pins.
 *
 * Props:
 *   level   — 0.0–1.0 battery fraction (from expo-battery or crew API)
 *   size    — 'sm' (crew pin) | 'md' (header chip)
 *   showPct — show numeric percentage alongside icon
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  level?: number | null;  // 0.0–1.0, undefined = unknown
  size?: 'sm' | 'md';
  showPct?: boolean;
}

function batteryIcon(level: number): string {
  if (level > 0.8) return 'battery-full';
  if (level > 0.6) return 'battery-half';
  if (level > 0.3) return 'battery-half';
  return 'battery-dead';
}

function batteryColor(level: number): string {
  if (level > 0.5) return '#4CAF50';
  if (level > 0.2) return '#FF8C00';
  return '#FF3366';
}

export default function BatteryIndicator({ level, size = 'md', showPct = true }: Props) {
  if (level == null || level < 0) return null;

  const pct = Math.round(level * 100);
  const color = batteryColor(level);
  const iconName = batteryIcon(level) as any;
  const iconSize = size === 'sm' ? 11 : 14;
  const fontSize = size === 'sm' ? 9 : 11;

  return (
    <View style={[styles.row, size === 'sm' && styles.rowSm]}>
      <Ionicons name={iconName} size={iconSize} color={color} />
      {showPct && (
        <Text style={[styles.pct, { color, fontSize }]}>{pct}%</Text>
      )}
    </View>
  );
}

/** Self-reading variant — reads own device battery via expo-battery */
export function OwnBatteryIndicator({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const [level, setLevel] = useState<number | null>(null);

  useEffect(() => {
    let sub: any;
    (async () => {
      try {
        const Battery = require('expo-battery');
        const lvl = await Battery.getBatteryLevelAsync();
        setLevel(lvl);
        // Update live on change
        sub = Battery.addBatteryLevelListener(({ batteryLevel }: { batteryLevel: number }) => {
          setLevel(batteryLevel);
        });
      } catch {}
    })();
    return () => { sub?.remove?.(); };
  }, []);

  if (level == null) return null;

  const pct = Math.round(level * 100);
  const color = batteryColor(level);
  const iconName = batteryIcon(level) as any;
  const iconSize = size === 'sm' ? 11 : 13;
  const fontSize = size === 'sm' ? 9 : 11;

  return (
    <View style={[styles.chip, { borderColor: color + '44', backgroundColor: color + '18' }]}>
      <Ionicons name={iconName} size={iconSize} color={color} />
      <Text style={[styles.chipText, { color, fontSize }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rowSm: {
    gap: 1,
  },
  pct: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  chipText: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
