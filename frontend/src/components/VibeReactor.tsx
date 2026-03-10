/**
 * VibeReactor — Merged Kinetic Tap + Charge Progress Ring
 *
 * Single "star feature" card replacing VibeSurgeBar + KineticTap.
 *
 * Layout:
 *   [Quest Bar — collective BPM + scout count]
 *   [Circular ring showing collective charge %]
 *     [Central tap circle → Accelerometer G-force tap]
 *     [Surge level label + tap count inside]
 *     [×N combo multiplier badge (BPM-driven)]
 *     [Surges count badge]
 *     [↗ expand to SurgeFullScreen]
 *   [Sub-row: taps-to-next + BPM readout]
 *   [Danger zone callout when score < 80]
 *
 * Tap mechanics:
 *   Chill (<1.5g)  → light haptic, +1 UI count
 *   Lit (1.5–2.5g) → medium haptic, +1 UI count
 *   Peak (>2.5g)   → heavy haptic + screen shake + flare burst, +10 UI count
 *
 * Timings:
 *   15s visual cooldown (local state) — separate from
 *   30-min clout cooldown (server rate-limit 429)
 *
 * Socket events emitted:  tap_velocity, vibe_pulse
 * Socket events received: surge_update, kinetics_update, quest_succeeded,
 *                         global_charge_depletion, venue_update
 *
 * Gates: geofence 100 m + scout+ role (bypassed in demo mode)
 * Battery: Accelerometer listener only starts when isEligible
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Accelerometer } from 'expo-sensors';
import { useVibeStore } from '../store/vibeStore';
import { calculateDistance } from '../utils/geo';
import SurgeFullScreen, { SurgeState } from './SurgeFullScreen';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const RING_SIZE      = 168;
const RING_THICKNESS = 10;
const INNER_SIZE     = RING_SIZE - (RING_THICKNESS + 4) * 2;

const GEOFENCE_RADIUS_M = 100;
const CHILL_THRESHOLD   = 1.5;
const PEAK_THRESHOLD    = 2.5;
const BPM_WINDOW_SIZE   = 8;
const BPM_MAX_AGE_MS    = 10_000;
const COMBO_WINDOW_MS   = 15_000;
const COMBO_THRESHOLD   = 10;
const LOCAL_COOLDOWN_MS = 15_000;
const CHARGE_LOW_SCORE  = 80;

const DEMO_SURGE: SurgeState = {
  charge_pct: 0.08, level: 'stirring', level_label: 'STIRRING',
  level_color: '#6655FF', level_progress: 0.08, taps_to_next: 3,
  next_level: 'BUZZING', tap_count: 0, total_surges: 0,
};

const DEMO_LEVELS = [
  { level: 'dormant',  label: 'DORMANT',  color: '#3A3A4E', min: 0,    next: 'BUZZING' },
  { level: 'stirring', label: 'STIRRING', color: '#6655FF', min: 0.08, next: 'BUZZING' },
  { level: 'buzzing',  label: 'BUZZING',  color: '#33CCFF', min: 0.32, next: 'POPPING' },
  { level: 'popping',  label: 'POPPING',  color: '#FF9933', min: 0.58, next: 'ELECTRIC' },
  { level: 'electric', label: 'ELECTRIC', color: '#FF3366', min: 0.84, next: null },
];

type TapIntensity = 'chill' | 'lit' | 'peak';

interface QuestState {
  aggregate_bpm:  number;
  unique_scouts:  number;
  quest_state:    'idle' | 'active' | 'cooldown';
  resonance_min:  number;
  resonance_max:  number;
}

export interface VibeReactorProps {
  venueId:           string;
  venueName:         string;
  venueCoordinates?: { lat: number; lng: number } | null;
  userLocation?:     { lat: number; lng: number } | null;
  isDemoMode?:       boolean;
  onElectric?:       (tapCount: number) => void;
  onReact?:          () => void;
  onQuestSucceeded?: (participants: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VibeReactor({
  venueId,
  venueName,
  venueCoordinates,
  userLocation,
  isDemoMode = false,
  onElectric,
  onReact,
  onQuestSucceeded,
}: VibeReactorProps) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const socket         = useVibeStore(s => s.socket);
  const user           = useVibeStore(s => s.user);

  // ── Surge state ─────────────────────────────────────────────────────────────
  const [surge, setSurge]             = useState<SurgeState | null>(isDemoMode ? DEMO_SURGE : null);
  const [tapping, setTapping]         = useState(false);
  const [cooldown, setCooldown]       = useState(false);       // 30-min server clout
  const [localCooldown, setLocal]     = useState(false);       // 15s visual
  const [showFull, setShowFull]       = useState(false);

  // ── Kinetic state ───────────────────────────────────────────────────────────
  const latestAccel    = useRef({ x: 0, y: 0, z: 1 });
  const tapTimestamps  = useRef<number[]>([]);
  const comboTaps      = useRef<number[]>([]);
  const localTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLevel      = useRef<string | null>(null);

  const [lastIntensity,  setLastIntensity]  = useState<TapIntensity>('chill');
  const [localTapCount,  setLocalTapCount]  = useState(0);
  const [comboCount,     setComboCount]     = useState(0);
  const [questState,     setQuestState]     = useState<QuestState | null>(null);
  const [dangerZone,     setDangerZone]     = useState(false);
  const [questSucceeded, setQuestSucceeded] = useState(false);

  // ── Animations ──────────────────────────────────────────────────────────────
  const ringProgress   = useRef(new Animated.Value(0)).current;
  const shakeAnim      = useRef(new Animated.Value(0)).current;
  const pressScale     = useRef(new Animated.Value(1)).current;
  const dangerAnim     = useRef(new Animated.Value(0)).current;
  const questGlowAnim  = useRef(new Animated.Value(0)).current;
  const flareAnim      = useRef(new Animated.Value(0)).current;
  const glowOpacity    = useRef(new Animated.Value(0.85)).current;

  // ── Role / geofence gate ────────────────────────────────────────────────────
  const isEligible = (() => {
    if (isDemoMode) return true;
    if (!user) return false;
    const ok = user.is_vibe_plus || ['regular', 'scout', 'elite'].includes(user.scout_status);
    if (!ok || !userLocation || !venueCoordinates) return false;
    return calculateDistance(userLocation.lat, userLocation.lng, venueCoordinates.lat, venueCoordinates.lng) <= GEOFENCE_RADIUS_M;
  })();

  // ── Accelerometer (battery-safe: only when eligible) ───────────────────────
  useEffect(() => {
    if (!isEligible) return;
    Accelerometer.setUpdateInterval(16); // ~60 Hz
    const sub = Accelerometer.addListener(d => { latestAccel.current = d; });
    return () => sub.remove();
  }, [isEligible]);

  // ── Fetch surge ─────────────────────────────────────────────────────────────
  const fetchSurge = useCallback(async () => {
    if (isDemoMode) { setSurge(DEMO_SURGE); return; }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/surge`);
      if (res.ok) setSurge(await res.json());
    } catch {}
  }, [venueId, isDemoMode]);

  useEffect(() => { fetchSurge(); }, [venueId]);

  // ── Ring progress animation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!surge) return;

    Animated.spring(ringProgress, {
      toValue: surge.level_progress,
      tension: 55, friction: 11, useNativeDriver: false,
    }).start();

    // Electric glow pulse
    if (surge.level === 'electric') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1,   duration: 500, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])).start();
    } else {
      glowOpacity.setValue(0.85);
    }

    // Notify parent on electric transition
    if (surge.level === 'electric' && prevLevel.current && prevLevel.current !== 'electric') {
      setTimeout(() => onElectric?.(surge.tap_count), 200);
    }
    prevLevel.current = surge.level;
  }, [surge?.level_progress, surge?.level]);

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !venueId) return;

    const onSurge     = (d: { venue_id: string }) =>
      d.venue_id === venueId && fetchSurge();

    const onKinetics  = (d: QuestState & { venue_id: string }) =>
      d.venue_id === venueId && setQuestState(d);

    const onQuestDone = (d: { venue_id: string; participants: number }) => {
      if (d.venue_id !== venueId) return;
      setQuestSucceeded(true);
      onQuestSucceeded?.(d.participants);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.sequence([
        Animated.timing(questGlowAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(questGlowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]).start(() => setQuestSucceeded(false));
    };

    const onDepletion  = (d: { venue_id: string }) =>
      d.venue_id === venueId && setDangerZone(true);

    const onVenueUpd   = (d: { id: string; current_vibe_score?: number }) => {
      if (d.id === venueId && (d.current_vibe_score ?? 100) >= CHARGE_LOW_SCORE) setDangerZone(false);
    };

    socket.on('surge_update',           onSurge);
    socket.on('kinetics_update',        onKinetics);
    socket.on('quest_succeeded',        onQuestDone);
    socket.on('global_charge_depletion',onDepletion);
    socket.on('venue_update',           onVenueUpd);

    return () => {
      socket.off('surge_update',           onSurge);
      socket.off('kinetics_update',        onKinetics);
      socket.off('quest_succeeded',        onQuestDone);
      socket.off('global_charge_depletion',onDepletion);
      socket.off('venue_update',           onVenueUpd);
    };
  }, [socket, venueId]);

  // ── Danger zone pulsing border ──────────────────────────────────────────────
  useEffect(() => {
    if (!dangerZone) { dangerAnim.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dangerAnim, { toValue: 1,   duration: 500, useNativeDriver: false }),
      Animated.timing(dangerAnim, { toValue: 0.2, duration: 500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dangerZone]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  useEffect(() => () => { if (localTimer.current) clearTimeout(localTimer.current); }, []);

  // ── Tap handler ─────────────────────────────────────────────────────────────
  const handleTap = useCallback(async () => {
    onReact?.();

    const { x, y, z } = latestAccel.current;
    const g = Math.sqrt(x * x + y * y + z * z);
    const intensity: TapIntensity = g > PEAK_THRESHOLD ? 'peak' : g > CHILL_THRESHOLD ? 'lit' : 'chill';
    const uiIncrement = intensity === 'peak' ? 10 : 1;

    // Haptics
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(
        intensity === 'peak' ? Haptics.ImpactFeedbackStyle.Heavy
        : intensity === 'lit'  ? Haptics.ImpactFeedbackStyle.Medium
        :                        Haptics.ImpactFeedbackStyle.Light,
      );
    }

    setLastIntensity(intensity);
    setLocalTapCount(c => c + uiIncrement);

    // Press scale
    Animated.sequence([
      Animated.timing(pressScale, { toValue: intensity === 'peak' ? 0.83 : 0.91, duration: 55, useNativeDriver: true }),
      Animated.timing(pressScale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();

    // Peak: screen shake + flare burst
    if (intensity === 'peak') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:  5, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  4, duration: 30, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 30, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(flareAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(flareAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }

    // BPM + combo tracking
    const now = Date.now();
    tapTimestamps.current.push(now);
    if (tapTimestamps.current.length > 24) tapTimestamps.current = tapTimestamps.current.slice(-24);
    comboTaps.current = comboTaps.current.filter(ts => now - ts < COMBO_WINDOW_MS);
    comboTaps.current.push(now);
    setComboCount(comboTaps.current.length);
    if (comboTaps.current.length >= COMBO_THRESHOLD && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // BPM calc
    const recent = tapTimestamps.current.filter(ts => now - ts < BPM_MAX_AGE_MS).slice(-BPM_WINDOW_SIZE);
    const bpm = recent.length < 2 ? 0 : Math.min(((recent.length - 1) / ((recent[recent.length - 1] - recent[0]) / 1000)) * 60, 300);

    // Kinetic velocity emit (per-tap, small payload)
    socket?.emit('tap_velocity', {
      venue_id: venueId, user_id: user?.id,
      bpm: Math.round(bpm), intensity, g_force: Math.round(g * 100) / 100,
    });

    // 15s visual cooldown gate — emit vibe_pulse once per window
    if (!localCooldown) {
      setLocal(true);
      socket?.emit('vibe_pulse', { venue_id: venueId, user_id: user?.id, intensity: intensity === 'peak' ? 'power' : 'soft', ui_increment: uiIncrement });
      localTimer.current = setTimeout(() => setLocal(false), LOCAL_COOLDOWN_MS);
    }

    // Demo mode: local surge progression
    if (isDemoMode) {
      setSurge(prev => {
        if (!prev) return prev;
        const np = Math.min(prev.level_progress + (intensity === 'peak' ? 0.15 : 0.08), 1.0);
        const lvl = [...DEMO_LEVELS].reverse().find(t => np >= t.min) ?? DEMO_LEVELS[1];
        const nextLvl = DEMO_LEVELS.find(t => t.min > lvl.min);
        return {
          ...prev,
          charge_pct: np, level_progress: np,
          tap_count: prev.tap_count + 1,
          level: lvl.level, level_label: lvl.label, level_color: lvl.color,
          next_level: lvl.next ?? null,
          taps_to_next: nextLvl ? Math.max(0, Math.ceil((nextLvl.min - np) / 0.08)) : 0,
          total_surges: lvl.level === 'electric' && prev.level !== 'electric' ? prev.total_surges + 1 : prev.total_surges,
        };
      });
      return;
    }

    // Real: 30-min clout bolt POST
    if (!cooldown && !tapping) {
      setTapping(true);
      try {
        const res = await fetch(`${API_URL}/api/venues/${venueId}/bolt`, { method: 'POST', headers: getAuthHeaders() });
        if (res.ok) { const d = await res.json(); setSurge(d); }
        else if (res.status === 429) { setCooldown(true); setTimeout(() => setCooldown(false), 1_800_000); }
      } catch {}
      setTapping(false);
    }
  }, [isEligible, socket, venueId, user?.id, localCooldown, cooldown, tapping, isDemoMode, onReact]);

  // ── Derived values ───────────────────────────────────────────────────────────
  if (!surge) return null;

  const color      = dangerZone ? '#FF3B30' : surge.level_color;
  const isElectric = surge.level === 'electric';
  const displayTaps = localTapCount > 0 ? localTapCount : surge.tap_count;

  const intensityColor =
    lastIntensity === 'peak' ? '#FF6B35'
    : lastIntensity === 'lit' ? '#FFD60A'
    : color;

  const bpmNow = (() => {
    const now = Date.now();
    const r = tapTimestamps.current.filter(ts => now - ts < BPM_MAX_AGE_MS).slice(-BPM_WINDOW_SIZE);
    return r.length < 2 ? 0 : Math.min(((r.length - 1) / ((r[r.length - 1] - r[0]) / 1000)) * 60, 300);
  })();

  const comboMultiplier = bpmNow < 60 ? 1 : bpmNow < 100 ? 1.5 : bpmNow < 140 ? 2 : 3;

  // ── Ring arc rotations (two-half-circle technique) ──────────────────────────
  // Right clip (left: RING_SIZE/2) handles progress 0→50%  (rotation -90→90deg)
  // Left  clip (width: RING_SIZE/2) handles progress 50→100% (rotation -90→90deg)
  const rightDeg = ringProgress.interpolate({
    inputRange: [0, 0.5], outputRange: ['-90deg', '90deg'], extrapolate: 'clamp',
  });
  const leftDeg = ringProgress.interpolate({
    inputRange: [0.5, 1], outputRange: ['-90deg', '90deg'], extrapolate: 'clamp',
  });

  const dangerColor = dangerAnim.interpolate({
    inputRange: [0.2, 1],
    outputRange: ['rgba(255,59,48,0.15)', 'rgba(255,59,48,0.85)'],
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.outerWrap, { transform: [{ translateX: shakeAnim }] }]}>

      {/* Quest bar — shown when collective quest is active */}
      {questState && questState.unique_scouts > 0 && (
        <View style={styles.questBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.questLabel}>COLLECTIVE QUEST</Text>
            <Text style={styles.questSub}>
              {questState.quest_state === 'cooldown'
                ? 'Quest complete — next in 30 min'
                : `${questState.unique_scouts} scout${questState.unique_scouts !== 1 ? 's' : ''} · target ${questState.resonance_min}–${questState.resonance_max} BPM`}
            </Text>
          </View>
          <View style={styles.bpmBadge}>
            <Text style={styles.bpmBadgeNum}>{Math.round(questState.aggregate_bpm)}</Text>
            <Text style={styles.bpmBadgeLabel}>BPM</Text>
          </View>
        </View>
      )}

      {/* ── Ring + Center ─────────────────────────────────────── */}
      <View style={styles.ringOuter}>

        {/* Quest glow / electric glow backdrop */}
        {(questSucceeded || isElectric) && (
          <Animated.View style={[
            styles.glowBackdrop,
            { opacity: questSucceeded ? questGlowAnim : glowOpacity,
              backgroundColor: questSucceeded ? 'rgba(0,230,118,0.14)' : color + '14' },
          ]} />
        )}

        {/* Track circle */}
        <Animated.View style={[
          styles.ringTrack,
          { borderColor: dangerZone ? dangerColor : '#1E1E2E' },
        ]} />

        {/* Ring fill: right half (0–50%) */}
        <View style={styles.rightClip}>
          <Animated.View style={[
            styles.arcBase,
            { borderTopColor: color, borderRightColor: color,
              borderBottomColor: 'transparent', borderLeftColor: 'transparent',
              transform: [{ rotate: rightDeg }],
              shadowColor: color, shadowOpacity: isElectric ? 0.8 : 0.45,
            },
          ]} />
        </View>

        {/* Ring fill: left half (50–100%) */}
        <View style={styles.leftClip}>
          <Animated.View style={[
            styles.arcBase,
            { position: 'absolute', right: 0,
              borderTopColor: color, borderLeftColor: color,
              borderBottomColor: 'transparent', borderRightColor: 'transparent',
              transform: [{ rotate: leftDeg }],
              shadowColor: color, shadowOpacity: isElectric ? 0.8 : 0.45,
            },
          ]} />
        </View>

        {/* ── Central tap circle ─────────────────────────────── */}
        <Pressable onPress={handleTap} style={styles.centerWrap}>
          <Animated.View style={[
            styles.centerCircle,
            { transform: [{ scale: pressScale }],
              borderColor: intensityColor + '44',
              shadowColor: intensityColor,
              shadowOpacity: isElectric ? 0.75 : 0.35,
              shadowRadius: isElectric ? 16 : 8,
            },
          ]}>
            {/* Specular highlight */}
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
              start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
              style={styles.centerShine}
              pointerEvents="none"
            />

            {/* Peak flare burst overlay */}
            <Animated.View style={[styles.flareOverlay, { opacity: flareAnim, backgroundColor: intensityColor + '30' }]} />

            {/* Bolt icon */}
            <Animated.View style={{ opacity: isElectric ? glowOpacity : 1 }}>
              <Ionicons name="flash" size={30} color={intensityColor} />
            </Animated.View>

            {/* Level label */}
            <Text style={[styles.levelLabel, { color }]}>{surge.level_label}</Text>

            {/* Tap count */}
            <Text style={styles.tapCountLabel}>{displayTaps}</Text>
          </Animated.View>
        </Pressable>

        {/* Combo multiplier — top-right of ring */}
        {comboMultiplier > 1 && (
          <View style={[styles.comboBadge, { backgroundColor: intensityColor + '1A', borderColor: intensityColor + '55' }]}>
            <Text style={[styles.comboText, { color: intensityColor }]}>×{comboMultiplier}</Text>
          </View>
        )}

        {/* Surges counter — bottom-right */}
        <View style={styles.surgeBadge}>
          <Text style={[styles.surgeBadgeNum, { color }]}>{surge.total_surges}</Text>
          <Text style={styles.surgeBadgeLabel}>SURGES</Text>
        </View>

        {/* Expand to full-screen — bottom-left */}
        <TouchableOpacity style={styles.expandBtn} onPress={() => setShowFull(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="expand-outline" size={15} color={color + 'AA'} />
        </TouchableOpacity>

      </View>
      {/* ── End ring ──────────────────────────────────────────── */}

      {/* Sub-row: progress text + live BPM */}
      <View style={styles.subRow}>
        {surge.taps_to_next > 0 && surge.next_level ? (
          <Text style={styles.subText}>
            {surge.taps_to_next} taps to{' '}
            <Text style={{ color }}>{surge.next_level}</Text>
          </Text>
        ) : (
          <Text style={[styles.subText, { color }]}>ELECTRIC — MAX CHARGE</Text>
        )}
        {bpmNow > 0 && (
          <Text style={styles.subText}>{Math.round(bpmNow)} BPM</Text>
        )}
      </View>

      {/* Danger zone callout */}
      {dangerZone && (
        <Animated.Text style={[styles.dangerText, { opacity: dangerAnim }]}>
          ⚠ Energy dropping — keep it alive!
        </Animated.Text>
      )}

      {/* Full-screen charger overlay */}
      <SurgeFullScreen
        visible={showFull}
        surge={surge}
        venueName={venueName}
        venueId={venueId}
        onClose={() => setShowFull(false)}
        onTap={handleTap}
        tapping={tapping}
        cooldown={cooldown}
        socket={socket}
        userId={user?.id}
      />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerWrap: {
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#0C0C15',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1C1C2C',
    paddingVertical: 16,
    paddingHorizontal: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },

  // ── Quest bar ────────────────────────────────────────────
  questBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  questLabel: {
    fontSize: 10, fontWeight: '700', color: '#FFD60A', letterSpacing: 1.2,
  },
  questSub: {
    fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2,
  },
  bpmBadge: {
    alignItems: 'center', backgroundColor: 'rgba(255,214,10,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  bpmBadgeNum:   { fontSize: 20, fontWeight: '800', color: '#FFD60A', lineHeight: 22 },
  bpmBadgeLabel: { fontSize: 9,  color: '#FFD60A', letterSpacing: 1 },

  // ── Ring container ───────────────────────────────────────
  ringOuter: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignSelf: 'center',
    position: 'relative',
  },
  glowBackdrop: {
    position: 'absolute',
    width: RING_SIZE + 20, height: RING_SIZE + 20,
    left: -10, top: -10,
    borderRadius: (RING_SIZE + 20) / 2,
  },
  ringTrack: {
    position: 'absolute',
    width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_THICKNESS,
  },

  // ── Two-half arc clips ───────────────────────────────────
  rightClip: {
    position: 'absolute',
    left: RING_SIZE / 2, top: 0,
    width: RING_SIZE / 2, height: RING_SIZE,
    overflow: 'hidden',
  },
  leftClip: {
    position: 'absolute',
    left: 0, top: 0,
    width: RING_SIZE / 2, height: RING_SIZE,
    overflow: 'hidden',
  },
  arcBase: {
    position: 'absolute',
    left: -RING_SIZE / 2, top: 0,           // full ring starting at left edge of rightClip
    width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: RING_THICKNESS,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
  },

  // ── Center circle ────────────────────────────────────────
  centerWrap: {
    position: 'absolute',
    top: RING_THICKNESS + 4,
    left: RING_THICKNESS + 4,
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCircle: {
    width: '100%', height: '100%',
    borderRadius: INNER_SIZE / 2,
    backgroundColor: 'rgba(12,12,21,0.95)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  centerShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
    borderTopLeftRadius: INNER_SIZE / 2, borderTopRightRadius: INNER_SIZE / 2,
  },
  flareOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: INNER_SIZE / 2,
  },
  levelLabel: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginTop: 4,
  },
  tapCountLabel: {
    fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2,
  },

  // ── Overlay badges ───────────────────────────────────────
  comboBadge: {
    position: 'absolute', top: 4, right: 4,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  comboText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  surgeBadge: {
    position: 'absolute', bottom: 4, right: 4,
    alignItems: 'center',
  },
  surgeBadgeNum:   { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  surgeBadgeLabel: { fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.2 },

  expandBtn: {
    position: 'absolute', bottom: 8, left: 8,
    opacity: 0.7,
  },

  // ── Sub-row ──────────────────────────────────────────────
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  subText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  dangerText: {
    textAlign: 'center', fontSize: 12, color: '#FF3B30',
    fontWeight: '600', marginTop: 6,
  },
} as any);
