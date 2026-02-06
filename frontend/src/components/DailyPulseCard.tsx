/**
 * DAILY PULSE CARD - Glass-morphism styled city vibe summary
 * 
 * Displays the Vibe Master's commentary on the current nightlife state
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { generateDailyPulse, CityStats, CityMood } from '../utils/vibeMaster';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;

interface DailyPulseCardProps {
  stats: CityStats;
  onPress?: () => void;
}

export default function DailyPulseCard({ stats, onPress }: DailyPulseCardProps) {
  const [pulse, setPulse] = useState(generateDailyPulse(stats));
  const pulseAnim = useState(new Animated.Value(1))[0];
  const glowAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    setPulse(generateDailyPulse(stats));
    
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [stats]);

  const getMoodGradient = (mood: CityMood): string[] => {
    switch (mood) {
      case 'high':
        return ['rgba(255,51,102,0.3)', 'rgba(255,107,53,0.2)'];
      case 'weekend':
        return ['rgba(255,215,0,0.3)', 'rgba(255,51,102,0.2)'];
      case 'rainy':
        return ['rgba(0,212,255,0.3)', 'rgba(65,105,225,0.2)'];
      case 'mid':
        return ['rgba(255,152,0,0.3)', 'rgba(255,215,0,0.2)'];
      default:
        return ['rgba(100,100,100,0.3)', 'rgba(50,50,50,0.2)'];
    }
  };

  const getMoodAccentColor = (mood: CityMood): string => {
    switch (mood) {
      case 'high':
        return colors.primary;
      case 'weekend':
        return colors.gold;
      case 'rainy':
        return colors.secondary;
      case 'mid':
        return '#FF9800';
      default:
        return colors.text.muted;
    }
  };

  const accentColor = getMoodAccentColor(pulse.mood);

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPress={onPress}
      style={styles.container}
    >
      <Animated.View 
        style={[
          styles.cardWrapper,
          { transform: [{ scale: pulseAnim }] }
        ]}
      >
        <LinearGradient
          colors={getMoodGradient(pulse.mood)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.glassCard}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.labelContainer}>
                <Ionicons name="pulse" size={16} color={accentColor} />
                <Text style={[styles.label, { color: accentColor }]}>DAILY PULSE</Text>
              </View>
              <View style={[styles.liveBadge, { backgroundColor: accentColor + '30' }]}>
                <Animated.View 
                  style={[
                    styles.liveIndicator, 
                    { backgroundColor: accentColor }
                  ]} 
                />
                <Text style={[styles.liveText, { color: accentColor }]}>LIVE</Text>
              </View>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
              <Text style={styles.emoji}>{pulse.emoji}</Text>
              <Text style={styles.headline}>{pulse.headline}</Text>
              <Text style={styles.subtext}>{pulse.subtext}</Text>
            </View>

            {/* Top Venue Badge (if available) */}
            {pulse.topVenue && pulse.topVenue.vibeScore >= 60 && (
              <View style={styles.topVenueBadge}>
                <Ionicons name="trophy" size={14} color={colors.gold} />
                <Text style={styles.topVenueText}>
                  {pulse.topVenue.name} • {pulse.topVenue.vibeScore} energy
                </Text>
              </View>
            )}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats.activeVenues}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: accentColor + '40' }]} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{stats.hotSpots}</Text>
                <Text style={styles.statLabel}>Hot Spots</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: accentColor + '40' }]} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{Math.round(stats.averageVibe)}</Text>
                <Text style={styles.statLabel}>Avg Vibe</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardWrapper: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: borderRadius.xl,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  content: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  headline: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  topVenueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  topVenueText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gold,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: spacing.md,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
});
