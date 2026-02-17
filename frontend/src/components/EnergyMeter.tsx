/**
 * EnergyMeter - Gamified energy level display with animated gradient bars
 *
 * Replaces the plain 4px energy bar with a vibrant, level-aware power meter.
 * Features animated fill, gradient colors per level, and pulsing glow at ELECTRIC.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { neonGlow } from '../theme';

// ─── Energy Level Configs ────────────────────────────────────────
const ENERGY_LEVELS = [
  {
    min: 80,
    key: 'electric',
    label: 'ELECTRIC',
    icon: 'flash' as keyof typeof Ionicons.glyphMap,
    colors: ['#FF3366', '#FF6B35'] as [string, string],
    accent: '#FF3366',
    pulse: true,
  },
  {
    min: 60,
    key: 'popping',
    label: 'POPPING',
    icon: 'flame' as keyof typeof Ionicons.glyphMap,
    colors: ['#FF9800', '#FF6B35'] as [string, string],
    accent: '#FF9800',
    pulse: false,
  },
  {
    min: 40,
    key: 'moderate',
    label: 'MODERATE',
    icon: 'musical-notes' as keyof typeof Ionicons.glyphMap,
    colors: ['#FFD54F', '#FF9800'] as [string, string],
    accent: '#FFD54F',
    pulse: false,
  },
  {
    min: 0,
    key: 'chill',
    label: 'CHILL',
    icon: 'moon' as keyof typeof Ionicons.glyphMap,
    colors: ['#4FC3F7', '#4FC3F7'] as [string, string],
    accent: '#4FC3F7',
    pulse: false,
  },
];

export const getEnergyLevel = (percent: number) => {
  return ENERGY_LEVELS.find((l) => percent >= l.min) || ENERGY_LEVELS[ENERGY_LEVELS.length - 1];
};

// ─── Props ───────────────────────────────────────────────────────
interface EnergyMeterProps {
  percent: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  animate?: boolean;
}

// ─── Component ───────────────────────────────────────────────────
export default function EnergyMeter({
  percent,
  size = 'sm',
  showLabel = true,
  animate = true,
}: EnergyMeterProps) {
  const level = getEnergyLevel(percent);
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const barHeight = size === 'md' ? 12 : 8;
  const barRadius = barHeight / 2;

  useEffect(() => {
    if (animate) {
      fillAnim.setValue(0);
      Animated.spring(fillAnim, {
        toValue: percent,
        tension: 40,
        friction: 8,
        useNativeDriver: false,
      }).start();
    } else {
      fillAnim.setValue(percent);
    }
  }, [percent, animate]);

  // Electric pulse loop
  useEffect(() => {
    if (level.pulse) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.75,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [level.pulse]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Bar track */}
      <View
        style={[
          styles.track,
          { height: barHeight, borderRadius: barRadius },
        ]}
      >
        {/* Animated fill */}
        <Animated.View
          style={[
            styles.fillWrapper,
            {
              width: fillWidth,
              height: barHeight,
              borderRadius: barRadius,
              opacity: level.pulse ? pulseAnim : 1,
            },
            level.pulse && neonGlow(level.accent, 'soft'),
          ]}
        >
          <LinearGradient
            colors={level.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.fill,
              { height: barHeight, borderRadius: barRadius },
            ]}
          />
          {/* Leading edge glow */}
          <View
            style={[
              styles.leadingEdge,
              {
                width: barHeight + 4,
                height: barHeight,
                borderRadius: barRadius,
                backgroundColor: 'rgba(255,255,255,0.3)',
              },
            ]}
          />
        </Animated.View>
      </View>

      {/* Level label */}
      {showLabel && (
        <View style={styles.labelRow}>
          <Ionicons name={level.icon} size={11} color={level.accent} />
          <Text style={[styles.labelText, { color: level.accent }]}>
            {level.label}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fillWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  leadingEdge: {
    position: 'absolute',
    right: -2,
    top: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
