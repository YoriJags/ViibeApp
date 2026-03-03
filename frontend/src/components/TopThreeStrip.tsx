/**
 * TopThreeStrip — Horizontal strip of tonight's top 3 venues by vibe score.
 * Goes below CityPulseBar on the home screen.
 * Tapping a card navigates to the venue detail page.
 */
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { VibeMarketVenue } from './VibeMarket';

// ─── Constants ───────────────────────────────────────────────────────────────

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'] as const;
const MEDAL_LABELS = ['#1', '#2', '#3'] as const;

const VELOCITY_ICON: Record<string, string> = {
  heating_up:   '↑',
  cooling_down: '↓',
  stable:       '→',
};

function getVibeState(score: number, energy_level?: string): string {
  if (score >= 85) return 'PEAK';
  if (score >= 65) return 'LIT';
  if (score >= 45) return 'WARMING';
  if (score >= 20) return 'CHILL';
  return 'QUIET';
}

function getVibeColor(score: number): string {
  if (score >= 85) return '#FF3366';
  if (score >= 65) return '#FF9933';
  if (score >= 45) return '#9B59B6';
  if (score >= 20) return '#3399FF';
  return '#555E6E';
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface TopThreeStripProps {
  venues: VibeMarketVenue[];   // already sorted by score; slice(0,3) applied inside
  onVenuePress: (id: string) => void;
  onSeeMore?: () => void;
}

// ─── Individual Card ─────────────────────────────────────────────────────────

function TopCard({
  venue,
  rank,
  onPress,
}: {
  venue: VibeMarketVenue;
  rank: 0 | 1 | 2;
  onPress: () => void;
}) {
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const score = Math.round(venue.current_vibe_score);
  const color = getVibeColor(score);
  const medalColor = MEDAL_COLORS[rank];
  const medalLabel = MEDAL_LABELS[rank];
  const state = getVibeState(score, venue.energy_level);
  const velocity = venue.vibe_velocity ?? 'stable';

  // Subtle entrance scale
  useEffect(() => {
    Animated.spring(scoreAnim, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={styles.cardWrap}>
      <LinearGradient
        colors={[`${color}22`, `${color}08`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.card, { borderColor: `${color}35` }]}
      >
        {/* Medal rank */}
        <View style={[styles.medalBadge, { backgroundColor: `${medalColor}20`, borderColor: `${medalColor}50` }]}>
          <Text style={[styles.medalText, { color: medalColor }]}>{medalLabel}</Text>
        </View>

        {/* Score — big number */}
        <Animated.Text
          style={[styles.score, { color, transform: [{ scale: scoreAnim }] }]}
        >
          {score}
        </Animated.Text>

        {/* State label */}
        <Text style={[styles.stateLabel, { color }]}>{state}</Text>

        {/* Venue name */}
        <Text style={styles.venueName} numberOfLines={2}>{venue.name}</Text>

        {/* Area + velocity */}
        <View style={styles.bottomRow}>
          <Text style={styles.area} numberOfLines={1}>{venue.area}</Text>
          <Text style={[styles.velocity, { color: velocity === 'heating_up' ? '#FF9933' : velocity === 'cooling_down' ? '#3399FF' : '#555' }]}>
            {VELOCITY_ICON[velocity]}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Strip ────────────────────────────────────────────────────────────────────

export default function TopThreeStrip({ venues, onVenuePress, onSeeMore }: TopThreeStripProps) {
  const top3 = venues.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.headerTitle}>TONIGHT'S TOP 3</Text>
        </View>
        {onSeeMore && (
          <TouchableOpacity onPress={onSeeMore} activeOpacity={0.7} style={styles.seeMoreBtn}>
            <Text style={styles.seeMoreText}>Full list</Text>
            <Ionicons name="arrow-forward" size={10} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {top3.map((venue, i) => (
          <TopCard
            key={venue.id}
            venue={venue}
            rank={i as 0 | 1 | 2}
            onPress={() => onVenuePress(venue.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_WIDTH = 140;

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 2,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  seeMoreText: {
    fontSize: 10,
    color: '#555',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  cardWrap: {
    width: CARD_WIDTH,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 3,
  },
  medalBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 6,
  },
  medalText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  score: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
  },
  stateLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  venueName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DDD',
    marginTop: 6,
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  area: {
    fontSize: 10,
    color: '#666',
    flex: 1,
  },
  velocity: {
    fontSize: 14,
    fontWeight: '800',
  },
});
