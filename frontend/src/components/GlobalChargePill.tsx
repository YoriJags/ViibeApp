/**
 * GlobalChargePill — Persistent bottom-of-screen kinetic indicator.
 *
 * Minimized state: glowing pill showing tracked venue's surge level.
 *                  Sparks gold when cityChargeActive or followed venue hits LIT.
 *
 * Expanded state:  Spring-animated modal overlay that expands from the pill
 *                  position — simulating a shared-element transition into
 *                  the full Kinetic Core.
 *
 * Lives in MainLayout so it persists across all tab screens.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable, Platform, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue,
  withSpring, withTiming, withRepeat, withSequence,
  interpolate, interpolateColor, Extrapolation, Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  Canvas, Circle, BlurMask, RadialGradient, vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';
import VibeReactor from './VibeReactor';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Level index map for color interpolation
const LEVEL_INDICES: Record<string, number> = {
  dormant: 0, stirring: 1, buzzing: 2, popping: 3, electric: 4,
};
const LEVEL_PALETTE = ['#3A3A4E', '#5544FF', '#AA00FF', '#FF7700', '#FF0055'];

// Surge state shape (minimal — only what the pill needs)
interface PillSurge {
  level:       string;
  level_label: string;
  level_color: string;
  charge_pct:  number;
}

// ─── Mini Skia orb (24×24) ────────────────────────────────────────────────────

function MiniOrb({ color, pulse }: { color: string; pulse: ReturnType<typeof useSharedValue<number>> }) {
  const CX = 12; const CY = 12;
  const r  = useDerivedValue(() => 7 + pulse.value * 3);
  const br = useDerivedValue(() => 10 + pulse.value * 5);

  return (
    <Canvas style={{ width: 24, height: 24 }}>
      <Circle cx={CX} cy={CY} r={br}>
        <BlurMask blur={6} style="normal" />
        <RadialGradient c={vec(CX, CY)} r={br} colors={[color + '55', color + '00']} />
      </Circle>
      <Circle cx={CX} cy={CY} r={r}>
        <RadialGradient c={vec(CX, CY)} r={r} colors={[color, color + '88']} />
      </Circle>
    </Canvas>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GlobalChargePill() {
  const cityChargeActive = useVibeStore(s => s.cityChargeActive);
  const cityPulse        = useVibeStore(s => s.cityPulse);
  const venues           = useVibeStore(s => s.venues);
  const followedVenues   = useVibeStore(s => s.followedVenues ?? []);
  const isInsideVenue    = useVibeStore(s => s.isInsideVenue);
  const activeVenueId    = useVibeStore(s => s.activeVenueId);
  const activeVenueName  = useVibeStore(s => s.activeVenueName);
  const user             = useVibeStore(s => s.user);

  const router = useRouter();

  const [surge,       setSurge]       = useState<PillSurge | null>(null);
  const [expanded,    setExpanded]    = useState(false);
  const [sparkActive, setSparkActive] = useState(false);

  // ── Check if a followed venue just hit LIT+ ──────────────────────────────────
  useEffect(() => {
    const litVenue = venues.find(
      v => followedVenues.includes(v.id) &&
           ['lit', 'peak'].includes(v.energy_level) &&
           v.id !== activeVenueId,
    );
    if (litVenue) {
      setSparkActive(true);
    }
  }, [venues, followedVenues, activeVenueId]);

  // ── Fetch surge for active venue ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeVenueId) { setSurge(null); return; }
    fetch(`${API_URL}/api/venues/${activeVenueId}/surge`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSurge(d))
      .catch(() => {});
  }, [activeVenueId]);

  // ── Shared values ─────────────────────────────────────────────────────────────
  const levelIdx    = useSharedValue(1);
  const pulseAnim   = useSharedValue(0);
  const pillScale   = useSharedValue(1);
  const sparkGlow   = useSharedValue(0);
  const expandProg  = useSharedValue(0);   // 0 = pill, 1 = full modal

  // Level color
  const coreColor = useDerivedValue<string>(() =>
    interpolateColor(levelIdx.value, [0, 1, 2, 3, 4], LEVEL_PALETTE),
  );

  // ── Update level index when surge changes ─────────────────────────────────────
  useEffect(() => {
    if (!surge) return;
    levelIdx.value = withTiming(LEVEL_INDICES[surge.level] ?? 1, { duration: 500 });
  }, [surge?.level]);

  // ── Continuous orb breathe ────────────────────────────────────────────────────
  useEffect(() => {
    const rate = cityChargeActive ? 350 : 1100;
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: rate, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [cityChargeActive]);

  // ── Spark effect when followed venue hits LIT ─────────────────────────────────
  useEffect(() => {
    if (!sparkActive) {
      cancelAnimation(sparkGlow);
      sparkGlow.value = withTiming(0, { duration: 400 });
      return;
    }
    sparkGlow.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 200 }),
        withTiming(0.2, { duration: 200 }),
      ),
      6,   // 6 flashes then stop
      false,
    );
    setTimeout(() => setSparkActive(false), 2500);
  }, [sparkActive]);

  // ── Pill press ────────────────────────────────────────────────────────────────
  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (activeVenueId) {
      // Animate pill scale down then expand modal
      pillScale.value = withSequence(
        withTiming(0.88, { duration: 80 }),
        withSpring(1,    { stiffness: 200, damping: 14 }),
      );
      setExpanded(true);
    } else if (cityPulse) {
      router.push('/(tabs)/trending' as any);
    }
  }, [activeVenueId, cityPulse]);

  const handleClose = () => {
    setExpanded(false);
  };

  // ── Animated styles ───────────────────────────────────────────────────────────
  const pillStyle = useAnimatedStyle(() => {
    const glow = sparkActive
      ? interpolate(sparkGlow.value, [0, 1], [0, 1], Extrapolation.CLAMP)
      : 0;
    const cityGlow = cityChargeActive
      ? interpolate(pulseAnim.value, [0, 1], [0.3, 0.9], Extrapolation.CLAMP)
      : 0.15;

    return {
      transform:    [{ scale: pillScale.value }],
      borderColor:  sparkActive
        ? `rgba(255,214,10,${glow * 0.8})`
        : cityChargeActive
        ? `rgba(255,153,0,${cityGlow})`
        : coreColor.value + '44',
      shadowColor:  sparkActive ? '#FFD60A' : coreColor.value,
      shadowRadius: 8 + interpolate(pulseAnim.value, [0, 1], [0, 6], Extrapolation.CLAMP),
      shadowOpacity: 0.6,
    };
  });

  // Don't render if no venue and city pulse isn't ready
  if (!isInsideVenue && !cityPulse) return null;

  const displayLabel  = surge?.level_label ?? cityPulse?.pulse_label ?? 'CHILL';
  const displayColor  = surge?.level_color ?? '#5544FF';
  const displayVenue  = activeVenueName ?? cityPulse?.city ?? '';

  return (
    <>
      {/* ── Minimized pill ───────────────────────────────────── */}
      <Animated.View style={[styles.pill, pillStyle]}>
        <TouchableOpacity
          onPress={handlePress}
          activeOpacity={0.85}
          style={styles.pillInner}
        >
          {/* Mini orb */}
          <MiniOrb color={displayColor} pulse={pulseAnim} />

          {/* Labels */}
          <View style={styles.pillTextWrap}>
            <Text style={[styles.pillLevel, { color: displayColor }]}>
              {displayLabel}
            </Text>
            {displayVenue ? (
              <Text style={styles.pillVenue} numberOfLines={1}>
                {displayVenue}
              </Text>
            ) : null}
          </View>

          {/* City on fire badge */}
          {cityChargeActive && (
            <View style={styles.fireBadge}>
              <Text style={styles.fireBadgeText}>🔥</Text>
            </View>
          )}

          {/* Spark indicator */}
          {sparkActive && (
            <Animated.View style={[styles.sparkDot, { opacity: sparkGlow }]}>
              <Text style={styles.sparkDotText}>✦</Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* ── Expanded modal (spring from pill → full screen) ──── */}
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <Animated.View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeVenueName ?? 'Kinetic Core'}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Full VibeReactor */}
            {activeVenueId && (
              <VibeReactor
                venueId={activeVenueId}
                venueName={activeVenueName ?? ''}
                isDemoMode={!user?.id}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    position:        'absolute',
    bottom:          90,    // above tab bar
    alignSelf:       'center',
    backgroundColor: 'rgba(10,10,18,0.92)',
    borderRadius:    28,
    borderWidth:     1.5,
    shadowOffset:    { width: 0, height: 0 },
    elevation:       10,
    overflow:        'hidden',
  },
  pillInner: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  pillTextWrap: {
    flexShrink: 1,
  },
  pillLevel: {
    fontSize:    11,
    fontWeight:  '800',
    letterSpacing: 1.2,
  },
  pillVenue: {
    fontSize:  9,
    color:     'rgba(255,255,255,0.35)',
    maxWidth:  100,
  },
  fireBadge: {
    backgroundColor: 'rgba(255,153,0,0.15)',
    borderRadius:    8,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  fireBadgeText: { fontSize: 12 },
  sparkDot: {
    position: 'absolute',
    top: -4, right: -4,
  },
  sparkDotText: {
    fontSize: 12,
    color: '#FFD60A',
  },

  // ── Modal ─────────────────────────────────────────────────
  modalBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent:  'flex-end',
  },
  modalCard: {
    backgroundColor: '#0A0A12',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderWidth:  1,
    borderColor:  '#1A1A2C',
    paddingBottom: 32,
    paddingTop:    16,
    minHeight:     SCREEN_H * 0.55,
  },
  modalHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom:   8,
  },
  modalTitle: {
    fontSize:     16,
    fontWeight:   '700',
    color:        '#EEEEF5',
    letterSpacing: 0.4,
  },
  closeBtn: {
    padding: 6,
    opacity: 0.6,
  },
  closeBtnText: {
    fontSize:   16,
    color:      '#EEEEF5',
    fontWeight: '600',
  },
} as any);
