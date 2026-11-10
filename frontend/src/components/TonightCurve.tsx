/**
 * Tonight so far: one bar per hour, height by average score, coloured by the
 * hour's energy state. No gridlines, no chrome. Replaces the old collapsible
 * VibeTimeline card on the venue screen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, energy, radius, space, type } from '../theme/tokens';
import { asEnergyState } from '../theme/energy';

type Point = { hour: string; hour_label: string; avg_vibe_score: number; energy_level: string };

export default function TonightCurve({ points }: { points: Point[] }) {
  const last = points.slice(-8);
  const peak = Math.max(1, ...last.map((p) => p.avg_vibe_score || 0));
  return (
    <View accessibilityLabel={`Tonight so far: ${last.map((p) => `${p.hour_label} ${Math.round(p.avg_vibe_score)}`).join(', ')}`}>
      <View style={s.bars}>
        {last.map((p) => {
          const st = asEnergyState(p.energy_level);
          return (
            <View key={p.hour} style={s.col}>
              <View style={[s.bar, { height: `${Math.max(6, (p.avg_vibe_score / peak) * 100)}%`, backgroundColor: energy[st].fill }]} />
            </View>
          );
        })}
      </View>
      <View style={s.axis}>
        {last.map((p) => <Text key={p.hour} style={s.label} numberOfLines={1}>{p.hour_label}</Text>)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bars: { height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, marginTop: space.sm },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: radius.sm / 2, borderTopRightRadius: radius.sm / 2 },
  axis: { flexDirection: 'row', gap: space.xs, marginTop: space.xxs },
  label: { ...type.caption, color: color.inkFaint, flex: 1, textAlign: 'center' },
});
