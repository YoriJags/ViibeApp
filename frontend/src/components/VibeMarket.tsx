/**
 * VibeMarket — Wall Street-style venue leaderboard.
 *
 * Venue vibe scores as live stock prices. Green up / red down.
 * Sparklines, volume bars, change chips, and a composite VIBE INDEX.
 * People get hooked watching rankings shift in real-time.
 *
 * Layout:
 *   [VIBE INDEX header — composite city score + market status]
 *   [Column labels: VENUE · TREND · SCORE · CHG · PULSE]
 *   [Venue rows x N — animated on mount, flash on change]
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VibeMarketVenue {
  id: string;
  name: string;
  area: string;
  current_vibe_score: number;
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  energy_level?: string;
  pulse_count: number;
  pulse_tier: string;
  is_featured?: boolean;
}

interface Props {
  venues: VibeMarketVenue[];
  cityName: string;
  cityScore?: number;   // cityPulse.pulse_score
  cityLabel?: string;   // cityPulse.pulse_label
  onVenuePress: (id: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#FF3366';
  if (score >= 60) return '#FF9933';
  if (score >= 40) return '#9933FF';
  return '#3399FF';
}

/** Maps city/venue vibe label → display config. Consistent with app-wide vibe vocabulary. */
function vibeStatus(label: string): { label: string; color: string; icon: string } {
  switch (label.toUpperCase()) {
    case 'ELECTRIC':  return { label: 'ELECTRIC',   color: '#FF3366', icon: 'trending-up'   };
    case 'POPPING':   return { label: 'POPPING',     color: '#FF9933', icon: 'trending-up'   };
    case 'BUZZING':   return { label: 'BUZZING',     color: '#9933FF', icon: 'remove'        };
    default:          return { label: 'SLOW BURN',   color: '#3399FF', icon: 'trending-down' };
  }
}

/** Energy label for a single venue based on its score */
function venueVibeLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'ELECTRIC',  color: '#FF3366' };
  if (score >= 60) return { label: 'POPPING',   color: '#FF9933' };
  if (score >= 40) return { label: 'BUZZING',   color: '#9933FF' };
  return                   { label: 'SLOW BURN', color: '#3399FF' };
}

function liveTime(): string {
  return new Date().toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).toUpperCase();
}

// ─── Volume Bar ──────────────────────────────────────────────────────────────

function VolumeBar({ count, color }: { count: number; color: string }) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const pct = Math.min(count / 100, 1);

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={volStyles.track}>
      <Animated.View
        style={[
          volStyles.fill,
          {
            backgroundColor: color,
            width: fillAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
}

const volStyles = StyleSheet.create({
  track: {
    width: 28,
    height: 4,
    backgroundColor: '#252530',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});

// ─── Row ─────────────────────────────────────────────────────────────────────

function VenueRow({
  venue,
  rank,
  delay,
  onPress,
}: {
  venue: VibeMarketVenue;
  rank: number;
  delay: number;
  onPress: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(16)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  const sColor = scoreColor(venue.current_vibe_score);
  const vl     = venueVibeLabel(venue.current_vibe_score);

  // Slide-in on mount
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  // #1 venue: blink score every 3s
  useEffect(() => {
    if (rank !== 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2800),
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 120, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 100, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1,   duration: 120, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rank]);

  return (
    <Animated.View
      style={[
        rowStyles.wrap,
        {
          transform: [{ translateX: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={rowStyles.row}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Rank */}
        <Text style={[rowStyles.rank, rank === 0 && { color: '#FFD700' }]}>
          #{rank + 1}
        </Text>

        {/* Venue name + area + energy label */}
        <View style={rowStyles.nameCol}>
          <View style={rowStyles.nameRow}>
            <Text style={rowStyles.name} numberOfLines={1}>{venue.name}</Text>
            {venue.is_featured && (
              <View style={rowStyles.featuredBadge}>
                <Text style={rowStyles.featuredText}>★ TOP</Text>
              </View>
            )}
          </View>
          <Text style={rowStyles.area} numberOfLines={1}>
            {venue.area}
            <Text style={{ color: vl.color, fontWeight: '800', fontSize: 8 }}> · {vl.label}</Text>
          </Text>
        </View>

        {/* Score */}
        <Animated.Text style={[rowStyles.price, { color: sColor, opacity: rank === 0 ? blinkAnim : 1 }]}>
          {Math.round(venue.current_vibe_score)}
        </Animated.Text>

        {/* Volume */}
        <View style={rowStyles.volCol}>
          <VolumeBar count={venue.pulse_count} color={sColor} />
          <Text style={rowStyles.volNum}>{venue.pulse_count}</Text>
        </View>
      </TouchableOpacity>

      {/* Divider */}
      <View style={rowStyles.divider} />
    </Animated.View>
  );
}

const rowStyles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  rank: {
    fontSize: 11,
    fontWeight: '800',
    color: '#555',
    width: 24,
    letterSpacing: -0.3,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EEE',
    marginBottom: 1,
    flexShrink: 1,
  },
  featuredBadge: {
    backgroundColor: '#FFD70020',
    borderWidth: 1,
    borderColor: '#FFD70055',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  featuredText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
  area: {
    fontSize: 10,
    color: '#444',
  },
  price: {
    fontSize: 20,
    fontWeight: '900',
    width: 36,
    textAlign: 'right',
    letterSpacing: -0.5,
  },
  volCol: {
    alignItems: 'center',
    gap: 2,
    width: 30,
  },
  volNum: {
    fontSize: 8,
    color: '#444',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1A1A24',
    marginHorizontal: 14,
  },
});

// ─── Index Header ─────────────────────────────────────────────────────────────

function IndexHeader({
  cityName,
  cityScore,
  cityLabel,
  venueCount,
}: {
  cityName: string;
  cityScore: number;
  cityLabel: string;
  venueCount: number;
}) {
  const [time, setTime] = useState(liveTime());
  const dotAnim = useRef(new Animated.Value(1)).current;
  const status  = vibeStatus(cityLabel);

  const nowDay  = new Date().getDay();
  const nowHour = new Date().getHours();
  const isWeekend = (nowDay === 5 && nowHour >= 18) || nowDay === 6;
  const weekendTag = nowDay === 5 ? 'FRI NIGHT' : 'WEEKEND';

  // Tick clock every 30s
  useEffect(() => {
    const interval = setInterval(() => setTime(liveTime()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Blink live dot
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 0.2, duration: 900,  useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 1,   duration: 900,  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Composite index change (simulated from label)
  const indexChange =
    cityLabel === 'ELECTRIC' ? '+12.4%' :
    cityLabel === 'POPPING'  ? '+6.8%'  :
    cityLabel === 'BUZZING'  ? '+2.1%'  :
    '-3.4%';
  const isPositive = !indexChange.startsWith('-');

  return (
    <LinearGradient
      colors={['#0E0E16', '#111118']}
      style={idxStyles.card}
    >
      {/* Top row */}
      <View style={idxStyles.topRow}>
        <View style={idxStyles.liveRow}>
          <Animated.View style={[idxStyles.liveDot, { opacity: dotAnim }]} />
          <Text style={idxStyles.liveText}>LIVE</Text>
          <Text style={idxStyles.exchange}>VIBE EXCHANGE</Text>
          {isWeekend && (
            <View style={idxStyles.weekendChip}>
              <Text style={idxStyles.weekendChipText}>🎉 {weekendTag}</Text>
            </View>
          )}
        </View>
        <View style={idxStyles.timeRow}>
          <Text style={idxStyles.timeText}>{time}</Text>
          <View style={[idxStyles.marketBadge, { borderColor: status.color + '40' }]}>
            <Ionicons name={status.icon as any} size={9} color={status.color} />
            <Text style={[idxStyles.marketLabel, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>
      </View>

      {/* Score + city */}
      <View style={idxStyles.indexRow}>
        <View>
          <Text style={idxStyles.indexScore}>{cityScore}<Text style={idxStyles.indexUnit}> pts</Text></Text>
          <Text style={idxStyles.cityLabel}>{cityName.toUpperCase()} · {venueCount} ACTIVE</Text>
        </View>

        <View style={idxStyles.changeBlock}>
          <Text style={[idxStyles.indexChange, { color: isPositive ? '#00E676' : '#FF5252' }]}>
            {isPositive ? '▲' : '▼'} {indexChange}
          </Text>
          <Text style={idxStyles.changeSubtext}>tonight</Text>
        </View>
      </View>

      {/* Column headers */}
      <View style={idxStyles.colHeaders}>
        <Text style={[idxStyles.colLabel, { flex: 1, marginLeft: 32 }]}>VENUE</Text>
        <Text style={[idxStyles.colLabel, { width: 36, textAlign: 'right' }]}>SCORE</Text>
        <Text style={[idxStyles.colLabel, { width: 30, textAlign: 'center' }]}>PULSE</Text>
      </View>
    </LinearGradient>
  );
}

const idxStyles = StyleSheet.create({
  card: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: '#1E1E2A',
    borderBottomWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#00E676',
    letterSpacing: 1.5,
  },
  exchange: {
    fontSize: 9,
    color: '#333',
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 4,
  },
  weekendChip: {
    backgroundColor: '#FF336618',
    borderWidth: 1,
    borderColor: '#FF336640',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  weekendChipText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FF9933',
    letterSpacing: 0.5,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 10,
    color: '#444',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  marketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  marketLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  indexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  indexScore: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -1,
  },
  indexUnit: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  cityLabel: {
    fontSize: 9,
    color: '#444',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  changeBlock: {
    alignItems: 'flex-end',
  },
  indexChange: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  changeSubtext: {
    fontSize: 9,
    color: '#444',
    marginTop: 2,
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A24',
    gap: 8,
  },
  colLabel: {
    fontSize: 8,
    color: '#333',
    fontWeight: '700',
    letterSpacing: 1,
  },
});

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function VibeMarket({ venues, cityName, cityScore = 50, cityLabel = 'BUZZING', onVenuePress }: Props) {
  if (!venues || venues.length === 0) return null;

  // Featured venues float to top, then sorted by score
  const sorted = [...venues].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return b.current_vibe_score - a.current_vibe_score;
  });

  return (
    <View style={styles.container}>
      {/* Market index header */}
      <IndexHeader
        cityName={cityName}
        cityScore={cityScore}
        cityLabel={cityLabel.toUpperCase()}
        venueCount={venues.length}
      />

      {/* Venue rows */}
      <View style={styles.board}>
        {sorted.map((venue, i) => (
          <VenueRow
            key={venue.id}
            venue={venue}
            rank={i}
            delay={i * 60}
            onPress={() => onVenuePress(venue.id)}
          />
        ))}

        {/* Market footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            VIBE EXCHANGE · RANKINGS RESET 6AM · DATA LIVE
          </Text>
          <Text style={styles.footerText}>◈</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1E2A',
  },
  board: {
    backgroundColor: '#0B0B12',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A24',
  },
  footerText: {
    fontSize: 7,
    color: '#2A2A38',
    fontWeight: '700',
    letterSpacing: 1,
  },
});
