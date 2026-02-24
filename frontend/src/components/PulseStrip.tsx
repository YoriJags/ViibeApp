/**
 * PulseStrip — compact Source of Pulse bar for venue cards
 * Sits beneath the vibe score on VenueCard.
 * Tap triggers PulseBottomSheet.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

export type PulseTier =
  | 'dormant'
  | 'stirring'
  | 'charged'
  | 'electric'
  | 'max_pulse'
  | 'source';

export interface PulseData {
  count: number;         // raw scout contribution count tonight
  total: number;         // max (100)
  tier: PulseTier;
  next_tier_at: number;  // count needed to reach next tier
}

export const TIER_CONFIG: Record<
  PulseTier,
  { label: string; icon: string; color: string; glow: string; nextLabel: string }
> = {
  dormant:   { label: 'Dormant',   icon: '😴', color: '#4a4a6a', glow: 'transparent',           nextLabel: 'Stirring'   },
  stirring:  { label: 'Stirring',  icon: '👀', color: '#6366f1', glow: 'rgba(99,102,241,0.3)',   nextLabel: 'Charged'    },
  charged:   { label: 'Charged',   icon: '⚡', color: '#8b5cf6', glow: 'rgba(139,92,246,0.35)',  nextLabel: 'Electric'   },
  electric:  { label: 'Electric',  icon: '🔥', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)',   nextLabel: 'Max Pulse'  },
  max_pulse: { label: 'Max Pulse', icon: '💜', color: '#c084fc', glow: 'rgba(192,132,252,0.45)', nextLabel: 'SOURCE'     },
  source:    { label: 'SOURCE',    icon: '👑', color: '#fbbf24', glow: 'rgba(251,191,36,0.5)',   nextLabel: ''           },
};

interface Props {
  pulse: PulseData;
  onPress?: () => void;
}

export default function PulseStrip({ pulse, onPress }: Props) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  const tier = TIER_CONFIG[pulse.tier];
  const pct = Math.min(pulse.count / pulse.total, 1);

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: pct,
      tension: 60,
      friction: 9,
      useNativeDriver: false,
    }).start();

    // Subtle breathing glow on the bar
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, [pct]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const fillOpacity = glowAnim;

  if (pulse.tier === 'dormant' && pulse.count === 0) {
    return null; // Don't show strip if no scouts yet tonight
  }

  return (
    <Pressable onPress={onPress} style={styles.container} hitSlop={8}>
      {/* Track */}
      <View style={styles.track}>
        {/* Animated fill */}
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillWidth,
              opacity: fillOpacity,
              backgroundColor: tier.color,
              shadowColor: tier.glow,
              shadowRadius: 6,
              shadowOpacity: 1,
            },
          ]}
        />

        {/* Tier milestone ticks */}
        {[20, 40, 60, 80].map((tick) => (
          <View
            key={tick}
            style={[
              styles.tick,
              { left: `${tick}%` as any },
              pulse.count >= tick && { backgroundColor: tier.color, opacity: 0.7 },
            ]}
          />
        ))}
      </View>

      {/* Label row */}
      <View style={styles.labelRow}>
        <Text style={[styles.tierLabel, { color: tier.color }]}>
          {tier.icon} {tier.label.toUpperCase()}
        </Text>
        <Text style={styles.countLabel}>
          {pulse.count}/{pulse.total}
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
    height: 4,
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
    height: 6,
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  countLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
