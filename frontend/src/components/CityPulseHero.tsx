/**
 * CityPulseHero — Real-time city heartbeat.
 * "Feel the city's pulse" — this IS that pulse.
 *
 * Shows the live aggregate energy of the city.
 * Three animated rings pulse outward from a central score circle.
 * Color shifts: muted (dead) → cyan (quiet) → gold (buzzing) → orange (popping) → pink (electric)
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export type PulseLabel = 'DEAD' | 'QUIET' | 'BUZZING' | 'POPPING' | 'ELECTRIC';

export interface CityPulseData {
  city: string;
  pulse_score: number;       // 0-100
  pulse_label: PulseLabel;
  active_scouts: number;
  live_venues: number;
  pulses_tonight: number;
  trending_venue?: { name: string; score: number };
  updated_at?: string;
}

interface CityPulseHeroProps {
  data: CityPulseData | null;
  loading?: boolean;
  cityName?: string;
}

const PULSE_THEME: Record<PulseLabel, {
  primary: string;
  secondary: string;
  gradient: [string, string];
  ringColor: string;
  label: string;
}> = {
  DEAD:     { primary: '#444',    secondary: '#333',    gradient: ['#1A1A2A', '#111118'], ringColor: '#333',    label: 'Dead' },
  QUIET:    { primary: '#00D4FF', secondary: '#0099BB', gradient: ['#001A22', '#000E18'], ringColor: '#00D4FF', label: 'Quiet' },
  BUZZING:  { primary: '#FFD700', secondary: '#FF9800', gradient: ['#1A1400', '#120E00'], ringColor: '#FFD700', label: 'Buzzing' },
  POPPING:  { primary: '#FF6B35', secondary: '#FF3366', gradient: ['#1A0A00', '#110508'], ringColor: '#FF6B35', label: 'Popping' },
  ELECTRIC: { primary: '#FF3366', secondary: '#9933FF', gradient: ['#1A0010', '#0D0018'], ringColor: '#FF3366', label: 'Electric' },
};

const RING_SIZES = [32, 52, 72]; // concentric ring diameters

const CityPulseHero: React.FC<CityPulseHeroProps> = ({
  data,
  loading = false,
  cityName = 'Lagos',
}) => {
  const ringAnims = useRef(RING_SIZES.map(() => new Animated.Value(0))).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const dotAnim   = useRef(new Animated.Value(1)).current;

  const label = data?.pulse_label ?? 'QUIET';
  const theme = PULSE_THEME[label];

  // ─── Pulsing rings ────────────────────────────────────────────
  useEffect(() => {
    const pulseRing = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1, duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0, duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const animations = ringAnims.map((a, i) => pulseRing(a, i * 500));
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [label]);

  // ─── LIVE dot blink ──────────────────────────────────────────
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, []);

  // ─── Score fade-in on data change ────────────────────────────
  useEffect(() => {
    Animated.timing(scoreAnim, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start();
    return () => scoreAnim.setValue(0);
  }, [data?.pulse_score]);

  const score = data?.pulse_score ?? 0;

  return (
    <View style={styles.wrapper}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Left: Pulse orb with rings */}
        <View style={styles.orbSection}>
          {/* Rings */}
          {ringAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.ring,
                {
                  width:  RING_SIZES[i],
                  height: RING_SIZES[i],
                  borderRadius: RING_SIZES[i] / 2,
                  borderColor: theme.ringColor,
                  opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
                  transform: [{
                    scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }),
                  }],
                },
              ]}
            />
          ))}
          {/* Core circle */}
          <View style={[styles.core, { backgroundColor: theme.ringColor + '22', borderColor: theme.ringColor }]}>
            <Animated.Text style={[styles.coreScore, { color: theme.primary, opacity: scoreAnim }]}>
              {score}
            </Animated.Text>
          </View>
        </View>

        {/* Right: info */}
        <View style={styles.infoSection}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={styles.cityLabel}>{cityName.toUpperCase()} PULSE</Text>
            <View style={styles.livePill}>
              <Animated.View style={[styles.liveDot, { backgroundColor: theme.primary, opacity: dotAnim }]} />
              <Text style={[styles.liveText, { color: theme.primary }]}>LIVE</Text>
            </View>
          </View>

          {/* Energy label */}
          <Text style={[styles.energyLabel, { color: theme.primary }]}>
            {label}
          </Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data?.live_venues ?? 0}</Text>
              <Text style={styles.statLabel}>venues live</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data?.active_scouts ?? 0}</Text>
              <Text style={styles.statLabel}>scouts active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{data?.pulses_tonight ?? 0}</Text>
              <Text style={styles.statLabel}>pulses tonight</Text>
            </View>
          </View>

          {/* Trending */}
          {data?.trending_venue && (
            <View style={styles.trendingRow}>
              <Text style={styles.trendingIcon}>🔥</Text>
              <Text style={styles.trendingText} numberOfLines={1}>
                {data.trending_venue.name}
              </Text>
              <View style={[styles.trendingScore, { backgroundColor: theme.primary + '22' }]}>
                <Text style={[styles.trendingScoreText, { color: theme.primary }]}>
                  {data.trending_venue.score}
                </Text>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Bottom border glow */}
      <View style={[styles.borderGlow, { backgroundColor: theme.primary }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },

  // ── Orb ──
  orbSection: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  core: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreScore: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  // ── Info ──
  infoSection: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cityLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  energyLabel: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 26,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  trendingIcon: { fontSize: 11 },
  trendingText: {
    fontSize: 11,
    color: '#CCC',
    fontWeight: '600',
    flex: 1,
  },
  trendingScore: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trendingScoreText: {
    fontSize: 10,
    fontWeight: '800',
  },

  borderGlow: {
    height: 1,
    opacity: 0.3,
  },
});

export default CityPulseHero;
