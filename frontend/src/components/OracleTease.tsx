/**
 * OracleTease — Cliffhanger hook that pulls users back.
 * "The Oracle sees something brewing at {venue} after midnight."
 * Creates FOMO and return-visit motivation.
 * Shown on home feed in the evening (after 6pm). Tapping navigates to venue.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const ENERGY_PRIORITY: Record<string, number> = {
  peak: 4,
  lit: 3,
  charged: 2,
  warming: 1,
};

interface VenueItem {
  id: string;
  name: string;
  area?: string;
  energy_level: string;
}

interface Props {
  venues: VenueItem[];
  onVenuePress: (id: string) => void;
  isDemoMode?: boolean;
}

export default function OracleTease({ venues, onVenuePress, isDemoMode }: Props) {
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  // Compute derived values (before any early returns — hooks must always run first)
  const hour = new Date().getHours();
  const eligible = venues.filter((v) => ENERGY_PRIORITY[v.energy_level] != null);
  const venue = eligible.length > 0
    ? eligible.reduce((best, v) =>
        (ENERGY_PRIORITY[v.energy_level] ?? 0) > (ENERGY_PRIORITY[best.energy_level] ?? 0) ? v : best
      )
    : null;
  const teaseTime = (isDemoMode || hour >= 22) ? 'before 2AM' : 'after midnight';

  // Purple glow pulse — must run before any early returns (Rules of Hooks)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 3000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Only show after 6pm (or always in demo mode) and only when there's an eligible venue
  if ((hour < 18 && !isDemoMode) || !venue) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onVenuePress(venue.id)}
      style={styles.wrapper}
    >
      <LinearGradient
        colors={['#0A0015', '#07070F']}
        style={styles.card}
      >
        {/* Left accent bar */}
        <Animated.View style={[styles.accentBar, { opacity: glowAnim }]} />

        {/* Content row */}
        <View style={styles.contentRow}>
          <View style={styles.leftCol}>
            <View style={styles.headerRow}>
              <Text style={styles.crystalBall}>{'🔮'}</Text>
              <Text style={styles.tagLabel}>ORACLE INTEL</Text>
            </View>
            <Text style={styles.mainText}>
              {'Something is brewing at ' + venue.name}
            </Text>
            <Text style={styles.subText}>
              {'The energy peaks ' + teaseTime + ' \u2014 will you be there?'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9933FF40" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#9933FF20',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
  },
  accentBar: {
    width: 3,
    backgroundColor: '#9933FF',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  leftCol: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  crystalBall: {
    fontSize: 11,
  },
  tagLabel: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#9933FF80',
    fontWeight: '700',
  },
  mainText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#EEEEEE',
    marginTop: 4,
  },
  subText: {
    fontSize: 12,
    color: '#3A3A5A',
    marginTop: 4,
  },
});
