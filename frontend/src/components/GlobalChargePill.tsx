/**
 * GlobalChargePill — Floating draggable reactor shortcut.
 *
 * Floats over all screens. Drag anywhere, snaps to nearest edge on release.
 * Tap → opens VibeReactor modal for the active venue.
 *
 * Shows: surge level label + animated orb when inside a venue.
 * Shows: city pulse label when not inside a venue.
 */
import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  Modal, Pressable, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue,
  withSpring, withTiming, withRepeat, withSequence,
  interpolate, interpolateColor, Extrapolation, Easing,
  cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Canvas, Circle, BlurMask, RadialGradient, vec,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import VibeReactor from './VibeReactor';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const PILL_W    = 110;
const PILL_H    = 44;
const EDGE_PAD  = 16;
const INIT_X    = SCREEN_W - PILL_W - EDGE_PAD;
const INIT_Y    = SCREEN_H - 180;

const LEVEL_INDICES: Record<string, number> = {
  dormant: 0, stirring: 1, buzzing: 2, popping: 3, electric: 4,
};
const LEVEL_PALETTE = ['#3A3A4E', '#5544FF', '#AA00FF', '#FF7700', '#FF0055'];

interface PillSurge {
  level:       string;
  level_label: string;
  level_color: string;
  charge_pct:  number;
}

// ─── Mini Skia orb ────────────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GlobalChargePill() {
  const cityPulse      = useVibeStore(s => s.cityPulse);
  const cityChargeActive = useVibeStore(s => s.cityChargeActive);
  const venues         = useVibeStore(s => s.venues);
  const followedVenues = useVibeStore(s => s.followedVenues ?? []);
  const isInsideVenue  = useVibeStore(s => s.isInsideVenue);
  const activeVenueId  = useVibeStore(s => s.activeVenueId);
  const activeVenueName = useVibeStore(s => s.activeVenueName);
  const user           = useVibeStore(s => s.user);

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  const [surge,       setSurge]       = useState<PillSurge | null>(null);
  const [expanded,    setExpanded]    = useState(false);
  const [sparkActive, setSparkActive] = useState(false);

  // ── Position shared values ─────────────────────────────────────────────────
  const posX    = useSharedValue(INIT_X);
  const posY    = useSharedValue(INIT_Y);
  const savedX  = useSharedValue(INIT_X);
  const savedY  = useSharedValue(INIT_Y);
  const dragScale = useSharedValue(1);
  const isDragging = useSharedValue(false);

  // ── Animation shared values ────────────────────────────────────────────────
  const levelIdx  = useSharedValue(1);
  const pulseAnim = useSharedValue(0);
  const sparkGlow = useSharedValue(0);

  const coreColor = useDerivedValue<string>(() =>
    interpolateColor(levelIdx.value, [0, 1, 2, 3, 4], LEVEL_PALETTE),
  );

  // ── Fetch surge for active venue ──────────────────────────────────────────
  useEffect(() => {
    if (!activeVenueId) { setSurge(null); return; }
    fetch(`${API_URL}/api/venues/${activeVenueId}/surge`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSurge(d))
      .catch(() => {});
  }, [activeVenueId]);

  // ── Update level color ────────────────────────────────────────────────────
  useEffect(() => {
    if (!surge) return;
    levelIdx.value = withTiming(LEVEL_INDICES[surge.level] ?? 1, { duration: 500 });
  }, [surge?.level]);

  // ── Orb breathe ───────────────────────────────────────────────────────────
  useEffect(() => {
    const rate = cityChargeActive ? 350 : 1100;
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: rate, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [cityChargeActive]);

  // ── Spark: followed venue hits LIT ────────────────────────────────────────
  useEffect(() => {
    const litVenue = venues.find(
      v => followedVenues.includes(v.id) &&
           ['lit', 'peak'].includes(v.energy_level) &&
           v.id !== activeVenueId,
    );
    if (litVenue) setSparkActive(true);
  }, [venues, followedVenues, activeVenueId]);

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
      6, false,
    );
    setTimeout(() => setSparkActive(false), 2500);
  }, [sparkActive]);

  // ── Open expanded modal ───────────────────────────────────────────────────
  const openExpanded = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeVenueId) setExpanded(true);
  }, [activeVenueId]);

  // ── Drag gesture with edge snap ───────────────────────────────────────────
  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
      dragScale.value = withSpring(1.08, { stiffness: 300, damping: 18 });
    })
    .onUpdate((e) => {
      posX.value = savedX.value + e.translationX;
      posY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      isDragging.value = false;
      dragScale.value  = withSpring(1, { stiffness: 300, damping: 18 });

      // Snap to nearest horizontal edge
      const snapX = posX.value + PILL_W / 2 > SCREEN_W / 2
        ? SCREEN_W - PILL_W - EDGE_PAD
        : EDGE_PAD;

      // Clamp vertical within safe zone
      const clampY = Math.max(80, Math.min(SCREEN_H - PILL_H - 100, posY.value));

      posX.value   = withSpring(snapX, { stiffness: 220, damping: 22 });
      posY.value   = withSpring(clampY, { stiffness: 220, damping: 22 });
      savedX.value = snapX;
      savedY.value = clampY;
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => {
      runOnJS(openExpanded)();
    });

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  // ── Animated styles ───────────────────────────────────────────────────────
  const pillStyle = useAnimatedStyle(() => {
    const glow      = sparkActive ? interpolate(sparkGlow.value, [0, 1], [0, 1], Extrapolation.CLAMP) : 0;
    const cityGlow  = cityChargeActive
      ? interpolate(pulseAnim.value, [0, 1], [0.3, 0.9], Extrapolation.CLAMP)
      : 0.15;

    return {
      transform: [
        { translateX: posX.value },
        { translateY: posY.value },
        { scale: dragScale.value },
      ],
      borderColor: sparkActive
        ? `rgba(255,214,10,${glow * 0.8})`
        : cityChargeActive
        ? `rgba(255,153,0,${cityGlow})`
        : coreColor.value + '44',
      shadowColor:   sparkActive ? '#FFD60A' : coreColor.value,
      shadowRadius:  8 + interpolate(pulseAnim.value, [0, 1], [0, 8], Extrapolation.CLAMP),
      shadowOpacity: isDragging.value ? 0.9 : 0.6,
      elevation:     isDragging.value ? 20 : 10,
    };
  });

  if (!isInsideVenue && !cityPulse) return null;

  const displayLabel = surge?.level_label ?? cityPulse?.pulse_label ?? 'CHILL';
  const displayColor = surge?.level_color ?? '#5544FF';
  const displayVenue = activeVenueName ?? cityPulse?.city ?? '';

  return (
    <>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.pill, pillStyle]}>
          <MiniOrb color={displayColor} pulse={pulseAnim} />

          <View style={styles.textWrap}>
            <Text style={[styles.level, { color: displayColor }]} numberOfLines={1}>
              {displayLabel}
            </Text>
            {displayVenue ? (
              <Text style={styles.venue} numberOfLines={1}>
                {displayVenue}
              </Text>
            ) : null}
          </View>

          {cityChargeActive && (
            <Text style={styles.fire}>🔥</Text>
          )}
          {sparkActive && (
            <Animated.Text style={[styles.spark, { opacity: sparkGlow }]}>✦</Animated.Text>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Expanded reactor modal */}
      <Modal
        visible={expanded}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExpanded(false)} />
          <Animated.View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeVenueName ?? 'Kinetic Core'}</Text>
              <Pressable onPress={() => setExpanded(false)} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>
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

const styles = StyleSheet.create({
  pill: {
    position:        'absolute',
    top:             0,
    left:            0,
    width:           PILL_W,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             7,
    backgroundColor: 'rgba(8,8,18,0.94)',
    borderRadius:    22,
    borderWidth:     1.5,
    paddingVertical:   8,
    paddingHorizontal: 10,
    shadowOffset:    { width: 0, height: 0 },
    // elevation handled in animated style
  },
  textWrap: { flex: 1, minWidth: 0 },
  level: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.2,
  },
  venue: {
    fontSize:  9,
    color:     'rgba(255,255,255,0.35)',
  },
  fire:  { fontSize: 13 },
  spark: { position: 'absolute', top: -4, right: -4, fontSize: 12, color: '#FFD60A' },

  // ── Modal ──────────────────────────────────────────────────
  modalBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent:  'flex-end',
  },
  modalCard: {
    backgroundColor:     '#08080F',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderWidth:  1,
    borderColor:  '#1A1A2C',
    paddingBottom: 36,
    paddingTop:    16,
    minHeight:     SCREEN_H * 0.55,
  },
  modalHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    marginBottom:      8,
  },
  modalTitle: {
    fontSize:      16,
    fontWeight:    '700',
    color:         '#EEEEF5',
    letterSpacing: 0.4,
  },
  closeBtn:     { padding: 6, opacity: 0.6 },
  closeBtnText: { fontSize: 16, color: '#EEEEF5', fontWeight: '600' },
} as any);
