/**
 * SignalDensityStrip — how much evidence sits behind a venue's reading.
 *
 * This is NOT the energy. It is the sample size. It was previously called
 * "Source of Pulse" and used the energy ladder's words (Charged, Electric),
 * so a venue with eighty ratings displayed "ELECTRIC" regardless of what the
 * room actually felt like. See docs/VOCABULARY.md.
 *
 * Two rules keep it from being misread again:
 *   1. No word here appears on the energy ladder.
 *   2. No colour here is a heat colour. Energy owns the thermal ramp (ember,
 *      amber, white hot). Density renders cold and technical, so the eye never
 *      files it as temperature.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

export type DensityTier =
  | 'none'
  | 'thin'
  | 'partial'
  | 'firm'
  | 'dense'
  | 'saturated';

export interface SignalDensityData {
  count: number;         // readings received in the last 24h
  total: number;         // max (100)
  tier: DensityTier;
  next_tier_at: number;  // count needed to reach the next tier
}

export const DENSITY_CONFIG: Record<
  DensityTier,
  { label: string; icon: string; color: string; glow: string; nextLabel: string; meaning: string }
> = {
  none:      { label: 'No signal', icon: '\u2581', color: '#4a4a5a', glow: 'transparent',            nextLabel: 'Thin',      meaning: 'Not enough readings to say anything yet' },
  thin:      { label: 'Thin',      icon: '\u2583', color: '#64748b', glow: 'rgba(100,116,139,0.3)',  nextLabel: 'Partial',   meaning: 'A few readings. Hold the number loosely' },
  partial:   { label: 'Partial',   icon: '\u2584', color: '#0ea5e9', glow: 'rgba(14,165,233,0.32)',  nextLabel: 'Solid',     meaning: 'Indicative, not yet conclusive' },
  firm:      { label: 'Firm',      icon: '\u2586', color: '#22d3ee', glow: 'rgba(34,211,238,0.35)',  nextLabel: 'Dense',     meaning: 'Enough readings to stand behind' },
  dense:     { label: 'Dense',     icon: '\u2587', color: '#a5f3fc', glow: 'rgba(165,243,252,0.4)',  nextLabel: 'Saturated', meaning: 'Heavily covered. The number is well evidenced' },
  saturated: { label: 'Saturated', icon: '\u2588', color: '#f1f5f9', glow: 'rgba(241,245,249,0.45)', nextLabel: '',          meaning: 'As well evidenced as a reading gets' },
};

interface Props {
  density: SignalDensityData;
  onPress?: () => void;
}

export default function SignalDensityStrip({ density, onPress }: Props) {
  const fillAnim = useRef(new Animated.Value(0)).current;

  const tier = DENSITY_CONFIG[density.tier] ?? DENSITY_CONFIG.none;
  const pct = Math.min(density.count / density.total, 1);

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: pct,
      tension: 60,
      friction: 9,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // No readings, nothing to report. Silence is a true statement.
  if (density.count === 0) {
    return null;
  }

  return (
    <Pressable onPress={onPress} style={styles.container} hitSlop={8}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillWidth,
              backgroundColor: tier.color,
              shadowColor: tier.glow,
              shadowRadius: 6,
              shadowOpacity: 1,
            },
          ]}
        />

        {[20, 40, 60, 80].map((tick) => (
          <View
            key={tick}
            style={[
              styles.tick,
              { left: `${tick}%` as any },
              density.count >= tick && { backgroundColor: tier.color, opacity: 0.7 },
            ]}
          />
        ))}
      </View>

      {/* "SIGNAL" is stated outright so the tier word can never be read as a
          claim about the room itself. */}
      <View style={styles.labelRow}>
        <Text style={[styles.tierLabel, { color: tier.color }]}>
          SIGNAL {tier.label.toUpperCase()}
        </Text>
        <Text style={styles.countLabel}>
          {density.count} {density.count === 1 ? 'reading' : 'readings'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginTop: 10,
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  tick: {
    position: 'absolute',
    width: 1,
    height: 5,
    top: -1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    opacity: 0.75,
  },
  countLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
