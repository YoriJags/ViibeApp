/**
 * VibeReactor — VIIBE 2.0 Kinetic Core
 *
 * Visual layer: @shopify/react-native-skia canvas (ring + particles)
 * Animation:    react-native-reanimated (orb pulse, color transitions)
 * Logic:        unchanged — socket, haptics, G-force, fraud guard
 */
import React, {
  useEffect, useRef, useState, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, Pressable, TouchableOpacity, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useDerivedValue, useAnimatedStyle,
  withSpring, withTiming, withSequence, withRepeat,
  interpolate, interpolateColor, Extrapolation,
  cancelAnimation, Easing,
} from 'react-native-reanimated';
import {
  Canvas, Circle, Path, Paint, BlurMask, Skia,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../store/vibeStore';
import { calculateDistance } from '../utils/geo';
import SurgeFullScreen, { SurgeState } from './SurgeFullScreen';
import { useHapticVelocity } from '../hooks/useHapticVelocity';
import { useRetryFetch } from '../hooks/useRetryFetch';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CANVAS_SIZE = 220;
const CX          = CANVAS_SIZE / 2;
const CY          = CANVAS_SIZE / 2;
const RING_R      = 95;
const RING_T      = 9;
const ORB_R       = 72;   // inner tap circle radius

const GEOFENCE_RADIUS_M  = 100;
const BPM_WINDOW_SIZE    = 8;
const BPM_MAX_AGE_MS     = 10_000;
const COMBO_WINDOW_MS    = 15_000;
const COMBO_THRESHOLD    = 10;
const LOCAL_COOLDOWN_MS  = 15_000;
const CHARGE_LOW_SCORE   = 80;
const HIGH_G_SPARK_FLOOR = 2.0;   // G-force threshold for particle burst

// Level → index for color interpolation
const LEVEL_INDICES: Record<string, number> = {
  dormant: 0, stirring: 1, buzzing: 2, popping: 3, electric: 4,
};
// deep electric blue → volatile neon purple → fire → crimson
const LEVEL_PALETTE = ['#3A3A4E', '#5544FF', '#AA00FF', '#FF7700', '#FF0055'];

const DEMO_SURGE: SurgeState = {
  charge_pct: 0.08, level: 'stirring', level_label: 'STIRRING',
  level_color: '#5544FF', level_progress: 0.08, taps_to_next: 3,
  next_level: 'BUZZING', tap_count: 0, total_surges: 0,
};

const DEMO_LEVELS = [
  { level: 'dormant',  label: 'DORMANT',  color: '#3A3A4E', min: 0,    next: 'BUZZING'   },
  { level: 'stirring', label: 'STIRRING', color: '#5544FF', min: 0.08, next: 'BUZZING'   },
  { level: 'buzzing',  label: 'BUZZING',  color: '#AA00FF', min: 0.32, next: 'POPPING'   },
  { level: 'popping',  label: 'POPPING',  color: '#FF7700', min: 0.58, next: 'ELECTRIC'  },
  { level: 'electric', label: 'ELECTRIC', color: '#FF0055', min: 0.84, next: null        },
];

const GLITCH_CHARS = '!@#$%^&*<>?/|~';

type TapIntensity = 'chill' | 'lit' | 'peak';

interface QuestState {
  aggregate_bpm: number;
  unique_scouts: number;
  quest_state:   'idle' | 'active' | 'cooldown';
  resonance_min: number;
  resonance_max: number;
}

interface Spark {
  id:      number;
  x:       number;
  y:       number;
  vx:      number;
  vy:      number;
  life:    number;
  maxLife: number;
  color:   string;
  size:    number;
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

// ─── GlitchText ───────────────────────────────────────────────────────────────

function GlitchText({ text, color }: { text: string; color: string }) {
  const [display, setDisplay] = useState(text);
  const prevRef = useRef(text);

  useEffect(() => {
    if (text === prevRef.current) return;
    prevRef.current = text;
    let frame = 0;
    const FRAMES = 7;
    const id = setInterval(() => {
      frame++;
      if (frame >= FRAMES) {
        setDisplay(text);
        clearInterval(id);
      } else {
        setDisplay(
          text.split('').map(c =>
            c === ' ' ? ' ' : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
          ).join(''),
        );
      }
    }, 45);
    return () => clearInterval(id);
  }, [text]);

  return (
    <Text style={{ color, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }}>
      {display}
    </Text>
  );
}

// ─── KineticCanvas (Skia) ─────────────────────────────────────────────────────

interface KineticCanvasProps {
  ringProgress: ReturnType<typeof useSharedValue<number>>;
  coreColor:    ReturnType<typeof useDerivedValue<string>>;
  sparks:       Spark[];
}

const KineticCanvas = React.memo(function KineticCanvas({
  ringProgress, coreColor, sparks,
}: KineticCanvasProps) {
  // Progress arc — built on the UI thread
  const arcPath = useDerivedValue(() => {
    const sweep = Math.max(0, ringProgress.value * 360);
    if (sweep < 0.5) return Skia.Path.Make();
    const path = Skia.Path.Make();
    path.addArc(
      { x: CX - RING_R, y: CY - RING_R, width: RING_R * 2, height: RING_R * 2 },
      -90,
      sweep,
    );
    return path;
  });

  return (
    <Canvas style={canvasStyle}>
      {/* Ring track */}
      <Circle cx={CX} cy={CY} r={RING_R}>
        <Paint style="stroke" strokeWidth={RING_T} color="#1A1A2E" />
      </Circle>

      {/* Outer glow (blurred wide stroke) */}
      <Path path={arcPath}>
        <Paint
          style="stroke"
          strokeWidth={RING_T + 10}
          strokeCap="round"
          color={coreColor}
          opacity={0.18}
        >
          <BlurMask blur={14} style="normal" />
        </Paint>
      </Path>

      {/* Progress arc (sharp) */}
      <Path path={arcPath}>
        <Paint
          style="stroke"
          strokeWidth={RING_T}
          strokeCap="round"
          color={coreColor}
        />
      </Path>

      {/* Particle sparks */}
      {sparks.map(spark => (
        <Circle
          key={spark.id}
          cx={spark.x}
          cy={spark.y}
          r={Math.max(0.5, spark.size * (spark.life / spark.maxLife))}
          color={spark.color}
          opacity={spark.life / spark.maxLife}
        />
      ))}
    </Canvas>
  );
});

const canvasStyle = {
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  position: 'absolute' as const,
  top: 0, left: 0,
};

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
  const activeSurge    = useVibeStore(s => s.activeSurge);

  // ── Surge state ─────────────────────────────────────────────────────────────
  const [surge,       setSurge]     = useState<SurgeState | null>(isDemoMode ? DEMO_SURGE : null);
  const [cooldown,    setCooldown]  = useState(false);
  const [localCooldown, setLocal]  = useState(false);
  const [showFull,    setShowFull]  = useState(false);

  // ── Kinetic tracking refs ────────────────────────────────────────────────────
  const tapTimestamps  = useRef<number[]>([]);
  const comboTaps      = useRef<number[]>([]);
  const localTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLevel      = useRef<string | null>(null);
  const windowGForces  = useRef<number[]>([]);
  const windowPeakCount = useRef(0);
  const windowTapCount  = useRef(0);
  const windowMaxBpm    = useRef(0);

  const STATIONARY_G_THRESHOLD = 1.2;

  const [lastIntensity,   setLastIntensity]   = useState<TapIntensity>('chill');
  const [localTapCount,   setLocalTapCount]   = useState(0);
  const [comboCount,      setComboCount]       = useState(0);
  const [questState,      setQuestState]       = useState<QuestState | null>(null);
  const [dangerZone,      setDangerZone]       = useState(false);
  const [questSucceeded,  setQuestSucceeded]   = useState(false);
  const [stationaryNudge, setStationaryNudge]  = useState(false);

  // ── Spark particle system ────────────────────────────────────────────────────
  const sparksRef = useRef<Spark[]>([]);
  const rafRef    = useRef<number>(0);
  const [, forceSparkUpdate] = useState(0);

  const tickSparks = useCallback(() => {
    sparksRef.current = sparksRef.current
      .map(s => ({
        ...s,
        x:    s.x + s.vx,
        y:    s.y + s.vy,
        vy:   s.vy + 0.12,  // gravity
        life: s.life - 16,
      }))
      .filter(s => s.life > 0);

    if (sparksRef.current.length > 0) {
      forceSparkUpdate(n => n + 1);
      rafRef.current = requestAnimationFrame(tickSparks);
    }
  }, []);

  const spawnSparks = useCallback((color: string) => {
    const count = 10;
    const newSparks: Spark[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.9;
      const speed = 2.5 + Math.random() * 4;
      return {
        id:      Date.now() + i,
        x:       CX,
        y:       CY,
        vx:      Math.cos(angle) * speed,
        vy:      Math.sin(angle) * speed - 1.2,
        life:    500 + Math.random() * 300,
        maxLife: 600,
        color,
        size:    1.8 + Math.random() * 1.5,
      };
    });
    sparksRef.current = [...sparksRef.current.slice(-20), ...newSparks];
    forceSparkUpdate(n => n + 1);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tickSparks);
  }, [tickSparks]);

  // ── Reanimated shared values ─────────────────────────────────────────────────
  const ringProgress     = useSharedValue(0);
  const shakeX           = useSharedValue(0);
  const pressScale       = useSharedValue(1);
  const dangerOpacity    = useSharedValue(0);
  const questGlow        = useSharedValue(0);
  const flareOpacity     = useSharedValue(0);
  const glowOpacity      = useSharedValue(0.85);
  const breathPhase      = useSharedValue(0);
  const bpmShared        = useSharedValue(0);
  const levelIdx         = useSharedValue(1);  // 0–4 level index

  // ── Collective Surge — secondary ghost ring + SURGE ACTIVE badge ─────────────
  const surgeRingScale   = useSharedValue(1);
  const surgeRingOpacity = useSharedValue(0);
  const surgeBadgeOp     = useSharedValue(0);

  // Smooth level color transition
  const coreColor = useDerivedValue<string>(() =>
    interpolateColor(levelIdx.value, [0, 1, 2, 3, 4], LEVEL_PALETTE),
  );

  // ── Role / geofence gate ─────────────────────────────────────────────────────
  const isEligible = (() => {
    if (isDemoMode) return true;
    if (!user) return false;
    const ok = user.is_vibe_plus || ['regular', 'scout', 'elite'].includes(user.scout_status);
    if (!ok || !userLocation || !venueCoordinates) return false;
    return calculateDistance(
      userLocation.lat, userLocation.lng,
      venueCoordinates.lat, venueCoordinates.lng,
    ) <= GEOFENCE_RADIUS_M;
  })();

  const { getIntensity, getGForce, fireHaptic } = useHapticVelocity({ enabled: isEligible });
  const { post: retryPost, pending: tapping }   = useRetryFetch();

  // ── Breathing animation ──────────────────────────────────────────────────────
  useEffect(() => {
    breathPhase.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);

  // ── Fetch surge ──────────────────────────────────────────────────────────────
  const fetchSurge = useCallback(async () => {
    if (isDemoMode) { setSurge(DEMO_SURGE); return; }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/surge`);
      if (res.ok) setSurge(await res.json());
    } catch {}
  }, [venueId, isDemoMode]);

  useEffect(() => { fetchSurge(); }, [venueId]);

  // ── Ring progress + level color + electric glow ──────────────────────────────
  useEffect(() => {
    if (!surge) return;
    ringProgress.value = withSpring(surge.level_progress, { stiffness: 55, damping: 11 });
    levelIdx.value = withTiming(LEVEL_INDICES[surge.level] ?? 1, { duration: 500 });

    if (surge.level === 'electric') {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    } else {
      cancelAnimation(glowOpacity);
      glowOpacity.value = withTiming(0.85, { duration: 200 });
    }

    if (surge.level === 'electric' && prevLevel.current && prevLevel.current !== 'electric') {
      setTimeout(() => onElectric?.(surge.tap_count), 200);
    }
    prevLevel.current = surge.level;
  }, [surge?.level_progress, surge?.level]);

  // ── Socket ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !venueId) return;

    const onSurge    = (d: { venue_id: string }) =>
      d.venue_id === venueId && fetchSurge();
    const onKinetics = (d: QuestState & { venue_id: string }) =>
      d.venue_id === venueId && setQuestState(d);
    const onQuestDone = (d: { venue_id: string; participants: number }) => {
      if (d.venue_id !== venueId) return;
      setQuestSucceeded(true);
      onQuestSucceeded?.(d.participants);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      questGlow.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(0, { duration: 1200 }),
      );
      setTimeout(() => setQuestSucceeded(false), 1500);
    };
    const onDepletion = (d: { venue_id: string }) =>
      d.venue_id === venueId && setDangerZone(true);
    const onVenueUpd  = (d: { id: string; current_vibe_score?: number }) => {
      if (d.id === venueId && (d.current_vibe_score ?? 100) >= CHARGE_LOW_SCORE)
        setDangerZone(false);
    };

    socket.on('surge_update',            onSurge);
    socket.on('kinetics_update',         onKinetics);
    socket.on('quest_succeeded',         onQuestDone);
    socket.on('global_charge_depletion', onDepletion);
    socket.on('venue_update',            onVenueUpd);

    return () => {
      socket.off('surge_update',            onSurge);
      socket.off('kinetics_update',         onKinetics);
      socket.off('quest_succeeded',         onQuestDone);
      socket.off('global_charge_depletion', onDepletion);
      socket.off('venue_update',            onVenueUpd);
    };
  }, [socket, venueId]);

  // ── Danger pulse ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!dangerZone) {
      cancelAnimation(dangerOpacity);
      dangerOpacity.value = withTiming(0, { duration: 200 });
      return;
    }
    dangerOpacity.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 500 }),
        withTiming(0.2, { duration: 500 }),
      ),
      -1, false,
    );
  }, [dangerZone]);

  // ── Collective surge reaction ─────────────────────────────────────────────────
  // Fires when a venue_surge event arrives from the server (via store).
  // Secondary ghost ring expands outward (offset from main ring) to represent
  // "someone else's" collective energy. Haptic heartbeat: heavy → light.
  useEffect(() => {
    if (!activeSurge || activeSurge.venue_id !== venueId) return;

    // Haptic heartbeat succession: impactHeavy then impactLight 120ms later
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 120);
    }

    // Ghost ring: flash in then expand outward
    surgeRingOpacity.value = withSequence(
      withTiming(0.65, { duration: 120 }),
      withTiming(0,    { duration: 700 }),
    );
    surgeRingScale.value = withSequence(
      withTiming(1.0,  { duration: 0 }),
      withTiming(1.28, { duration: 700, easing: Easing.out(Easing.ease) }),
    );

    // SURGE ACTIVE badge: fade in, hold 4.5s, fade out
    surgeBadgeOp.value = withSequence(
      withTiming(1,   { duration: 200 }),
      withTiming(1,   { duration: 4500 }),
      withTiming(0,   { duration: 500 }),
    );
  }, [activeSurge]);

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (localTimer.current) clearTimeout(localTimer.current);
    cancelAnimationFrame(rafRef.current);
    windowGForces.current   = [];
    windowTapCount.current  = 0;
    windowPeakCount.current = 0;
  }, []);

  // ── Tap handler ──────────────────────────────────────────────────────────────
  const handleTap = useCallback(async () => {
    onReact?.();

    const intensity   = getIntensity();
    const gForce      = getGForce();
    const uiIncrement = intensity === 'peak' ? 10 : 1;

    fireHaptic(intensity);
    setLastIntensity(intensity);
    setLocalTapCount(c => c + uiIncrement);

    // Press + breath scale
    pressScale.value = withSequence(
      withTiming(intensity === 'peak' ? 0.82 : 0.90, { duration: 55 }),
      withSpring(1, { stiffness: 80, damping: 8 }),
    );

    if (intensity === 'peak') {
      shakeX.value = withSequence(
        withTiming( 6, { duration: 40 }),
        withTiming(-6, { duration: 40 }),
        withTiming( 4, { duration: 30 }),
        withTiming( 0, { duration: 30 }),
      );
      flareOpacity.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 320 }),
      );
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Particle burst on high-velocity tap
    if (gForce >= HIGH_G_SPARK_FLOOR && surge) {
      spawnSparks(surge.level_color);
    }

    // BPM tracking
    const now = Date.now();
    tapTimestamps.current.push(now);
    if (tapTimestamps.current.length > 24) tapTimestamps.current = tapTimestamps.current.slice(-24);
    comboTaps.current = comboTaps.current.filter(ts => now - ts < COMBO_WINDOW_MS);
    comboTaps.current.push(now);
    setComboCount(comboTaps.current.length);
    if (comboTaps.current.length >= COMBO_THRESHOLD && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const recent = tapTimestamps.current.filter(ts => now - ts < BPM_MAX_AGE_MS).slice(-BPM_WINDOW_SIZE);
    const bpm = recent.length < 2
      ? 0
      : Math.min(((recent.length - 1) / ((recent[recent.length - 1] - recent[0]) / 1000)) * 60, 300);

    // Update BPM shared value for orb pulse
    bpmShared.value = Math.round(bpm);

    socket?.emit('tap_velocity', {
      venue_id: venueId, user_id: user?.id,
      bpm: Math.round(bpm), intensity, g_force: gForce,
    });

    // Kinetic Verification window accumulation
    windowGForces.current.push(gForce);
    windowTapCount.current  += 1;
    if (intensity === 'peak') windowPeakCount.current += 1;
    if (bpm > windowMaxBpm.current) windowMaxBpm.current = Math.round(bpm);

    if (!localCooldown) {
      setLocal(true);
      windowGForces.current   = [gForce];
      windowTapCount.current  = 1;
      windowPeakCount.current = intensity === 'peak' ? 1 : 0;
      windowMaxBpm.current    = Math.round(bpm);

      localTimer.current = setTimeout(() => {
        const gfs       = windowGForces.current;
        const avgG      = gfs.length > 0 ? gfs.reduce((a, b) => a + b, 0) / gfs.length : 1.0;
        const peakRatio = windowTapCount.current > 0
          ? windowPeakCount.current / windowTapCount.current : 0;
        const stationaryPeakAbuse = avgG < STATIONARY_G_THRESHOLD && peakRatio > 0.5;

        socket?.emit('vibe_pulse', {
          venue_id:   venueId, user_id: user?.id,
          tap_count:  windowTapCount.current,
          peak_count: windowPeakCount.current,
          avg_g_force: Math.round(avgG * 100) / 100,
          max_bpm:     windowMaxBpm.current,
          intensity:   peakRatio > 0.5 ? 'power' : 'soft',
          ui_increment: windowTapCount.current,
          stationary_peak_abuse: stationaryPeakAbuse,
        });

        if (stationaryPeakAbuse) {
          setStationaryNudge(true);
          setTimeout(() => setStationaryNudge(false), 4000);
        }

        windowGForces.current   = [];
        windowTapCount.current  = 0;
        windowPeakCount.current = 0;
        windowMaxBpm.current    = 0;
        setLocal(false);
      }, LOCAL_COOLDOWN_MS);
    }

    if (isDemoMode) {
      setSurge(prev => {
        if (!prev) return prev;
        const np  = Math.min(prev.level_progress + (intensity === 'peak' ? 0.15 : 0.08), 1.0);
        const lvl = [...DEMO_LEVELS].reverse().find(t => np >= t.min) ?? DEMO_LEVELS[1];
        return {
          ...prev,
          charge_pct: np, level_progress: np,
          tap_count: prev.tap_count + 1,
          level: lvl.level, level_label: lvl.label, level_color: lvl.color,
          next_level: lvl.next ?? null,
          taps_to_next: DEMO_LEVELS.find(t => t.min > lvl.min)
            ? Math.max(0, Math.ceil((DEMO_LEVELS.find(t => t.min > lvl.min)!.min - np) / 0.08))
            : 0,
          total_surges: lvl.level === 'electric' && prev.level !== 'electric'
            ? prev.total_surges + 1 : prev.total_surges,
        };
      });
      return;
    }

    if (!cooldown && !tapping) {
      await retryPost<SurgeState>(
        `${API_URL}/api/venues/${venueId}/bolt`,
        { method: 'POST', headers: getAuthHeaders() },
        {
          onOptimistic: () => setLocalTapCount(c => c + 1),
          onSuccess:    (data) => setSurge(data),
          onFailure:    (status) => {
            if (status === 429) {
              setCooldown(true);
              setTimeout(() => setCooldown(false), 1_800_000);
            }
          },
        },
      );
    }
  }, [
    isEligible, socket, venueId, user?.id, surge,
    localCooldown, cooldown, tapping, isDemoMode,
    onReact, getIntensity, getGForce, fireHaptic, spawnSparks,
  ]);

  // ── Derived display values ────────────────────────────────────────────────────
  const isElectric = surge?.level === 'electric';
  const color      = dangerZone ? '#FF3B30' : (surge?.level_color ?? '#5544FF');

  const displayTaps = localTapCount > 0 ? localTapCount : (surge?.tap_count ?? 0);

  const bpmNow = (() => {
    const now = Date.now();
    const r = tapTimestamps.current.filter(ts => now - ts < BPM_MAX_AGE_MS).slice(-BPM_WINDOW_SIZE);
    return r.length < 2 ? 0
      : Math.min(((r.length - 1) / ((r[r.length - 1] - r[0]) / 1000)) * 60, 300);
  })();

  const comboMultiplier = bpmNow < 60 ? 1 : bpmNow < 100 ? 1.5 : bpmNow < 140 ? 2 : 3;

  // ── Animated styles ──────────────────────────────────────────────────────────
  const outerWrapStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // Orb scale: press + BPM-driven breath
  const orbStyle = useAnimatedStyle(() => {
    const breathBoost = interpolate(breathPhase.value, [0, 1], [0, 0.035], Extrapolation.CLAMP);
    const bpmBoost    = interpolate(bpmShared.value, [0, 60, 140, 240], [0, 0.01, 0.04, 0.07], Extrapolation.CLAMP);
    return {
      transform: [{ scale: pressScale.value * (1 + breathBoost + bpmBoost) }],
    };
  });

  const flareStyle = useAnimatedStyle(() => ({
    opacity: flareOpacity.value,
  }));

  const boltStyle = useAnimatedStyle(() => ({
    opacity: isElectric ? glowOpacity.value : 1,
  }));

  const dangerTextStyle = useAnimatedStyle(() => ({
    opacity: dangerOpacity.value,
  }));

  const surgeRingStyle = useAnimatedStyle(() => ({
    opacity:   surgeRingOpacity.value,
    transform: [{ scale: surgeRingScale.value }],
  }));

  const surgeBadgeStyle = useAnimatedStyle(() => ({
    opacity: surgeBadgeOp.value,
  }));

  // ── Early return ──────────────────────────────────────────────────────────────
  if (!surge) return null;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.outerWrap, outerWrapStyle]}>

      {/* Quest bar */}
      {questState && questState.unique_scouts > 0 && (
        <View style={styles.questBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.questLabel}>COLLECTIVE QUEST</Text>
            <Text style={styles.questSub}>
              {questState.quest_state === 'cooldown'
                ? 'Quest complete — next in 30 min'
                : `${questState.unique_scouts} scout${questState.unique_scouts !== 1 ? 's' : ''} · target ${questState.resonance_min}–${questState.resonance_max} BPM`
              }
            </Text>
          </View>
          <View style={styles.bpmBadge}>
            <Text style={styles.bpmBadgeNum}>{Math.round(questState.aggregate_bpm)}</Text>
            <Text style={styles.bpmBadgeLabel}>BPM</Text>
          </View>
        </View>
      )}

      {/* ── Kinetic Core ─────────────────────────────────────────── */}
      <View style={styles.coreContainer}>

        {/* Skia: ring track + progress arc + sparks */}
        <KineticCanvas
          ringProgress={ringProgress}
          coreColor={coreColor}
          sparks={sparksRef.current}
        />

        {/* Ghost surge ring — secondary pulse offset from main ring */}
        <Animated.View style={[styles.surgeGhostRing, surgeRingStyle, { borderColor: color }]} />

        {/* Central orb (tap target) */}
        <Pressable onPress={handleTap} style={styles.orbPressable}>
          <Animated.View style={[
            styles.orb,
            orbStyle,
            {
              shadowColor:   color,
              shadowOpacity: isElectric ? 0.8 : 0.4,
              shadowRadius:  isElectric ? 20 : 10,
              borderColor:   color + '30',
            },
          ]}>
            {/* Gradient wash */}
            <LinearGradient
              colors={[color + '1A', 'transparent'] as [string, string]}
              style={StyleSheet.absoluteFill}
            />

            {/* Peak flare */}
            <Animated.View style={[
              styles.flareOverlay,
              flareStyle,
              { backgroundColor: color + '28' },
            ]} />

            {/* Bolt */}
            <Animated.View style={boltStyle}>
              <Ionicons name="flash" size={34} color={color} />
            </Animated.View>

            {/* Level text — glitches on transition */}
            <GlitchText text={surge.level_label} color={color} />

            {/* Tap count */}
            <Text style={styles.tapCount}>{displayTaps}</Text>
          </Animated.View>
        </Pressable>

        {/* Combo badge */}
        {comboMultiplier > 1 && (
          <View style={[
            styles.comboBadge,
            { backgroundColor: color + '1A', borderColor: color + '55' },
          ]}>
            <Text style={[styles.comboText, { color }]}>×{comboMultiplier}</Text>
          </View>
        )}

        {/* Surges counter */}
        <View style={styles.surgeBadge}>
          <Text style={[styles.surgeBadgeNum, { color }]}>{surge.total_surges}</Text>
          <Text style={styles.surgeBadgeLabel}>SURGES</Text>
        </View>

        {/* Expand */}
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setShowFull(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="expand-outline" size={15} color={color + 'AA'} />
        </TouchableOpacity>

      </View>
      {/* ── End Kinetic Core ─────────────────────────────────────── */}

      {/* Sub-row */}
      <View style={styles.subRow}>
        {surge.taps_to_next > 0 && surge.next_level ? (
          <Text style={styles.subText}>
            {surge.taps_to_next} taps to <Text style={{ color }}>{surge.next_level}</Text>
          </Text>
        ) : (
          <Text style={[styles.subText, { color }]}>ELECTRIC — MAX CHARGE</Text>
        )}
        {bpmNow > 0 && <Text style={styles.subText}>{Math.round(bpmNow)} BPM</Text>}
      </View>

      {/* SURGE ACTIVE 2× CLOUT badge */}
      <Animated.View style={[styles.surgeActiveBadge, surgeBadgeStyle]}>
        <Text style={styles.surgeActiveText}>⚡ SURGE ACTIVE 2× CLOUT</Text>
      </Animated.View>

      {/* Danger callout */}
      {dangerZone && (
        <Animated.View style={dangerTextStyle}>
          <Text style={styles.dangerText}>⚠ Energy dropping — keep it alive!</Text>
        </Animated.View>
      )}

      {/* Stationary nudge */}
      {stationaryNudge && (
        <Text style={styles.stationaryNudge}>
          Move your body 🕺 — Peak energy needs real motion
        </Text>
      )}

      {/* Full-screen charger */}
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
    marginVertical:   12,
    backgroundColor:  '#0A0A12',
    borderRadius:     20,
    borderWidth:      1,
    borderColor:      '#1A1A2C',
    paddingVertical:  16,
    paddingHorizontal: 12,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius:  16,
    elevation:     8,
  },

  // ── Quest bar ────────────────────────────────────────────
  questBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14, paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  questLabel: { fontSize: 10, fontWeight: '700', color: '#FFD60A', letterSpacing: 1.2 },
  questSub:   { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  bpmBadge: {
    alignItems: 'center', backgroundColor: 'rgba(255,214,10,0.1)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  bpmBadgeNum:   { fontSize: 20, fontWeight: '800', color: '#FFD60A', lineHeight: 22 },
  bpmBadgeLabel: { fontSize: 9,  color: '#FFD60A', letterSpacing: 1 },

  // ── Kinetic Core container ───────────────────────────────
  coreContainer: {
    width:     CANVAS_SIZE,
    height:    CANVAS_SIZE,
    alignSelf: 'center',
  },

  // ── Central orb ─────────────────────────────────────────
  orbPressable: {
    position:     'absolute',
    top:          CY - ORB_R,
    left:         CX - ORB_R,
    width:        ORB_R * 2,
    height:       ORB_R * 2,
    borderRadius: ORB_R,
  },
  orb: {
    width:           '100%',
    height:          '100%',
    borderRadius:    ORB_R,
    backgroundColor: 'rgba(10, 10, 18, 0.96)',
    borderWidth:     1.5,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    shadowOffset:    { width: 0, height: 0 },
    elevation:       6,
  },
  flareOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_R,
  },
  tapCount: {
    fontSize: 11,
    color:    'rgba(255,255,255,0.35)',
    marginTop: 2,
  },

  // ── Overlay badges ───────────────────────────────────────
  comboBadge: {
    position: 'absolute', top: 12, right: 12,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  comboText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  surgeBadge: {
    position: 'absolute', bottom: 12, right: 12,
    alignItems: 'center',
  },
  surgeBadgeNum:   { fontSize: 13, fontWeight: '800', lineHeight: 15 },
  surgeBadgeLabel: { fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.2 },

  expandBtn: {
    position: 'absolute', bottom: 14, left: 14,
    opacity: 0.7,
  },

  // ── Sub-row ──────────────────────────────────────────────
  subRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingHorizontal: 4,
  },
  subText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  dangerText: {
    textAlign: 'center', fontSize: 12, color: '#FF3B30',
    fontWeight: '600', marginTop: 6,
  },
  stationaryNudge: {
    textAlign: 'center', fontSize: 11, color: '#FFD60A',
    fontWeight: '600', marginTop: 4, opacity: 0.9,
  },

  // ── Collective Surge UI ──────────────────────────────────
  // Ghost ring: slightly larger than RING_R, centered on canvas, expands outward
  surgeGhostRing: {
    position:     'absolute',
    width:        (RING_R + 14) * 2,
    height:       (RING_R + 14) * 2,
    borderRadius: RING_R + 14,
    borderWidth:  2,
    top:          CY - RING_R - 14,
    left:         CX - RING_R - 14,
    opacity:      0,  // controlled by animation
  },
  surgeActiveBadge: {
    alignSelf:         'center',
    marginTop:          8,
    backgroundColor:   'rgba(255,214,10,0.10)',
    borderRadius:       8,
    borderWidth:        1,
    borderColor:       'rgba(255,214,10,0.38)',
    paddingHorizontal: 12,
    paddingVertical:    5,
    opacity:            0,  // controlled by animation
  },
  surgeActiveText: {
    fontSize:     11,
    fontWeight:  '800',
    color:       '#FFD60A',
    letterSpacing: 1.4,
  },
} as any);
