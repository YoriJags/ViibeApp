/**
 * VibeMomentum — Crowd Velocity + Vibe Decay signal for a venue.
 *
 * Two signals in one compact strip:
 *   LEFT  — Crowd Velocity: ↑ rising | → flat | ↓ falling (based on 10-min check-in rate delta)
 *   RIGHT — Freshness:      FRESH | COOLING | COLD  (decay since last activity)
 *
 * Sits between EmojiPulse and the utility stats row on the venue detail page.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type Velocity  = 'rising' | 'flat' | 'falling';
type Freshness = 'fresh' | 'cooling' | 'cold';

interface MomentumData {
  velocity:          Velocity;
  velocity_pct:      number;
  checkins_last_10m: number;
  is_decaying:       boolean;
  decay_minutes:     number;
  decay_points:      number;
  freshness:         Freshness;
}

// Demo data covers a variety of states
const DEMO: MomentumData = {
  velocity: 'rising', velocity_pct: 67,
  checkins_last_10m: 5, is_decaying: false,
  decay_minutes: 0, decay_points: 0, freshness: 'fresh',
};

const VELOCITY_CONFIG: Record<Velocity, { icon: string; color: string; label: string }> = {
  rising:  { icon: 'trending-up',   color: '#00E676', label: 'RISING' },
  flat:    { icon: 'remove',        color: '#888',    label: 'STEADY' },
  falling: { icon: 'trending-down', color: '#FF5252', label: 'SLOWING' },
};

const FRESHNESS_CONFIG: Record<Freshness, { color: string; label: string; dot: string }> = {
  fresh:   { color: '#00E676', label: 'FRESH',   dot: '#00E676' },
  cooling: { color: '#FF9933', label: 'COOLING', dot: '#FF9933' },
  cold:    { color: '#555',    label: 'COLD',    dot: '#444'    },
};

interface Props {
  venueId:    string;
  isDemoMode?: boolean;
}

export default function VibeMomentum({ venueId, isDemoMode }: Props) {
  const [data, setData] = useState<MomentumData | null>(null);

  const fetch_data = useCallback(async () => {
    if (isDemoMode) { setData(DEMO); return; }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/momentum`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [venueId, isDemoMode]);

  useEffect(() => {
    fetch_data();
    const t = setInterval(fetch_data, 2 * 60 * 1000); // refresh every 2 min
    return () => clearInterval(t);
  }, [fetch_data]);

  if (!data) return null;

  const vc = VELOCITY_CONFIG[data.velocity];
  const fc = FRESHNESS_CONFIG[data.freshness];

  return (
    <View style={styles.wrap}>
      {/* Crowd Velocity */}
      <View style={styles.cell}>
        <View style={styles.cellLabelRow}>
          <View style={[styles.dot, { backgroundColor: vc.color }]} />
          <Text style={styles.cellLabel}>CROWD VELOCITY</Text>
        </View>
        <View style={styles.velocityRow}>
          <Ionicons name={vc.icon as any} size={18} color={vc.color} />
          <Text style={[styles.velocityText, { color: vc.color }]}>{vc.label}</Text>
          {data.velocity_pct !== 0 && (
            <Text style={[styles.velocityPct, { color: vc.color + 'AA' }]}>
              {data.velocity_pct > 0 ? '+' : ''}{data.velocity_pct}%
            </Text>
          )}
        </View>
        <Text style={styles.cellSub}>
          {data.checkins_last_10m > 0
            ? `${data.checkins_last_10m} check-in${data.checkins_last_10m !== 1 ? 's' : ''} last 10 min`
            : 'No recent check-ins'}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Vibe Freshness */}
      <View style={styles.cell}>
        <View style={styles.cellLabelRow}>
          <View style={[styles.dot, { backgroundColor: fc.dot }]} />
          <Text style={styles.cellLabel}>VIBE FRESHNESS</Text>
        </View>
        <Text style={[styles.freshnessText, { color: fc.color }]}>{fc.label}</Text>
        <Text style={styles.cellSub}>
          {data.is_decaying
            ? `Quiet ${data.decay_minutes}+ min · -${data.decay_points} pts`
            : 'Activity in last 45 min'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#0C0C14',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#111120',
    overflow: 'hidden',
  },
  cell: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  cellLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  cellLabel: { fontSize: 8, fontWeight: '800', color: '#444', letterSpacing: 1.5 },
  velocityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  velocityText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  velocityPct:  { fontSize: 11, fontWeight: '700' },
  freshnessText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  cellSub: { fontSize: 10, color: '#444', fontWeight: '500' },
  divider: { width: 1, backgroundColor: '#111120', marginVertical: 10 },
});
