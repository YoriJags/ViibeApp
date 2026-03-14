/**
 * KineticTap — Haptic Velocity + Collective Quest UI
 *
 * Reads accelerometer G-force at the moment of each tap and categorizes:
 *   Chill  < 1.5g  → ImpactFeedbackStyle.Light
 *   Lit  1.5–2.5g  → ImpactFeedbackStyle.Medium
 *   Peak   > 2.5g  → ImpactFeedbackStyle.Heavy + screen-shake
 *
 * Calculates rolling BPM from tap timestamps and emits `tap_velocity`
 * to the venue Socket.IO room. Listens for `kinetics_update`,
 * `quest_succeeded`, and `global_charge_depletion` events.
 *
 * Gated: only active when user is within 100 m of venue.
 * Role gate: Scout status (not newbie) OR Vibe+ subscription.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { Ionicons } from '@expo/vector-icons';
import { calculateDistance } from '../utils/geo';

// ─── Types ────────────────────────────────────────────────────────────────────

type TapIntensity = 'chill' | 'lit' | 'peak';

interface KineticUser {
  id: string;
  is_vibe_plus: boolean;
  scout_status: 'newbie' | 'regular' | 'scout' | 'elite';
}

interface KineticQuestState {
  aggregate_bpm: number;
  unique_scouts: number;
  quest_state: 'idle' | 'active' | 'cooldown';
  resonance_min: number;
  resonance_max: number;
}

interface Props {
  venueId: string;
  venueCoordinates: { lat: number; lng: number };
  userLocation: { lat: number; lng: number } | null;
  socket: any | null; // Socket.IO socket
  user: KineticUser | null;
  isDemoMode?: boolean;
  onQuestSucceeded?: (participants: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEOFENCE_RADIUS_M = 100;
const CHILL_THRESHOLD = 1.5;
const PEAK_THRESHOLD = 2.5;
const BPM_WINDOW_SIZE = 8;    // use last N taps for BPM
const BPM_MAX_AGE_MS = 10000; // taps older than 10s excluded
const CHARGE_LOW_SCORE = 80;

// ─── Component ────────────────────────────────────────────────────────────────

export default function KineticTap({
  venueId,
  venueCoordinates,
  userLocation,
  socket,
  user,
  isDemoMode = false,
  onQuestSucceeded,
}: Props) {
  // Latest accelerometer reading (updated at 60 Hz, no re-render)
  const latestAccel = useRef({ x: 0, y: 0, z: 1 });

  // Tap timestamp ring buffer for BPM
  const tapTimestamps = useRef<number[]>([]);

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const dangerBorderAnim = useRef(new Animated.Value(0)).current;
  const questGlowAnim = useRef(new Animated.Value(0)).current;

  const [lastIntensity, setLastIntensity] = useState<TapIntensity>('chill');
  const [tapCount, setTapCount] = useState(0);
  const [questState, setQuestState] = useState<KineticQuestState | null>(null);
  const [dangerZone, setDangerZone] = useState(false);
  const [questSucceeded, setQuestSucceeded] = useState(false);

  // ─── Role / geofence gate ─────────────────────────────────────────────────

  const isEligible = (() => {
    if (!user) return false;
    if (isDemoMode) return true; // demo bypasses all gates
    // Role gate: scout+ or Vibe+
    const allowedStatuses: KineticUser['scout_status'][] = ['regular', 'scout', 'elite'];
    const hasRole = user.is_vibe_plus || allowedStatuses.includes(user.scout_status);
    if (!hasRole) return false;
    // Geofence gate
    if (!userLocation) return false;
    const dist = calculateDistance(
      userLocation.lat, userLocation.lng,
      venueCoordinates.lat, venueCoordinates.lng,
    );
    return dist <= GEOFENCE_RADIUS_M;
  })();

  // ─── Accelerometer setup ──────────────────────────────────────────────────

  useEffect(() => {
    if (!isEligible) return;

    Accelerometer.setUpdateInterval(16); // ~60 Hz
    const subscription = Accelerometer.addListener((data) => {
      latestAccel.current = data;
    });

    return () => subscription.remove(); // battery safety: always remove
  }, [isEligible]);

  // ─── Socket listeners ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !venueId) return;

    const onKinetics = (data: KineticQuestState & { venue_id: string }) => {
      if (data.venue_id !== venueId) return;
      setQuestState(data);
    };

    const onQuestDone = (data: { venue_id: string; participants: number }) => {
      if (data.venue_id !== venueId) return;
      setQuestSucceeded(true);
      onQuestSucceeded?.(data.participants);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Glow burst
      Animated.sequence([
        Animated.timing(questGlowAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(questGlowAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => setQuestSucceeded(false));
    };

    const onChargeDepletion = (data: { venue_id: string }) => {
      if (data.venue_id !== venueId) return;
      setDangerZone(true);
      // Pulsing red border loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(dangerBorderAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(dangerBorderAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ]),
        { iterations: 6 },
      ).start(() => setDangerZone(false));
    };

    socket.on('kinetics_update', onKinetics);
    socket.on('quest_succeeded', onQuestDone);
    socket.on('global_charge_depletion', onChargeDepletion);

    return () => {
      socket.off('kinetics_update', onKinetics);
      socket.off('quest_succeeded', onQuestDone);
      socket.off('global_charge_depletion', onChargeDepletion);
    };
  }, [socket, venueId]);

  // ─── BPM calculation ──────────────────────────────────────────────────────

  const calcBpm = useCallback((): number => {
    const now = Date.now();
    const recent = tapTimestamps.current
      .filter(ts => now - ts < BPM_MAX_AGE_MS)
      .slice(-BPM_WINDOW_SIZE);
    if (recent.length < 2) return 0;
    const duration = (recent[recent.length - 1] - recent[0]) / 1000; // seconds
    if (duration <= 0) return 0;
    return Math.min(((recent.length - 1) / duration) * 60, 300);
  }, []);

  // ─── Tap handler ─────────────────────────────────────────────────────────

  const handleTap = useCallback(() => {
    if (!isEligible) return;

    const { x, y, z } = latestAccel.current;
    const g = Math.sqrt(x * x + y * y + z * z);

    const intensity: TapIntensity =
      g > PEAK_THRESHOLD ? 'peak' : g > CHILL_THRESHOLD ? 'lit' : 'chill';

    // Haptics
    if (Platform.OS !== 'web') {
      if (intensity === 'peak') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (intensity === 'lit') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }

    // Screen shake for Peak
    if (intensity === 'peak') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 30, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 30, useNativeDriver: true }),
      ]).start();
    }

    // Press scale feedback
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 0.92, duration: 60, useNativeDriver: true }),
      Animated.timing(pressScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    // Track BPM
    tapTimestamps.current.push(Date.now());
    if (tapTimestamps.current.length > 20) {
      tapTimestamps.current = tapTimestamps.current.slice(-20);
    }
    const bpm = calcBpm();

    setLastIntensity(intensity);
    setTapCount(c => c + 1);

    // Emit to Socket.IO
    socket?.emit('tap_velocity', {
      venue_id: venueId,
      user_id: user?.id,
      bpm: Math.round(bpm),
      intensity,
      g_force: Math.round(g * 100) / 100,
    });
  }, [isEligible, socket, venueId, user?.id, calcBpm]);

  // ─── Render ───────────────────────────────────────────────────────────────

  // Show a locked state instead of silently returning nothing.
  // Explains why the tap is unavailable and what the user needs to do.
  if (!isEligible) {
    const reason = !user
      ? { icon: 'person-circle-outline' as const, line1: 'Sign in to tap', line2: 'Create your scout account to join the energy' }
      : !userLocation
      ? { icon: 'location-outline' as const, line1: 'Location needed', line2: 'Enable location to unlock kinetic tap' }
      : (() => {
          const hasRole = user.is_vibe_plus || ['regular', 'scout', 'elite'].includes(user.scout_status);
          if (!hasRole) return { icon: 'lock-closed-outline' as const, line1: 'Scout status required', line2: 'Keep scouting to unlock this feature' };
          return { icon: 'navigate-outline' as const, line1: 'Get closer', line2: 'You need to be within 100m of the venue' };
        })();

    return (
      <View style={lockStyles.wrap}>
        <Ionicons name={reason.icon} size={28} color="#2A2A3E" />
        <Text style={lockStyles.line1}>{reason.line1}</Text>
        <Text style={lockStyles.line2}>{reason.line2}</Text>
      </View>
    );
  }

  const bpmDisplay = Math.round(calcBpm());
  const resonanceMin = questState?.resonance_min ?? 123;
  const resonanceMax = questState?.resonance_max ?? 133;
  const aggregateBpm = questState?.aggregate_bpm ?? 0;
  const uniqueScouts = questState?.unique_scouts ?? 0;

  const dangerBorderColor = dangerBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,59,48,0)', 'rgba(255,59,48,0.9)'],
  });

  const questGlowOpacity = questGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const intensityColor =
    lastIntensity === 'peak' ? '#FF6B35'
    : lastIntensity === 'lit' ? '#FFD60A'
    : '#00E676';

  const intensityLabel =
    lastIntensity === 'peak' ? 'PEAK' : lastIntensity === 'lit' ? 'LIT' : 'CHILL';

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX: shakeAnim }] },
        dangerZone && { borderColor: dangerBorderColor, borderWidth: 2 },
      ]}
    >
      {/* Quest succeeded glow */}
      {questSucceeded && (
        <Animated.View style={[styles.questGlow, { opacity: questGlowOpacity }]} />
      )}

      {/* Quest status bar */}
      {questState && questState.unique_scouts > 0 && (
        <View style={styles.questBar}>
          <View style={styles.questBarLeft}>
            <Text style={styles.questLabel}>COLLECTIVE QUEST</Text>
            <Text style={styles.questSub}>
              {questState.quest_state === 'cooldown'
                ? 'Quest complete — next in 30 min'
                : `${uniqueScouts} scout${uniqueScouts !== 1 ? 's' : ''} · target ${resonanceMin}–${resonanceMax} BPM`}
            </Text>
          </View>
          <View style={styles.bpmBadge}>
            <Text style={styles.bpmBadgeNum}>{aggregateBpm}</Text>
            <Text style={styles.bpmBadgeLabel}>BPM</Text>
          </View>
        </View>
      )}

      {/* Tap button */}
      <Pressable onPress={handleTap} style={styles.tapArea}>
        <Animated.View style={[styles.tapButton, { transform: [{ scale: pressScale }] }]}>
          <Text style={[styles.tapIcon, { color: intensityColor }]}>⚡</Text>
          <Text style={[styles.tapIntensityLabel, { color: intensityColor }]}>
            {intensityLabel}
          </Text>
          <Text style={styles.tapCountLabel}>{tapCount}</Text>
        </Animated.View>
      </Pressable>

      {/* BPM readout */}
      {bpmDisplay > 0 && (
        <Text style={styles.bpmReadout}>{bpmDisplay} BPM</Text>
      )}

      {/* Danger zone callout */}
      {dangerZone && (
        <Animated.Text style={[styles.dangerText, { opacity: dangerBorderAnim }]}>
          ⚠ Energy dropping — keep it alive!
        </Animated.Text>
      )}
    </Animated.View>
  );
}

// ─── Lock state styles ────────────────────────────────────────────────────────

const lockStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A1A2A',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  line1: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2A2A3E',
    marginTop: 4,
  },
  line2: {
    fontSize: 11,
    color: '#1E1E2E',
    textAlign: 'center',
    lineHeight: 16,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  questGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,230,118,0.18)',
    borderRadius: 16,
  },
  questBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  questBarLeft: { flex: 1 },
  questLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD60A',
    letterSpacing: 1.2,
  },
  questSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  bpmBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,214,10,0.12)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bpmBadgeNum: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFD60A',
    lineHeight: 22,
  },
  bpmBadgeLabel: {
    fontSize: 9,
    color: '#FFD60A',
    letterSpacing: 1,
  },
  tapArea: {
    alignItems: 'center',
  },
  tapButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapIcon: {
    fontSize: 24,
    lineHeight: 28,
  },
  tapIntensityLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  tapCountLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  bpmReadout: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  dangerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#FF3B30',
    fontWeight: '600',
    marginTop: 6,
  },
} as any);
