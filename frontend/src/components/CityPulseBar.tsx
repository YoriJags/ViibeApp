import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CityPulseData } from '../store/vibeStore';

const LABEL_COLORS: Record<string, string> = {
  PEAK:    '#FF3366',
  LIT:     '#FF9933',
  WARMING: '#9B59B6',
  CHILL:   '#3399FF',
  QUIET:   '#555E6E',
};

const TREND_ICON: Record<string, string> = {
  heating_up:    '↑',
  cooling_down:  '↓',
  stable:        '→',
};

const TREND_LABEL: Record<string, string> = {
  heating_up:   'heating up',
  cooling_down: 'cooling down',
  stable:       'stable',
};

interface CityPulseBarProps {
  pulse: CityPulseData;
  onPress?: () => void;
}

/**
 * Compact city heartbeat bar for the home screen.
 * Shows: city name · live score · trend · 30-min sparkline · scout/venue counts.
 * Updates via Socket.IO city_pulse_update event (handled in vibeStore).
 */
export default function CityPulseBar({ pulse, onPress }: CityPulseBarProps) {
  const pulseAnim = useRef(new Animated.Value(0.7)).current;
  const color = LABEL_COLORS[pulse.pulse_label] ?? LABEL_COLORS.CHILL;

  // Score pulsing glow when city is LIT or PEAK
  useEffect(() => {
    if (pulse.pulse_score >= 65) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulse.pulse_score]);

  const cityName = pulse.city.charAt(0).toUpperCase() + pulse.city.slice(1);
  const sparkline = pulse.sparkline ?? [];
  const maxSpark = Math.max(...sparkline, 1);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.wrapper}>
      <LinearGradient
        colors={[`${color}18`, `${color}06`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.card, { borderColor: `${color}30` }]}
      >
        {/* Left: city + score */}
        <View style={styles.left}>
          <Text style={styles.cityName}>{cityName.toUpperCase()}</Text>
          <View style={styles.scoreRow}>
            <Animated.Text style={[styles.score, { color, opacity: pulseAnim }]}>
              {pulse.pulse_score}
            </Animated.Text>
            <Text style={[styles.label, { color }]}>{pulse.pulse_label}</Text>
            <Text style={[styles.trend, { color }]}>
              {TREND_ICON[pulse.trend]} {TREND_LABEL[pulse.trend]}
            </Text>
          </View>
          <Text style={styles.sub}>
            {pulse.active_scouts} scouts · {pulse.hot_venues ?? 0} venues lit
          </Text>
        </View>

        {/* Right: sparkline */}
        <View style={styles.sparklineWrapper}>
          <View style={styles.sparkline}>
            {sparkline.map((val, i) => (
              <View
                key={i}
                style={[
                  styles.sparkBar,
                  {
                    height: Math.max(3, (val / maxSpark) * 28),
                    backgroundColor: i === sparkline.length - 1 ? color : `${color}60`,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.sparkLabel}>{'30 min'}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  left: {
    flex: 1,
    gap: 3,
  },
  cityName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  score: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  trend: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  sub: {
    fontSize: 11,
    color: '#666',
    letterSpacing: 0.3,
  },
  sparklineWrapper: {
    alignItems: 'flex-end',
    gap: 4,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 32,
  },
  sparkBar: {
    width: 6,
    borderRadius: 3,
  },
  sparkLabel: {
    fontSize: 9,
    color: '#444',
    letterSpacing: 0.5,
  },
});
