/**
 * SurgeFullScreen — High-Velocity Vibe Charger
 *
 * High-frequency tap loop:
 *  - 15-second local visual cooldown (vs 30-min clout limit which is unchanged)
 *  - Accelerometer multipliers: Soft (<1.5g) = +1 UI count, Power (>2.5g) = +10
 *  - ComboCounter: 10 taps in 15s → NotificationFeedback.Success + screen shake
 *  - Global_Surge: listen for socket event when venue hits 1000 collective taps in 5 min
 *  - Energy_Critical: banner when server signals collective charge drop
 *  - Emits `vibe_pulse` socket event for shadow-log (vibe_pulses collection, not vibe_score)
 *  - Geofence gate respected (>100m disables 15s cycle; onTap still gated by parent)
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal, StyleSheet,
  Dimensions, GestureResponderEvent, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

const RING_R = 130;
const SEG    = 72;
const SEG_W  = 5;
const SEG_H  = 18;

const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

// Accel thresholds
const SOFT_THRESHOLD = 1.5;
const POWER_THRESHOLD = 2.5;

// Visual cooldown (ms) — separate from 30-min clout limit
const VISUAL_COOLDOWN_MS = 15_000;

// Combo window & target
const COMBO_WINDOW_MS = 15_000;
const COMBO_TARGET = 10;

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
  venueId?: string;
  onClose: () => void;
  onTap: () => void;
  tapping?: boolean;
  cooldown?: boolean;   // 30-min clout cooldown from parent
  socket?: any;         // Socket.IO socket for vibe_pulse + event listening
  userId?: string;
}

export default function SurgeFullScreen({
  visible, surge, venueName, venueId, onClose, onTap, tapping, cooldown,
  socket, userId,
}: Props) {
  const insets = useSafeAreaInsets();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  // ── New state ──
  const [localTapCount, setLocalTapCount] = useState(0);
  const [localCooldown, setLocalCooldown] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [comboFired, setComboFired] = useState(false);
  const [globalSurgeActive, setGlobalSurgeActive] = useState(false);
  const [energyCriticalMsg, setEnergyCriticalMsg] = useState<string | null>(null);

  // Refs
  const rippleId      = useRef(0);
  const prevLevel     = useRef('');
  const latestAccel   = useRef({ x: 0, y: 0, z: 1 });
  const comboTaps     = useRef<number[]>([]); // timestamps
  const localCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboResetTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surgeResetTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations (existing)
  const boltScale   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0.6)).current;
  const beamAnim    = useRef(new Animated.Value(1)).current;
  const orbitAnim   = useRef(new Animated.Value(0)).current;
  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const entryScale  = useRef(new Animated.Value(0.88)).current;
  const stampScale  = useRef(new Animated.Value(0.4)).current;
  const stampOpacity= useRef(new Animated.Value(0)).current;
  const flashOpacity= useRef(new Animated.Value(0)).current;
  const burstParticles = useRef(
    BURST_ANGLES.map(() => ({ t: new Animated.Value(0), o: new Animated.Value(0) }))
  ).current;
  // New animations
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const comboAnim   = useRef(new Animated.Value(0)).current;
  const surgeFlash  = useRef(new Animated.Value(0)).current;
  const bigNumScale = useRef(new Animated.Value(1)).current;

  const color      = surge.level_color;
  const isElectric = surge.level === 'electric';
  const filledSegs = Math.round(surge.charge_pct * SEG);

  // ── Accelerometer setup — runs while screen is open ──────────────────────
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS === 'web') return; // expo-sensors not supported on web

    Accelerometer.setUpdateInterval(16);
    const sub = Accelerometer.addListener(d => { latestAccel.current = d; });
    return () => sub.remove(); // always remove on cleanup
  }, [visible]);

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !venueId) return;

    const onGlobalSurge = (data: { venue_id: string }) => {
      if (data.venue_id !== venueId) return;
      setGlobalSurgeActive(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Flash white
      Animated.sequence([
        Animated.timing(surgeFlash, { toValue: 0.35, duration: 80, useNativeDriver: true }),
        Animated.timing(surgeFlash, { toValue: 0,    duration: 500, useNativeDriver: true }),
      ]).start();
      clearTimeout(surgeResetTimer.current ?? undefined);
      surgeResetTimer.current = setTimeout(() => setGlobalSurgeActive(false), 8000);
    };

    const onEnergyCritical = (data: { venue_id: string; message: string }) => {
      if (data.venue_id !== venueId) return;
      setEnergyCriticalMsg(data.message || 'ENERGY CRITICAL — 5× CLOUT FOR NEXT 30 TAPS');
      setTimeout(() => setEnergyCriticalMsg(null), 12000);
    };

    socket.on('global_surge', onGlobalSurge);
    socket.on('energy_critical', onEnergyCritical);

    return () => {
      socket.off('global_surge', onGlobalSurge);
      socket.off('energy_critical', onEnergyCritical);
    };
  }, [socket, venueId]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(localCooldownTimer.current ?? undefined);
      clearTimeout(comboResetTimer.current ?? undefined);
      clearTimeout(surgeResetTimer.current ?? undefined);
    };
  }, []);

  // ── Entry animation ───────────────────────────────────────────────────────
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
    if (!visible || localCooldown) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(beamAnim, { toValue: 1.14, duration: 900, useNativeDriver: true }),
      Animated.timing(beamAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, localCooldown]);

  // Orbit ring spin
  useEffect(() => {
    if (!visible) return;
    const dur = isElectric ? 2500 : 8000;
    const loop = Animated.loop(
      Animated.timing(orbitAnim, { toValue: 1, duration: dur, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, isElectric]);

  // ELECTRIC transition burst
  useEffect(() => {
    if (!visible) return;
    if (isElectric && prevLevel.current !== 'electric') {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.25, duration: 80,  useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0,    duration: 400, useNativeDriver: true }),
      ]).start();
      stampScale.setValue(0.4); stampOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(stampScale,   { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.timing(stampOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(stampOpacity, { toValue: 0, duration: 500, delay: 500, useNativeDriver: true }).start();
      });
      burstParticles.forEach(p => { p.t.setValue(0); p.o.setValue(0.9); });
      Animated.parallel([
        ...burstParticles.map(p => Animated.timing(p.t, { toValue: 1, duration: 650, useNativeDriver: true })),
        ...burstParticles.map(p => Animated.timing(p.o, { toValue: 0, duration: 650, useNativeDriver: true })),
      ]).start();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
      }
    }
    prevLevel.current = surge.level;
  }, [surge.level, visible]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 20, useNativeDriver: true }),
    ]).start();
  }, []);

  const triggerBigNumPop = useCallback(() => {
    Animated.sequence([
      Animated.timing(bigNumScale, { toValue: 1.35, duration: 80, useNativeDriver: true }),
      Animated.spring(bigNumScale, { toValue: 1, tension: 400, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Main tap handler ──────────────────────────────────────────────────────

  const handleTap = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const isCooling = cooldown || tapping;

    // ── Spawn ripple (always) ──
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

    // ── Read G-force for UI multiplier ──
    const { x, y, z } = latestAccel.current;
    const g = Math.sqrt(x * x + y * y + z * z);
    const isPower = g > POWER_THRESHOLD;
    const uiMultiplier = isPower ? 10 : 1; // +10 for power, +1 for soft

    // ── 15s visual cooldown gate ──
    if (!localCooldown) {
      // Increment local "big number"
      setLocalTapCount(c => c + uiMultiplier);
      triggerBigNumPop();

      // Combo tracking
      const now = Date.now();
      comboTaps.current = comboTaps.current.filter(ts => now - ts < COMBO_WINDOW_MS);
      comboTaps.current.push(now);
      const currentCombo = comboTaps.current.length;
      setComboCount(currentCombo);

      if (currentCombo >= COMBO_TARGET) {
        // COMBO ACHIEVED
        comboTaps.current = [];
        setComboFired(true);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        triggerShake();
        // Combo badge glow
        Animated.sequence([
          Animated.timing(comboAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(comboAnim, { toValue: 0, duration: 800, delay: 400, useNativeDriver: true }),
        ]).start(() => setComboFired(false));
        clearTimeout(comboResetTimer.current ?? undefined);
        comboResetTimer.current = setTimeout(() => setComboCount(0), 3000);
      }

      // Power tap: heavier haptic + mini shake
      if (isPower && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        triggerShake();
      } else if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Shadow log via socket (doesn't affect vibe_score)
      socket?.emit('vibe_pulse', {
        venue_id: venueId,
        user_id: userId,
        intensity: isPower ? 'power' : 'soft',
        ui_increment: uiMultiplier,
      });

      // Start 15s visual cooldown
      setLocalCooldown(true);
      clearTimeout(localCooldownTimer.current ?? undefined);
      localCooldownTimer.current = setTimeout(() => setLocalCooldown(false), VISUAL_COOLDOWN_MS);
    } else {
      // In visual cooldown — lighter haptic, no increment
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }

    // ── Beam animation ──
    if (!isCooling) {
      Animated.sequence([
        Animated.timing(beamAnim, { toValue: 1.4, duration: 90, useNativeDriver: true }),
        Animated.spring(beamAnim, { toValue: 1, tension: 250, friction: 7, useNativeDriver: true }),
      ]).start();

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 80);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 180);
      }
      onTap(); // 30-min clout gate handled by parent
    }
  }, [cooldown, tapping, localCooldown, onTap, socket, venueId, userId, triggerShake, triggerBigNumPop]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const orbitDeg        = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const orbitDegReverse = orbitAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const pct             = Math.round(surge.charge_pct * 100);
  const ORBIT_OUTER     = RING_R * 2 + 60;
  const ORBIT_INNER     = RING_R * 2 + 22;

  const displayTapCount = localTapCount > 0 ? localTapCount : surge.tap_count;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: bgOpacity, transform: [{ translateX: shakeAnim }], paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>

        <LinearGradient colors={['#000010', '#040412', '#000008']} style={StyleSheet.absoluteFill} />

        {/* Global Surge overlay */}
        {globalSurgeActive && (
          <Animated.View style={[StyleSheet.absoluteFill, styles.surgeBanner]} pointerEvents="none">
            <Text style={styles.surgeBannerText}>⚡ GLOBAL SURGE ⚡</Text>
            <Text style={styles.surgeBannerSub}>1,000 taps hit — venue is ELECTRIC</Text>
          </Animated.View>
        )}

        {/* Screen flash for global surge */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFD60A', opacity: surgeFlash }]} pointerEvents="none" />

        {/* Electric color wash */}
        {isElectric && (
          <Animated.View style={[StyleSheet.absoluteFill, {
            backgroundColor: color,
            opacity: glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.04, 0.10] }),
          }]} pointerEvents="none" />
        )}

        {/* Flash on ELECTRIC hit */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flashOpacity }]} pointerEvents="none" />

        {/* Close */}
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 8 }]} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#555" />
        </TouchableOpacity>

        {/* Energy Critical Banner */}
        {energyCriticalMsg && (
          <View style={styles.criticalBanner}>
            <Text style={styles.criticalBannerText}>{energyCriticalMsg}</Text>
          </View>
        )}

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
              opacity: localCooldown ? 0.05 : isElectric ? 0.35 : 0.14,
              width: ORBIT_OUTER, height: ORBIT_OUTER, borderRadius: ORBIT_OUTER / 2,
            }]} />

            {/* Inner counter orbit */}
            <Animated.View style={[styles.innerOrbit, {
              transform: [{ rotate: orbitDegReverse }],
              borderColor: color,
              opacity: localCooldown ? 0.05 : isElectric ? 0.5 : 0.28,
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

            {/* Center content — BIG NUMBER */}
            <View style={styles.centerContent} pointerEvents="none">
              <Animated.View style={{ transform: [{ scale: boltScale }] }}>
                <Animated.View style={{
                  transform: [{ scale: localCooldown ? 1 : beamAnim }],
                  shadowColor: color,
                  shadowOpacity: localCooldown ? 0 : isElectric ? 0.95 : 0.7,
                  shadowRadius: isElectric ? 45 : 22,
                  shadowOffset: { width: 0, height: 0 },
                }}>
                  <Ionicons name="flash" size={84} color={localCooldown ? '#252535' : color} />
                </Animated.View>
              </Animated.View>
              {/* The addictive "Big Number" */}
              <Animated.Text style={[styles.bigNumber, { color, transform: [{ scale: bigNumScale }] }]}>
                {displayTapCount.toLocaleString()}
              </Animated.Text>
              <Text style={styles.bigNumberSub}>
                {localTapCount > 0 ? 'taps this session' : 'taps tonight'}
              </Text>
              <Animated.Text style={[styles.levelLabel, { color, opacity: isElectric ? glowAnim : 1 }]}>
                {surge.level_label}
              </Animated.Text>
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

          {/* Combo Counter */}
          {comboCount > 0 && (
            <Animated.View style={[styles.comboRow, { opacity: comboFired ? comboAnim : 1 }]}>
              <Text style={[styles.comboLabel, comboFired && { color: '#00E676' }]}>
                {comboFired ? `COMBO ×${COMBO_TARGET} 🔥` : `COMBO ${comboCount}/${COMBO_TARGET}`}
              </Text>
            </Animated.View>
          )}

          {/* Hint */}
          <View style={styles.hintBlock} pointerEvents="none">
            {localCooldown ? (
              <Text style={styles.hintText}>
                <Text style={{ color: color + '88' }}>⏱ </Text>
                <Text style={styles.hintDim}>visual cooldown — 15s</Text>
              </Text>
            ) : surge.next_level && surge.taps_to_next > 0 ? (
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
                {cooldown ? 'Cooling down...' : 'Tap anywhere — power the venue'}
              </Text>
            )}
            <Text style={styles.hintSub}>{surge.total_surges} surges lit this venue</Text>
          </View>
        </Animated.View>

        {/* Bottom % */}
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
  overlay:          { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  closeBtn:         { position: 'absolute', left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: '#0E0E1A', borderWidth: 1, borderColor: '#1C1C2C', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  surgeBanner:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,214,10,0.08)', zIndex: 5 },
  surgeBannerText:  { fontSize: 28, fontWeight: '900', color: '#FFD60A', letterSpacing: 3, textAlign: 'center' },
  surgeBannerSub:   { fontSize: 13, color: 'rgba(255,214,10,0.7)', marginTop: 6 },
  criticalBanner:   { position: 'absolute', top: 100, left: 16, right: 16, backgroundColor: 'rgba(255,59,48,0.18)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,59,48,0.5)', padding: 10, zIndex: 8, alignItems: 'center' },
  criticalBannerText: { fontSize: 12, fontWeight: '800', color: '#FF3B30', letterSpacing: 0.8, textAlign: 'center' },
  header:           { alignItems: 'center', gap: 5, paddingTop: 8 },
  headerLabel:      { fontSize: 10, color: '#3A3A4E', fontWeight: '700', letterSpacing: 2 },
  headerVenue:      { fontSize: 22, color: '#EEEEF5', fontWeight: '800', letterSpacing: 0.3, maxWidth: W - 80, textAlign: 'center' },
  squadBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#140024', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#9933FF44' },
  squadBadgeText:   { fontSize: 9, color: '#9933FF', fontWeight: '800', letterSpacing: 1 },
  tapZone:          { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  ripple:           { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1.5 },
  ringWrap:         { width: RING_R * 2 + 80, height: RING_R * 2 + 80, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  segment:          { position: 'absolute', width: SEG_W, height: SEG_H, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  outerOrbit:       { position: 'absolute', borderWidth: 1 },
  innerOrbit:       { position: 'absolute', borderWidth: 1.5, borderStyle: 'dashed' },
  centerGlow:       { position: 'absolute', width: RING_R * 1.4, height: RING_R * 1.4, borderRadius: RING_R * 0.7 },
  burstDot:         { position: 'absolute', width: 10, height: 10, borderRadius: 5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 8 },
  stampWrap:        { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  stampText:        { fontSize: 28, fontWeight: '900', letterSpacing: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  centerContent:    { alignItems: 'center', gap: 2 },
  bigNumber:        { fontSize: 44, fontWeight: '900', lineHeight: 48, letterSpacing: -1 },
  bigNumberSub:     { fontSize: 10, color: '#333', fontWeight: '600', letterSpacing: 0.5 },
  levelLabel:       { fontSize: 18, fontWeight: '900', letterSpacing: 2.5, marginTop: 4 },
  leadDot:          { position: 'absolute', width: 12, height: 12, borderRadius: 6, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8, elevation: 6 },
  comboRow:         { alignItems: 'center', marginBottom: 4 },
  comboLabel:       { fontSize: 13, fontWeight: '800', color: '#FFD60A', letterSpacing: 1 },
  hintBlock:        { alignItems: 'center', gap: 6 },
  hintText:         { fontSize: 15, color: '#666', fontWeight: '600', textAlign: 'center' },
  hintDim:          { color: '#555' },
  hintSub:          { fontSize: 11, color: '#2A2A3A', fontWeight: '500' },
  bottom:           { width: W - 48, alignItems: 'center', gap: 8 },
  pctRow:           { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  pctNum:           { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  pctUnit:          { fontSize: 22, color: '#555', fontWeight: '700', paddingBottom: 4 },
  pctTrack:         { width: '100%', height: 4, backgroundColor: '#111120', borderRadius: 3, overflow: 'hidden' },
  pctFill:          { height: '100%', borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  bottomSub:        { fontSize: 10, color: '#2A2A3A', fontWeight: '600', letterSpacing: 1 },
} as any);
