import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import SurgeFullScreen from './SurgeFullScreen';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface SurgeState {
  charge_pct: number; level: string; level_label: string; level_color: string;
  level_progress: number; taps_to_next: number; next_level: string | null;
  tap_count: number; total_surges: number; is_squad_surge?: boolean;
}

const LEVEL_ORDER = ['dormant', 'stirring', 'buzzing', 'popping', 'electric'];

// Demo level progression — full journey from STIRRING to ELECTRIC in ~12 taps
const DEMO_LEVELS = [
  { level: 'dormant',  label: 'DORMANT',  color: '#3A3A4E', min: 0,    next: 'BUZZING' },
  { level: 'stirring', label: 'STIRRING', color: '#6655FF', min: 0.08, next: 'BUZZING' },
  { level: 'buzzing',  label: 'BUZZING',  color: '#33CCFF', min: 0.32, next: 'POPPING' },
  { level: 'popping',  label: 'POPPING',  color: '#FF9933', min: 0.58, next: 'ELECTRIC' },
  { level: 'electric', label: 'ELECTRIC', color: '#FF3366', min: 0.84, next: null },
];

export const DEMO_SURGE: SurgeState = {
  charge_pct: 0.08, level: 'stirring', level_label: 'STIRRING', level_color: '#6655FF',
  level_progress: 0.08, taps_to_next: 3, next_level: 'BUZZING', tap_count: 0, total_surges: 0,
};

interface Props {
  venueId: string; venueName: string; isDemoMode?: boolean;
  onElectric?: (tapCount: number) => void;
  onReact?: () => void;
}

export default function VibeSurgeBar({ venueId, venueName, isDemoMode, onElectric, onReact }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const socket         = useVibeStore(s => s.socket);
  const user           = useVibeStore(s => s.user);
  const [surge, setSurge]     = useState<SurgeState | null>(isDemoMode ? DEMO_SURGE : null);
  const [tapping, setTapping] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const prevLevel = useRef<string | null>(null);

  const barAnim   = useRef(new Animated.Value(isDemoMode ? DEMO_SURGE.level_progress : 0)).current;
  const glowAnim  = useRef(new Animated.Value(0.5)).current;
  const boltPulse = useRef(new Animated.Value(1)).current;
  const levelBump = useRef(new Animated.Value(1)).current;

  // Electric glow loop
  useEffect(() => {
    if (surge?.level === 'electric') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])).start();
    } else { glowAnim.setValue(0.85); }
  }, [surge?.level]);

  // Bolt icon idle pulse
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(boltPulse, { toValue: 1.2, duration: 800, useNativeDriver: true }),
      Animated.timing(boltPulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);

  useEffect(() => {
    if (!surge) return;
    Animated.spring(barAnim, { toValue: surge.level_progress, tension: 60, friction: 12, useNativeDriver: false }).start();

    // On ELECTRIC: let full-screen burst play (650ms), then close + fire celebration
    if (surge.level === 'electric' && prevLevel.current && prevLevel.current !== 'electric') {
      setTimeout(() => setShowFull(false), 650);
      setTimeout(() => onElectric?.(surge.tap_count), 750);
    }
    prevLevel.current = surge.level;
  }, [surge?.level_progress, surge?.level]);

  const fetchSurge = useCallback(async () => {
    if (isDemoMode) { setSurge(DEMO_SURGE); return; }
    try {
      const res = await fetch(API_URL + '/api/venues/' + venueId + '/surge');
      if (res.ok) setSurge(await res.json());
    } catch {}
  }, [venueId, isDemoMode]);

  useEffect(() => { fetchSurge(); }, [venueId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      if (data.venue_id !== venueId) return;
      fetchSurge();
      if (data.new_level === 'electric' && data.prev_level !== 'electric') {
        setTimeout(() => setShowFull(false), 650);
        setTimeout(() => onElectric?.(data.tap_count ?? 0), 750);
      }
      Animated.sequence([
        Animated.timing(levelBump, { toValue: 1.04, duration: 120, useNativeDriver: true }),
        Animated.timing(levelBump, { toValue: 1,    duration: 120, useNativeDriver: true }),
      ]).start();
    };
    socket.on('surge_update', handler);
    return () => { socket.off('surge_update', handler); };
  }, [socket, venueId]);

  const handleCharge = useCallback(async () => {
    if (cooldown || tapping) return;
    onReact?.();
    if (isDemoMode) {
      setSurge(prev => {
        if (!prev) return prev;
        const newProgress = Math.min(prev.level_progress + 0.08, 1.0);
        const lvl = [...DEMO_LEVELS].reverse().find(t => newProgress >= t.min) ?? DEMO_LEVELS[1];
        const nextLvl = DEMO_LEVELS.find(t => t.min > lvl.min);
        const tapsToNext = nextLvl ? Math.max(0, Math.ceil((nextLvl.min - newProgress) / 0.08)) : 0;
        return {
          ...prev,
          charge_pct: newProgress,
          level_progress: newProgress,
          tap_count: prev.tap_count + 1,
          level: lvl.level,
          level_label: lvl.label,
          level_color: lvl.color,
          next_level: lvl.next,
          taps_to_next: tapsToNext,
          total_surges: lvl.level === 'electric' && prev.level !== 'electric'
            ? prev.total_surges + 1
            : prev.total_surges,
        };
      });
      setCooldown(true); setTimeout(() => setCooldown(false), 800); return;
    }
    setTapping(true);
    try {
      const res = await fetch(API_URL + '/api/venues/' + venueId + '/bolt', { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) { const data = await res.json(); setSurge(data); }
      else if (res.status === 429) { setCooldown(true); setTimeout(() => setCooldown(false), 10000); }
    } catch {}
    setTapping(false);
  }, [cooldown, tapping, isDemoMode, venueId, onReact]);

  const handleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFull(true);
  };

  if (!surge) return null;
  const levelIdx  = LEVEL_ORDER.indexOf(surge.level);
  const color      = surge.level_color;
  const isElectric = surge.level === 'electric';

  return (
    <>
      {/* Compact trigger card */}
      <Animated.View style={[styles.container, {
        transform: [{ perspective: 900 }, { rotateX: '2deg' }, { scale: levelBump }],
        borderColor: isElectric ? color + 'AA' : color + '33',
        shadowColor: color,
        shadowOpacity: isElectric ? 0.55 : 0.18,
        shadowRadius: isElectric ? 16 : 6,
        shadowOffset: { width: 0, height: 4 },
        elevation: isElectric ? 8 : 3,
      }]}>
        <TouchableOpacity onPress={handleOpen} activeOpacity={0.8} style={styles.inner}>

          {/* Left: bolt icon — tap directly to charge */}
          <TouchableOpacity
            onPress={handleCharge}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
          >
            <Animated.View style={[styles.iconWrap, {
              borderColor: color + '88',
              backgroundColor: color + '15',
              shadowColor: color,
              shadowOpacity: isElectric ? 0.9 : 0.6,
              shadowRadius: isElectric ? 14 : 8,
              transform: [{ scale: isElectric ? boltPulse : 1 }],
            }]}>
              {/* 3D raised-button specular highlight */}
              <LinearGradient
                colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.iconShine}
                pointerEvents="none"
              />
              <Animated.View style={{ opacity: isElectric ? glowAnim : 1 }}>
                <Ionicons name="flash" size={20} color={color} />
              </Animated.View>
            </Animated.View>
          </TouchableOpacity>

          {/* Center: label + bar */}
          <View style={styles.centerBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>VIBE CHARGE</Text>
              <Animated.Text style={[styles.levelText, { color, opacity: isElectric ? glowAnim : 1 }]}>
                {surge.level_label}
              </Animated.Text>
            </View>

            {/* Progress bar — 3D embossed groove */}
            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFill, {
                width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: color,
                shadowColor: color,
                shadowOpacity: isElectric ? 0.9 : 0.5,
                shadowRadius: isElectric ? 10 : 4,
              }]}>
                {/* Glossy shine overlay — top-to-bottom fade */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </Animated.View>
            </View>

            <Text style={styles.subText}>
              {surge.tap_count} taps  ·  {surge.total_surges} surges
              {surge.is_squad_surge ? '  ·  Squad 1.5×' : ''}
            </Text>
          </View>

          {/* Right: dots + chevron */}
          <View style={styles.rightBlock}>
            <View style={styles.dotsCol}>
              {LEVEL_ORDER.map((_, i) => (
                <View key={i} style={[styles.dot,
                  i <= levelIdx
                    ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 4, elevation: 3 }
                    : { backgroundColor: '#1E1E2E' }
                ]} />
              ))}
            </View>
            <Ionicons name="chevron-forward" size={14} color={color + '99'} />
          </View>

        </TouchableOpacity>
      </Animated.View>

      {/* Full-screen surge experience */}
      <SurgeFullScreen
        visible={showFull}
        surge={surge}
        venueName={venueName}
        venueId={venueId}
        onClose={() => setShowFull(false)}
        onTap={handleCharge}
        tapping={tapping}
        cooldown={cooldown}
        socket={socket}
        userId={user?.id}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container:    {
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C',
    marginHorizontal: 16, marginTop: 12,
    // 3D depth shadow base
    shadowOffset: { width: 0, height: 4 },
  },
  inner:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap:     {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 2 }, overflow: 'hidden',
  },
  iconShine:    { position: 'absolute', top: 0, left: 0, right: 0, height: '55%', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  centerBlock:  { flex: 1, gap: 6 },
  labelRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  levelText:    { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  barTrack:     {
    height: 8, backgroundColor: '#0A0A18', borderRadius: 4, overflow: 'hidden',
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.7)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  barFill:      { height: 8, borderRadius: 4, shadowOffset: { width: 0, height: 0 }, overflow: 'hidden' },
  subText:      { fontSize: 9, color: '#3A3A4E', fontWeight: '500' },
  rightBlock:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotsCol:      { gap: 4, alignItems: 'center' },
  dot:          { width: 6, height: 6, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
});
