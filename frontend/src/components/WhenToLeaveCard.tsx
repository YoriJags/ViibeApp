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
import { card, color, energy, space, type } from '../theme/tokens';

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

// The advice is the content; colour only marks urgency, in the token palette.
const ADVICE_COLOR: Record<string, string> = {
  go_now: color.success,
  go_soon: energy.peak.ink,
  no_rush: color.ink,
  filling: energy.peak.ink,
  wait: energy.lit.ink,
  winding_down: energy.warming.ink,
  no_data: color.inkSoft,
  upcoming: color.inkSoft,
  ended: color.inkSoft,
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

  const tint = ADVICE_COLOR[t.advice ?? 'no_data'] ?? ADVICE_COLOR.no_data;
  const flow = t.flow;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.label}>When to leave</Text>
      <Text style={[styles.headline, { color: tint }]}>{t.headline}</Text>
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
  card: { ...card, gap: space.xxs, marginHorizontal: space.md, marginTop: space.md },
  label: { ...type.labelStrong, color: color.inkSoft },
  headline: { ...type.title },
  detail: { ...type.label, color: color.inkSoft },
  row: { flexDirection: 'row', gap: space.lg, marginTop: space.xs, flexWrap: 'wrap' },
  stat: { minWidth: 0 },
  statValue: { ...type.bodyStrong, color: color.ink },
  statLabel: { ...type.caption, color: color.inkSoft, marginTop: 2 },
});
