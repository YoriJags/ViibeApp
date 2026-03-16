/**
 * SurgeFullScreen — Full-screen Vibe Charger
 * Uses the same Skia KineticCanvas as the inline VibeReactor for visual parity.
 * Larger canvas, cleaner layout, no more rectangular segments.
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
import {
  useSharedValue, useDerivedValue, withTiming,
  interpolate,
} from 'react-native-reanimated';
import {
  Canvas, Circle, Path, Paint, BlurMask, Skia,
} from '@shopify/react-native-skia';

const { width: W, height: H } = Dimensions.get('window');

// Canvas sized for full screen — larger than inline reactor
const CANVAS_SIZE = Math.min(W - 32, 340);
const CX = CANVAS_SIZE / 2;
const CY = CANVAS_SIZE / 2;
const RING_R  = CANVAS_SIZE * 0.43;
const RING_T  = 14;
const OUTER_R = RING_R + 15;
const INNER_R = RING_R - 16;

// Accel thresholds
const SOFT_THRESHOLD  = 1.5;
const POWER_THRESHOLD = 2.5;

// Visual cooldown (ms)
const VISUAL_COOLDOWN_MS = 15_000;

// Combo window & target
const COMBO_WINDOW_MS = 15_000;
const COMBO_TARGET    = 10;

export interface SurgeState {
  charge_pct:     number;
  level:          string;
  level_label:    string;
  level_color:    string;
  level_progress: number;
  taps_to_next:   number;
  next_level:     string | null;
  tap_count:      number;
  total_surges:   number;
  is_squad_surge?: boolean;
}

export interface QuestState {
  aggregate_bpm: number;
  unique_scouts: number;
  quest_state:   'idle' | 'active' | 'cooldown';
  resonance_min: number;
  resonance_max: number;
}

interface Ripple {
  id: number; x: number; y: number;
  scale: Animated.Value; opacity: Animated.Value;
}

interface Props {
  visible:    boolean;
  surge:      SurgeState;
  venueName:  string;
  venueId?:   string;
  onClose:    () => void;
  onTap:      () => void;
  tapping?:   boolean;
  cooldown?:  boolean;
  socket?:    any;
  userId?:    string;
  syncPct?:   ReturnType<typeof useSharedValue<number>>;
  questState?: QuestState | null;
  bpmNow?:    number;
}

// ─── Skia Canvas (identical logic to VibeReactor, sized for full screen) ──────

interface KineticCanvasProps {
  ringProgress: ReturnType<typeof useSharedValue<number>>;
  coreColor:    ReturnType<typeof useDerivedValue<string>>;
  syncPct:      ReturnType<typeof useSharedValue<number>>;
}

const FS_DIAL_MARKS = [
  { pct: 0.08, color: '#5544FF' },
  { pct: 0.32, color: '#AA00FF' },
  { pct: 0.58, color: '#FF7700' },
  { pct: 0.84, color: '#FF0055' },
] as const;

const KineticCanvas = React.memo(function KineticCanvas({
  ringProgress, coreColor, syncPct,
}: KineticCanvasProps) {
  const tickDimColor    = useDerivedValue(() => coreColor.value + '28');
  const tickBrightColor = useDerivedValue(() => coreColor.value + '55');
  const bezelColor      = useDerivedValue(() => coreColor.value + '18');

  const coherenceOpacity = useDerivedValue(() =>
    Math.max(0, (syncPct.value - 15) / 85)
  );
  const coherenceBlur = useDerivedValue(() =>
    interpolate(syncPct.value, [0, 100], [24, 2])
  );
  const coherenceWidth = useDerivedValue(() =>
    interpolate(syncPct.value, [0, 100], [1.5, 4])
  );

  const arcPath = useDerivedValue(() => {
    const sweep = Math.max(0, ringProgress.value * 360);
    if (sweep < 0.5) return Skia.Path.Make();
    const path = Skia.Path.Make();
    path.addArc(
      { x: CX - RING_R, y: CY - RING_R, width: RING_R * 2, height: RING_R * 2 },
      -90, sweep,
    );
    return path;
  });

  const arcTipGlow = useDerivedValue(() => {
    const sweep = Math.max(0, ringProgress.value * 360);
    if (sweep < 3) return Skia.Path.Make();
    const a = (-90 + sweep) * (Math.PI / 180);
    const tx = CX + RING_R * Math.cos(a);
    const ty = CY + RING_R * Math.sin(a);
    const p = Skia.Path.Make();
    p.addOval({ x: tx - 10, y: ty - 10, width: 20, height: 20 });
    return p;
  });

  const arcTipCore = useDerivedValue(() => {
    const sweep = Math.max(0, ringProgress.value * 360);
    if (sweep < 3) return Skia.Path.Make();
    const a = (-90 + sweep) * (Math.PI / 180);
    const tx = CX + RING_R * Math.cos(a);
    const ty = CY + RING_R * Math.sin(a);
    const p = Skia.Path.Make();
    p.addOval({ x: tx - 3.5, y: ty - 3.5, width: 7, height: 7 });
    return p;
  });

  const { minorTicks, majorTicks, dialMarks } = React.useMemo(() => {
    const minor = Skia.Path.Make();
    const major = Skia.Path.Make();
    const TICK_OUT = OUTER_R - 1;
    for (let i = 0; i < 48; i++) {
      const isMajor = i % 12 === 0;
      const rad = ((i / 48) * 360 - 90) * (Math.PI / 180);
      const inR = isMajor ? OUTER_R - 10 : OUTER_R - 4;
      const xi = CX + inR      * Math.cos(rad);
      const yi = CY + inR      * Math.sin(rad);
      const xo = CX + TICK_OUT * Math.cos(rad);
      const yo = CY + TICK_OUT * Math.sin(rad);
      (isMajor ? major : minor).moveTo(xi, yi);
      (isMajor ? major : minor).lineTo(xo, yo);
    }
    const marks = FS_DIAL_MARKS.map(({ pct, color }) => {
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
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }} pointerEvents="none">
      {/* Outer bezel ring */}
      <Circle cx={CX} cy={CY} r={OUTER_R}>
        <Paint style="stroke" strokeWidth={0.75} color={bezelColor} />
      </Circle>
      {/* Minor ticks (7.5° spacing) */}
      <Path path={minorTicks}>
        <Paint style="stroke" strokeWidth={1} color={tickDimColor} strokeCap="round" />
      </Path>
      {/* Major ticks (cardinal) */}
      <Path path={majorTicks}>
        <Paint style="stroke" strokeWidth={2} color={tickBrightColor} strokeCap="round" />
      </Path>
      {/* Ring track */}
      <Circle cx={CX} cy={CY} r={RING_R}>
        <Paint style="stroke" strokeWidth={RING_T} color="rgba(10,10,24,0.97)" />
      </Circle>
      {/* Level dial marks */}
      {dialMarks.map((m, i) => (
        <Path key={i} path={m.path}>
          <Paint color={m.color} opacity={0.55} />
        </Path>
      ))}
      {/* Inner detail ring */}
      <Circle cx={CX} cy={CY} r={INNER_R}>
        <Paint style="stroke" strokeWidth={0.75} color={bezelColor} />
      </Circle>
      {/* Wide bloom glow */}
      <Path path={arcPath}>
        <Paint style="stroke" strokeWidth={RING_T + 28} strokeCap="round" color={coreColor} opacity={0.18}>
          <BlurMask blur={30} style="normal" />
        </Paint>
      </Path>
      {/* Mid glow */}
      <Path path={arcPath}>
        <Paint style="stroke" strokeWidth={RING_T + 12} strokeCap="round" color={coreColor} opacity={0.30}>
          <BlurMask blur={12} style="normal" />
        </Paint>
      </Path>
      {/* Sharp arc */}
      <Path path={arcPath}>
        <Paint style="stroke" strokeWidth={RING_T} strokeCap="round" color={coreColor} />
      </Path>
      {/* Arc tip bloom */}
      <Path path={arcTipGlow}>
        <Paint color={coreColor} opacity={0.60}>
          <BlurMask blur={12} style="solid" />
        </Paint>
      </Path>
      {/* Arc tip core dot (accent color, no white) */}
      <Path path={arcTipCore}>
        <Paint color={coreColor} opacity={0.95} />
      </Path>
      {/* Coherence ring */}
      <Circle cx={CX} cy={CY} r={RING_R + 8}>
        <Paint style="stroke" strokeWidth={coherenceWidth} color="#00FFCC" opacity={coherenceOpacity}>
          <BlurMask blur={coherenceBlur} style="solid" />
        </Paint>
      </Circle>
    </Canvas>
  );
});

// ─── Main Component ────────────────────────────────────────────────────────────

export default function SurgeFullScreen({
  visible, surge, venueName, venueId, onClose, onTap, tapping, cooldown,
  socket, userId, syncPct: syncPctProp, questState, bpmNow,
}: Props) {
  const insets = useSafeAreaInsets();

  // Reanimated shared values for Skia
  const ringProgress   = useSharedValue(surge.charge_pct);
  const localSyncPct   = useSharedValue(0);
  const syncPct        = syncPctProp ?? localSyncPct;
  const coreColor      = useDerivedValue(() => surge.level_color);

  // Sync ring progress when surge updates
  useEffect(() => {
    ringProgress.value = withTiming(surge.charge_pct, { duration: 600 });
  }, [surge.charge_pct]);

  // Legacy animated values for non-Skia animations
  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const entryScale  = useRef(new Animated.Value(0.9)).current;
  const boltScale   = useRef(new Animated.Value(1)).current;
  const glowAnim    = useRef(new Animated.Value(0.6)).current;
  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const bigNumScale = useRef(new Animated.Value(1)).current;
  const flashOpacity= useRef(new Animated.Value(0)).current;
  const surgeFlash  = useRef(new Animated.Value(0)).current;

  const [ripples, setRipples]             = useState<Ripple[]>([]);
  const [localTapCount, setLocalTapCount] = useState(0);
  const [localCooldown, setLocalCooldown] = useState(false);
  const [comboCount, setComboCount]       = useState(0);
  const [comboFired, setComboFired]       = useState(false);
  const [globalSurgeActive, setGlobalSurgeActive] = useState(false);
  const [energyCriticalMsg, setEnergyCriticalMsg] = useState<string | null>(null);

  const rippleId           = useRef(0);
  const prevLevel          = useRef('');
  const latestAccel        = useRef({ x: 0, y: 0, z: 1 });
  const comboTaps          = useRef<number[]>([]);
  const localCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboResetTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surgeResetTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const color      = surge.level_color;
  const isElectric = surge.level === 'electric';
  const pct        = Math.round(surge.charge_pct * 100);
  const displayTapCount = localTapCount > 0 ? localTapCount : surge.tap_count;

  // ── Accelerometer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    Accelerometer.setUpdateInterval(16);
    const sub = Accelerometer.addListener(d => { latestAccel.current = d; });
    return () => sub.remove();
  }, [visible]);

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !venueId) return;
    const onGlobalSurge = (data: { venue_id: string }) => {
      if (data.venue_id !== venueId) return;
      setGlobalSurgeActive(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    return () => { socket.off('global_surge', onGlobalSurge); socket.off('energy_critical', onEnergyCritical); };
  }, [socket, venueId]);

  useEffect(() => {
    return () => {
      clearTimeout(localCooldownTimer.current ?? undefined);
      clearTimeout(comboResetTimer.current ?? undefined);
      clearTimeout(surgeResetTimer.current ?? undefined);
    };
  }, []);

  // ── Entry animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      bgOpacity.setValue(0); entryScale.setValue(0.9);
      Animated.parallel([
        Animated.timing(bgOpacity,  { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(entryScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ── Electric glow loop ──────────────────────────────────────────────────────
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

  // ── ELECTRIC transition flash ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (isElectric && prevLevel.current !== 'electric') {
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.2, duration: 80,  useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0,   duration: 400, useNativeDriver: true }),
      ]).start();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 100);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 250);
      }
    }
    prevLevel.current = surge.level;
  }, [surge.level, visible]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 30, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 20, useNativeDriver: true }),
    ]).start();
  }, []);

  const triggerBigNumPop = useCallback(() => {
    Animated.sequence([
      Animated.timing(bigNumScale, { toValue: 1.35, duration: 80, useNativeDriver: true }),
      Animated.spring(bigNumScale, { toValue: 1, tension: 400, friction: 6, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Main tap handler ────────────────────────────────────────────────────────
  const handleTap = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const isCooling = cooldown || tapping;

    const id = ++rippleId.current;
    const scale   = new Animated.Value(0);
    const opacity = new Animated.Value(isCooling ? 0.2 : 0.6);
    setRipples(prev => [...prev, { id, x: locationX, y: locationY, scale, opacity }]);
    Animated.parallel([
      Animated.timing(scale,   { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 750, useNativeDriver: true }),
    ]).start(() => setRipples(prev => prev.filter(r => r.id !== id)));

    Animated.sequence([
      Animated.timing(boltScale, { toValue: isCooling ? 0.9 : 0.72, duration: 60, useNativeDriver: true }),
      Animated.spring(boltScale, { toValue: 1, tension: 400, friction: 5, useNativeDriver: true }),
    ]).start();

    const { x, y, z } = latestAccel.current;
    const g = Math.sqrt(x * x + y * y + z * z);
    const isPower = g > POWER_THRESHOLD;
    const uiMult  = isPower ? 10 : 1;

    if (!localCooldown) {
      setLocalTapCount(c => c + uiMult);
      triggerBigNumPop();

      const now = Date.now();
      comboTaps.current = comboTaps.current.filter(ts => now - ts < COMBO_WINDOW_MS);
      comboTaps.current.push(now);
      const currentCombo = comboTaps.current.length;
      setComboCount(currentCombo);

      if (currentCombo >= COMBO_TARGET) {
        comboTaps.current = [];
        setComboFired(true);
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        triggerShake();
        Animated.sequence([
          Animated.timing(new Animated.Value(0), { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start(() => setComboFired(false));
        clearTimeout(comboResetTimer.current ?? undefined);
        comboResetTimer.current = setTimeout(() => setComboCount(0), 3000);
      }

      if (isPower && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        triggerShake();
      } else if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      socket?.emit('vibe_pulse', { venue_id: venueId, user_id: userId, intensity: isPower ? 'power' : 'soft', ui_increment: uiMult });

      setLocalCooldown(true);
      clearTimeout(localCooldownTimer.current ?? undefined);
      localCooldownTimer.current = setTimeout(() => setLocalCooldown(false), VISUAL_COOLDOWN_MS);
    } else {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (!isCooling) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 80);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 180);
      }
      onTap();
    }
  }, [cooldown, tapping, localCooldown, onTap, socket, venueId, userId, triggerShake, triggerBigNumPop]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[
        s.overlay,
        {
          opacity: bgOpacity,
          transform: [{ translateX: shakeAnim }],
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 20,
        },
      ]}>
        <LinearGradient colors={['#000010', '#040412', '#000008']} style={StyleSheet.absoluteFill} />

        {/* Global surge flash */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFD60A', opacity: surgeFlash }]} pointerEvents="none" />
        {/* ELECTRIC flash */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flashOpacity }]} pointerEvents="none" />

        {/* Electric color wash */}
        {isElectric && (
          <Animated.View style={[StyleSheet.absoluteFill, {
            backgroundColor: color,
            opacity: glowAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.04, 0.12] }),
          }]} pointerEvents="none" />
        )}

        {/* Global Surge banner */}
        {globalSurgeActive && (
          <View style={s.surgeBanner} pointerEvents="none">
            <Text style={s.surgeBannerText}>⚡ GLOBAL SURGE ⚡</Text>
            <Text style={s.surgeBannerSub}>1,000 taps — venue is ELECTRIC</Text>
          </View>
        )}

        {/* Energy critical */}
        {energyCriticalMsg && (
          <View style={s.criticalBanner}>
            <Text style={s.criticalBannerText}>{energyCriticalMsg}</Text>
          </View>
        )}

        {/* Close */}
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color="#555" />
        </TouchableOpacity>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerLabel}>VIBE CHARGE</Text>
          <Text style={s.headerVenue} numberOfLines={1}>{venueName}</Text>
          {surge.is_squad_surge && (
            <View style={s.squadBadge}>
              <Ionicons name="people" size={10} color="#9933FF" />
              <Text style={s.squadBadgeText}>SQUAD SURGE 1.5×</Text>
            </View>
          )}
        </View>

        {/* ── Tap zone with Skia canvas ── */}
        <Animated.View
          style={[s.tapZone, { transform: [{ scale: entryScale }] }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={handleTap}
        >
          {/* Ripples */}
          {ripples.map(r => (
            <Animated.View key={r.id} pointerEvents="none" style={[s.ripple, {
              left: r.x - 90, top: r.y - 90,
              borderColor: color,
              transform: [{ scale: r.scale.interpolate({ inputRange: [0, 1], outputRange: [0.1, 3.8] }) }],
              opacity: r.opacity,
            }]} />
          ))}

          {/* Skia ring */}
          <KineticCanvas
            ringProgress={ringProgress}
            coreColor={coreColor}
            syncPct={syncPct}
          />

          {/* Center content — overlaid on canvas */}
          <View style={s.centerContent} pointerEvents="none">
            <Animated.View style={{ transform: [{ scale: boltScale }] }}>
              <Ionicons
                name="flash"
                size={80}
                color={localCooldown ? '#252535' : color}
                style={{
                  textShadowColor: color,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: isElectric ? 40 : 16,
                } as any}
              />
            </Animated.View>
            <Animated.Text style={[s.levelLabel, { color, opacity: isElectric ? glowAnim : 1 }]}>
              {surge.level_label}
            </Animated.Text>
            <Animated.Text style={[s.bigNumber, { color, transform: [{ scale: bigNumScale }] }]}>
              {displayTapCount.toLocaleString()}
            </Animated.Text>
            <Text style={s.bigNumberSub}>
              {localTapCount > 0 ? 'taps this session' : 'taps tonight'}
            </Text>
          </View>
        </Animated.View>

        {/* ── Info row below canvas — combo, hint, BPM, quest ── */}
        <View style={s.infoBlock} pointerEvents="none">
          {/* Combo */}
          {comboCount > 0 && (
            <Text style={[s.comboLabel, comboFired && { color: '#00E676' }]}>
              {comboFired ? `COMBO ×${COMBO_TARGET} 🔥` : `COMBO ${comboCount}/${COMBO_TARGET}`}
            </Text>
          )}

          {/* Hint */}
          {localCooldown ? (
            <Text style={s.hintText}><Text style={{ color: color + '88' }}>⏱ </Text>visual cooldown — 15s</Text>
          ) : surge.next_level && surge.taps_to_next > 0 ? (
            <Text style={s.hintText}>
              <Text style={s.hintDim}>{surge.taps_to_next} taps to </Text>
              <Text style={{ color, fontWeight: '900' }}>{surge.next_level}</Text>
            </Text>
          ) : isElectric ? (
            <Animated.Text style={[s.hintText, { color, opacity: glowAnim }]}>
              ELECTRIC — KEEP IT ALIVE
            </Animated.Text>
          ) : (
            <Text style={s.hintText}>{cooldown ? 'Cooling down...' : 'Tap anywhere — power the venue'}</Text>
          )}

          {/* BPM + surges row */}
          <View style={s.statsRow}>
            {(bpmNow ?? 0) > 0 && (
              <View style={s.statChip}>
                <Text style={s.statNum}>{Math.round(bpmNow!)}</Text>
                <Text style={s.statLabel}> BPM</Text>
              </View>
            )}
            <View style={s.statChip}>
              <Text style={s.statNum}>{surge.total_surges}</Text>
              <Text style={s.statLabel}> SURGES</Text>
            </View>
          </View>

          {/* Quest bar — only when active */}
          {questState && questState.unique_scouts > 0 && (
            <View style={s.questBar}>
              <View style={s.questLeft}>
                <Text style={s.questLabel}>COLLECTIVE QUEST</Text>
                <Text style={s.questSub}>
                  {questState.quest_state === 'cooldown'
                    ? 'Quest cooldown — keep tapping'
                    : `${questState.unique_scouts} scout${questState.unique_scouts !== 1 ? 's' : ''} · target ${questState.resonance_min}–${questState.resonance_max} BPM`}
                </Text>
              </View>
              <View style={s.bpmBadge}>
                <Text style={s.bpmBadgeNum}>{Math.round(questState.aggregate_bpm)}</Text>
                <Text style={s.bpmBadgeLabel}>BPM</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom % bar */}
        <View style={s.bottom} pointerEvents="none">
          <View style={s.pctRow}>
            <Animated.Text style={[s.pctNum, { color, opacity: isElectric ? glowAnim : 1 }]}>{pct}</Animated.Text>
            <Text style={s.pctUnit}>%</Text>
          </View>
          <View style={s.pctTrack}>
            <View style={[s.pctFill, {
              width: `${pct}%` as any,
              backgroundColor: color,
              shadowColor: color, shadowOpacity: isElectric ? 0.9 : 0.5, shadowRadius: 8,
            }]} />
          </View>
          <Text style={s.bottomSub}>collective vibe charge</Text>
        </View>

      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:         { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  closeBtn:        { position: 'absolute', top: 52, left: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: '#0E0E1A', borderWidth: 1, borderColor: '#1C1C2C', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  surgeBanner:     { position: 'absolute', top: 120, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  surgeBannerText: { fontSize: 24, fontWeight: '900', color: '#FFD60A', letterSpacing: 3, textAlign: 'center' },
  surgeBannerSub:  { fontSize: 12, color: 'rgba(255,214,10,0.7)', marginTop: 4 },
  criticalBanner:  { position: 'absolute', top: 110, left: 16, right: 16, backgroundColor: 'rgba(255,59,48,0.18)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,59,48,0.5)', padding: 10, zIndex: 8, alignItems: 'center' },
  criticalBannerText: { fontSize: 12, fontWeight: '800', color: '#FF3B30', letterSpacing: 0.8, textAlign: 'center' },
  header:          { alignItems: 'center', gap: 5, paddingTop: 8 },
  headerLabel:     { fontSize: 10, color: '#3A3A4E', fontWeight: '700', letterSpacing: 2 },
  headerVenue:     { fontSize: 22, color: '#EEEEF5', fontWeight: '800', letterSpacing: 0.3, maxWidth: W - 80, textAlign: 'center' },
  squadBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#140024', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#9933FF44' },
  squadBadgeText:  { fontSize: 9, color: '#9933FF', fontWeight: '800', letterSpacing: 1 },
  tapZone:         { alignItems: 'center', justifyContent: 'center', width: CANVAS_SIZE, height: CANVAS_SIZE, position: 'relative' },
  ripple:          { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1.5 },
  centerContent:   { position: 'absolute', alignItems: 'center', gap: 4 },
  levelLabel:      { fontSize: 20, fontWeight: '900', letterSpacing: 3 },
  bigNumber:       { fontSize: 44, fontWeight: '900', lineHeight: 48, letterSpacing: -1 },
  bigNumberSub:    { fontSize: 10, color: 'rgba(130,125,170,0.55)', fontWeight: '600', letterSpacing: 0.5 },
  infoBlock:       { width: W - 48, alignItems: 'center', gap: 6, marginTop: 2 },
  comboLabel:      { fontSize: 13, fontWeight: '800', color: '#FFD60A', letterSpacing: 1 },
  hintText:        { fontSize: 13, color: '#555', fontWeight: '600', textAlign: 'center' },
  hintDim:         { color: '#444' },
  statsRow:        { flexDirection: 'row', gap: 16, marginTop: 2 },
  statChip:        { flexDirection: 'row', alignItems: 'baseline' },
  statNum:         { fontSize: 14, fontWeight: '800', color: 'rgba(160,155,200,0.70)' },
  statLabel:       { fontSize: 10, fontWeight: '600', color: 'rgba(140,135,180,0.45)', letterSpacing: 1 },
  bottom:          { width: W - 48, alignItems: 'center', gap: 8 },
  pctRow:          { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  pctNum:          { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  pctUnit:         { fontSize: 22, color: '#555', fontWeight: '700', paddingBottom: 4 },
  pctTrack:        { width: '100%', height: 4, backgroundColor: '#111120', borderRadius: 3, overflow: 'hidden' },
  pctFill:         { height: '100%', borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  bottomSub:       { fontSize: 10, color: '#2A2A3A', fontWeight: '600', letterSpacing: 1 },
  questBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: W - 48, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(255,214,10,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,214,10,0.15)', marginTop: 4 },
  questLeft:       { flex: 1, gap: 2 },
  questLabel:      { fontSize: 10, fontWeight: '700', color: '#FFD60A', letterSpacing: 1.2 },
  questSub:        { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  bpmBadge:        { alignItems: 'center', backgroundColor: 'rgba(255,214,10,0.10)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  bpmBadgeNum:     { fontSize: 20, fontWeight: '800', color: '#FFD60A', lineHeight: 22 },
  bpmBadgeLabel:   { fontSize: 9, fontWeight: '700', color: 'rgba(255,214,10,0.6)', letterSpacing: 1 },
} as any);
