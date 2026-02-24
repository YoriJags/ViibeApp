/**
 * AfterDarkRankings — Tonight's top 3 venues by pulse accumulation.
 * Horizontally scrollable rank cards. Resets at 6 AM daily.
 * Shows: rank number, venue name, pulse tier badge, live score.
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export interface RankedVenue {
  id: string;
  name: string;
  area: string;
  current_vibe_score: number;
  pulse_count: number; // total_ratings_24h
  pulse_tier: 'source' | 'max_pulse' | 'electric' | 'charged' | 'stirring' | 'dormant';
}

interface Props {
  venues: RankedVenue[];
  onVenuePress: (id: string) => void;
}

const TIER_LABELS: Record<string, string> = {
  source: 'THE SOURCE',
  max_pulse: 'MAX PULSE',
  electric: 'ELECTRIC',
  charged: 'CHARGED',
  stirring: 'STIRRING',
  dormant: 'DORMANT',
};

const TIER_COLORS: Record<string, string> = {
  source: '#FF3366',
  max_pulse: '#FF6B35',
  electric: '#FFD700',
  charged: '#9933FF',
  stirring: '#3399FF',
  dormant: '#555',
};

const RANK_ACCENTS = [
  { medal: '#FFD700', glow: '#FFD70040', label: '#FFD700' }, // 1st — Gold
  { medal: '#C0C0C0', glow: '#C0C0C020', label: '#C0C0C0' }, // 2nd — Silver
  { medal: '#CD7F32', glow: '#CD7F3220', label: '#CD7F32' }, // 3rd — Bronze
];

function RankCard({
  venue,
  rank,
  onPress,
  delay,
}: {
  venue: RankedVenue;
  rank: number;
  onPress: () => void;
  delay: number;
}) {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const accent = RANK_ACCENTS[rank] ?? RANK_ACCENTS[2];
  const tierColor = TIER_COLORS[venue.pulse_tier] ?? '#555';
  const tierLabel = TIER_LABELS[venue.pulse_tier] ?? 'DORMANT';

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 380, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(t);
  }, []);

  // Pulse bar fill — percentage of 100
  const fillPct = Math.min(venue.pulse_count / 100, 1);

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <TouchableOpacity
        style={[styles.card, { borderColor: accent.glow }]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        {/* Subtle rank glow bg */}
        <View style={[styles.glowBg, { backgroundColor: accent.glow }]} />

        {/* Top row: rank + venue name */}
        <View style={styles.topRow}>
          <Text style={[styles.rankNum, { color: accent.medal }]}>
            #{rank + 1}
          </Text>
          <View style={styles.nameWrap}>
            <Text style={styles.venueName} numberOfLines={1}>
              {venue.name}
            </Text>
            <Text style={styles.areaText}>{venue.area}</Text>
          </View>
          <Text style={[styles.vibeScore, { color: TIER_COLORS[venue.pulse_tier] ?? '#888' }]}>
            {Math.round(venue.current_vibe_score)}
          </Text>
        </View>

        {/* Pulse tier badge */}
        <View style={[styles.tierBadge, { borderColor: tierColor + '50' }]}>
          <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
          <Text style={[styles.tierLabel, { color: tierColor }]}>{tierLabel}</Text>
        </View>

        {/* Pulse fill bar */}
        <View style={styles.barTrack}>
          <LinearGradient
            colors={[tierColor, tierColor + '80']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.barFill, { width: `${fillPct * 100}%` as any }]}
          />
        </View>

        {/* Count label */}
        <Text style={styles.countLabel}>
          {venue.pulse_count} <Text style={styles.countSub}>pulses tonight</Text>
        </Text>

        {/* Medal icon top-right */}
        {rank === 0 && (
          <View style={styles.medalWrap}>
            <Ionicons name="trophy" size={16} color="#FFD700" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AfterDarkRankings({ venues, onVenuePress }: Props) {
  if (!venues || venues.length === 0) return null;

  // Show up to top 3
  const top3 = venues.slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <Ionicons name="trophy" size={14} color="#FFD700" />
        <Text style={styles.headerText}>TONIGHT'S RANKINGS</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={196}
        snapToAlignment="start"
      >
        {top3.map((venue, i) => (
          <RankCard
            key={venue.id}
            venue={venue}
            rank={i}
            onPress={() => onVenuePress(venue.id)}
            delay={i * 80}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  cardWrap: {
    width: 186,
  },
  card: {
    backgroundColor: '#111118',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  glowBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  rankNum: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 28,
    letterSpacing: -1,
  },
  nameWrap: {
    flex: 1,
  },
  venueName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    lineHeight: 18,
  },
  areaText: {
    fontSize: 11,
    color: '#555',
    marginTop: 1,
  },
  vibeScore: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tierLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  barTrack: {
    height: 3,
    backgroundColor: '#252530',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  barFill: {
    height: 3,
    borderRadius: 2,
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  countSub: {
    fontSize: 10,
    fontWeight: '400',
    color: '#555',
  },
  medalWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
