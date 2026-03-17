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
import { resolveSkinPalette } from '../config/skins';
import SurgeFullScreen, { SurgeState } from './SurgeFullScreen';
import { useHapticVelocity } from '../hooks/useHapticVelocity';
import { useRetryFetch } from '../hooks/useRetryFetch';
import { useKineticBuffer } from '../hooks/useKineticBuffer';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const CANVAS_SIZE = 300;
const CX          = CANVAS_SIZE / 2;
const CY          = CANVAS_SIZE / 2;
const RING_R      = 130;
const RING_T      = 14;
const ORB_R       = 98;   // inner tap circle radius
const OUTER_R     = 144;  // outer bezel ring (precision dial)
const INNER_R     = 114;  // inner detail ring (depth layer)

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
const DEMO_SURGE: SurgeState = {
  charge_pct: 0.08, level: 'stirring', level_label: 'STIRRING',
  level_color: '#1155EE', level_progress: 0.08, taps_to_next: 3,
  next_level: 'BUZZING', tap_count: 0, total_surges: 0,
};

const DEMO_LEVELS = [
  { level: 'dormant',  label: 'DORMANT',  color: '#1A1040', min: 0,    next: 'STIRRING'  },
  { level: 'stirring', label: 'STIRRING', color: '#1155EE', min: 0.08, next: 'BUZZING'   },
  { level: 'buzzing',  label: 'BUZZING',  color: '#8800EE', min: 0.32, next: 'POPPING'   },
  { level: 'popping',  label: 'POPPING',  color: '#FF6600', min: 0.58, next: 'ELECTRIC'  },
  { level: 'electric', label: 'ELECTRIC', color: '#FF0044', min: 0.84, next: null        },
];

// ── Segmented ring geometry (module-level for worklet access) ──────────────
const SEGMENT_COUNT = 20;
const SEGMENT_SWEEP = 360 / SEGMENT_COUNT;  // 18° per slot
const SEGMENT_ARC   = SEGMENT_SWEEP - 2;    // 16° arc, 2° gap between chambers

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
  skinKey?:          string;   // preset key or 'custom:#RRGGBB'
  onElectric?:       (tapCount: number) => void;
  onReact?:          () => void;
  onQuestSucceeded?: (participants: number) => void;
  onBpmUpdate?:      (bpm: number) => void;
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
    <Text style={{ color, fontSize: 20, fontWeight: '900', letterSpacing: 3 }}>
      {display}
    </Text>
  );
}

// ─── KineticCanvas (Skia) ─────────────────────────────────────────────────────

interface KineticCanvasProps {
  ringProgress: ReturnType<typeof useSharedValue<number>>;
  coreColor:    ReturnType<typeof useDerivedValue<string>>;
  sparks:       Spark[];
  syncPct:      ReturnType<typeof useSharedValue<number>>;
  emberAngle:   ReturnType<typeof useSharedValue<number>>;
  emberColor:   ReturnType<typeof useDerivedValue<string>>;
}

// Level threshold positions on ring (progress 0–1) and their colors
const DIAL_MARKS = [
  { pct: 0.08, color: '#1155EE' },
  { pct: 0.32, color: '#8800EE' },
  { pct: 0.58, color: '#FF6600' },
  { pct: 0.84, color: '#FFD700' },  // ELECTRIC threshold — gold
] as const;

const KineticCanvas = React.memo(function KineticCanvas({
  ringProgress, coreColor, sparks, syncPct, emberAngle, emberColor,
}: KineticCanvasProps) {

  // ── Luxury gold bezel tones ────────────────────────────────────────────────
  const tickDimColor    = useDerivedValue(() => '#C9A84C1A');
  const tickBrightColor = useDerivedValue(() => '#C9A84C44');
  const bezelColor      = useDerivedValue(() => '#C9A84C14');

  // ── Coherence ring ─────────────────────────────────────────────────────────
  const coherenceOpacity = useDerivedValue(() =>
    Math.max(0, (syncPct.value - 15) / 85)
  );
  const coherenceBlur = useDerivedValue(() =>
    interpolate(syncPct.value, [0, 100], [24, 2])
  );
  const coherenceWidth = useDerivedValue(() =>
    interpolate(syncPct.value, [0, 100], [1.5, 4])
  );

  // ── All 20 unlit chamber outlines — always visible, dim gold ──────────────
  const chamberPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      p.addArc(
        { x: CX - RING_R, y: CY - RING_R, width: RING_R * 2, height: RING_R * 2 },
        -90 + i * SEGMENT_SWEEP + 1,
        SEGMENT_ARC,
      );
    }
    return p;
  }, []);

  // ── Filled chamber arcs — charged segments only ───────────────────────────
  const filledPath = useDerivedValue(() => {
    const sweep = ringProgress.value * 360;
    if (sweep < 1) return Skia.Path.Make();
    const p = Skia.Path.Make();
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const slotStart = i * SEGMENT_SWEEP;
      if (slotStart >= sweep) break;
      const fillArc = Math.min(SEGMENT_ARC, sweep - slotStart);
      if (fillArc < 0.5) continue;
      p.addArc(
        { x: CX - RING_R, y: CY - RING_R, width: RING_R * 2, height: RING_R * 2 },
        -90 + slotStart + 1,
        fillArc,
      );
    }
    return p;
  });

  // ── Frontier — the leading (actively filling) segment, hotter glow ────────
  const frontierPath = useDerivedValue(() => {
    const sweep = ringProgress.value * 360;
    if (sweep < 2) return Skia.Path.Make();
    const slot = Math.floor(sweep / SEGMENT_SWEEP);
    if (slot >= SEGMENT_COUNT) return Skia.Path.Make();
    const fillArc = Math.min(SEGMENT_ARC, sweep - slot * SEGMENT_SWEEP);
    if (fillArc < 0.5) return Skia.Path.Make();
    const p = Skia.Path.Make();
    p.addArc(
      { x: CX - RING_R, y: CY - RING_R, width: RING_R * 2, height: RING_R * 2 },
      -90 + slot * SEGMENT_SWEEP + 1,
      fillArc,
    );
    return p;
  });

  // ── Traveling ember — races through charged area, shifts color with level ──
  const emberGlow = useDerivedValue(() => {
    const maxSweep = ringProgress.value * 360;
    if (maxSweep < 10) return Skia.Path.Make();
    const pos = emberAngle.value % maxSweep;
    const a = (-90 + pos) * (Math.PI / 180);
    const p = Skia.Path.Make();
    p.addOval({
      x: CX + RING_R * Math.cos(a) - 10,
      y: CY + RING_R * Math.sin(a) - 10,
      width: 20, height: 20,
    });
    return p;
  });
  const emberCore = useDerivedValue(() => {
    const maxSweep = ringProgress.value * 360;
    if (maxSweep < 10) return Skia.Path.Make();
    const pos = emberAngle.value % maxSweep;
    const a = (-90 + pos) * (Math.PI / 180);
    const p = Skia.Path.Make();
    p.addOval({
      x: CX + RING_R * Math.cos(a) - 3,
      y: CY + RING_R * Math.sin(a) - 3,
      width: 6, height: 6,
    });
    return p;
  });

  // ── Mouth focal diamond — 6 o'clock, where energy converges at ELECTRIC ───
  const mouthMarker = React.useMemo(() => {
    const a  = 90 * (Math.PI / 180);
    const mx = CX + RING_R * Math.cos(a);
    const my = CY + RING_R * Math.sin(a);
    const p  = Skia.Path.Make();
    p.moveTo(mx,     my - 7);
    p.lineTo(mx + 5, my    );
    p.lineTo(mx,     my + 7);
    p.lineTo(mx - 5, my    );
    p.close();
    return p;
  }, []);

  // ── Bezel ticks + threshold diamonds ──────────────────────────────────────
  const { minorTicks, majorTicks, dialMarks } = React.useMemo(() => {
    const minor = Skia.Path.Make();
    const major = Skia.Path.Make();
    const TICK_OUT = OUTER_R - 1;
    for (let i = 0; i < 48; i++) {
      const isMajor = i % 12 === 0;
      const rad = ((i / 48) * 360 - 90) * (Math.PI / 180);
      const inR  = isMajor ? OUTER_R - 10 : OUTER_R - 4;
      const xi = CX + inR      * Math.cos(rad);
      const yi = CY + inR      * Math.sin(rad);
      const xo = CX + TICK_OUT * Math.cos(rad);
      const yo = CY + TICK_OUT * Math.sin(rad);
      (isMajor ? major : minor).moveTo(xi, yi);
      (isMajor ? major : minor).lineTo(xo, yo);
    }
    const marks = DIAL_MARKS.map(({ pct, color }) => {
      const angle = (-90 + pct * 360) * (Math.PI / 180);
      const tx = CX + RING_R * Math.cos(angle);
      const ty = CY + RING_R * Math.sin(angle);
      const p = Skia.Path.Make();
      p.addOval({ x: tx - 4, y: ty - 4, width: 8, height: 8 });
      return { path: p, color };
    });
    return { minorTicks: minor, majorTicks: major, dialMarks: marks };
  }, []);

  return (
    <Canvas style={canvasStyle}>

      {/* ── 1. Outer bezel ring ── */}
      <Circle cx={CX} cy={CY} r={OUTER_R}>
        <Paint style="stroke" strokeWidth={0.75} color={bezelColor} />
      </Circle>

      {/* ── 2. Minor tick marks ── */}
      <Path path={minorTicks}>
        <Paint style="stroke" strokeWidth={1} color={tickDimColor} strokeCap="round" />
      </Path>

      {/* ── 3. Major tick marks ── */}
      <Path path={majorTicks}>
        <Paint style="stroke" strokeWidth={2} color={tickBrightColor} strokeCap="round" />
      </Path>

      {/* ── 4. Ring track — subtle void ── */}
      <Circle cx={CX} cy={CY} r={RING_R}>
        <Paint style="stroke" strokeWidth={RING_T} color="rgba(255,255,255,0.05)" />
      </Circle>

      {/* ── 5. Unlit chamber outlines — dim gold channels ── */}
      <Path path={chamberPath}>
        <Paint style="stroke" strokeWidth={RING_T - 2} strokeCap="butt" color="#C9A84C" opacity={0.07} />
      </Path>

      {/* ── 6. Deep bloom behind charged chambers ── */}
      <Path path={filledPath}>
        <Paint style="stroke" strokeWidth={RING_T + 34} strokeCap="butt" color={coreColor} opacity={0.12}>
          <BlurMask blur={32} style="normal" />
        </Paint>
      </Path>

      {/* ── 7. Mid aura ── */}
      <Path path={filledPath}>
        <Paint style="stroke" strokeWidth={RING_T + 16} strokeCap="butt" color={coreColor} opacity={0.30}>
          <BlurMask blur={20} style="normal" />
        </Paint>
      </Path>

      {/* ── 8. Crisp chamber fill ── */}
      <Path path={filledPath}>
        <Paint style="stroke" strokeWidth={RING_T - 1} strokeCap="butt" color={coreColor} opacity={0.94} />
      </Path>

      {/* ── 9. Frontier leading-edge heat ── */}
      <Path path={frontierPath}>
        <Paint style="stroke" strokeWidth={RING_T + 8} strokeCap="butt" color="#FFFFFF" opacity={0.15}>
          <BlurMask blur={8} style="normal" />
        </Paint>
      </Path>

      {/* ── 10. Level threshold diamonds ── */}
      {dialMarks.map((m, i) => (
        <Path key={i} path={m.path}>
          <Paint color={m.color} opacity={0.75} />
        </Path>
      ))}

      {/* ── 11. Inner depth ring ── */}
      <Circle cx={CX} cy={CY} r={INNER_R}>
        <Paint style="stroke" strokeWidth={0.75} color={bezelColor} />
      </Circle>

      {/* ── 12. Coherence crystalliser — gold sync ring ── */}
      <Circle cx={CX} cy={CY} r={RING_R + 8}>
        <Paint
          style="stroke"
          strokeWidth={coherenceWidth}
          color="#C9A84C"
          opacity={coherenceOpacity}
        >
          <BlurMask blur={coherenceBlur} style="solid" />
        </Paint>
      </Circle>

      {/* ── 13. Ember outer bloom ── */}
      <Path path={emberGlow}>
        <Paint color={emberColor} opacity={0.50}>
          <BlurMask blur={14} style="solid" />
        </Paint>
      </Path>

      {/* ── 14. Ember core ── */}
      <Path path={emberCore}>
        <Paint color={emberColor} opacity={1.0} />
      </Path>

      {/* ── 15. Mouth focal diamond — glow then crisp ── */}
      <Path path={mouthMarker}>
        <Paint color="#C9A84C" opacity={0.35}>
          <BlurMask blur={10} style="normal" />
        </Paint>
      </Path>
      <Path path={mouthMarker}>
        <Paint color="#C9A84C" opacity={0.90} />
      </Path>

      {/* ── 16. Particle sparks ── */}
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
  skinKey,
  onElectric,
  onReact,
  onQuestSucceeded,
  onBpmUpdate,
}: VibeReactorProps) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const socket         = useVibeStore(s => s.socket);
  const user           = useVibeStore(s => s.user);
  const activeSurge    = useVibeStore(s => s.activeSurge);

  // ── Skin palette — shared value so color transitions are smooth ──────────────
  const activeSkin     = skinKey ?? user?.reactor_skin;
  const skinPalette    = useSharedValue<string[]>(resolveSkinPalette(activeSkin));
  useEffect(() => {
    skinPalette.value = resolveSkinPalette(activeSkin);
  }, [activeSkin]);

  // ── Coherence system ─────────────────────────────────────────────────────────
  const { syncPct, isCoherent, recordTap, recordVariance } = useKineticBuffer();
  const syncPctShared   = useSharedValue(0);
  const wasCoherentRef  = useRef(false);

  useEffect(() => {
    syncPctShared.value = withTiming(syncPct, { duration: 600 });
  }, [syncPct]);

  // Haptic + one-shot feedback when crowd first locks in
  useEffect(() => {
    if (isCoherent && !wasCoherentRef.current) {
      wasCoherentRef.current = true;
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 90);
      }
    } else if (!isCoherent) {
      wasCoherentRef.current = false;
    }
  }, [isCoherent]);

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

  // ── BPM-lock tracking ────────────────────────────────────────────────────────
  const recentBpmsRef      = useRef<number[]>([]);
  const bpmLockedRef       = useRef(false);
  const bpmLockTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bpmLocked, setBpmLocked] = useState(false);

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
  const emberAngle       = useSharedValue(0);
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
    interpolateColor(levelIdx.value, [0, 1, 2, 3, 4], skinPalette.value),
  );

  // Ember color: jewel tones per level, turns pure gold at ELECTRIC
  const emberColor = useDerivedValue<string>(() =>
    interpolateColor(levelIdx.value, [0, 1, 2, 3, 4], [
      '#7744CC',  // dormant  — deep violet
      '#3388FF',  // stirring — sapphire
      '#CC55FF',  // buzzing  — amethyst
      '#FFAA00',  // popping  — liquid amber
      '#FFD700',  // electric — pure gold
    ]),
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

  // ── Ember — continuous rotation, speed increases with charge ─────────────────
  useEffect(() => {
    emberAngle.value = withRepeat(
      withTiming(360, { duration: 2800, easing: Easing.linear }),
      -1, false,
    );
  }, []);

  // ── Ring progress + level color + electric glow ──────────────────────────────
  useEffect(() => {
    if (!surge) return;
    ringProgress.value = withSpring(surge.charge_pct, { stiffness: 55, damping: 11 });
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
  }, [surge?.charge_pct, surge?.level]);

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
    if (bpmLockTimerRef.current) clearTimeout(bpmLockTimerRef.current);
    cancelAnimationFrame(rafRef.current);
    windowGForces.current   = [];
    windowTapCount.current  = 0;
    windowPeakCount.current = 0;
  }, []);

  // ── Tap handler ──────────────────────────────────────────────────────────────
  const handleTap = useCallback(async () => {
    onReact?.();

    const intensity = getIntensity();
    const gForce    = getGForce();
    recordTap(gForce);   // G-force weighted personal rhythm — fires immediately
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

    // Update BPM shared value for orb pulse + oscillator
    bpmShared.value = Math.round(bpm);
    onBpmUpdate?.(Math.round(bpm));

    // ── BPM-lock: stable within ±8 BPM for last 4 readings ──────────────────
    if (bpm > 40) {
      recentBpmsRef.current.push(Math.round(bpm));
      if (recentBpmsRef.current.length > 5) recentBpmsRef.current = recentBpmsRef.current.slice(-5);
      if (recentBpmsRef.current.length >= 4) {
        const range     = Math.max(...recentBpmsRef.current) - Math.min(...recentBpmsRef.current);
        const nowLocked = range <= 8;
        if (nowLocked && !bpmLockedRef.current && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        bpmLockedRef.current = nowLocked;
        setBpmLocked(nowLocked);
        // Auto-unlock 8 s after the last tap if still locked
        clearTimeout(bpmLockTimerRef.current ?? undefined);
        if (nowLocked) {
          bpmLockTimerRef.current = setTimeout(() => {
            bpmLockedRef.current = false;
            setBpmLocked(false);
            recentBpmsRef.current = [];
          }, 8000);
        }
      }
    }

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

        // Compute tap_variance: std dev of inter-tap intervals (seconds)
        // within the LOCAL_COOLDOWN_MS window. Used by VibeSignature classifier.
        const windowNow  = Date.now();
        const recentTaps = tapTimestamps.current.filter(ts => windowNow - ts < LOCAL_COOLDOWN_MS);
        let tapVariance  = 1.0; // default = ATMOSPHERIC_CHILL / unknown
        if (recentTaps.length >= 3) {
          const diffs    = recentTaps.slice(1).map((ts, i) => (ts - recentTaps[i]) / 1000);
          const meanDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
          tapVariance    = Math.round(
            Math.sqrt(diffs.reduce((sum, d) => sum + (d - meanDiff) ** 2, 0) / diffs.length) * 1000
          ) / 1000;
        }

        // Feed variance into coherence buffer → drives the sync ring
        recordVariance(tapVariance);

        socket?.emit('vibe_pulse', {
          venue_id:   venueId, user_id: user?.id,
          tap_count:  windowTapCount.current,
          peak_count: windowPeakCount.current,
          avg_g_force: Math.round(avgG * 100) / 100,
          max_bpm:     windowMaxBpm.current,
          intensity:   peakRatio > 0.5 ? 'power' : 'soft',
          ui_increment: windowTapCount.current,
          stationary_peak_abuse: stationaryPeakAbuse,
          tap_variance: tapVariance,
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
    onReact, getIntensity, getGForce, fireHaptic, spawnSparks, recordTap,
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

      {/* ── Atmospheric backdrop ─────────────────────────────── */}
      <LinearGradient
        colors={[color + '26', 'transparent', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          left: -16,
          right: -16,
          height: 340,
          top: 0,
          zIndex: 0,
        }}
      />

      {/* ── Kinetic Core ─────────────────────────────────────────── */}
      <View style={[styles.coreContainer, { zIndex: 1 }]}>

        {/* Skia: ring track + progress arc + coherence ring + sparks */}
        <KineticCanvas
          ringProgress={ringProgress}
          coreColor={coreColor}
          sparks={sparksRef.current}
          syncPct={syncPctShared}
          emberAngle={emberAngle}
          emberColor={emberColor}
        />

        {/* SYNC chip — personal rhythm or crowd lock, narrative label */}
        {syncPct > 18 && (
          <View style={[
            styles.syncChip,
            {
              borderColor:     syncPct >= 65 ? '#00FFCC' : '#00FFCC44',
              backgroundColor: syncPct >= 65 ? 'rgba(0,255,204,0.12)' : 'rgba(0,255,204,0.04)',
            },
          ]}>
            <Text style={[styles.syncChipText, { color: syncPct >= 65 ? '#00FFCC' : '#00FFCC77' }]}>
              {syncPct >= 65
                ? bpmLocked ? '⬡ LOCKED IN' : '⬡ IN SYNC'
                : syncPct >= 40
                ? '◈ IN THE ZONE'
                : '◇ FINDING RHYTHM'}
            </Text>
          </View>
        )}

        {/* Ghost surge ring — secondary pulse offset from main ring */}
        <Animated.View style={[styles.surgeGhostRing, surgeRingStyle, { borderColor: color }]} />

        {/* Central orb (tap target) */}
        <Pressable onPress={handleTap} style={styles.orbPressable}>
          <Animated.View style={[
            styles.orb,
            orbStyle,
            {
              shadowColor:   color,
              shadowOpacity: isElectric ? 0.9 : 0.5,
              shadowRadius:  isElectric ? 28 : 14,
              borderColor:   color + '55',
            },
          ]}>
            {/* Diagonal color wash */}
            <LinearGradient
              colors={[color + '28', 'transparent', 'rgba(0,0,0,0.20)']}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Specular highlight — metallic glass illusion */}
            <View style={styles.orbSpecular} />
            <View style={styles.orbSpecularCore} />

            {/* Peak flare */}
            <Animated.View style={[
              styles.flareOverlay,
              flareStyle,
              { backgroundColor: color + '28' },
            ]} />

            {/* Bolt */}
            <Animated.View style={boltStyle}>
              <Ionicons name="flash" size={60} color={color} />
            </Animated.View>

            {/* Level text — glitches on transition */}
            <GlitchText text={surge.level_label} color={color} />

            {/* Tap count */}
            <Text style={[styles.tapCount, { color: color + '99' }]}>{displayTaps}</Text>
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
        syncPct={syncPctShared}
        syncPctValue={syncPct}
        bpmLocked={bpmLocked}
        questState={questState}
        bpmNow={bpmNow}
      />
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerWrap: {
    marginHorizontal: 16,
    marginVertical:   12,
    backgroundColor:  'transparent',
    borderRadius:     20,
    borderWidth:      0,
    borderColor:      'transparent',
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
    backgroundColor: 'rgba(4, 4, 12, 0.98)',
    borderWidth:     0.75,
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

  // Metallic glass specular highlights — two overlapping ellipses top-left
  orbSpecular: {
    position:        'absolute',
    top:             14,
    left:            20,
    width:           58,
    height:          28,
    borderRadius:    18,
    backgroundColor: 'rgba(255,255,255,0.055)',
    transform:       [{ rotate: '-22deg' }],
  },
  orbSpecularCore: {
    position:        'absolute',
    top:             18,
    left:            30,
    width:           26,
    height:          12,
    borderRadius:    9,
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform:       [{ rotate: '-22deg' }],
  },
  tapCount: {
    fontSize: 16,
    color:    'transparent',  // overridden inline with accent color
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
  surgeBadgeLabel: { fontSize: 7, color: 'rgba(160,155,200,0.40)', letterSpacing: 1.2 },

  expandBtn: {
    position: 'absolute', bottom: 14, left: 14,
    opacity: 0.7,
  },

  // ── Sub-row ──────────────────────────────────────────────
  subRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingHorizontal: 4,
  },
  subText: { fontSize: 13, color: 'rgba(160,155,200,0.70)', fontWeight: '600' },

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
  // ── Coherence ring chip ──────────────────────────────────
  syncChip: {
    position:          'absolute',
    top:                8,
    alignSelf:         'center',
    left:              '50%',
    marginLeft:        -36,
    borderRadius:       8,
    borderWidth:        1,
    paddingHorizontal:  8,
    paddingVertical:    3,
  },
  syncChipText: {
    fontSize:      9,
    fontWeight:   '800',
    letterSpacing: 1.4,
  },
} as any);
