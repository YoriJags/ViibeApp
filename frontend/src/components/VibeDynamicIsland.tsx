/**
 * VibeDynamicIsland — Kinetic StatusBar for the homepage.
 *
 * Free for all users. Lives at the top of the app like a Dynamic Island.
 * Pulses with the city's real-time energy. VIIBE+ unlocks the
 * "Obsidian Terminal" skin (dark etched-glass aesthetic + custom haptic profile).
 *
 * Fixes applied to the original snippet:
 *   • useComputedValue (deprecated) → useDerivedValue from Reanimated
 *   • vec2() → vec() from @shopify/react-native-skia
 *   • RadialGradient r accepts number, not a vec2
 *   • pulseDuration restart handled via useAnimatedReaction (worklet-safe)
 *   • Store selector uses correct flat slice path
 */
import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import {
  Canvas, RoundedRect, Circle, Paint, BlurMask,
  RadialGradient, vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue, useDerivedValue,
  withRepeat, withTiming, withSequence,
  useAnimatedReaction, runOnJS,
  Easing,
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

const OBSIDIAN_COLORS: [string, string] = ['#888899', '#222233']; // VIIBE+ skin

const CX = 40;
const CY = 40;
const BASE_ORB_R  = 18;
const OUTER_RING_R = 34;

// ─── Component ────────────────────────────────────────────────────────────────

interface VibeDynamicIslandProps {
  onPress?: () => void;
}

export function VibeDynamicIsland({ onPress }: VibeDynamicIslandProps) {
  const cityPulse        = useVibeStore(s => s.cityPulse);
  const cityChargeActive = useVibeStore(s => s.cityChargeActive);
  const user             = useVibeStore(s => s.user);

  const isVibePlus = user?.is_vibe_plus ?? false;
  const label      = cityPulse?.pulse_label ?? 'CHILL';
  const score      = cityPulse?.pulse_score ?? 0;
  const scouts     = cityPulse?.active_scouts ?? 0;

  const [innerColor, outerColor] = isVibePlus
    ? OBSIDIAN_COLORS
    : (VIBE_COLORS[label] ?? VIBE_COLORS.CHILL);

  // ── Pulse speed derived from score (higher score = faster beat) ──────────────
  // 60 BPM equiv at score 0 → 160 BPM equiv at score 100
  const currentBpm = useSharedValue(Math.max(60, 60 + score));

  useEffect(() => {
    currentBpm.value = Math.max(60, 60 + score);
  }, [score]);

  // pulse duration in ms: 60 BPM = 1000ms, 120 BPM = 500ms
  const pulseDuration = useDerivedValue(() =>
    Math.max(300, Math.round(60_000 / currentBpm.value)),
  );

  // ── Animation progress (0 → 1 → 0, repeating) ───────────────────────────────
  const pulse = useSharedValue(0);

  // Restart withRepeat when pulse duration changes (worklet-safe)
  useAnimatedReaction(
    () => pulseDuration.value,
    (dur) => {
      pulse.value = withRepeat(
        withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        -1, true,
      );
    },
    [],
  );

  // ── Animated orb radius: BASE_ORB_R → BASE_ORB_R + 7 ───────────────────────
  const orbRadius = useDerivedValue(() =>
    BASE_ORB_R + pulse.value * 7,
  );

  // ── Shadow bloom: BASE_ORB_R*1.4 → BASE_ORB_R*2.2 ───────────────────────────
  const bloomRadius = useDerivedValue(() =>
    BASE_ORB_R * 1.4 + pulse.value * (BASE_ORB_R * 0.8),
  );

  // ── cityChargeActive: ring sparks gold ──────────────────────────────────────
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

  const ringOpacity = useDerivedValue(() =>
    cityChargeActive ? 0.3 + chargeGlow.value * 0.5 : 0.25,
  );

  const handlePress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={styles.wrapper}
    >
      {/* ── Skia Canvas ──────────────────────────────────────── */}
      <Canvas style={styles.canvas}>

        {/* 1. Glass HUD background */}
        <RoundedRect x={5} y={5} width={70} height={70} r={18}>
          <Paint color="rgba(255,255,255,0.07)" style="fill" />
          <BlurMask blur={4} style="inner" />
        </RoundedRect>

        {/* 2. Outer glowing ring */}
        <Circle cx={CX} cy={CY} r={OUTER_RING_R}>
          <Paint
            style="stroke"
            strokeWidth={cityChargeActive ? 2 : 1.5}
            color={cityChargeActive ? `rgba(255,214,10,${ringOpacity.value})` : innerColor + '44'}
          />
        </Circle>

        {/* 3. Shadow bloom glow (wide, blurred) */}
        <Circle cx={CX} cy={CY} r={bloomRadius}>
          <BlurMask blur={14} style="normal" />
          <RadialGradient
            c={vec(CX, CY)}
            r={bloomRadius}
            colors={[innerColor + '55', innerColor + '00']}
          />
        </Circle>

        {/* 4. Pulsing kinetic core orb */}
        <Circle cx={CX} cy={CY} r={orbRadius}>
          <RadialGradient
            c={vec(CX, CY)}
            r={orbRadius}
            colors={[innerColor, outerColor]}
          />
        </Circle>

        {/* 5. City charge spark ring (VIIBE+ aesthetic: gold ring when active) */}
        {cityChargeActive && (
          <Circle cx={CX} cy={CY} r={OUTER_RING_R - 6}>
            <Paint
              style="stroke"
              strokeWidth={1}
              color={`rgba(255,214,10,${chargeGlow.value * 0.6})`}
            />
          </Circle>
        )}

      </Canvas>

      {/* ── Text HUD (below canvas) ──────────────────────────── */}
      <View style={styles.hud}>
        <Text style={[styles.hudLabel, { color: innerColor }]}>
          {cityChargeActive ? 'CITY ON FIRE' : label}
        </Text>
        {scouts > 0 && (
          <Text style={styles.hudScouts}>{scouts} scouts</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  canvas: {
    width: 80,
    height: 80,
  },
  hud: {
    alignItems: 'center',
    marginTop: -4,
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  hudScouts: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 1,
  },
} as any);
