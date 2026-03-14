/**
 * VibeDynamicIsland — Liquid Metaball Edition
 *
 * Three Skia blobs orbit a center point inside a composited layer.
 * A ColorMatrix alpha-threshold filter fuses their blurred edges into
 * a single high-velocity liquid mass — the classic GPU metaball trick.
 *
 * Viscosity → orbit speed + blur tied to pulse_score:
 *   LOW  energy: blobs drift apart, thick syrupy blur (slow orbit ~3s/cycle)
 *   HIGH energy: blobs fuse into one sharp liquid mass (fast orbit ~700ms/cycle)
 *
 * Gold overflow: when cityChargeActive, gold dust particles spawn at the
 * orb center and drift outward using a JS-thread RAF loop.
 *
 * Haptics: impactHeavy fires on each pulse peak to sync physical vibration
 * with the visual expansion of the orb.
 *
 * VIIBE+ "Obsidian Terminal" skin: grey-silver palette replaces energy colors.
 */
import React, {
  useEffect, useRef, useState, useMemo, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Animated,
} from 'react-native';
import {
  Canvas, Circle, BlurMask, Skia, Group,
  RoundedRect, Paint,
} from '@shopify/react-native-skia';
import {
  useSharedValue, useDerivedValue, withRepeat, withTiming,
  withSequence, useAnimatedReaction, runOnJS, Easing, interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

// ─── Palette ──────────────────────────────────────────────────────────────────

const VIBE_COLORS: Record<string, [string, string]> = {
  QUIET:   ['#1A2A5E', '#0A0A18'],
  CHILL:   ['#0055AA', '#001A44'],
  WARMING: ['#2277FF', '#0044AA'],
  LIT:     ['#9900DD', '#44007A'],
  PEAK:    ['#FFD60A', '#FF0055'],
};

const OBSIDIAN_COLORS: [string, string] = ['#888899', '#222233'];

// Vibe DNA signature → liquid color (overrides energy label color when present)
const DNA_COLORS: Record<string, string> = {
  HIGH_VELOCITY:    '#FF5500',   // Red-Orange — burst energy, bottle service, hype
  STEADY_GROOVE:    '#7700CC',   // Deep Purple — Afrobeats, locked-in dance floor
  ATMOSPHERIC_CHILL: '#00AACC', // Cyan — lounge, conversation, chill energy
};

// ─── Canvas constants ─────────────────────────────────────────────────────────

const CANVAS_W = 80;
const CANVAS_H = 80;
const CX = 40;
const CY = 40;
const OUTER_RING = 34;

// ─── Metaball ColorFilter (4×5 = 20 element matrix) ──────────────────────────
//
// Only the alpha channel is thresholded; RGB passes through unchanged.
// α' = α × 15 + (−6)
// → below α ≈ 0.40: snaps to 0 (transparent gap between separate blobs)
// → above α ≈ 0.47: snaps to 1 (opaque fused liquid mass where blobs overlap)
//
// Blob blur of ~12px creates sufficient feathering for the overlap threshold
// to fire at the correct orbital distance.

const METABALL_MATRIX: number[] = [
  1, 0, 0, 0,   0,
  0, 1, 0, 0,   0,
  0, 0, 1, 0,   0,
  0, 0, 0, 15, -6,
];

// Fixed blob blur — changing blur per-frame is expensive; orbit speed carries
// the viscosity feel. 12px is the sweet spot: fuses at close range, separates cleanly far.
const BLOB_BLUR = 12;

// ─── Gold particle type ───────────────────────────────────────────────────────

interface GoldParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  born: number;
}

let _pid = 0;
const PARTICLE_LIFE_MS = 1000;

// ─── Component ────────────────────────────────────────────────────────────────

interface VibeDynamicIslandProps {
  onPress?: () => void;
}

export function VibeDynamicIsland({ onPress }: VibeDynamicIslandProps) {
  const cityPulse        = useVibeStore(s => s.cityPulse);
  const cityChargeActive = useVibeStore(s => s.cityChargeActive);
  const user             = useVibeStore(s => s.user);
  const isInsideVenue    = useVibeStore(s => s.isInsideVenue);
  const activeVenueName  = useVibeStore(s => s.activeVenueName);

  const isVibePlus   = user?.is_vibe_plus ?? false;
  const label        = cityPulse?.pulse_label ?? 'CHILL';
  const score        = cityPulse?.pulse_score ?? 0;
  const scouts       = cityPulse?.active_scouts ?? 0;
  const dnaSignature = cityPulse?.city_vibe_signature;
  const isOverdrive  = score > 90;

  // DNA color overrides energy label color — VIIBE+ Obsidian overrides both
  // Overdrive (score >90) overrides everything with red-gold
  const innerColor = isVibePlus
    ? OBSIDIAN_COLORS[0]
    : isOverdrive
    ? '#FF4400'
    : (dnaSignature ? DNA_COLORS[dnaSignature] : (VIBE_COLORS[label] ?? VIBE_COLORS.CHILL)[0]);

  // ── Metaball composite layer paint (imperative, Skia.Paint API) ──────────────
  const metaballPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColorFilter(Skia.ColorFilter.MakeMatrix(METABALL_MATRIX));
    return p;
  }, []);

  // ── cityChargeActive as SharedValue (worklet-safe) ───────────────────────────
  const chargeActiveShared = useSharedValue(cityChargeActive ? 1 : 0);
  useEffect(() => {
    chargeActiveShared.value = cityChargeActive ? 1 : 0;
  }, [cityChargeActive]);

  // ── Normalized score 0..1 (drives viscosity + orbit radius) ─────────────────
  const normScore = useSharedValue(score / 100);
  useEffect(() => {
    normScore.value = withTiming(score / 100, { duration: 800 });
  }, [score]);

  // ── Orbit speed: syrupy at low energy, frenetic at high ─────────────────────
  // 3000ms/rev at score 0  →  700ms/rev at score 100
  const orbitDur = useDerivedValue(() =>
    Math.round(interpolate(normScore.value, [0, 1], [3000, 700]))
  );

  const phase = useSharedValue(0);
  useAnimatedReaction(
    () => orbitDur.value,
    (dur) => {
      phase.value = withRepeat(
        withTiming(Math.PI * 2, { duration: dur, easing: Easing.linear }),
        -1, false,
      );
    },
    [],
  );

  // ── Orbit radius: close enough to always partially fuse (10px) at low energy ─
  // Was [18,4] — at 18px with 12px blur, blobs were too far to merge at score 0,
  // giving three isolated dots instead of a liquid mass. 10px keeps them fused.
  const orbitR = useDerivedValue(() =>
    interpolate(normScore.value, [0, 1], [10, 4])
  );

  // ── Blob radius: slightly larger at low energy for always-visible mass ────────
  const blobR = useDerivedValue(() =>
    interpolate(normScore.value, [0, 1], [15, 18])
  );

  // ── Orbiting blob positions (120° apart) ─────────────────────────────────────
  const orb2X = useDerivedValue(() => CX + Math.cos(phase.value) * orbitR.value);
  const orb2Y = useDerivedValue(() => CY + Math.sin(phase.value) * orbitR.value);
  const orb3X = useDerivedValue(() =>
    CX + Math.cos(phase.value + (Math.PI * 2) / 3) * orbitR.value
  );
  const orb3Y = useDerivedValue(() =>
    CY + Math.sin(phase.value + (Math.PI * 2) / 3) * orbitR.value
  );

  // ── Heartbeat pulse (for haptic timing) ──────────────────────────────────────
  // 60 BPM at score 0 → 160 BPM at score 100
  const bpm = useSharedValue(Math.max(60, 60 + score));
  useEffect(() => {
    bpm.value = Math.max(60, 60 + score);
  }, [score]);

  const pulseDur = useDerivedValue(() =>
    Math.max(300, Math.round(60_000 / bpm.value))
  );

  const pulse = useSharedValue(0);
  useAnimatedReaction(
    () => pulseDur.value,
    (dur) => {
      pulse.value = withRepeat(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
    },
    [],
  );

  // ── Haptic: impactHeavy on each pulse peak ───────────────────────────────────
  const triggerHaptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, []);

  useAnimatedReaction(
    () => pulse.value,
    (v, prev) => {
      if (v > 0.95 && (prev ?? 0) <= 0.95) runOnJS(triggerHaptic)();
    },
    [triggerHaptic],
  );

  // ── Charge ring glow (cityChargeActive → gold flash) ─────────────────────────
  const chargeGlow = useSharedValue(0);
  useEffect(() => {
    if (cityChargeActive) {
      chargeGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 350 }),
          withTiming(0.2, { duration: 350 }),
        ),
        -1, false,
      );
    } else {
      chargeGlow.value = withTiming(0, { duration: 400 });
    }
  }, [cityChargeActive]);

  // ── Overdrive: red-gold ring flicker + MAXED label pulse (score > 90) ─────────
  const isOverdriveShared  = useSharedValue(isOverdrive ? 1 : 0);
  const overdriveFlicker   = useSharedValue(0);
  const maxedPulse         = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    isOverdriveShared.value = isOverdrive ? 1 : 0;
    if (isOverdrive) {
      overdriveFlicker.value = withRepeat(
        withSequence(
          withTiming(1,   { duration: 110 }),
          withTiming(0.3, { duration: 170 }),
          withTiming(0.9, { duration: 80  }),
          withTiming(0.1, { duration: 140 }),
        ),
        -1, false,
      );
      Animated.loop(Animated.sequence([
        Animated.timing(maxedPulse, { toValue: 0.25, duration: 280, useNativeDriver: true }),
        Animated.timing(maxedPulse, { toValue: 1,    duration: 280, useNativeDriver: true }),
      ])).start();
    } else {
      overdriveFlicker.value = withTiming(0, { duration: 400 });
      maxedPulse.stopAnimation();
      maxedPulse.setValue(1);
    }
  }, [isOverdrive]);

  const overdriveRingColor = useDerivedValue(() =>
    isOverdriveShared.value > 0
      ? `rgba(255,68,0,${(0.5 + overdriveFlicker.value * 0.5).toFixed(2)})`
      : cityChargeActive
        ? `rgba(255,214,10,${(0.3 + chargeGlow.value * 0.5).toFixed(2)})`
        : innerColor + '44'
  );

  // ── Gold overflow particles (JS-thread RAF) ───────────────────────────────────
  const sparksRef = useRef<GoldParticle[]>([]);
  const rafRef    = useRef<number>(0);
  const [, forceUpdate] = useState(0);

  const tickParticles = useCallback(() => {
    const now = Date.now();

    // Spawn 2 particles per frame when active, cap at 28
    if (cityChargeActive && sparksRef.current.length < 28) {
      const a1 = Math.random() * Math.PI * 2;
      const a2 = a1 + Math.PI + (Math.random() - 0.5) * 1.2;
      const s1 = 0.8 + Math.random() * 1.4;
      const s2 = 0.6 + Math.random() * 1.2;
      sparksRef.current.push(
        {
          id: _pid++,
          x: CX + (Math.random() - 0.5) * 18,
          y: CY + (Math.random() - 0.5) * 18,
          vx: Math.cos(a1) * s1, vy: Math.sin(a1) * s1,
          r: 1.2 + Math.random() * 1.8, born: now,
        },
        {
          id: _pid++,
          x: CX + (Math.random() - 0.5) * 18,
          y: CY + (Math.random() - 0.5) * 18,
          vx: Math.cos(a2) * s2, vy: Math.sin(a2) * s2,
          r: 1.0 + Math.random() * 1.5, born: now,
        },
      );
    }

    // Advance + cull expired
    sparksRef.current = sparksRef.current
      .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy }))
      .filter(p => now - p.born < PARTICLE_LIFE_MS);

    forceUpdate(t => t + 1);

    if (cityChargeActive || sparksRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(tickParticles);
    }
  }, [cityChargeActive]);

  useEffect(() => {
    if (cityChargeActive) {
      rafRef.current = requestAnimationFrame(tickParticles);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [cityChargeActive, tickParticles]);

  // ─── Web fallback — Skia ColorMatrix layer doesn't work on web ───────────────
  // Simple pulsing orb using React Native Animated API.
  const webPulseAnim = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    Animated.loop(Animated.sequence([
      Animated.timing(webPulseAnim, { toValue: 1,   duration: Math.max(300, Math.round(60_000 / Math.max(60, 60 + score))), useNativeDriver: true }),
      Animated.timing(webPulseAnim, { toValue: 0.7, duration: Math.max(300, Math.round(60_000 / Math.max(60, 60 + score))), useNativeDriver: true }),
    ])).start();
  }, [score]);

  if (Platform.OS === 'web') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.wrapper}>
        <View style={styles.webOrbWrap}>
          <Animated.View style={[styles.webOrbRing, { borderColor: innerColor + '55' }]} />
          <Animated.View style={[styles.webOrb, { backgroundColor: innerColor, opacity: webPulseAnim, transform: [{ scale: webPulseAnim }] }]} />
          {cityChargeActive && <View style={styles.webGoldRing} />}
        </View>
        <View style={styles.hud}>
          <Text style={[styles.hudLabel, { color: innerColor }]}>
            {cityChargeActive ? 'CITY ON FIRE' : label}
          </Text>
          {scouts > 0 && <Text style={styles.hudScouts}>{scouts} scouts</Text>}
        </View>
      </TouchableOpacity>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <TouchableOpacity
      onPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress?.();
      }}
      activeOpacity={0.85}
      style={styles.wrapper}
    >
      <Canvas style={styles.canvas}>

        {/* 1. Glass pill background */}
        <RoundedRect x={5} y={5} width={70} height={70} r={18}>
          <Paint color="rgba(255,255,255,0.06)" style="fill" />
          <BlurMask blur={4} style="inner" />
        </RoundedRect>

        {/* 2. Outer ring — overdrive flicker / gold flash / dim ring */}
        <Circle cx={CX} cy={CY} r={OUTER_RING}>
          <Paint
            style="stroke"
            strokeWidth={isOverdrive ? 3 : cityChargeActive ? 2 : 1.5}
            color={overdriveRingColor}
          />
        </Circle>

        {/* 3. Liquid metaball core ─────────────────────────────────────────── */}
        {/* Group with metaballPaint composites the blobs to an offscreen layer  */}
        {/* then applies the alpha-threshold ColorMatrix to fuse their edges.    */}
        <Group layer={metaballPaint}>

          {/* Center blob — stationary; overdrive adds molten gold core on top */}
          <Circle cx={CX} cy={CY} r={blobR} color={innerColor}>
            <BlurMask blur={BLOB_BLUR} style="normal" />
          </Circle>
          {isOverdrive && (
            <Circle cx={CX} cy={CY} r={blobR} color="rgba(255,184,0,0.55)">
              <BlurMask blur={BLOB_BLUR * 0.6} style="normal" />
            </Circle>
          )}

          {/* Orbiting blob 2 */}
          <Circle cx={orb2X} cy={orb2Y} r={blobR} color={innerColor}>
            <BlurMask blur={BLOB_BLUR} style="normal" />
          </Circle>

          {/* Orbiting blob 3 (120° offset) */}
          <Circle cx={orb3X} cy={orb3Y} r={blobR} color={innerColor}>
            <BlurMask blur={BLOB_BLUR} style="normal" />
          </Circle>

        </Group>

        {/* 4. Gold overflow particles (cityChargeActive) */}
        {sparksRef.current.map(p => {
          const life = Math.max(0, 1 - (Date.now() - p.born) / PARTICLE_LIFE_MS);
          return (
            <Circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.r}
              color={`rgba(255,214,10,${life.toFixed(2)})`}
            />
          );
        })}

      </Canvas>

      {/* HUD text */}
      <View style={styles.hud}>
        <Animated.Text style={[
          styles.hudLabel,
          { color: innerColor, opacity: isOverdrive ? maxedPulse : 1 },
        ]}>
          {isOverdrive
            ? 'MAXED'
            : cityChargeActive
            ? 'CITY ON FIRE'
            : isInsideVenue && activeVenueName
            ? activeVenueName.slice(0, 11).toUpperCase()
            : label}
        </Animated.Text>
        {scouts > 0 && !isInsideVenue && (
          <Text style={styles.hudScouts}>{scouts} scouts</Text>
        )}
        {isInsideVenue && !isOverdrive && (
          <Text style={styles.hudScouts}>you're inside</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper:      { alignItems: 'center' },
  canvas:       { width: CANVAS_W, height: CANVAS_H },
  hud:          { alignItems: 'center', marginTop: -4 },
  hudLabel:     { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  hudScouts:    { fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 1 },
  // Web fallback styles
  webOrbWrap:   { width: CANVAS_W, height: CANVAS_H, alignItems: 'center', justifyContent: 'center' },
  webOrbRing:   { position: 'absolute', width: OUTER_RING * 2, height: OUTER_RING * 2, borderRadius: OUTER_RING, borderWidth: 1.5 },
  webOrb:       { width: 36, height: 36, borderRadius: 18 },
  webGoldRing:  { position: 'absolute', width: OUTER_RING * 2 + 8, height: OUTER_RING * 2 + 8, borderRadius: OUTER_RING + 4, borderWidth: 2, borderColor: 'rgba(255,214,10,0.6)' },
} as any);
