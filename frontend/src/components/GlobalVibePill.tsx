/**
 * GlobalVibePill — Persistent HUD overlay (v2)
 *
 * States:
 *   default     — blue pulse, shows surge level chip
 *   cityOnFire  — gold → red flare (pulse_score > 70), faster bolt
 *   dangerZone  — red pulse border, ENERGY LOW label
 *
 * New in v2:
 *   • Reanimated-driven fire glow transition (UI thread, 120Hz capable)
 *   • Momentum sparkline — 6-bucket city pulse history inside the pill
 *   • Expansion panel — tap to reveal top 3 "heating up" venues before
 *     opening the full SurgeFullScreen charger
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated as RNAnimated,  // entrance spring only
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';
import SurgeFullScreen, { SurgeState } from './SurgeFullScreen';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const EMPTY_SURGE: SurgeState = {
  charge_pct: 0, level: 'dormant', level_label: 'DORMANT',
  level_color: '#3A3A4E', level_progress: 0, taps_to_next: 5,
  next_level: 'BUZZING', tap_count: 0, total_surges: 0,
};

// ─── Sparkline bar ────────────────────────────────────────────────────────────

function SparkBar({ value, max, color }: { value: number; max: number; color: string }) {
  const BAR_H = 12;
  const height = max > 0 ? Math.max(2, Math.round((value / max) * BAR_H)) : 2;
  return (
    <View style={[sparkStyles.bar, { height, backgroundColor: color + 'CC' }]} />
  );
}

const sparkStyles = StyleSheet.create({
  bar: { width: 3, borderRadius: 1.5, alignSelf: 'flex-end' },
});

// ─── Heating venue row ────────────────────────────────────────────────────────

interface HeatVenue {
  id: string;
  name: string;
  current_vibe_score: number;
  energy_level: string;
}

function HeatRow({ venue, onPress }: { venue: HeatVenue; onPress: () => void }) {
  const score = Math.round(venue.current_vibe_score);
  return (
    <TouchableOpacity onPress={onPress} style={heatStyles.row} activeOpacity={0.7}>
      <View style={heatStyles.arrowWrap}>
        <Ionicons name="trending-up" size={10} color="#FF9933" />
      </View>
      <Text style={heatStyles.name} numberOfLines={1}>{venue.name}</Text>
      <Text style={heatStyles.score}>{score}</Text>
    </TouchableOpacity>
  );
}

const heatStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    gap: 6,
  },
  arrowWrap: {
    width: 14,
    alignItems: 'center',
  },
  name: {
    flex: 1,
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  score: {
    fontSize: 10,
    color: '#FF9933',
    fontWeight: '800',
  },
} as any);

// ─── Main component ───────────────────────────────────────────────────────────

export default function GlobalVibePill() {
  const isInsideVenue    = useVibeStore(s => s.isInsideVenue);
  const activeVenueId    = useVibeStore(s => s.activeVenueId);
  const activeVenueName  = useVibeStore(s => s.activeVenueName);
  const socket           = useVibeStore(s => s.socket);
  const user             = useVibeStore(s => s.user);
  const getAuthHeaders   = useVibeStore(s => s.getAuthHeaders);
  const isDemoMode       = useVibeStore(s => s.isDemoMode);
  const cityChargeActive = useVibeStore(s => s.cityChargeActive);
  const cityPulse        = useVibeStore(s => s.cityPulse);
  const venues           = useVibeStore(s => s.venues);

  const router = useRouter();

  const [showCharger,   setShowCharger]   = useState(false);
  const [showExpansion, setShowExpansion] = useState(false);
  const [surge,         setSurge]         = useState<SurgeState>(EMPTY_SURGE);
  const [dangerZone,    setDangerZone]    = useState(false);
  const [cooldown,      setCooldown]      = useState(false);
  const [tapping,       setTapping]       = useState(false);

  // ── Entrance animation (React Native Animated — spring only) ─────────────
  const pillScale   = useRef(new RNAnimated.Value(0)).current;
  const pillOpacity = useRef(new RNAnimated.Value(0)).current;

  // ── Reanimated shared values ──────────────────────────────────────────────
  // 0 = normal, 1 = city on fire
  const fireGlow     = useSharedValue(0);
  // 0 = normal, 1 = danger
  const dangerPulse  = useSharedValue(0);
  // bolt scale
  const boltScale    = useSharedValue(1);
  // expansion panel height progress 0→1
  const expandProg   = useSharedValue(0);

  // ── Entrance show/hide ────────────────────────────────────────────────────
  useEffect(() => {
    if (isInsideVenue) {
      RNAnimated.parallel([
        RNAnimated.spring(pillScale,   { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        RNAnimated.timing(pillOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchSurge();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(pillScale,   { toValue: 0, duration: 200, useNativeDriver: true }),
        RNAnimated.timing(pillOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      setShowCharger(false);
      setDangerZone(false);
      setShowExpansion(false);
    }
  }, [isInsideVenue, activeVenueId]);

  // ── City on Fire — Reanimated fire glow transition ────────────────────────
  useEffect(() => {
    fireGlow.value = withTiming(cityChargeActive ? 1 : 0, {
      duration: 600,
      easing: Easing.inOut(Easing.ease),
    });

    // Bolt pulse: faster + larger when city is on fire
    cancelAnimation(boltScale);
    const peak     = cityChargeActive ? 1.6 : 1.25;
    const duration = cityChargeActive ? 380 : 700;
    boltScale.value = withRepeat(
      withSequence(
        withTiming(peak, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [cityChargeActive]);

  // ── Danger zone pulse ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!dangerZone) {
      cancelAnimation(dangerPulse);
      dangerPulse.value = withTiming(0, { duration: 200 });
      return;
    }
    dangerPulse.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 500 }),
        withTiming(0.2, { duration: 500 }),
      ),
      -1,
      false,
    );
  }, [dangerZone]);

  // ── Expansion panel show/hide ─────────────────────────────────────────────
  useEffect(() => {
    expandProg.value = withTiming(showExpansion ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [showExpansion]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !activeVenueId) return;
    const onDepletion  = (d: { venue_id: string }) => d.venue_id === activeVenueId && setDangerZone(true);
    const onSurgeUpd   = (d: { venue_id: string }) => d.venue_id === activeVenueId && fetchSurge();
    const onVenueUpd   = (d: { id: string; current_vibe_score?: number }) => {
      if (d.id === activeVenueId && (d.current_vibe_score ?? 100) >= 80) setDangerZone(false);
    };
    socket.on('global_charge_depletion', onDepletion);
    socket.on('surge_update',            onSurgeUpd);
    socket.on('venue_update',            onVenueUpd);
    return () => {
      socket.off('global_charge_depletion', onDepletion);
      socket.off('surge_update',            onSurgeUpd);
      socket.off('venue_update',            onVenueUpd);
    };
  }, [socket, activeVenueId]);

  // ── Fetch surge ───────────────────────────────────────────────────────────
  const fetchSurge = useCallback(async () => {
    if (!activeVenueId || isDemoMode) return;
    try {
      const res = await fetch(`${API_URL}/api/venues/${activeVenueId}/surge`);
      if (res.ok) setSurge(await res.json());
    } catch {}
  }, [activeVenueId, isDemoMode]);

  // ── Tap to charge ─────────────────────────────────────────────────────────
  const handleCharge = useCallback(async () => {
    if (cooldown || tapping || !activeVenueId) return;
    setTapping(true);
    try {
      const res = await fetch(`${API_URL}/api/venues/${activeVenueId}/bolt`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (res.ok) setSurge(await res.json());
      else if (res.status === 429) { setCooldown(true); setTimeout(() => setCooldown(false), 10000); }
    } catch {}
    setTapping(false);
  }, [cooldown, tapping, activeVenueId, getAuthHeaders]);

  const handlePillPress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowExpansion(prev => !prev);
  };

  const handleOpenCharger = () => {
    setShowExpansion(false);
    setShowCharger(true);
  };

  // ── Derived: top 3 heating venues ────────────────────────────────────────
  const heatingVenues = venues
    .filter(v => v.vibe_velocity === 'heating_up' && v.id !== activeVenueId)
    .sort((a, b) => b.current_vibe_score - a.current_vibe_score)
    .slice(0, 3);

  // ── Sparkline data ────────────────────────────────────────────────────────
  const sparkline = cityPulse?.sparkline ?? [];
  const sparkMax  = Math.max(...sparkline, 1);

  // ── Animated styles (Reanimated UI thread) ────────────────────────────────

  const pillContainerStyle = useAnimatedStyle(() => {
    // Border color: normal surge color → gold → red-orange
    const borderColor = dangerZone
      ? interpolateColor(dangerPulse.value, [0.2, 1], ['rgba(255,59,48,0.2)', 'rgba(255,59,48,0.9)'])
      : interpolateColor(
          fireGlow.value,
          [0, 0.5, 1],
          [surge.level_color + '55', '#FFD60A88', '#FF660088'],
        );

    // Glow shadow: blooms when city is on fire
    const shadowRadius  = interpolate(fireGlow.value, [0, 1], [8, 20], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(fireGlow.value, [0, 1], [0.4, 0.85], Extrapolation.CLAMP);

    return { borderColor, shadowRadius, shadowOpacity };
  });

  const fireBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fireGlow.value, [0, 1], [0, 0.12], Extrapolation.CLAMP),
  }));

  const boltStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boltScale.value }],
  }));

  const boltColor = dangerZone ? '#FF3B30' : cityChargeActive ? '#FFD60A' : surge.level_color;
  const labelColor = dangerZone ? '#FF3B30' : cityChargeActive ? '#FFD60A' : '#EEEEF5';
  const labelText  = dangerZone ? 'ENERGY LOW' : cityChargeActive ? 'CITY ON FIRE' : 'VIBE CHARGE';

  const expansionStyle = useAnimatedStyle(() => ({
    opacity:   expandProg.value,
    transform: [{ translateY: interpolate(expandProg.value, [0, 1], [-6, 0], Extrapolation.CLAMP) }],
    // pointerEvents needs to be JS-side, handled via showExpansion bool
  }));

  if (!isInsideVenue) return null;

  return (
    <>
      {/* ── The Pill HUD ──────────────────────────────────────────────── */}
      <RNAnimated.View
        style={[
          styles.pillWrapper,
          { opacity: pillOpacity, transform: [{ scale: pillScale }] },
        ]}
        pointerEvents="box-none"
      >
        {/* Reanimated border/glow layer */}
        <Animated.View style={[styles.pillAnimated, pillContainerStyle]}>

          {/* Fire backdrop wash */}
          <Animated.View style={[styles.fireBackdrop, fireBackdropStyle]} />

          <Pressable onPress={handlePillPress} style={styles.pillInner}>
            {/* Danger dot */}
            {dangerZone && (
              <View style={styles.dangerDot} />
            )}

            {/* Bolt */}
            <Animated.View style={boltStyle}>
              <Ionicons name="flash" size={14} color={boltColor} />
            </Animated.View>

            {/* Label */}
            <Text style={[styles.pillLabel, { color: labelColor }]}>{labelText}</Text>

            {/* Momentum sparkline (city pulse history) */}
            {sparkline.length > 0 && (
              <View style={styles.sparkRow}>
                {sparkline.map((v, i) => (
                  <SparkBar key={i} value={v} max={sparkMax} color={boltColor} />
                ))}
              </View>
            )}

            {/* Level chip */}
            <View style={[styles.levelChip, { backgroundColor: surge.level_color + '22', borderColor: surge.level_color + '55' }]}>
              <Text style={[styles.levelChipText, { color: surge.level_color }]}>
                {surge.level_label}
              </Text>
            </View>

            {/* Chevron */}
            <Ionicons
              name={showExpansion ? 'chevron-up' : 'chevron-down'}
              size={10}
              color="rgba(255,255,255,0.35)"
            />
          </Pressable>
        </Animated.View>

        {/* ── Expansion panel ───────────────────────────────────────────── */}
        <Animated.View
          style={[styles.expansion, expansionStyle]}
          pointerEvents={showExpansion ? 'auto' : 'none'}
        >
          {/* Heading */}
          <View style={styles.expansionHeader}>
            <Ionicons name="flame" size={10} color="#FF9933" />
            <Text style={styles.expansionHeading}>HEATING UP</Text>
          </View>

          {/* Top 3 heating venues */}
          {heatingVenues.length > 0
            ? heatingVenues.map(v => (
                <HeatRow
                  key={v.id}
                  venue={v}
                  onPress={() => {
                    setShowExpansion(false);
                    router.push(`/venue/${v.id}` as any);
                  }}
                />
              ))
            : (
              <Text style={styles.noHeatText}>No heating venues nearby</Text>
            )
          }

          {/* Divider + Charge CTA */}
          <View style={styles.expansionDivider} />
          <TouchableOpacity onPress={handleOpenCharger} style={styles.chargeBtn} activeOpacity={0.8}>
            <Ionicons name="flash" size={11} color="#0A0A0F" />
            <Text style={styles.chargeBtnText}>CHARGE THIS VENUE</Text>
          </TouchableOpacity>
        </Animated.View>
      </RNAnimated.View>

      {/* ── Full-screen charger overlay ──────────────────────────────────── */}
      <SurgeFullScreen
        visible={showCharger}
        surge={surge}
        venueName={activeVenueName ?? ''}
        venueId={activeVenueId ?? undefined}
        onClose={() => setShowCharger(false)}
        onTap={handleCharge}
        tapping={tapping}
        cooldown={cooldown}
        socket={socket}
        userId={user?.id}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pillWrapper: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 999,
    alignItems: 'center',
  },

  pillAnimated: {
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(12,12,21,0.92)',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowColor: '#FF6600',
    elevation: 6,
  },

  fireBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF6600',
  },

  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },

  dangerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
  },

  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    height: 12,
  },

  levelChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  levelChipText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // ── Expansion ──────────────────────────────────────────────────────────────
  expansion: {
    marginTop: 4,
    backgroundColor: 'rgba(12,12,21,0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 200,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  expansionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  expansionHeading: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF9933',
    letterSpacing: 1.2,
  },
  noHeatText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expansionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 10,
    marginVertical: 6,
  },
  chargeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FF9933',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 10,
    paddingVertical: 7,
  },
  chargeBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A0A0F',
    letterSpacing: 0.8,
  },
} as any);
