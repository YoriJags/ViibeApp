import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PulseStrip, { PulseData } from './PulseStrip';
import PulseBottomSheet from './PulseBottomSheet';

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  current_vibe_score: number;
  energy_level: 'chill' | 'popping' | 'electric';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  is_featured: boolean;
  active_pulse_tier?: 'spark' | 'flare' | 'supernova' | null;
  entry_fee?: string;
  music_genre?: string;
  pulse?: PulseData;
}

interface VenueCardProps {
  venue: Venue;
  onPress: () => void;
  showBoostBadge?: boolean;
  isNearby?: boolean;
  onRatePress?: () => void;
}

// Gradient color pairs per vibe level
const VIBE_GRADIENTS: Record<string, [string, string, string]> = {
  electric: ['#FF3366', '#FF6B35', '#FF3366'],
  popping: ['#FF9933', '#FFD700', '#FF9933'],
  moderate: ['#9933FF', '#6B1FCC', '#9933FF'],
  chill: ['#3399FF', '#00D4FF', '#3399FF'],
};

export const VenueCard: React.FC<VenueCardProps> = ({ venue, onPress, showBoostBadge = true, isNearby, onRatePress }) => {
  const isPulseBoosted = venue.active_pulse_tier !== null && venue.active_pulse_tier !== undefined;
  const borderGlow = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const [showPulseSheet, setShowPulseSheet] = useState(false);

  // Animated border glow — faster pulse for higher scores
  useEffect(() => {
    const duration = venue.current_vibe_score >= 80 ? 1200 : venue.current_vibe_score >= 60 ? 2000 : 3000;
    Animated.loop(
      Animated.sequence([
        Animated.timing(borderGlow, { toValue: 1, duration, useNativeDriver: false }),
        Animated.timing(borderGlow, { toValue: 0, duration, useNativeDriver: false }),
      ])
    ).start();
  }, [venue.current_vibe_score]);

  // Score pop animation on mount
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scoreScale, { toValue: 1.15, duration: 300, useNativeDriver: true }),
      Animated.spring(scoreScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  const getVibeColor = (score: number) => {
    if (score >= 80) return '#FF3366';
    if (score >= 60) return '#FF9933';
    if (score >= 40) return '#9933FF';
    return '#3399FF';
  };

  const getVibeGradientKey = (score: number) => {
    if (score >= 80) return 'electric';
    if (score >= 60) return 'popping';
    if (score >= 40) return 'moderate';
    return 'chill';
  };

  const getEnergyLabel = (level: string) => {
    switch (level) {
      case 'electric': return 'Electric';
      case 'popping': return 'Popping';
      case 'chill': return 'Quiet';
      default: return 'Quiet';
    }
  };

  const getVelocityIcon = (velocity: string) => {
    switch (velocity) {
      case 'heating_up':
        return { name: 'trending-up', color: '#4CAF50' };
      case 'cooling_down':
        return { name: 'trending-down', color: '#FF5252' };
      default:
        return { name: 'remove', color: '#888' };
    }
  };

  const velocityIcon = getVelocityIcon(venue.vibe_velocity);
  const vibeColor = getVibeColor(venue.current_vibe_score);
  const isLowEnergy = venue.current_vibe_score < 40;
  const gradientKey = getVibeGradientKey(venue.current_vibe_score);
  const gradientColors = VIBE_GRADIENTS[gradientKey];

  // Animated border opacity — stronger glow for hotter venues
  const maxOpacity = venue.current_vibe_score >= 80 ? 0.7 : venue.current_vibe_score >= 60 ? 0.45 : 0.25;
  const borderOpacity = borderGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, maxOpacity],
  });
  const glowShadowRadius = borderGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, venue.current_vibe_score >= 80 ? 16 : 8],
  });

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        {
          shadowColor: vibeColor,
          shadowOpacity: borderOpacity,
          shadowRadius: glowShadowRadius,
          shadowOffset: { width: 0, height: 0 },
          elevation: venue.current_vibe_score >= 60 ? 6 : 2,
        },
      ]}
    >
      {/* Live gradient border */}
      <Animated.View style={[styles.gradientBorderWrap, { opacity: borderOpacity }]}>
        <LinearGradient
          colors={gradientColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <TouchableOpacity
        style={[
          styles.card,
          isPulseBoosted && styles.cardBoosted,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Gold Border for Pulse Drop venues */}
        {isPulseBoosted && (
          <View style={styles.goldBorderOverlay}>
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FFD700']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.goldGradientBorder}
            />
          </View>
        )}

        {/* Left accent bar - Shows REAL vibe color */}
        <LinearGradient
          colors={[vibeColor, gradientColors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.accentBar}
        />

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
              {venue.is_featured && !isPulseBoosted && (
                <Ionicons name="star" size={14} color="#FFD700" />
              )}
            </View>

            {/* PROMINENT Energy Score */}
            <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scoreScale }] }]}>
              <View style={styles.scoreBox}>
                <Text style={[styles.energyLabel, { color: vibeColor }]}>
                  {getEnergyLabel(venue.energy_level)}
                </Text>
                <Text style={[styles.score, { color: vibeColor }]}>
                  {Math.round(venue.current_vibe_score)}%
                </Text>
              </View>
              <Ionicons
                name={velocityIcon.name as any}
                size={16}
                color={velocityIcon.color}
              />
            </Animated.View>
          </View>

          <Text style={styles.area}>{venue.area}</Text>

          {/* Status chips */}
          <View style={styles.chips}>
            <View style={styles.chip}>
              <Ionicons name="people" size={12} color="#888" />
              <Text style={styles.chipText}>{venue.capacity_level}</Text>
            </View>
            <View style={styles.chip}>
              <Ionicons name="enter" size={12} color="#888" />
              <Text style={styles.chipText}>{venue.gate_level}</Text>
            </View>
            {venue.entry_fee && (
              <View style={styles.chip}>
                <Ionicons name="ticket-outline" size={12} color="#888" />
                <Text style={styles.chipText}>{venue.entry_fee}</Text>
              </View>
            )}
          </View>

          {/* Source of Pulse strip */}
          {venue.pulse && (
            <PulseStrip
              pulse={venue.pulse}
              onPress={() => setShowPulseSheet(true)}
            />
          )}

          {/* Pulse Drop Badge */}
          {isPulseBoosted && showBoostBadge && (
            <View style={styles.pulseBadgeContainer}>
              <View style={styles.pulseBadge}>
                <Ionicons name="flash" size={12} color="#FFD700" />
                <Text style={styles.pulseBadgeText}>PULSE</Text>
              </View>
              <Text style={styles.cloutBonusText}>2x Clout for check-ins!</Text>
            </View>
          )}

          {/* Low energy warning */}
          {isPulseBoosted && isLowEnergy && (
            <View style={styles.lowEnergyWarning}>
              <Ionicons name="information-circle" size={12} color="#888" />
              <Text style={styles.lowEnergyText}>
                Low activity right now
              </Text>
            </View>
          )}
        </View>

        {/* Rate chip when nearby */}
        {isNearby && onRatePress ? (
          <TouchableOpacity
            style={styles.rateChip}
            onPress={(e) => {
              e.stopPropagation();
              onRatePress();
            }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#FF3366', '#FF6B35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rateChipGradient}
            >
              <Ionicons name="star" size={12} color="#FFF" />
              <Text style={styles.rateChipText}>RATE</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={isPulseBoosted ? '#FFD700' : '#444'} />
        )}
      </TouchableOpacity>

      {/* Source of Pulse bottom sheet */}
      {venue.pulse && (
        <PulseBottomSheet
          visible={showPulseSheet}
          onClose={() => setShowPulseSheet(false)}
          venueName={venue.name}
          pulse={venue.pulse}
          onRatePress={() => {
            setShowPulseSheet(false);
            onRatePress?.();
          }}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: 12,
    borderRadius: 17,
  },
  gradientBorderWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 17,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151520',
    borderRadius: 16,
    overflow: 'hidden',
    paddingRight: 16,
    margin: 1.5,
  },
  cardBoosted: {
    backgroundColor: '#1A1815',
  },
  goldBorderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    opacity: 0.1,
  },
  goldGradientBorder: {
    flex: 1,
  },
  accentBar: {
    width: 4,
    height: '100%',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    flex: 1,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  energyLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  score: {
    fontSize: 22,
    fontWeight: '800',
  },
  area: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252530',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  chipText: {
    fontSize: 11,
    color: '#888',
    textTransform: 'capitalize',
  },
  pulseBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD70020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD70040',
    gap: 4,
  },
  pulseBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFD700',
    letterSpacing: 1,
  },
  cloutBonusText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  lowEnergyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  lowEnergyText: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
  },
  rateChip: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  rateChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  rateChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
});
