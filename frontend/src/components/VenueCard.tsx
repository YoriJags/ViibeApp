import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { hapticVibe } from '../utils/hapticVibe';
import { LinearGradient } from 'expo-linear-gradient';
import PulseStrip, { PulseData } from './PulseStrip';
import PulseBottomSheet from './PulseBottomSheet';
import MomentumArrow from './MomentumArrow';

interface Venue {
  id: string;
  name: string;
  address: string;
  area: string;
  current_vibe_score: number;
  energy_level: 'quiet' | 'chill' | 'warming' | 'charged' | 'lit' | 'peak';
  capacity_level: 'sparse' | 'vibrant' | 'full';
  gate_level: 'clear' | 'slow' | 'blocked';
  vibe_velocity: 'heating_up' | 'cooling_down' | 'stable';
  is_featured: boolean;
  active_pulse_tier?: string | null;
  entry_fee?: string;
  music_genre?: string;
  pulse?: PulseData;
  viibe_certified?: boolean;
  is_open_now?: boolean | null;
  next_open?: string;
  vibe_tier?: string;
  venue_narrative?: string;
  icon_spotted?: { username: string; icon_tier: string; icon_label?: string } | null;
  last_rated_mins_ago?: number | null;
}

interface VenueCardProps {
  venue: Venue;
  onPress: () => void;
  showBoostBadge?: boolean;
  isNearby?: boolean;
  onRatePress?: () => void;
  dnaMatch?: number;
}

// Premium gradient palettes per vibe state
const VIBE_GRADIENTS: Record<string, [string, string, string]> = {
  peak:    ['#FF3366', '#C0183E', '#FF3366'],
  lit:     ['#FF8C00', '#E67300', '#FF8C00'],
  charged: ['#8B31C7', '#6A1F9E', '#8B31C7'],
  warming: ['#7B2FBE', '#5A1A99', '#7B2FBE'],
  chill:   ['#1E78D4', '#0F5CA8', '#1E78D4'],
  quiet:   ['#3A3F4E', '#2A2E3A', '#3A3F4E'],
};

const getVibeState = (score: number, capacity: string): string => {
  if (score >= 85) return 'PEAK';
  if (score >= 65) return 'LIT';
  if (score >= 45) return (capacity === 'full' || capacity === 'vibrant') ? 'CHARGED' : 'WARMING';
  if (score >= 20) return 'CHILL';
  return 'QUIET';
};

const getVibeStateKey = (score: number, capacity: string): string => {
  if (score >= 85) return 'peak';
  if (score >= 65) return 'lit';
  if (score >= 45) return (capacity === 'full' || capacity === 'vibrant') ? 'charged' : 'warming';
  if (score >= 20) return 'chill';
  return 'quiet';
};

export const VenueCard: React.FC<VenueCardProps> = ({ venue, onPress, showBoostBadge = true, isNearby, onRatePress, dnaMatch }) => {
  const isPulseBoosted = venue.active_pulse_tier !== null && venue.active_pulse_tier !== undefined;
  const maxOpacity = venue.current_vibe_score >= 80 ? 0.65 : venue.current_vibe_score >= 60 ? 0.4 : 0.18;
  const borderOpacity = useRef(new Animated.Value(0.08)).current;
  const scoreScale    = useRef(new Animated.Value(0.85)).current;
  const pressDepth    = useRef(new Animated.Value(0)).current;
  const [showPulseSheet, setShowPulseSheet] = useState(false);

  const onPressIn  = () => Animated.spring(pressDepth, { toValue: 1, tension: 300, friction: 10, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(pressDepth, { toValue: 0, tension: 200, friction: 14, useNativeDriver: true }).start();

  // Ambient border breathe — GPU thread only
  useEffect(() => {
    const duration = venue.current_vibe_score >= 80 ? 1400 : venue.current_vibe_score >= 60 ? 2200 : 3500;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(borderOpacity, { toValue: maxOpacity, duration, useNativeDriver: true }),
        Animated.timing(borderOpacity, { toValue: 0.08, duration, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [venue.current_vibe_score]);

  // Score entrance pop
  useEffect(() => {
    Animated.spring(scoreScale, { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }).start();
  }, []);

  const getVibeColor = (score: number, capacity: string) => {
    return VIBE_GRADIENTS[getVibeStateKey(score, capacity)][0];
  };

  const getGateLabel = (gate: string) => {
    if (gate === 'blocked') return 'Long queue';
    if (gate === 'slow') return 'Short wait';
    return 'No queue';
  };

  const vibeColor = getVibeColor(venue.current_vibe_score, venue.capacity_level ?? 'sparse');
  const gradientKey = getVibeStateKey(venue.current_vibe_score, venue.capacity_level ?? 'sparse');
  const gradientColors = VIBE_GRADIENTS[gradientKey] ?? VIBE_GRADIENTS.quiet;
  const vibeStateLabel = getVibeState(venue.current_vibe_score, venue.capacity_level ?? 'sparse');
  const isLowEnergy = venue.current_vibe_score < 20;

  // ── Energy decay state ───────────────────────────────────────────────────────
  // fresh < 45 min | stale 45–90 min | expired > 90 min or no data
  const minsAgo = venue.last_rated_mins_ago;
  const decayState: 'fresh' | 'stale' | 'expired' =
    minsAgo == null                ? 'fresh'   :  // no data yet — don't punish
    minsAgo < 45                   ? 'fresh'   :
    minsAgo < 90                   ? 'stale'   :
                                     'expired';

  const decayOpacity  = decayState === 'expired' ? 0.35 : decayState === 'stale' ? 0.6 : 1;
  const staleLabelText =
    decayState === 'expired'
      ? 'No recent signal'
      : minsAgo != null
        ? `${minsAgo < 60 ? `${minsAgo}m` : `${Math.round(minsAgo / 60)}h`} ago`
        : null;

  const momentum: 'rising' | 'peaking' | 'fading' | 'stable' =
    venue.vibe_velocity === 'heating_up' ? 'rising' :
    venue.vibe_velocity === 'cooling_down' ? 'fading' :
    venue.current_vibe_score >= 70 ? 'peaking' : 'stable';

  // Glow strength drives shadow radius — high-energy cards levitate more
  const shadowRadius = venue.current_vibe_score >= 80 ? 18 : venue.current_vibe_score >= 60 ? 10 : 4;
  const shadowOpacity = venue.current_vibe_score >= 80 ? 0.45 : venue.current_vibe_score >= 60 ? 0.28 : 0.1;

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        {
          shadowColor: vibeColor,
          shadowOpacity,
          shadowRadius,
          shadowOffset: { width: 0, height: 4 },
          elevation: venue.current_vibe_score >= 60 ? 8 : 3,
          transform: [
            { perspective: 900 },
            { rotateX: pressDepth.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) },
            { scale: pressDepth.interpolate({ inputRange: [0, 1], outputRange: [1, 0.974] }) },
          ],
        },
      ]}
    >
      {/* Ambient gradient border — breathes with energy */}
      <Animated.View style={[styles.gradientBorderWrap, { opacity: borderOpacity }]}>
        <LinearGradient
          colors={gradientColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <TouchableOpacity
        style={[styles.card, isPulseBoosted && styles.cardBoosted]}
        onPress={() => {
          hapticVibe(venue.energy_level);
          onPress();
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.72}
      >
        {/* Atmospheric top gradient — subtle vibe color wash */}
        <LinearGradient
          colors={[vibeColor + '12', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.atmosphericTop}
        />

        {/* Gold shimmer overlay for pulse-boosted cards */}
        {isPulseBoosted && (
          <LinearGradient
            colors={['rgba(212,175,55,0.12)', 'transparent', 'rgba(212,175,55,0.06)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Left energy bar — 6px thick, full-height gradient */}
        <LinearGradient
          colors={[vibeColor, gradientColors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.accentBar}
        />

        {/* Card content */}
        <View style={styles.content}>

          {/* VIIBE CERTIFIED — premium gold stamp */}
          {venue.viibe_certified && (
            <View style={styles.viibeStamp}>
              <Text style={styles.viibeStampText}>✦ VIIBE CERTIFIED</Text>
            </View>
          )}

          {/* Top row: name + score */}
          <View style={styles.topRow}>
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
              {venue.is_featured && !isPulseBoosted && (
                <Ionicons name="star" size={13} color="#D4AF37" />
              )}
            </View>

            <Animated.View style={[styles.scoreContainer, { transform: [{ scale: scoreScale }], opacity: decayOpacity }]}>
              <View style={styles.scoreBox}>
                <Text style={[styles.energyLabel, { color: decayState === 'expired' ? 'rgba(255,255,255,0.25)' : vibeColor }]}>
                  {decayState === 'expired' ? 'STALE' : vibeStateLabel}
                </Text>
                <Text style={[styles.score, { color: decayState === 'expired' ? 'rgba(255,255,255,0.25)' : vibeColor }]}>
                  {Math.round(venue.current_vibe_score)}%
                </Text>
              </View>
              {decayState === 'fresh' && <MomentumArrow momentum={momentum} size="sm" />}
            </Animated.View>
          </View>

          {/* Area */}
          <Text style={styles.area}>{venue.area}</Text>

          {/* Context chips — horizontal scroll: one clean line, no wrapping overlap */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
          >
            {venue.is_open_now === true && (
              <View style={[styles.chip, styles.chipOpen]}>
                <View style={styles.openDot} />
                <Text style={[styles.chipText, { color: '#4FC56E' }]}>Open</Text>
              </View>
            )}
            {venue.is_open_now === false && venue.next_open && (
              <View style={styles.chip}>
                <Ionicons name="time-outline" size={11} color="#666" />
                <Text style={styles.chipText}>{venue.next_open}</Text>
              </View>
            )}
            {venue.capacity_level && venue.capacity_level !== 'sparse' && (
              <View style={styles.chip}>
                <Ionicons name="people" size={11} color="#666" />
                <Text style={styles.chipText}>
                  {venue.capacity_level === 'full' ? 'Packed' : 'Filling up'}
                </Text>
              </View>
            )}
            {venue.gate_level && venue.gate_level !== 'clear' && (
              <View style={styles.chip}>
                <Ionicons name="enter" size={11} color="#666" />
                <Text style={styles.chipText}>{getGateLabel(venue.gate_level)}</Text>
              </View>
            )}
            {venue.entry_fee && (
              <View style={styles.chip}>
                <Ionicons name="ticket-outline" size={11} color="#666" />
                <Text style={styles.chipText}>{venue.entry_fee}</Text>
              </View>
            )}
            {venue.vibe_tier === 'Elite' && (
              <View style={[styles.chip, styles.chipElite]}>
                <Ionicons name="diamond" size={10} color="#D4AF37" />
                <Text style={[styles.chipText, { color: '#D4AF37' }]}>Elite</Text>
              </View>
            )}
            {venue.icon_spotted && (
              <View style={[styles.chip, styles.chipIcon]}>
                <Text style={{ fontSize: 10 }}>
                  {venue.icon_spotted.icon_tier === 'legend' ? '🔥' : '👑'}
                </Text>
                <Text style={[styles.chipText, { color: '#D4AF37' }]}>
                  {venue.icon_spotted.icon_label || 'Icon'} spotted
                </Text>
              </View>
            )}
            {/* Decay staleness chip */}
            {decayState !== 'fresh' && staleLabelText && (
              <View style={[styles.chip, styles.chipStale]}>
                <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.3)" />
                <Text style={[styles.chipText, { color: 'rgba(255,255,255,0.3)' }]}>{staleLabelText}</Text>
              </View>
            )}
            {/* Momentum urgency — only shows when the signal is worth acting on */}
            {momentum === 'rising' && decayState === 'fresh' && (
              <View style={[styles.chip, styles.chipRising]}>
                <Text style={styles.chipRisingText}>⚡ RISING</Text>
              </View>
            )}
            {momentum === 'fading' && venue.current_vibe_score >= 55 && (
              <View style={[styles.chip, styles.chipFading]}>
                <Text style={styles.chipFadingText}>📉 FADING</Text>
              </View>
            )}
            {momentum === 'peaking' && (
              <View style={[styles.chip, styles.chipPeaking]}>
                <Text style={styles.chipPeakingText}>🔥 PEAK NOW</Text>
              </View>
            )}
            {dnaMatch !== undefined && dnaMatch >= 60 && (
              <View style={[styles.chip, styles.chipDna]}>
                <Text style={styles.chipDnaText}>🧬 {dnaMatch}% match</Text>
              </View>
            )}
          </ScrollView>

          {/* Sports-broadcast narrative */}
          {venue.venue_narrative && (
            <View style={styles.narrativeRow}>
              <View style={styles.narrativeDot} />
              <Text style={styles.narrativeText} numberOfLines={1}>{venue.venue_narrative}</Text>
            </View>
          )}

          {/* Pulse strip */}
          {venue.pulse && (
            <PulseStrip pulse={venue.pulse} onPress={() => setShowPulseSheet(true)} />
          )}

          {/* Pulse Drop badge */}
          {isPulseBoosted && showBoostBadge && (
            <View style={styles.pulseBadgeRow}>
              <View style={styles.pulseBadge}>
                <Ionicons name="flash" size={11} color="#D4AF37" />
                <Text style={styles.pulseBadgeText}>PULSE DROP</Text>
              </View>
              <Text style={styles.cloutBonusText}>2× Clout</Text>
            </View>
          )}

          {isPulseBoosted && isLowEnergy && (
            <View style={styles.lowEnergyRow}>
              <Ionicons name="information-circle-outline" size={12} color="#555" />
              <Text style={styles.lowEnergyText}>Low activity right now</Text>
            </View>
          )}
        </View>

        {/* Right action */}
        {isNearby && onRatePress ? (
          <TouchableOpacity
            style={styles.rateChip}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onRatePress();
            }}
            activeOpacity={0.75}
          >
            <LinearGradient
              colors={['#FF3366', '#C0183E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.rateChipGradient}
            >
              <Ionicons name="star" size={11} color="#FFF" />
              <Text style={styles.rateChipText}>RATE</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isPulseBoosted ? '#D4AF37' : '#333'}
          />
        )}
      </TouchableOpacity>

      {venue.pulse && (
        <PulseBottomSheet
          visible={showPulseSheet}
          onClose={() => setShowPulseSheet(false)}
          venueName={venue.name}
          pulse={venue.pulse}
          onRatePress={() => { setShowPulseSheet(false); onRatePress?.(); }}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardOuter: {
    marginBottom: 10,
    borderRadius: 20,
    marginHorizontal: 0,
  },
  gradientBorderWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E0E1A',
    borderRadius: 19,
    paddingRight: 14,
    margin: 1,
  },
  cardBoosted: {
    backgroundColor: '#110F1A',
  },
  atmosphericTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 80,
    zIndex: 0,
  },
  accentBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    marginRight: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F0F0F8',
    letterSpacing: 0.1,
    flex: 1,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scoreBox: {
    alignItems: 'flex-end',
  },
  energyLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  score: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  area: {
    fontSize: 12,
    color: '#555',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  chipsScroll: {
    marginTop: 10,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181825',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#2A2A38',
  },
  chipOpen: {
    backgroundColor: 'rgba(79,197,110,0.08)',
    borderColor: 'rgba(79,197,110,0.25)',
  },
  chipElite: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderColor: 'rgba(212,175,55,0.25)',
  },
  chipIcon: {
    backgroundColor: 'rgba(212,175,55,0.07)',
    borderColor: 'rgba(212,175,55,0.2)',
  },
  chipRising: { backgroundColor: '#00E67610', borderColor: '#00E67630' },
  chipRisingText: { fontSize: 11, fontWeight: '800', color: '#00E676' },
  chipStale: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' },
  chipFading: { backgroundColor: '#FF8C0010', borderColor: '#FF8C0030' },
  chipFadingText: { fontSize: 11, fontWeight: '800', color: '#FF8C00' },
  chipPeaking: { backgroundColor: '#FF336612', borderColor: '#FF336635' },
  chipPeakingText: { fontSize: 11, fontWeight: '800', color: '#FF3366' },
  chipDna: { backgroundColor: '#00BCD410', borderColor: '#00BCD430' },
  chipDnaText: { fontSize: 11, fontWeight: '700', color: '#00BCD4' },
  openDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4FC56E',
  },
  chipText: {
    fontSize: 11,
    color: '#666',
  },
  viibeStamp: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.45)',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 8,
  },
  viibeStampText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#D4AF37',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  pulseBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 0.5,
    borderColor: 'rgba(212,175,55,0.35)',
    gap: 4,
  },
  pulseBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 1.2,
  },
  cloutBonusText: {
    fontSize: 11,
    color: '#4FC56E',
    fontWeight: '700',
  },
  narrativeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
    paddingHorizontal: 2,
  },
  narrativeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FF3366',
    opacity: 0.8,
  },
  narrativeText: {
    flex: 1,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  lowEnergyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  lowEnergyText: {
    fontSize: 11,
    color: '#444',
    fontStyle: 'italic',
  },
  rateChip: {
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 8,
  },
  rateChipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rateChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1.2,
  },
});
