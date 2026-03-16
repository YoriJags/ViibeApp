import os

NEW_FILE = r"""import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface SurgeState {
  charge_pct: number; level: string; level_label: string; level_color: string;
  level_progress: number; taps_to_next: number; next_level: string | null;
  tap_count: number; total_surges: number; is_squad_surge?: boolean;
}
const LEVEL_ORDER = ['dormant', 'stirring', 'buzzing', 'popping', 'electric'];
export const DEMO_SURGE: SurgeState = {
  charge_pct: 0.72, level: 'popping', level_label: 'POPPING', level_color: '#FF9933',
  level_progress: 0.71, taps_to_next: 12, next_level: 'ELECTRIC', tap_count: 87, total_surges: 3,
};

interface Props {
  venueId: string; venueName: string; isDemoMode?: boolean;
  onElectric?: (tapCount: number) => void;
  onReact?: () => void;  // called on every tap so parent can also emit a reaction
}

// 8 tick mark angles around the ring
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

export default function VibeSurgeBar({ venueId, isDemoMode, onElectric, onReact }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const socket         = useVibeStore(s => s.socket);
  const [surge, setSurge]       = useState<SurgeState | null>(isDemoMode ? DEMO_SURGE : null);
  const [tapping, setTapping]   = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [boltFlash, setBoltFlash] = useState(false);
  const prevLevel = useRef<string | null>(null);

  // Animations
  const barAnim    = useRef(new Animated.Value(isDemoMode ? DEMO_SURGE.level_progress : 0)).current;
  const boltScale  = useRef(new Animated.Value(1)).current;
  const beamScale  = useRef(new Animated.Value(1)).current;   // bolt beam pulse
  const glowAnim   = useRef(new Animated.Value(0.5)).current; // electric glow loop
  const levelBump  = useRef(new Animated.Value(1)).current;
  const orbitAnim  = useRef(new Animated.Value(0)).current;   // slow outer ring rotation
  const tapRingAnim = useRef(new Animated.Value(0)).current;  // ring burst on tap
  const tapRingOpacity = useRef(new Animated.Value(0)).current;

  // Electric glow loop
  useEffect(() => {
    if (surge?.level === 'electric') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 500, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 500, useNativeDriver: false }),
      ])).start();
    } else { glowAnim.setValue(0.7); }
  }, [surge?.level]);

  // Slow orbital ring spin
  useEffect(() => {
    Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: 6000, useNativeDriver: true })
    ).start();
  }, []);

  // Bolt beam idle pulse
  useEffect(() => {
    if (cooldown) return;
    Animated.loop(Animated.sequence([
      Animated.timing(beamScale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
      Animated.timing(beamScale, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ])).start();
    return () => beamScale.stopAnimation();
  }, [cooldown]);

  useEffect(() => {
    if (!surge) return;
    Animated.spring(barAnim, { toValue: surge.level_progress, tension: 60, friction: 12, useNativeDriver: false }).start();
    if (surge.level === 'electric' && prevLevel.current && prevLevel.current !== 'electric') onElectric?.(surge.tap_count);
    prevLevel.current = surge.level;
  }, [surge?.level_progress, surge?.level]);

  const fetchSurge = useCallback(async () => {
    if (isDemoMode) { setSurge(DEMO_SURGE); return; }
    try {
      const res = await fetch(API_URL + '/api/venues/' + venueId + '/surge');
      if (res.ok) setSurge(await res.json());
    } catch {}
  }, [venueId, isDemoMode]);

  useEffect(() => { fetchSurge(); }, [venueId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      if (data.venue_id !== venueId) return;
      fetchSurge();
      if (data.new_level === 'electric' && data.prev_level !== 'electric') onElectric?.(data.tap_count ?? 0);
      Animated.sequence([
        Animated.timing(levelBump, { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.timing(levelBump, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    };
    socket.on('surge_update', handler);
    return () => { socket.off('surge_update', handler); };
  }, [socket, venueId]);

  const fireTapAnimations = () => {
    // Triple haptic: heavy + medium + light
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 80);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 160);

    setBoltFlash(true);
    setTimeout(() => setBoltFlash(false), 350);

    // Bolt punch down + spring back
    Animated.sequence([
      Animated.timing(boltScale, { toValue: 0.78, duration: 70, useNativeDriver: true }),
      Animated.spring(boltScale, { toValue: 1, tension: 300, friction: 7, useNativeDriver: true }),
    ]).start();

    // Beam burst: fast scale out then back
    Animated.sequence([
      Animated.timing(beamScale, { toValue: 1.35, duration: 100, useNativeDriver: true }),
      Animated.spring(beamScale, { toValue: 1,    tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();

    // Ring burst ripple
    tapRingAnim.setValue(0);
    tapRingOpacity.setValue(0.8);
    Animated.parallel([
      Animated.timing(tapRingAnim,    { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(tapRingOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  const handleBolt = async () => {
    if (cooldown || tapping) return;
    fireTapAnimations();
    onReact?.(); // also fire parent reaction

    if (isDemoMode) {
      setSurge(prev => {
        if (!prev) return prev;
        const newCharge = Math.min(prev.charge_pct + 0.03, 1);
        const toElectric = newCharge >= 0.85 && prev.level !== 'electric';
        return { ...prev, charge_pct: newCharge,
          level_progress: Math.min(prev.level_progress + 0.06, 1),
          tap_count: prev.tap_count + 1, taps_to_next: Math.max(0, prev.taps_to_next - 1),
          ...(toElectric ? { level: 'electric', level_label: 'ELECTRIC', level_color: '#FF3366', next_level: null, taps_to_next: 0 } : {}),
        };
      });
      setCooldown(true); setTimeout(() => setCooldown(false), 3000); return;
    }
    setTapping(true);
    try {
      const res = await fetch(API_URL + '/api/venues/' + venueId + '/bolt', { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) { const data = await res.json(); setSurge(data); }
      else if (res.status === 429) { setCooldown(true); setTimeout(() => setCooldown(false), 10000); }
    } catch {}
    setTapping(false);
  };

  if (!surge) return null;
  const levelIdx  = LEVEL_ORDER.indexOf(surge.level);
  const color      = surge.level_color;
  const isElectric = surge.level === 'electric';

  const orbitDeg = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbitDegReverse = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: levelBump }] }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.sectionLabel}>VIBE CHARGE</Text>
          <Animated.Text style={[styles.levelBadge, { color, opacity: isElectric ? glowAnim : 1 }]}>
            {surge.level_label}
          </Animated.Text>
        </View>
        <View style={styles.levelDots}>
          {LEVEL_ORDER.map((_, i) => (
            <View key={i} style={[styles.dot,
              i <= levelIdx
                ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, elevation: 5 }
                : { backgroundColor: '#1E1E2E' }]} />
          ))}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, {
          width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color, shadowColor: color,
          shadowOpacity: isElectric ? 0.95 : 0.6, shadowRadius: isElectric ? 16 : 7,
        }]} />
        <Animated.View style={[styles.barTip, {
          left: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '97%'] }),
          backgroundColor: color, shadowColor: color, opacity: isElectric ? glowAnim : 0.9,
        }]} />
      </View>

      {/* ═══ BIG CENTRAL TAP BUTTON ═══ */}
      <View style={styles.boltCenter}>
        <TouchableOpacity onPress={handleBolt} activeOpacity={1} disabled={tapping} style={styles.boltTouchable}>

          {/* Tap ripple ring — bursts out on each tap */}
          <Animated.View style={[styles.rippleRing, {
            borderColor: color,
            transform: [{ scale: tapRingAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
            opacity: tapRingOpacity,
          }]} pointerEvents="none" />

          {/* Outer orbit ring — slowly spins with 12 tick marks */}
          <Animated.View style={[styles.orbitRing, { transform: [{ rotate: orbitDeg }],
            borderColor: color, opacity: cooldown ? 0.1 : 0.25 }]}>
            {TICKS.map(angle => (
              <View key={angle} style={[styles.orbitTick, {
                transform: [{ rotate: angle + 'deg' }, { translateY: -72 }],
                backgroundColor: color,
                opacity: angle <= (levelIdx / 4) * 360 ? 1 : 0.2,
              }]} />
            ))}
          </Animated.View>

          {/* Inner counter-orbit ring — thinner, spins opposite */}
          <Animated.View style={[styles.innerOrbitRing, { transform: [{ rotate: orbitDegReverse }],
            borderColor: color, opacity: cooldown ? 0.05 : 0.5,
            borderStyle: 'dashed' }]} />

          {/* Glow halo — always visible when not on cooldown */}
          <Animated.View style={[styles.glowHalo, {
            backgroundColor: color,
            opacity: isElectric ? glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.12, 0.28] }) : 0.08,
            transform: [{ scale: isElectric ? glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.95, 1.05] }) : 1 }],
          }]} />

          {/* The bolt button itself */}
          <Animated.View style={[styles.boltOuter, {
            transform: [{ scale: boltScale }],
            shadowColor: color,
            shadowOpacity: cooldown ? 0 : boltFlash ? 1 : isElectric ? 0.95 : 0.65,
            shadowRadius: boltFlash ? 32 : isElectric ? 24 : 14,
          }]}>
            <LinearGradient
              colors={cooldown
                ? ['#181820', '#111118']
                : boltFlash
                  ? [color, color + 'AA']
                  : isElectric
                    ? [color + 'CC', color + '66']
                    : [color + '88', color + '33']}
              style={[styles.boltGradient, { borderColor: cooldown ? '#2A2A38' : boltFlash ? color : color + '99' }]}
            >
              {tapping ? (
                <ActivityIndicator size="large" color={color} />
              ) : (
                <Animated.View style={{ transform: [{ scale: beamScale }] }}>
                  <Ionicons name="flash" size={52} color={cooldown ? '#2A2A38' : color} />
                </Animated.View>
              )}
            </LinearGradient>

            {/* Squad pip */}
            {surge.is_squad_surge && !cooldown && (
              <View style={styles.squadPip}><Text style={styles.squadPipText}>1.5x</Text></View>
            )}
          </Animated.View>
        </TouchableOpacity>

        {/* Status */}
        {surge.next_level && surge.taps_to_next > 0 ? (
          <Text style={styles.tapHint}>
            <Text style={{ color: '#555' }}>{surge.taps_to_next} taps to </Text>
            <Text style={{ color, fontWeight: '900' }}>{surge.next_level}</Text>
          </Text>
        ) : isElectric ? (
          <Animated.Text style={[styles.tapHint, { color, fontWeight: '900', opacity: glowAnim }]}>
            ELECTRIC — keep it alive
          </Animated.Text>
        ) : (
          <Text style={styles.tapHint}>{cooldown ? 'Cooldown...' : 'Tap to power the venue'}</Text>
        )}
        <Text style={styles.subStats}>{surge.tap_count} taps tonight  •  {surge.total_surges} surges</Text>
      </View>

      {/* Explainer */}
      <View style={styles.explainerRow}>
        <Ionicons name="information-circle-outline" size={12} color="#3A3A4E" />
        <Text style={styles.explainerText}>
          Collective taps charge this bar — hits ELECTRIC when the whole crowd surges together
        </Text>
      </View>

      {surge.is_squad_surge && (
        <View style={styles.squadRow}>
          <Ionicons name="people" size={11} color="#9933FF" />
          <Text style={styles.squadText}>SQUAD SURGE — crew taps count 1.5x</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container:       { backgroundColor: '#0C0C15', borderRadius: 20, borderWidth: 1, borderColor: '#1C1C2C', padding: 20, marginHorizontal: 16, marginTop: 12 },
  headerRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titleBlock:      { gap: 2 },
  sectionLabel:    { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  levelBadge:      { fontSize: 24, fontWeight: '900', letterSpacing: 1.5 },
  levelDots:       { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot:             { width: 10, height: 10, borderRadius: 5, shadowOffset: { width: 0, height: 0 } },
  barTrack:        { height: 12, backgroundColor: '#181826', borderRadius: 8, marginBottom: 28, position: 'relative', overflow: 'visible' },
  barFill:         { height: 12, borderRadius: 8, shadowOffset: { width: 0, height: 0 } },
  barTip:          { position: 'absolute', top: -5, width: 12, height: 22, borderRadius: 6, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  boltCenter:      { alignItems: 'center', marginBottom: 20 },
  boltTouchable:   { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  rippleRing:      { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 2 },
  orbitRing:       { position: 'absolute', width: 156, height: 156, borderRadius: 78, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  orbitTick:       { position: 'absolute', width: 3, height: 10, borderRadius: 2 },
  innerOrbitRing:  { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1.5 },
  glowHalo:        { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  boltOuter:       { shadowOffset: { width: 0, height: 0 } },
  boltGradient:    { width: 110, height: 110, borderRadius: 55, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  tapHint:         { fontSize: 14, color: '#777', fontWeight: '600', marginBottom: 5, textAlign: 'center' },
  subStats:        { fontSize: 10, color: '#3A3A4E', fontWeight: '500', textAlign: 'center' },
  explainerRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#181826' },
  explainerText:   { fontSize: 10, color: '#3A3A4E', fontWeight: '500', flex: 1 },
  squadPip:        { position: 'absolute', top: -4, right: -4, backgroundColor: '#9933FF', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: '#0C0C15' },
  squadPipText:    { fontSize: 8, color: '#FFF', fontWeight: '900' },
  squadRow:        { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  squadText:       { fontSize: 10, color: '#9933FF', fontWeight: '700', letterSpacing: 0.5 },
});
"""

path = 'frontend/src/components/VibeSurgeBar.tsx'
with open(path, 'w', encoding='utf-8') as f:
    f.write(NEW_FILE)
print('written', len(NEW_FILE), 'chars,', NEW_FILE.count('\n'), 'lines')
