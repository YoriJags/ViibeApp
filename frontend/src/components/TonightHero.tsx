/**
 * TonightHero - Adaptive hero card that changes with the night's phase.
 * Phase 1 "The Warm-Up": venue match + cartel teaser + city energy
 * Phase 2 "Locked In": current venue + clout + badge proximity
 * Phase 3 "The Recap": night summary + best moment
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NightPhase } from '../store/vibeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TonightHeroProps {
  phase: NightPhase;
  // Phase 1 — "The Warm-Up"
  currentHour?: string;
  cityName?: string;
  cityEnergy?: 'chill' | 'moderate' | 'popping' | 'electric';
  cityEnergyScore?: number;
  matchVenue?: string;
  matchPercent?: number;
  matchArea?: string;
  cartelOutCount?: number;
  cartelTotal?: number;
  onSeePicksPress?: () => void;
  onMatchVenuePress?: () => void;
  // Phase 2 — "Locked In"
  venueName?: string;
  vibeScore?: number;
  cloutEarnedTonight?: number;
  badgeProximityText?: string;
  onRateVibePress?: () => void;
  // Phase 3 — "The Recap"
  venuesVisitedCount?: number;
  totalCloutEarned?: number;
  newBadgesCount?: number;
  bestMomentText?: string;
}

const ENERGY_COLORS: Record<string, string> = {
  electric: '#FF3366',
  popping: '#FF9933',
  moderate: '#9933FF',
  chill: '#3399FF',
};

const PHASE_GRADIENTS: Record<NightPhase, [string, string]> = {
  planning: ['#1A0A20', '#0D0D1A'],
  locked_in: ['#0A1A0F', '#0D0D1A'],
  recap: ['#1A1505', '#0D0D1A'],
};

const PHASE_SHIMMER: Record<NightPhase, string> = {
  planning: 'rgba(255,51,102,0.15)',
  locked_in: 'rgba(0,230,118,0.12)',
  recap: 'rgba(255,215,0,0.10)',
};

const PHASE_BORDER: Record<NightPhase, string> = {
  planning: 'rgba(255,51,102,0.15)',
  locked_in: 'rgba(0,230,118,0.15)',
  recap: 'rgba(255,215,0,0.15)',
};

const PHASE_LABEL_COLOR: Record<NightPhase, string> = {
  planning: '#FF3366',
  locked_in: '#00E676',
  recap: '#FFD700',
};

export default function TonightHero({
  phase,
  currentHour,
  cityName = 'Lagos',
  cityEnergy = 'electric',
  cityEnergyScore,
  matchVenue,
  matchPercent,
  matchArea,
  cartelOutCount = 0,
  cartelTotal = 0,
  onSeePicksPress,
  onMatchVenuePress,
  venueName,
  vibeScore,
  cloutEarnedTonight,
  badgeProximityText,
  onRateVibePress,
  venuesVisitedCount,
  totalCloutEarned,
  newBadgesCount,
  bestMomentText,
}: TonightHeroProps) {
  // === Entrance animation ===
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // === Shimmer loop ===
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // === Energy word glow (Phase 1) ===
  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
      ])
    ).start();

    // Energy glow (planning only)
    if (phase === 'planning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.6, duration: 1200, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [phase]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.03, 0.12],
  });

  const energyColor = ENERGY_COLORS[cityEnergy] || '#FF3366';
  const energyWord = cityEnergy.charAt(0).toUpperCase() + cityEnergy.slice(1);

  const glowRadius = glowAnim.interpolate({
    inputRange: [0.6, 1],
    outputRange: [4, 16],
  });

  // === Phase 1: The Warm-Up ===
  const renderPlanning = () => (
    <>
      {/* Header row */}
      <View style={s.headerRow}>
        <Text style={[s.phaseLabel, { color: PHASE_LABEL_COLOR.planning }]}>TONIGHT</Text>
        {cityEnergyScore != null && (
          <View style={[s.energyBadge, { backgroundColor: energyColor + '20' }]}>
            <View style={[s.energyDot, { backgroundColor: energyColor }]} />
            <Text style={[s.energyBadgeText, { color: energyColor }]}>
              {cityEnergyScore}% Energy
            </Text>
          </View>
        )}
      </View>

      {/* Headline */}
      <View style={s.headlineWrap}>
        <Text style={s.headlineText}>
          It's {currentHour || '10PM'} — {cityName} is{' '}
        </Text>
        <Animated.Text
          style={[
            s.headlineEnergy,
            {
              color: energyColor,
              textShadowColor: energyColor,
              textShadowRadius: glowRadius,
            },
          ]}
        >
          {energyWord.toUpperCase()}
        </Animated.Text>
      </View>

      {/* Match row */}
      {matchVenue && matchPercent && (
        <TouchableOpacity style={s.matchRow} onPress={onMatchVenuePress} activeOpacity={0.7}>
          <Ionicons name="sparkles" size={14} color="#FFD700" />
          <Text style={s.matchText}>
            {matchPercent}% match
          </Text>
          <Ionicons name="arrow-forward" size={12} color="#888" />
          <Text style={s.matchVenueText} numberOfLines={1}>
            {matchVenue}
          </Text>
          {matchArea && <Text style={s.matchAreaText}>{matchArea}</Text>}
        </TouchableOpacity>
      )}

      {/* Cartel teaser */}
      {cartelOutCount > 0 && (
        <View style={s.cartelTeaser}>
          <Ionicons name="people" size={14} color="#FF3366" />
          <Text style={s.cartelTeaserText}>
            {cartelOutCount} of your Cartel are out tonight
          </Text>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity style={s.ctaWrap} onPress={onSeePicksPress} activeOpacity={0.8}>
        <LinearGradient
          colors={['#FF3366', '#FF6B35']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.ctaGradient}
        >
          <Text style={s.ctaText}>See Tonight's Picks</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  // === Phase 2: Locked In ===
  const renderLockedIn = () => (
    <>
      <Text style={[s.phaseLabel, { color: PHASE_LABEL_COLOR.locked_in }]}>YOU'RE AT</Text>
      <Text style={s.venueNameText} numberOfLines={1}>{venueName || 'Unknown Venue'}</Text>

      {/* Stats row */}
      <View style={s.statsRow}>
        {vibeScore != null && (
          <View style={s.statBlock}>
            <Text style={[s.statValue, { color: '#FFD700' }]}>{vibeScore}</Text>
            <Text style={s.statLabel}>Live Vibe</Text>
          </View>
        )}
        {vibeScore != null && cloutEarnedTonight != null && <View style={s.statDivider} />}
        {cloutEarnedTonight != null && (
          <View style={s.statBlock}>
            <Text style={[s.statValue, { color: '#00E676' }]}>+{cloutEarnedTonight}</Text>
            <Text style={s.statLabel}>Clout Tonight</Text>
          </View>
        )}
      </View>

      {/* Badge proximity */}
      {badgeProximityText && (
        <View style={s.badgeProximity}>
          <Ionicons name="ribbon" size={14} color="#9933FF" />
          <Text style={s.badgeProximityText}>{badgeProximityText}</Text>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity style={s.ctaWrap} onPress={onRateVibePress} activeOpacity={0.8}>
        <LinearGradient
          colors={['#00E676', '#00D4FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.ctaGradient}
        >
          <Ionicons name="star" size={16} color="#FFF" />
          <Text style={s.ctaText}>Rate the Vibe</Text>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  // === Phase 3: The Recap ===
  const renderRecap = () => (
    <>
      <Text style={[s.phaseLabel, { color: PHASE_LABEL_COLOR.recap }]}>YOUR NIGHT</Text>

      {/* Summary stats */}
      <View style={s.statsRow}>
        <View style={s.statBlock}>
          <Text style={s.statValue}>{venuesVisitedCount || 0}</Text>
          <Text style={s.statLabel}>Venues</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBlock}>
          <Text style={[s.statValue, { color: '#FFD700' }]}>+{totalCloutEarned || 0}</Text>
          <Text style={s.statLabel}>Clout</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBlock}>
          <Text style={s.statValue}>{newBadgesCount || 0}</Text>
          <Text style={s.statLabel}>Badges</Text>
        </View>
      </View>

      {/* Best moment */}
      {bestMomentText && (
        <View style={s.bestMoment}>
          <Ionicons name="trophy" size={14} color="#FFD700" />
          <Text style={s.bestMomentText}>{bestMomentText}</Text>
        </View>
      )}

      {/* CTA */}
      <View style={[s.ctaWrap, { opacity: 0.5 }]}>
        <LinearGradient
          colors={['#FFD700', '#FFA500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.ctaGradient}
        >
          <Ionicons name="share-social" size={16} color="#FFF" />
          <Text style={s.ctaText}>Share Your Night</Text>
        </LinearGradient>
      </View>
    </>
  );

  return (
    <Animated.View
      style={[
        s.container,
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}
    >
      <LinearGradient
        colors={PHASE_GRADIENTS[phase]}
        style={[s.card, { borderColor: PHASE_BORDER[phase] }]}
      >
        {/* Shimmer overlay */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: shimmerOpacity }]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={['transparent', PHASE_SHIMMER[phase], 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {phase === 'planning' && renderPlanning()}
        {phase === 'locked_in' && renderLockedIn()}
        {phase === 'recap' && renderRecap()}
      </LinearGradient>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  phaseLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  energyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 5,
  },
  energyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  energyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  headlineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  headlineText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 30,
  },
  headlineEnergy: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    textShadowOffset: { width: 0, height: 0 },
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  matchText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD700',
  },
  matchVenueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  matchAreaText: {
    fontSize: 11,
    color: '#888',
  },
  cartelTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  cartelTeaserText: {
    fontSize: 12,
    color: '#CCC',
    fontWeight: '500',
  },
  ctaWrap: {
    marginTop: 4,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    gap: 8,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  venueNameText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 8,
  },
  badgeProximity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    backgroundColor: 'rgba(153,51,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeProximityText: {
    fontSize: 12,
    color: '#CCC',
    fontWeight: '500',
  },
  bestMoment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
    backgroundColor: 'rgba(255,215,0,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bestMomentText: {
    fontSize: 12,
    color: '#CCC',
    fontWeight: '500',
    flex: 1,
  },
});
