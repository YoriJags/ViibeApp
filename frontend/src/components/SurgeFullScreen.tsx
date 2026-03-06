import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal, StyleSheet,
  Dimensions, GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width: W } = Dimensions.get('window');

const RING_R = 130;
const SEG    = 72;
const SEG_W  = 5;
const SEG_H  = 18;

// 8 burst particles for ELECTRIC hit
const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export interface SurgeState {
  charge_pct: number;
  level: string;
  level_label: string;
  level_color: string;
  level_progress: number;
  taps_to_next: number;
  next_level: string | null;
  tap_count: number;
  total_surges: number;
  is_squad_surge?: boolean;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  scale: Animated.Value;
  opacity: Animated.Value;
}

interface Props {
  visible: boolean;
  surge: SurgeState;
  venueName: string;
  onClose: () => void;
  onTap: () => void;
  tapping?: boolean;
  cooldown?: boolean;
}

export default function SurgeFullScreen({ visible, surge, venueName, onClose, onTap, tapping, cooldown }: Props) {
  const [ripples, setRipples]       = useState<Ripple[]>([]);
  const rippleId    = useRef(0);
  const prevLevel   = useRef('');
  const boltScale   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0.6)).current;
  const beamAnim    = useRef(new Animated.Value(1)).current;
  const orbitAnim   = useRef(new Animated.Value(0)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const entryScale  = useRef(new Animated.Value(0.88)).current;
  // Electric burst
  const stampScale  = useRef(new Animated.Value(0.4)).current;
  const stampOpacity= useRef(new Animated.Value(0)).current;
  const flashOpacity= useRef(new Animated.Value(0)).current;
  // Per-burst-particle animations
  const burstParticles = useRef(
    BURST_ANGLES.map(() => ({ t: new Animated.Value(0), o: new Animated.Value(0) }))
  ).current;

  const color      = surge.level_color;
  const isElectric = surge.level === 'electric';
  const filledSegs = Math.round(surge.charge_pct * SEG);

  // Entry animation
  useEffect(() => {
    if (visible) {
      bgOpacity.setValue(0); entryScale.setValue(0.88);
      Animated.parallel([
        Animated.timing(bgOpacity,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(entryScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Electric glow loop
  useEffect(() => {
    if (!visible) return;
    if (isElectric) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 550, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 550, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    } else { glowAnim.setValue(0.85); }
  }, [isElectric, visible]);

  // Idle beam pulse
  useEffect(() => {
    if (!visible || cooldown) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(beamAnim, { toValue: 1.14, duration: 900, useNativeDriver: true }),
      Animated.timing(beamAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, cooldown]);

  // Orbit ring spin — faster when electric
  useEffect(() => {
    if (!visible) return;
    const dur = isElectric ? 2500 : 8000;
    const loop = Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: dur, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, isElectric]);

  // ELECTRIC transition — burst particles + flash + stamp
  useEffect(() => {
    if (!visible) return;
    if (isElectric && prevLevel.current !== 'electric') {
      // Screen flash
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.25, duration: 80,  useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0,    duration: 400, useNativeDriver: true }),
      ]).start();

      // Bolt stamp
      stampScale.setValue(0.4); stampOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(stampScale,   { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.timing(stampOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(stampOpacity, { toValue: 0, duration: 500, delay: 500, useNativeDriver: true }).start();
      });

      // Burst particles
      burstParticles.forEach(p => { p.t.setValue(0); p.o.setValue(0.9); });
      Animated.parallel([
        ...burstParticles.map(p => Animated.timing(p.t, { toValue: 1, duration: 650, useNativeDriver: true })),
        ...burstParticles.map(p => Animated.timing(p.o, { toValue: 0, duration: 650, useNativeDriver: true })),
      ]).start();

      // Triple success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
    }
    prevLevel.current = surge.level;
  }, [surge.level, visible]);

  const handleTap = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;

    // Always spawn a ripple + bolt react — even on cooldown (just no charge)
    const isCooling = cooldown || tapping;
    const id = ++rippleId.current;
    const scale = new Animated.Value(0);
    const opacity = new Animated.Value(isCooling ? 0.25 : 0.65);
    setRipples(prev => [...prev, { id, x: locationX, y: locationY, scale, opacity }]);
    Animated.parallel([
      Animated.timing(scale,   { toValue: 1, duration: isCooling ? 600 : 750, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: isCooling ? 600 : 750, useNativeDriver: true }),
    ]).start(() => setRipples(prev => prev.filter(r => r.id !== id)));

    Animated.sequence([
      Animated.timing(boltScale, { toValue: isCooling ? 0.9 : 0.75, duration: 60, useNativeDriver: true }),
      Animated.spring(boltScale, { toValue: 1, tension: 400, friction: 5, useNativeDriver: true }),
    ]).start();

    if (isCooling) {
      // Lighter haptic — still in the zone, just not counting
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 80);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 180);

    Animated.sequence([
      Animated.timing(beamAnim, { toValue: 1.4, duration: 90, useNativeDriver: true }),
      Animated.spring(beamAnim, { toValue: 1, tension: 250, friction: 7, useNativeDriver: true }),
    ]).start();
    onTap();
  }, [cooldown, tapping, onTap]);

  const orbitDeg        = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbitDegReverse = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const pct             = Math.round(surge.charge_pct * 100);
  const ORBIT_OUTER     = RING_R * 2 + 60;
  const ORBIT_INNER     = RING_R * 2 + 22;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: bgOpacity }]}>

        <LinearGradient colors={['#000010', '#040412', '#000008']} style={StyleSheet.absoluteFill} />

        {/* Electric color wash */}
        {isElectric && (
          <Animated.View style={[StyleSheet.absoluteFill, {
            backgroundColor: color,
            opacity: glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.04, 0.10] }),
          }]} pointerEvents="none" />
        )}

        {/* Flash on ELECTRIC hit */}
        <Animated.View style={[StyleSheet.absoluteFill, {
          backgroundColor: '#FFF', opacity: flashOpacity,
        }]} pointerEvents="none" />

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#555" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>VIBE CHARGE</Text>
          <Text style={styles.headerVenue} numberOfLines={1}>{venueName}</Text>
          {surge.is_squad_surge && (
            <View style={styles.squadBadge}>
              <Ionicons name="people" size={10} color="#9933FF" />
              <Text style={styles.squadBadgeText}>SQUAD SURGE 1.5×</Text>
            </View>
          )}
        </View>

        {/* Tap zone */}
        <Animated.View
          style={[styles.tapZone, { transform: [{ scale: entryScale }] }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleTap}
        >
          {/* Touch ripples */}
          {ripples.map(r => (
            <Animated.View key={r.id} pointerEvents="none" style={[styles.ripple, {
              left: r.x - 80, top: r.y - 80,
              borderColor: color,
              transform: [{ scale: r.scale.interpolate({ inputRange: [0, 1], outputRange: [0.1, 3.5] }) }],
              opacity: r.opacity,
            }]} />
          ))}

          {/* Ring */}
          <View style={styles.ringWrap}>

            {/* Segments */}
            {Array.from({ length: SEG }).map((_, i) => {
              const angle  = (i / SEG) * 360 - 90;
              const filled = i < filledSegs;
              const rad    = (angle * Math.PI) / 180;
              const isLead = i === filledSegs - 1;
              return (
                <View key={i} style={[styles.segment, {
                  transform: [
                    { translateX: RING_R * Math.cos(rad) },
                    { translateY: RING_R * Math.sin(rad) },
                    { rotate: (angle + 90) + 'deg' },
                  ],
                  backgroundColor: filled ? color : '#141420',
                  opacity: filled ? 1 : 0.22,
                  shadowColor: filled ? color : 'transparent',
                  shadowOpacity: isLead ? 1 : filled ? 0.6 : 0,
                  shadowRadius: isLead ? 12 : 5,
                  elevation: filled ? 4 : 0,
                }]} />
              );
            })}

            {/* Outer orbit */}
            <Animated.View style={[styles.outerOrbit, {
              transform: [{ rotate: orbitDeg }],
              borderColor: color,
              opacity: cooldown ? 0.05 : isElectric ? 0.35 : 0.14,
              width: ORBIT_OUTER, height: ORBIT_OUTER, borderRadius: ORBIT_OUTER / 2,
            }]} />

            {/* Inner counter orbit */}
            <Animated.View style={[styles.innerOrbit, {
              transform: [{ rotate: orbitDegReverse }],
              borderColor: color,
              opacity: cooldown ? 0.05 : isElectric ? 0.5 : 0.28,
              width: ORBIT_INNER, height: ORBIT_INNER, borderRadius: ORBIT_INNER / 2,
            }]} />

            {/* Center glow */}
            <Animated.View style={[styles.centerGlow, {
              backgroundColor: color,
              opacity: isElectric
                ? glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.07, 0.22] })
                : 0.04,
            }]} />

            {/* ELECTRIC burst particles */}
            {BURST_ANGLES.map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <Animated.View key={i} pointerEvents="none" style={[styles.burstDot, {
                  backgroundColor: color,
                  shadowColor: color,
                  transform: [
                    { translateX: burstParticles[i].t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * 160] }) },
                    { translateY: burstParticles[i].t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * 160] }) },
                    { scale: burstParticles[i].t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.5, 0.5] }) },
                  ],
                  opacity: burstParticles[i].o,
                }]} />
              );
            })}

            {/* "ELECTRIC" stamp on transition */}
            <Animated.View pointerEvents="none" style={[styles.stampWrap, {
              transform: [{ scale: stampScale }],
              opacity: stampOpacity,
            }]}>
              <Text style={[styles.stampText, { color }]}>ELECTRIC</Text>
            </Animated.View>

            {/* Center content */}
            <View style={styles.centerContent} pointerEvents="none">
              <Animated.View style={{ transform: [{ scale: boltScale }] }}>
                <Animated.View style={{
                  transform: [{ scale: cooldown ? 1 : beamAnim }],
                  shadowColor: color,
                  shadowOpacity: cooldown ? 0 : isElectric ? 0.95 : 0.7,
                  shadowRadius: isElectric ? 45 : 22,
                  shadowOffset: { width: 0, height: 0 },
                }}>
                  <Ionicons name="flash" size={84} color={cooldown ? '#252535' : color} />
                </Animated.View>
              </Animated.View>
              <Animated.Text style={[styles.levelLabel, { color, opacity: isElectric ? glowAnim : 1 }]}>
                {surge.level_label}
              </Animated.Text>
              <Text style={styles.centerTapCount}>{surge.tap_count} taps tonight</Text>
            </View>

            {/* Leading edge dot */}
            {filledSegs > 0 && filledSegs < SEG && (() => {
              const a = ((filledSegs - 1) / SEG) * 360 - 90;
              const rad = (a * Math.PI) / 180;
              return (
                <View style={[styles.leadDot, {
                  transform: [{ translateX: RING_R * Math.cos(rad) }, { translateY: RING_R * Math.sin(rad) }],
                  backgroundColor: color, shadowColor: color,
                }]} />
              );
            })()}
          </View>

          {/* Hint */}
          <View style={styles.hintBlock} pointerEvents="none">
            {surge.next_level && surge.taps_to_next > 0 ? (
              <Text style={styles.hintText}>
                <Text style={styles.hintDim}>{surge.taps_to_next} taps to </Text>
                <Text style={{ color, fontWeight: '900' }}>{surge.next_level}</Text>
              </Text>
            ) : isElectric ? (
              <Animated.Text style={[styles.hintText, { color, opacity: glowAnim }]}>
                ELECTRIC — KEEP IT ALIVE
              </Animated.Text>
            ) : (
              <Text style={styles.hintText}>
                {cooldown ? 'Cooling down...' : 'Tap anywhere to power the venue'}
              </Text>
            )}
            <Text style={styles.hintSub}>{surge.total_surges} surges lit this venue</Text>
          </View>
        </Animated.View>

        {/* Bottom pct */}
        <View style={styles.bottom} pointerEvents="none">
          <View style={styles.pctRow}>
            <Animated.Text style={[styles.pctNum, { color, opacity: isElectric ? glowAnim : 1 }]}>
              {pct}
            </Animated.Text>
            <Text style={styles.pctUnit}>%</Text>
          </View>
          <View style={styles.pctTrack}>
            <View style={[styles.pctFill, {
              width: `${pct}%` as any, backgroundColor: color,
              shadowColor: color, shadowOpacity: isElectric ? 0.9 : 0.5, shadowRadius: 8,
            }]} />
          </View>
          <Text style={styles.bottomSub}>collective vibe charge</Text>
        </View>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:        { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingBottom: 44 },
  closeBtn:       { position: 'absolute', top: 52, left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: '#0E0E1A', borderWidth: 1, borderColor: '#1C1C2C', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  header:         { alignItems: 'center', gap: 5, paddingTop: 8 },
  headerLabel:    { fontSize: 10, color: '#3A3A4E', fontWeight: '700', letterSpacing: 2 },
  headerVenue:    { fontSize: 22, color: '#EEEEF5', fontWeight: '800', letterSpacing: 0.3, maxWidth: W - 80, textAlign: 'center' },
  squadBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#140024', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#9933FF44' },
  squadBadgeText: { fontSize: 9, color: '#9933FF', fontWeight: '800', letterSpacing: 1 },
  tapZone:        { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  ripple:         { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1.5 },
  ringWrap:       { width: RING_R * 2 + 80, height: RING_R * 2 + 80, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  segment:        { position: 'absolute', width: SEG_W, height: SEG_H, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  outerOrbit:     { position: 'absolute', borderWidth: 1 },
  innerOrbit:     { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
  centerGlow:     { position: 'absolute', width: RING_R * 1.4, height: RING_R * 1.4, borderRadius: RING_R * 0.7 },
  burstDot:       { position: 'absolute', width: 10, height: 10, borderRadius: 5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 8 },
  stampWrap:      { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  stampText:      { fontSize: 28, fontWeight: '900', letterSpacing: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  centerContent:  { alignItems: 'center', gap: 4 },
  levelLabel:     { fontSize: 20, fontWeight: '900', letterSpacing: 2.5, marginTop: 6 },
  centerTapCount: { fontSize: 12, color: '#444', fontWeight: '600' },
  leadDot:        { position: 'absolute', width: 12, height: 12, borderRadius: 6, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 6 },
  hintBlock:      { alignItems: 'center', gap: 6 },
  hintText:       { fontSize: 15, color: '#666', fontWeight: '600', textAlign: 'center' },
  hintDim:        { color: '#555' },
  hintSub:        { fontSize: 11, color: '#2A2A3A', fontWeight: '500' },
  bottom:         { width: W - 48, alignItems: 'center', gap: 8 },
  pctRow:         { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  pctNum:         { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  pctUnit:        { fontSize: 22, color: '#555', fontWeight: '700', paddingBottom: 4 },
  pctTrack:       { width: '100%', height: 4, backgroundColor: '#111120', borderRadius: 3, overflow: 'hidden' },
  pctFill:        { height: '100%', borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  bottomSub:      { fontSize: 10, color: '#2A2A3A', fontWeight: '600', letterSpacing: 1 },
});
