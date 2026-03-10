/**
 * GlobalVibePill — Persistent HUD overlay
 *
 * Renders a pulsing pill at the top of the Map/Feed when `isInsideVenue` is true.
 * Tapping launches SurgeFullScreen as a high-performance overlay (no navigation).
 * Dismisses automatically when the user leaves the geofence.
 *
 * Danger Zone: when `dangerZone` prop or socket `global_charge_depletion` fires,
 * switches to a pulsing red mode until venue recharges.
 *
 * Mount once near the root of each tab layout — not inside venue screens.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';
import SurgeFullScreen, { SurgeState } from './SurgeFullScreen';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Placeholder surge state while fetch is in-flight
const EMPTY_SURGE: SurgeState = {
  charge_pct: 0,
  level: 'dormant',
  level_label: 'DORMANT',
  level_color: '#3A3A4E',
  level_progress: 0,
  taps_to_next: 5,
  next_level: 'BUZZING',
  tap_count: 0,
  total_surges: 0,
};

export default function GlobalVibePill() {
  const isInsideVenue    = useVibeStore(s => s.isInsideVenue);
  const activeVenueId    = useVibeStore(s => s.activeVenueId);
  const activeVenueName  = useVibeStore(s => s.activeVenueName);
  const socket           = useVibeStore(s => s.socket);
  const user             = useVibeStore(s => s.user);
  const getAuthHeaders   = useVibeStore(s => s.getAuthHeaders);
  const isDemoMode       = useVibeStore(s => s.isDemoMode);

  const [showCharger, setShowCharger] = useState(false);
  const [surge, setSurge]             = useState<SurgeState>(EMPTY_SURGE);
  const [dangerZone, setDangerZone]   = useState(false);
  const [cooldown, setCooldown]       = useState(false);
  const [tapping, setTapping]         = useState(false);

  // Animations
  const pillScale     = useRef(new Animated.Value(0)).current;
  const pillOpacity   = useRef(new Animated.Value(0)).current;
  const boltPulse     = useRef(new Animated.Value(1)).current;
  const dangerBorder  = useRef(new Animated.Value(0)).current;

  // ── Show/hide pill when geofence changes ──────────────────────────────────
  useEffect(() => {
    if (isInsideVenue) {
      Animated.parallel([
        Animated.spring(pillScale,   { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(pillOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      fetchSurge();
    } else {
      Animated.parallel([
        Animated.timing(pillScale,   { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(pillOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      setShowCharger(false);
      setDangerZone(false);
    }
  }, [isInsideVenue, activeVenueId]);

  // ── Bolt idle pulse ───────────────────────────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(boltPulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
      Animated.timing(boltPulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Danger zone pulsing red border ───────────────────────────────────────
  useEffect(() => {
    if (!dangerZone) { dangerBorder.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dangerBorder, { toValue: 1, duration: 500, useNativeDriver: false }),
      Animated.timing(dangerBorder, { toValue: 0.2, duration: 500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dangerZone]);

  // ── Socket: charge depletion + surge update ───────────────────────────────
  useEffect(() => {
    if (!socket || !activeVenueId) return;

    const onDepletion = (data: { venue_id: string }) => {
      if (data.venue_id !== activeVenueId) return;
      setDangerZone(true);
    };

    const onSurgeUpdate = (data: { venue_id: string }) => {
      if (data.venue_id !== activeVenueId) return;
      fetchSurge();
    };

    const onVenueUpdate = (data: { id: string; current_vibe_score?: number }) => {
      if (data.id !== activeVenueId) return;
      // Auto-clear danger when score recovers
      const score = data.current_vibe_score ?? 100;
      if (score >= 80) setDangerZone(false);
    };

    socket.on('global_charge_depletion', onDepletion);
    socket.on('surge_update', onSurgeUpdate);
    socket.on('venue_update', onVenueUpdate);

    return () => {
      socket.off('global_charge_depletion', onDepletion);
      socket.off('surge_update', onSurgeUpdate);
      socket.off('venue_update', onVenueUpdate);
    };
  }, [socket, activeVenueId]);

  // ── Fetch surge state ─────────────────────────────────────────────────────
  const fetchSurge = async () => {
    if (!activeVenueId || isDemoMode) return;
    try {
      const res = await fetch(`${API_URL}/api/venues/${activeVenueId}/surge`);
      if (res.ok) setSurge(await res.json());
    } catch {}
  };

  // ── Tap to charge ──────────────────────────────────────────────────────────
  const handleCharge = async () => {
    if (cooldown || tapping || !activeVenueId) return;
    setTapping(true);
    try {
      const res = await fetch(`${API_URL}/api/venues/${activeVenueId}/bolt`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (res.ok) { const d = await res.json(); setSurge(d); }
      else if (res.status === 429) { setCooldown(true); setTimeout(() => setCooldown(false), 10000); }
    } catch {}
    setTapping(false);
  };

  const handlePillPress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowCharger(true);
  };

  if (!isInsideVenue) return null;

  const color = surge.level_color;
  const dangerColor = dangerBorder.interpolate({
    inputRange: [0.2, 1],
    outputRange: ['rgba(255,59,48,0.2)', 'rgba(255,59,48,0.9)'],
  });

  return (
    <>
      {/* The Pill HUD */}
      <Animated.View
        style={[
          styles.pill,
          {
            opacity: pillOpacity,
            transform: [{ scale: pillScale }],
            borderColor: dangerZone ? dangerColor : (color + '55'),
            shadowColor: dangerZone ? '#FF3B30' : color,
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable onPress={handlePillPress} style={styles.pillInner}>
          {/* Danger zone indicator */}
          {dangerZone && (
            <Animated.View style={[styles.dangerDot, { opacity: dangerBorder }]} />
          )}

          <Animated.View style={{ transform: [{ scale: boltPulse }] }}>
            <Ionicons
              name="flash"
              size={14}
              color={dangerZone ? '#FF3B30' : color}
            />
          </Animated.View>

          <Text style={[styles.pillLabel, { color: dangerZone ? '#FF3B30' : '#EEEEF5' }]}>
            {dangerZone ? 'ENERGY LOW' : 'VIBE CHARGE'}
          </Text>

          <View style={[styles.pillLevelChip, { backgroundColor: color + '22', borderColor: color + '55' }]}>
            <Text style={[styles.pillLevelText, { color }]}>
              {surge.level_label}
            </Text>
          </View>
        </Pressable>
      </Animated.View>

      {/* Full-screen charger — mounts here, overlay on top of current screen */}
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

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 999,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
    backgroundColor: 'rgba(12,12,21,0.92)',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
  pillLevelChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillLevelText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
} as any);
