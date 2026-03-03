/**
 * MomentumArrow — directional score indicator for venue cards and map pins.
 * Shows whether a venue is rising, at peak, fading, or stable.
 *
 * rising  — score climbed 5+ pts in last hour  → green up arrow
 * peaking — high score (≥70), holding            → gold star pulse
 * fading  — score dropped 5+ pts in last hour  → red down arrow
 * stable  — small movement                       → nothing shown
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Momentum = 'rising' | 'peaking' | 'fading' | 'stable';

interface Props {
  momentum: Momentum;
  delta?: number;       // optional score delta e.g. +8.2
  size?: 'sm' | 'md';  // sm = map pins, md = cards
}

const COLORS = {
  rising: '#4CAF50',
  peaking: '#FFD700',
  fading: '#FF5252',
  stable: 'transparent',
};

export default function MomentumArrow({ momentum, delta, size = 'md' }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (momentum === 'peaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [momentum]);

  if (momentum === 'stable') return null;

  const iconSize = size === 'sm' ? 10 : 13;
  const color = COLORS[momentum];

  if (momentum === 'rising') {
    return (
      <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
        <Ionicons name="trending-up" size={iconSize} color={color} />
        {delta !== undefined && size === 'md' && (
          <Text style={[styles.delta, { color }]}>+{delta.toFixed(0)}</Text>
        )}
      </View>
    );
  }

  if (momentum === 'fading') {
    return (
      <View style={[styles.pill, { backgroundColor: `${color}22` }]}>
        <Ionicons name="trending-down" size={iconSize} color={color} />
        {delta !== undefined && size === 'md' && (
          <Text style={[styles.delta, { color }]}>{delta.toFixed(0)}</Text>
        )}
      </View>
    );
  }

  // peaking — pulsing star
  return (
    <Animated.View
      style={[
        styles.pill,
        { backgroundColor: `${color}22`, transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Ionicons name="star" size={iconSize} color={color} />
      {size === 'md' && (
        <Text style={[styles.delta, { color }]}>PEAK</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 2,
  },
  delta: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
