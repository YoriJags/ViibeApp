/**
 * TorchButton — torch control for concert moments.
 *
 * Three modes:
 *  1. Manual toggle  — always accessible, one tap on/off
 *  2. IGNITE SCENE   — hold to charge with other scouts (vibe ≥ 85 only)
 *     Server counts holders → broadcasts flash_ignite when threshold met
 *  3. Socket-driven  — server fires flash_ignite with pattern + timing
 *     supports 'single', 'pulse' (3× blink), 'wave' (staggered delay_ms)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Pressable,
  StyleSheet, Animated, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

// expo-camera controls the torch hardware via hidden CameraView
let CameraView: any = null;
let useCameraPermissions: any = null;
if (Platform.OS !== 'web') {
  try {
    const cam = require('expo-camera');
    CameraView = cam.CameraView;
    useCameraPermissions = cam.useCameraPermissions;
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlashIgnitePayload {
  pattern:    'single' | 'pulse' | 'wave';
  duration_ms: number;
  delay_ms?:  number;   // wave: per-scout stagger offset
}

interface Props {
  vibeScore:  number;
  venueId:    string;
  socket:     any | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IGNITE_THRESHOLD_SCORE = 85;   // vibe must be ≥ this for collective IGNITE
const IGNITE_HOLD_MS         = 2500; // hold duration before server fires

// ─── Component ───────────────────────────────────────────────────────────────

export default function TorchButton({ vibeScore, venueId, socket }: Props) {
  // ── permissions ────────────────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions
    ? useCameraPermissions()
    : [null, async () => {}];

  // ── state ──────────────────────────────────────────────────────────────────
  const [torchOn,      setTorchOn]      = useState(false);
  const [holding,      setHolding]      = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);  // 0→1 over IGNITE_HOLD_MS
  const [igniting,     setIgniting]     = useState(false); // server confirmed ignite

  // ── animation ──────────────────────────────────────────────────────────────
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const holdAnim    = useRef(new Animated.Value(0)).current;
  const igniteFlash = useRef(new Animated.Value(0)).current;

  const holdTimer  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const holdTickId = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── torch glow when on ─────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue:  torchOn ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [torchOn]);

  // ── socket: flash_ignite event ─────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleIgnite = async (payload: FlashIgnitePayload) => {
      const { pattern, duration_ms, delay_ms = 0 } = payload;

      // Staggered wave — each scout has a personal delay
      if (delay_ms > 0) {
        await new Promise(r => setTimeout(r, delay_ms));
      }

      setIgniting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Flash animation
      Animated.sequence([
        Animated.timing(igniteFlash, { toValue: 1, duration: 100, useNativeDriver: false }),
        Animated.timing(igniteFlash, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();

      if (pattern === 'pulse') {
        // 3 blinks
        for (let i = 0; i < 3; i++) {
          setTorchOn(true);
          await new Promise(r => setTimeout(r, duration_ms / 3));
          setTorchOn(false);
          if (i < 2) await new Promise(r => setTimeout(r, 120));
        }
      } else {
        // single or wave: one flash
        setTorchOn(true);
        await new Promise(r => setTimeout(r, duration_ms));
        setTorchOn(false);
      }

      setIgniting(false);
    };

    socket.on('flash_ignite', handleIgnite);
    return () => socket.off('flash_ignite', handleIgnite);
  }, [socket]);

  // ── manual toggle ──────────────────────────────────────────────────────────
  const handleManualToggle = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Torch', 'Torch is only available on mobile.');
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to use the torch.');
        return;
      }
    }
    const next = !torchOn;
    setTorchOn(next);
    Haptics.impactAsync(next
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Light
    );
  }, [torchOn, permission]);

  // ── IGNITE hold mechanic ───────────────────────────────────────────────────
  const startHold = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    setHolding(true);
    setHoldProgress(0);
    holdAnim.setValue(0);
    socket?.emit('ignite_hold_start', { venue_id: venueId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Progress tick
    const start = Date.now();
    holdTickId.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / IGNITE_HOLD_MS, 1);
      setHoldProgress(p);
      holdAnim.setValue(p);
      if (p >= 1) {
        clearInterval(holdTickId.current!);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 30);
  }, [socket, venueId, permission]);

  const endHold = useCallback(() => {
    clearInterval(holdTickId.current!);
    clearTimeout(holdTimer.current!);
    setHolding(false);
    setHoldProgress(0);
    holdAnim.setValue(0);
    socket?.emit('ignite_hold_end', { venue_id: venueId });
  }, [socket, venueId]);

  // ── cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    clearInterval(holdTickId.current!);
    clearTimeout(holdTimer.current!);
    setTorchOn(false);
  }, []);

  const canIgnite = vibeScore >= IGNITE_THRESHOLD_SCORE;

  // ── derived styles ─────────────────────────────────────────────────────────
  const glowColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(255,200,0,0)', 'rgba(255,200,0,0.35)'],
  });
  const igniteFlashColor = igniteFlash.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.25)'],
  });

  return (
    <View style={styles.wrapper}>
      {/* Hidden CameraView — only mounted on native when torch should be active */}
      {Platform.OS !== 'web' && torchOn && CameraView && (
        <CameraView
          style={styles.hiddenCamera}
          facing="back"
          enableTorch={true}
        />
      )}

      {/* Ignite flash overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.igniteFlashOverlay, { backgroundColor: igniteFlashColor }]}
        pointerEvents="none"
      />

      <View style={styles.row}>
        {/* ── Manual torch toggle ── */}
        <Animated.View style={[styles.torchBtnWrap, { shadowColor: 'rgba(255,200,0,1)', shadowOpacity: glowAnim, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }]}>
          <TouchableOpacity
            style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
            onPress={handleManualToggle}
            activeOpacity={0.8}
          >
            <Ionicons
              name={torchOn ? 'flashlight' : 'flashlight-outline'}
              size={22}
              color={torchOn ? '#FFD700' : 'rgba(255,255,255,0.5)'}
            />
            <Text style={[styles.torchLabel, torchOn && styles.torchLabelActive]}>
              {torchOn ? 'ON' : 'TORCH'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── IGNITE SCENE — collective hold ── */}
        {canIgnite && (
          <Pressable
            style={styles.igniteWrap}
            onPressIn={startHold}
            onPressOut={endHold}
          >
            <LinearGradient
              colors={holding ? ['#FF3366', '#FF8C00'] : ['rgba(255,51,102,0.15)', 'rgba(255,140,0,0.10)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.igniteBtn, holding && styles.igniteBtnActive]}
            >
              {/* Hold progress bar */}
              {holding && (
                <Animated.View
                  style={[
                    styles.holdBar,
                    { width: holdAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
              )}
              <Ionicons name="flame" size={18} color={holding ? '#FFF' : '#FF3366'} />
              <Text style={[styles.igniteLabel, holding && styles.igniteLabelActive]}>
                {igniting ? 'IGNITED 🔥' : holding ? `CHARGING ${Math.round(holdProgress * 100)}%` : 'IGNITE SCENE'}
              </Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      {canIgnite && (
        <Text style={styles.hint}>
          {holding ? 'Keep holding — other scouts are charging...' : 'Hold IGNITE to sync with everyone here'}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  hiddenCamera: {
    width: 0,
    height: 0,
    position: 'absolute',
  },
  igniteFlashOverlay: {
    borderRadius: 16,
    zIndex: 99,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },

  // Manual torch
  torchBtnWrap: {
    elevation: 0,
  },
  torchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  torchBtnActive: {
    backgroundColor: 'rgba(255,215,0,0.12)',
    borderColor: '#FFD70055',
  },
  torchLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.4)',
  },
  torchLabelActive: {
    color: '#FFD700',
  },

  // IGNITE hold button
  igniteWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  igniteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FF336633',
    position: 'relative',
    overflow: 'hidden',
  },
  igniteBtnActive: {
    borderColor: 'transparent',
  },
  holdBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  igniteLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#FF3366',
  },
  igniteLabelActive: {
    color: '#FFF',
  },

  hint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.20)',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
