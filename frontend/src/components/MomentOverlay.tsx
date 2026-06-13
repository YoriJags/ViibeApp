/**
 * MomentOverlay — Premium Moment experience
 *
 * Two states:
 *
 *   'personal' — scout triggered shake / raise / back tap
 *     Colour wash. Single bolt eruption. "YOU FELT THAT."
 *     2.5s hold.
 *
 *   'locked'   — 5+ scouts simultaneously (socket: moment_locked)
 *     Full Skia shockwave rings expanding from centre.
 *     Frosted glass content card (expo-blur).
 *     "MOMENT LOCKED" glitch text.
 *     Participant count animates up from 1.
 *     Full haptic sequence: Light → Medium → Heavy → Success.
 *     4s hold.
 *
 * Tap anywhere to early-dismiss.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Platform, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withSpring,
  withRepeat, Easing, cancelAnimation, runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { Canvas, Circle, Paint, BlurMask } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { MomentGesture } from '../hooks/useMomentTrigger';

const { width: W, height: H } = Dimensions.get('window');
const CX = W / 2;
const CY = H / 2;

const GLITCH_CHARS = '!@#$%^&*<>?/|~⚡';
const AUTO_DISMISS_PERSONAL_MS = 2500;
const AUTO_DISMISS_LOCK_MS     = 4000;

// ─── Shockwave ring (Skia) ────────────────────────────────────────────────────
// Each ring expands from CX,CY outward and fades. Locked state spawns 3 waves
// staggered 200ms apart.

interface ShockwaveProps {
  color: string;
  delay: number;
  maxRadius: number;
}

function Shockwave({ color, delay, maxRadius }: ShockwaveProps) {
  const radius  = useSharedValue(40);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withSequence(
        withTiming(0.7,  { duration: 80 }),
        withTiming(0,    { duration: 900, easing: Easing.out(Easing.quad) }),
      );
      radius.value = withTiming(maxRadius, {
        duration: 980,
        easing: Easing.out(Easing.cubic),
      });
    }, delay);
    return () => clearTimeout(t);
  }, []);

  // Skia shared values — read directly in canvas
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={CX} cy={CY} r={radius} opacity={opacity} color={color}>
        <Paint style="stroke" strokeWidth={2} color={color} opacity={opacity}>
          <BlurMask blur={8} style="normal" />
        </Paint>
      </Circle>
    </Canvas>
  );
}

// ─── Bolt particle (RN Animated) ──────────────────────────────────────────────

interface BoltProps {
  color: string;
  delay: number;
  startX: number;
  size?: number;
}

function BoltParticle({ color, delay, startX, size = 48 }: BoltProps) {
  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(0.4);
  const rotate     = useSharedValue(startX > 0 ? 12 : startX < 0 ? -12 : 0);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value    = withSequence(
        withTiming(1,   { duration: 100 }),
        withTiming(0.9, { duration: 600 }),
        withTiming(0,   { duration: 400 }),
      );
      translateY.value = withTiming(-H * 0.58, {
        duration: 1100,
        easing: Easing.out(Easing.quad),
      });
      scale.value = withSequence(
        withSpring(1.5, { stiffness: 220, damping: 10 }),
        withTiming(0.5, { duration: 600 }),
      );
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [
      { translateX: startX },
      { translateY: translateY.value },
      { scale:      scale.value },
      { rotate:     `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.Text
      style={[{ fontSize: size, position: 'absolute', bottom: H * 0.28 }, style]}
    >
      ⚡
    </Animated.Text>
  );
}

// ─── Animated count-up ────────────────────────────────────────────────────────

function CountUp({ target, color }: { target: number; color: string }) {
  const [displayed, setDisplayed] = useState(1);

  useEffect(() => {
    if (target <= 1) return;
    let current = 1;
    const step  = Math.max(1, Math.floor(target / 18));
    const id = setInterval(() => {
      current = Math.min(current + step, target);
      setDisplayed(current);
      if (current >= target) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [target]);

  return (
    <Text style={[styles.countNum, { color }]}>{displayed}</Text>
  );
}

// ─── Glitch label ─────────────────────────────────────────────────────────────

function GlitchLabel({ text, color, size = 28 }: { text: string; color: string; size?: number }) {
  const [display, setDisplay] = useState(text);
  const prevRef = useRef(text);

  useEffect(() => {
    if (text === prevRef.current) return;
    prevRef.current = text;
    let frame = 0;
    const id = setInterval(() => {
      frame++;
      if (frame >= 9) { setDisplay(text); clearInterval(id); }
      else setDisplay(
        text.split('').map(c =>
          c === ' ' ? ' ' : GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
        ).join('')
      );
    }, 38);
    return () => clearInterval(id);
  }, [text]);

  return (
    <Text style={{ color, fontSize: size, fontWeight: '900', letterSpacing: 5, textAlign: 'center' }}>
      {display}
    </Text>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Reactor orb (locked full-screen mode) ────────────────────────────────────
// Pulsing concentric rings that mimic the VibeReactor orb, expanded to fill
// the screen. Renders behind the content card. Skia paths + BlurMask.

function ReactorOrbLayer({ color }: { color: string }) {
  const ring1 = useSharedValue(0.88);
  const ring2 = useSharedValue(0.88);
  const ring3 = useSharedValue(0.88);

  useEffect(() => {
    const pulse = (sv: ReturnType<typeof useSharedValue<number>>, delay: number) => {
      setTimeout(() => {
        sv.value = withRepeat(
          withSequence(
            withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.88, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, false,
        );
      }, delay);
    };
    pulse(ring1, 0);
    pulse(ring2, 280);
    pulse(ring3, 560);
  }, []);

  const RADII = [W * 0.38, W * 0.52, W * 0.66];
  const opacities = [0.18, 0.10, 0.06];
  const scaleSVs  = [ring1, ring2, ring3];

  return (
    <>
      {RADII.map((r, i) => {
        const circleStyle = useAnimatedStyle(() => ({
          position: 'absolute',
          alignSelf: 'center',
          top: CY - r * scaleSVs[i].value,
          width:  r * 2 * scaleSVs[i].value,
          height: r * 2 * scaleSVs[i].value,
          borderRadius: r * scaleSVs[i].value,
          borderWidth: 1.5,
          borderColor: color,
          opacity: opacities[i],
        }));
        return <Animated.View key={i} style={circleStyle} pointerEvents="none" />;
      })}
      {/* Glowing core */}
      <View
        pointerEvents="none"
        style={[
          styles.orbCore,
          {
            shadowColor: color,
            backgroundColor: color + '22',
            borderColor: color + '55',
          },
        ]}
      />
    </>
  );
}

export interface MomentOverlayProps {
  state: 'personal' | 'locked' | null;
  vibeColor: string;
  participantCount?: number;
  gesture?: MomentGesture;
  venueName: string;
  onDismiss: () => void;
  /** Current vibe score — shown in the locked card */
  vibeScore?: number;
}

export default function MomentOverlay({
  state,
  vibeColor,
  participantCount = 5,
  gesture,
  venueName,
  onDismiss,
  vibeScore,
}: MomentOverlayProps) {
  const visible  = state !== null;
  const isLocked = state === 'locked';

  // Shared animation values
  const backdropOpacity = useSharedValue(0);
  const contentOpacity  = useSharedValue(0);
  const contentScale    = useSharedValue(0.82);
  const countScale      = useSharedValue(1);

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    backdropOpacity.value = withTiming(0, { duration: 380 });
    contentOpacity.value  = withTiming(0, { duration: 280 });
    contentScale.value    = withTiming(0.88, { duration: 280 });
    setTimeout(() => runOnJS(onDismiss)(), 400);
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) return;

    // ── Haptic choreography ─────────────────────────────────────────────────
    if (Platform.OS !== 'web') {
      if (isLocked) {
        // Building impact sequence for Moment Lock
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 80);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),  180);
        setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 320);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }

    // ── Animate in ──────────────────────────────────────────────────────────
    backdropOpacity.value = withTiming(isLocked ? 0.92 : 0.76, { duration: 220 });
    contentOpacity.value  = withTiming(1, { duration: 300 });
    contentScale.value    = withSpring(1, { stiffness: 200, damping: 16 });

    // Count badge pulse — 4 throbs then settle
    if (isLocked) {
      countScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 420, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 420, easing: Easing.inOut(Easing.ease) }),
        ),
        4, false,
      );
    }

    // ── Auto-dismiss ────────────────────────────────────────────────────────
    dismissTimer.current = setTimeout(
      dismiss,
      isLocked ? AUTO_DISMISS_LOCK_MS : AUTO_DISMISS_PERSONAL_MS,
    );

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      cancelAnimation(backdropOpacity);
      cancelAnimation(contentOpacity);
      cancelAnimation(contentScale);
      cancelAnimation(countScale);
    };
  }, [visible, isLocked]);

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity:   contentOpacity.value,
    transform: [{ scale: contentScale.value }],
  }));
  const countWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
  }));

  if (!visible) return null;

  // Accent: white at full lock, vibeColor for personal
  const accentColor  = isLocked ? '#FFFFFF' : vibeColor;
  const subColor     = 'rgba(255,255,255,0.45)';
  // Frosted card background tinted toward vibeColor
  const cardTint     = vibeColor + '22';

  const gestureLabel: Record<MomentGesture, string> = {
    shake:         '⚡ SHAKE',
    raise_to_face: '⚡ RAISE',
    back_tap:      '⚡ TAP',
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      {/* ── Full-bleed colour backdrop ───────────────────────────────────── */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <LinearGradient
          colors={[
            vibeColor + (isLocked ? 'F0' : 'CC'),
            vibeColor + '77',
            '#04040A',
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Inner radial bloom at centre */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: 'transparent',
              shadowColor: vibeColor,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: 120,
              shadowOpacity: isLocked ? 0.9 : 0.6,
            },
          ]}
        />
      </Animated.View>

      {/* ── Reactor orb rings + core (locked only) ───────────────────────── */}
      {isLocked && <ReactorOrbLayer color={vibeColor} />}

      {/* ── Skia shockwave rings (locked only) ───────────────────────────── */}
      {isLocked && (
        <>
          <Shockwave color={vibeColor} delay={0}   maxRadius={W * 0.55} />
          <Shockwave color={vibeColor} delay={220} maxRadius={W * 0.72} />
          <Shockwave color="#FFFFFF"   delay={440} maxRadius={W * 0.90} />
        </>
      )}

      {/* ── Bolt particles ────────────────────────────────────────────────── */}
      <View style={styles.boltsLayer} pointerEvents="none">
        {/* Core bolts — always present */}
        <BoltParticle color={vibeColor}  delay={0}   startX={0}    size={52} />
        <BoltParticle color={vibeColor}  delay={100} startX={-72}  size={36} />
        <BoltParticle color={vibeColor}  delay={200} startX={72}   size={36} />
        {/* Extra bolts for lock state */}
        {isLocked && (
          <>
            <BoltParticle color="#FFFFFF"   delay={60}  startX={-130} size={28} />
            <BoltParticle color="#FFFFFF"   delay={160} startX={130}  size={28} />
            <BoltParticle color={vibeColor} delay={280} startX={-45}  size={44} />
            <BoltParticle color={vibeColor} delay={340} startX={45}   size={44} />
            <BoltParticle color="#FFFFFF"   delay={420} startX={0}    size={24} />
          </>
        )}
      </View>

      {/* ── Frosted glass content card ────────────────────────────────────── */}
      <View style={styles.contentWrap} pointerEvents="box-none">
        <Animated.View style={contentStyle}>
          <BlurView
            intensity={isLocked ? 60 : 40}
            tint="dark"
            style={[
              styles.card,
              {
                borderColor:     vibeColor + '55',
                backgroundColor: cardTint,
              },
            ]}
          >
            {isLocked ? (
              /* ── MOMENT LOCKED ── */
              <>
                <Text style={[styles.eyebrow, { color: subColor }]}>
                  MOMENT
                </Text>

                <GlitchLabel text="LOCKED" color={accentColor} size={54} />

                <View style={[styles.divider, { backgroundColor: vibeColor + '60' }]} />

                {/* Participant count — counts up */}
                <Animated.View style={[styles.countBlock, countWrapStyle]}>
                  <CountUp
                    target={participantCount}
                    color={vibeColor === '#FFFFFF' ? '#FFD700' : '#FFFFFF'}
                  />
                  <Text style={[styles.countLabel, { color: subColor }]}>
                    SCOUTS FELT THIS
                  </Text>
                </Animated.View>

                <View style={[styles.pill, { borderColor: vibeColor + '44', backgroundColor: vibeColor + '18' }]}>
                  <Text style={[styles.pillText, { color: vibeColor }]}>
                    {venueName}
                  </Text>
                </View>

                {vibeScore !== undefined && (
                  <View style={[styles.scorePill, { borderColor: 'rgba(255,255,255,0.12)' }]}>
                    <Ionicons name="flash" size={10} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.scoreText}>VIBE {vibeScore}</Text>
                  </View>
                )}
              </>
            ) : (
              /* ── PERSONAL TRIGGER ── */
              <>
                <Text style={[styles.gestureTag, { color: vibeColor }]}>
                  {gesture ? gestureLabel[gesture] : '⚡'}
                </Text>

                <GlitchLabel text="YOU FELT THAT" color="#FFFFFF" size={26} />

                <View style={[styles.divider, { backgroundColor: vibeColor + '50', marginVertical: 14 }]} />

                <Text style={[styles.personalSub, { color: subColor }]}>
                  Signal fired into the room
                </Text>
              </>
            )}
          </BlurView>
        </Animated.View>
      </View>

      {/* ── Dismiss hint ─────────────────────────────────────────────────── */}
      <View style={styles.hintWrap} pointerEvents="none">
        <Text style={styles.hintText}>tap anywhere to close</Text>
      </View>

      {/* ── Full-screen tap to dismiss ────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} onTouchEnd={dismiss} />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  boltsLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'flex-end',
  },
  contentWrap: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width:          '100%',
    borderRadius:   28,
    borderWidth:    1,
    paddingVertical:   36,
    paddingHorizontal: 28,
    alignItems:     'center',
    overflow:       'hidden',
    // Elevation for depth
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 12 },
    shadowOpacity:  0.5,
    shadowRadius:   24,
    elevation:      16,
  },
  eyebrow: {
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 7,
    marginBottom:  10,
  },
  divider: {
    width:         48,
    height:        1,
    marginVertical: 22,
  },
  countBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  countNum: {
    fontSize:      80,
    fontWeight:    '900',
    lineHeight:    84,
    letterSpacing: -3,
  },
  countLabel: {
    fontSize:      10,
    fontWeight:    '800',
    letterSpacing: 3.5,
    marginTop:     6,
  },
  pill: {
    borderWidth:     1,
    borderRadius:    20,
    paddingHorizontal: 16,
    paddingVertical:   6,
    marginTop:       4,
  },
  pillText: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1.5,
  },
  gestureTag: {
    fontSize:      13,
    fontWeight:    '900',
    letterSpacing: 4,
    marginBottom:  14,
  },
  personalSub: {
    fontSize:      11,
    fontWeight:    '600',
    letterSpacing: 2,
  },
  hintWrap: {
    position: 'absolute',
    bottom:   44,
    left:     0,
    right:    0,
    alignItems: 'center',
  },
  hintText: {
    fontSize:      10,
    color:         'rgba(255,255,255,0.2)',
    letterSpacing: 1.5,
    fontWeight:    '500',
  },
  orbCore: {
    position:      'absolute',
    alignSelf:     'center',
    top:           CY - 52,
    width:         104,
    height:        104,
    borderRadius:  52,
    borderWidth:   1,
    shadowOffset:  { width: 0, height: 0 },
    shadowRadius:  60,
    shadowOpacity: 0.6,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
    borderWidth:   1,
    borderRadius:  14,
    paddingHorizontal: 12,
    paddingVertical:    4,
    marginTop:     8,
  },
  scoreText: {
    fontSize:      10,
    fontWeight:    '700',
    color:         'rgba(255,255,255,0.45)',
    letterSpacing: 1.5,
  },
});
