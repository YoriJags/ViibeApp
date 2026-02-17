/**
 * VibeIntelCarousel - Auto-rotating AI narrative for the Trending page
 *
 * Generates 3-4 insight cards from vibeMaster templates + live trending data.
 * Each card: emoji + headline + subtext. Crossfade animation every 5s.
 * Stats strip below (Active | Hot Spots | Avg Vibe).
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';
import {
  generateDailyPulse,
  getVenueCommentary,
  CityStats,
  CityMood,
} from '../utils/vibeMaster';

const { colors } = publicTheme;

// ─── Types ──────────────────────────────────────────────────────
interface TrendingVenue {
  venue: {
    id: string;
    name: string;
    area: string;
    current_vibe_score: number;
  };
  rank: number;
  energy_percent: number;
  check_in_velocity: number;
  scout_count: number;
  trend: 'up' | 'down' | 'stable';
}

interface InsightCard {
  emoji: string;
  headline: string;
  subtext: string;
  accentColor: string;
}

interface VibeIntelCarouselProps {
  venues: TrendingVenue[];
  city: string;
  isWeekend: boolean;
}

// ─── Mood-to-color mapping ──────────────────────────────────────
const MOOD_COLORS: Record<CityMood, string> = {
  high: '#FF3366',
  weekend: '#FFD700',
  rainy: '#00D4FF',
  mid: '#FF9800',
  low: '#888888',
};

// ─── Component ──────────────────────────────────────────────────
export default function VibeIntelCarousel({
  venues,
  city,
  isWeekend,
}: VibeIntelCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Compute city stats
  const cityPulse = useMemo(() => {
    if (!venues.length) return { avg: 0, active: 0, hot: 0 };
    const avg = Math.round(
      venues.reduce((s, v) => s + v.energy_percent, 0) / venues.length,
    );
    return {
      avg,
      active: venues.length,
      hot: venues.filter((v) => v.energy_percent >= 70).length,
    };
  }, [venues]);

  // Generate insight cards from live data + vibeMaster
  const insights = useMemo((): InsightCard[] => {
    if (!venues.length) return [];

    const cityName = city.charAt(0).toUpperCase() + city.slice(1);
    const topVenue = venues[0];
    const risingVenue = venues
      .filter((v) => v.trend === 'up')
      .sort((a, b) => b.check_in_velocity - a.check_in_velocity)[0];

    const stats: CityStats = {
      city,
      totalVenues: venues.length,
      activeVenues: venues.length,
      averageVibe: cityPulse.avg,
      topVenue: topVenue
        ? {
            name: topVenue.venue.name,
            vibeScore: topVenue.energy_percent,
            area: topVenue.venue.area,
          }
        : null,
      hotSpots: cityPulse.hot,
      isWeekend,
    };

    const pulse = generateDailyPulse(stats);

    const cards: InsightCard[] = [
      // Card 1: City mood
      {
        emoji: pulse.emoji,
        headline: pulse.headline,
        subtext: pulse.subtext,
        accentColor: MOOD_COLORS[pulse.mood] || colors.primary,
      },
    ];

    // Card 2: Top venue spotlight
    if (topVenue) {
      const commentary = getVenueCommentary(
        {
          name: topVenue.venue.name,
          vibeScore: topVenue.energy_percent,
          area: topVenue.venue.area,
        },
        city,
      );
      cards.push({
        emoji: '\u{1F451}',
        headline: `${topVenue.venue.name} is #1`,
        subtext: commentary,
        accentColor: '#FFD700',
      });
    }

    // Card 3: Rising star
    if (risingVenue && risingVenue.venue.id !== topVenue?.venue.id) {
      cards.push({
        emoji: '\u{1F4C8}',
        headline: `${risingVenue.venue.name} is rising fast`,
        subtext: `${risingVenue.check_in_velocity} checks/hr and climbing! The vibe dey increase.`,
        accentColor: '#00E676',
      });
    }

    // Card 4: Scout activity
    const totalScouts = venues.reduce((s, v) => s + v.scout_count, 0);
    cards.push({
      emoji: '\u{1F50D}',
      headline: `${totalScouts} Scouts Active`,
      subtext: `${totalScouts} vibe scouts checking ${venues.length} spots across ${cityName} tonight.`,
      accentColor: '#00D4FF',
    });

    return cards;
  }, [venues, city, isWeekend, cityPulse]);

  // Auto-rotate every 5 seconds with crossfade
  useEffect(() => {
    if (insights.length <= 1) return;

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setActiveIndex((prev) => (prev + 1) % insights.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [insights.length]);

  // Reset index when insights change
  useEffect(() => {
    setActiveIndex(0);
    fadeAnim.setValue(1);
  }, [insights.length]);

  if (!insights.length) return null;

  const current = insights[activeIndex] || insights[0];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={styles.label}>VIBE INTEL</Text>
        </View>
        <View style={styles.dotsRow}>
          {insights.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === activeIndex && {
                  backgroundColor: current.accentColor,
                  width: 16,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Card content with crossfade */}
      <Animated.View style={[styles.cardContent, { opacity: fadeAnim }]}>
        <Text style={styles.cardEmoji}>{current.emoji}</Text>
        <View style={styles.cardTextWrap}>
          <Text style={styles.cardHeadline} numberOfLines={1}>
            {current.headline}
          </Text>
          <Text style={styles.cardSubtext} numberOfLines={2}>
            {current.subtext}
          </Text>
        </View>
      </Animated.View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{cityPulse.active}</Text>
          <Text style={styles.stripLabel}>Active</Text>
        </View>
        <View style={styles.stripDivider} />
        <View style={styles.stripItem}>
          <Text style={[styles.stripValue, { color: colors.vibe.electric }]}>
            {cityPulse.hot}
          </Text>
          <Text style={styles.stripLabel}>Hot Spots</Text>
        </View>
        <View style={styles.stripDivider} />
        <View style={styles.stripItem}>
          <Text style={styles.stripValue}>{cityPulse.avg}</Text>
          <Text style={styles.stripLabel}>Avg Vibe</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
    letterSpacing: 1.5,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  cardEmoji: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardHeadline: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  statsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  stripItem: {
    alignItems: 'center',
    flex: 1,
  },
  stripValue: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  stripLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 2,
  },
  stripDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
