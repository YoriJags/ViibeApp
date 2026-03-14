/**
 * VibeOscillator — VIBE+ exclusive live scene frequency visualizer.
 *
 * Driven entirely by real venue data (no microphone):
 *   bpmShared    → animation speed / wave spatial frequency
 *   vibeScore    → bar height ceiling / wave amplitude
 *   surgeValue   → explosive multiplier (1.0 normal → 1.8 surge → 1.0 settle)
 *
 * Three modes:
 *   BARS  — 24 equalizer bars as a single batched Skia Path (performance-first)
 *   WAVE  — Sine path: frequency = bpm/600 spatial, amplitude = vibeScore
 *   PULSE — 3 concentric animated rings expanding from center
 *
 * VIBE+ gate: expo-blur overlay + lock badge. Tap → onUnlockPress().
 *
 * All math runs inside useDerivedValue (UI thread, zero JS overhead).
 */
import React, { useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import { Canvas, Group, Path, Circle, Rect, Skia } from '@shopify/react-native-skia';
import {
  useSharedValue, useDerivedValue,
  withRepeat, withTiming, withSequence, withSpring,
  SharedValue,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CANVAS_W  = SCREEN_W - 32;
const CANVAS_H  = 160;
const BAR_COUNT = 24;
const BAR_W     = 7;
const BAR_TOTAL = BAR_COUNT * BAR_W;
const BAR_GAP   = (CANVAS_W - BAR_TOTAL) / (BAR_COUNT + 1);
const MID_Y     = CANVAS_H / 2;

// Energy color derived from score (mirrors venue/[id].tsx)
function energyColor(score: number): string {
  if (score >= 85) return '#FF3366';
  if (score >= 65) return '#FF9933';
  if (score >= 45) return '#9933FF';
  if (score >= 20) return '#3399FF';
  return '#555E6E';
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VibeOscillatorProps {
  bpmShared:    SharedValue<number>;
  vibeScore:    SharedValue<number>;
  surgeValue:   SharedValue<number>;
  isPlus:       boolean;
  mode?:        'BARS' | 'WAVE' | 'PULSE';
  onUnlockPress?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VibeOscillator({
  bpmShared,
  vibeScore,
  surgeValue,
  isPlus,
  mode = 'BARS',
  onUnlockPress,
}: VibeOscillatorProps) {

  // ── Clock: 0 → 2π loop, drives all sine animations ──────────────────────
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 1800 }),
      -1,
      false,
    );
  }, []);

  // Pulse rings phase clocks (offset so they don't overlap)
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);
  useEffect(() => {
    p1.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false);
    p2.value = withRepeat(withTiming(1, { duration: 1800, easing: undefined }), -1, false);
    p3.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false);
    // Stagger: imperatively set start offset
    setTimeout(() => { p2.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false); }, 600);
    setTimeout(() => { p3.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false); }, 1200);
  }, []);

  // ── BARS: all 24 bars as one Skia path ───────────────────────────────────
  const barsPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const surge = surgeValue.value;
    for (let i = 0; i < BAR_COUNT; i++) {
      const x      = BAR_GAP + i * (BAR_W + BAR_GAP);
      const base   = (vibeScore.value / 100) * (CANVAS_H * 0.70);
      // Each bar has a unique phase offset — creates organic FFT-like spread
      const spread = Math.sin(clock.value + i * 0.75) * (CANVAS_H * 0.18);
      const h      = Math.max(4, (base + spread) * surge);
      const y      = CANVAS_H - h;
      p.addRect(Skia.XYWHRect(x, y, BAR_W, h));
    }
    return p;
  });

  // ── WAVE: sine path driven by bpm + vibeScore ────────────────────────────
  const wavePath = useDerivedValue(() => {
    const p         = Skia.Path.Make();
    const amplitude = (vibeScore.value / 100) * 45 * surgeValue.value;
    const frequency = bpmShared.value / 600;   // spatial frequency across canvas
    p.moveTo(0, MID_Y);
    for (let x = 0; x <= CANVAS_W; x += 3) {
      const y = MID_Y + Math.sin(x * frequency + clock.value) * amplitude;
      p.lineTo(x, y);
    }
    return p;
  });

  // ── PULSE: ring radius per phase clock ───────────────────────────────────
  const maxR   = (vibeScore.value / 100) * 65 + 15;
  const ring1R = useDerivedValue(() => p1.value * maxR * surgeValue.value);
  const ring2R = useDerivedValue(() => p2.value * maxR * surgeValue.value);
  const ring3R = useDerivedValue(() => p3.value * maxR * surgeValue.value);
  const ring1O = useDerivedValue(() => 1 - p1.value);
  const ring2O = useDerivedValue(() => 1 - p2.value);
  const ring3O = useDerivedValue(() => 1 - p3.value);

  // ── Color: shifts live with vibeScore ────────────────────────────────────
  // Static snapshot for Skia color string — updates on re-render from socket
  const color = energyColor(vibeScore.value);

  return (
    <View style={styles.wrapper}>
      <Canvas style={{ width: CANVAS_W, height: CANVAS_H }}>
        {/* Dark base */}
        <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} color="#05050A" />

        <Group>
          {/* BARS */}
          {mode === 'BARS' && (
            <Path path={barsPath} color={color} style="fill" />
          )}

          {/* WAVE */}
          {mode === 'WAVE' && (
            <Path
              path={wavePath}
              style="stroke"
              strokeWidth={2.5}
              strokeCap="round"
              strokeJoin="round"
              color={color}
            />
          )}

          {/* PULSE */}
          {mode === 'PULSE' && (
            <>
              <Circle cx={CANVAS_W / 2} cy={MID_Y} r={ring1R} color={color + '60'} style="stroke" strokeWidth={2} opacity={ring1O} />
              <Circle cx={CANVAS_W / 2} cy={MID_Y} r={ring2R} color={color + '40'} style="stroke" strokeWidth={1.5} opacity={ring2O} />
              <Circle cx={CANVAS_W / 2} cy={MID_Y} r={ring3R} color={color + '22'} style="stroke" strokeWidth={1} opacity={ring3O} />
              {/* Center dot */}
              <Circle cx={CANVAS_W / 2} cy={MID_Y} r={4} color={color} />
            </>
          )}
        </Group>
      </Canvas>

      {/* VIBE+ gate — expo-blur overlay, reliable across all RN versions */}
      {!isPlus && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {Platform.OS !== 'web' ? (
            <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.webBlur]} />
          )}
          <TouchableOpacity
            style={styles.gateOverlay}
            onPress={onUnlockPress}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['rgba(5,5,10,0.55)', 'rgba(5,5,10,0.80)']}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="lock-closed" size={18} color="#FFD700" />
            <Text style={styles.gateLabel}>◆ VIBE+ EXCLUSIVE</Text>
            <Text style={styles.gateSubLabel}>UNLOCK SCENE INTELLIGENCE</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Surge helper — call from parent on venue_surge socket event ─────────────
// Usage: triggerOscillatorSurge(surgeValueRef)
export function triggerOscillatorSurge(surgeValue: SharedValue<number>) {
  'worklet';
  surgeValue.value = withSequence(
    withSpring(1.8, { damping: 4, stiffness: 150 }),   // explosive pop
    withSpring(1.0, { damping: 12, stiffness: 100 }),  // smooth settle
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  webBlur: {
    backgroundColor: 'rgba(5,5,10,0.75)',
  },
  gateOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  gateLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 2,
  },
  gateSubLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,215,0,0.5)',
    letterSpacing: 1.5,
  },
});
