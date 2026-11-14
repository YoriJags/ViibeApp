/**
 * WhenToLeaveCard — the ticketed-event promise.
 *
 * Someone holding a festival ticket has already decided to go. What they need
 * on the night is timing: how bad the gate is, whether it has filled up,
 * whether the energy has picked up. That is a different question from "is it
 * worth going", which door-entry events answer with the normal reading.
 *
 * The advice comes from the server (services/leave_timing.py), which only says
 * what its evidence supports. It never claims a travel time or that a headliner
 * is on, because it cannot know either.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || 'https://vibeapp-production-1835.up.railway.app';

type Timing = {
  promise: 'timing' | 'worth';
  advice: string | null;
  headline?: string;
  detail?: string;
  gate?: 'clear' | 'slow' | 'blocked' | null;
  gate_readings?: number;
  flow?: { arrivals_30m: number; departures_30m: number; direction?: string };
};

// Colour carries the state, so a glance from across a dark room is enough.
const ADVICE_COLOR: Record<string, string> = {
  go_now: '#7CE3B0',
  go_soon: '#FFBE3B',
  no_rush: '#9AA7FF',
  filling: '#FFBE3B',
  wait: '#FF5A1F',
  winding_down: '#B3216B',
  no_data: '#8E7FA6',
  upcoming: '#8E7FA6',
  ended: '#8E7FA6',
};

const GATE_WORD: Record<string, string> = { clear: 'Clear', slow: 'Slow', blocked: 'Jammed' };

interface Props {
  venueId: string;
}

export default function WhenToLeaveCard({ venueId }: Props) {
  const [t, setT] = useState<Timing | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`${API_URL}/api/events/${venueId}/timing`);
        if (!r.ok) return;
        const d: Timing = await r.json();
        if (!cancelled) setT(d);
      } catch {
        // Keep the last answer rather than flashing an error on a bad signal.
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [venueId]);

  if (!t || t.promise !== 'timing' || !t.headline) return null;

  const color = ADVICE_COLOR[t.advice ?? 'no_data'] ?? ADVICE_COLOR.no_data;
  const flow = t.flow;

  return (
    <View style={[styles.card, { borderColor: color + '55' }]} accessibilityRole="summary">
      <Text style={styles.label}>When to leave</Text>
      <Text style={[styles.headline, { color }]}>{t.headline}</Text>
      {!!t.detail && <Text style={styles.detail}>{t.detail}</Text>}

      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{t.gate ? GATE_WORD[t.gate] : 'No reading'}</Text>
          <Text style={styles.statLabel}>
            Gate{t.gate_readings ? `, from ${t.gate_readings} readings` : ''}
          </Text>
        </View>
        {flow && (flow.arrivals_30m > 0 || flow.departures_30m > 0) && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {flow.arrivals_30m} in, {flow.departures_30m} out
            </Text>
            <Text style={styles.statLabel}>Last 30 minutes</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    backgroundColor: 'rgba(27,16,56,0.6)',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  headline: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  detail: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
  row: { flexDirection: 'row', gap: 20, marginTop: 8, flexWrap: 'wrap' },
  stat: { minWidth: 0 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#FFF5DE' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
});
