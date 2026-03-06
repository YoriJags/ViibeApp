import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

export const DEMO_SURGE: SurgeState = {
  charge_pct: 0.72, level: 'popping', level_label: 'POPPING', level_color: '#FF9933',
  level_progress: 0.71, taps_to_next: 12, next_level: 'ELECTRIC', tap_count: 87, total_surges: 3,
};

interface Props {
  venueId: string; venueName: string; isDemoMode?: boolean;
  onElectric?: (tapCount: number) => void;
  onReact?: () => void;
}

export default function VibeSurgeBar({ venueId, venueName, isDemoMode, onElectric, onReact }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const socket         = useVibeStore(s => s.socket);
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
        const newCharge  = Math.min(prev.charge_pct + 0.03, 1);
        const toElectric = newCharge >= 0.85 && prev.level !== 'electric';
        return {
          ...prev, charge_pct: newCharge,
          level_progress: Math.min(prev.level_progress + 0.06, 1),
          tap_count: prev.tap_count + 1, taps_to_next: Math.max(0, prev.taps_to_next - 1),
          ...(toElectric ? { level: 'electric', level_label: 'ELECTRIC', level_color: '#FF3366', next_level: null, taps_to_next: 0 } : {}),
        };
      });
      setCooldown(true); setTimeout(() => setCooldown(false), 3000); return;
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
      <Animated.View style={[styles.container, { transform: [{ scale: levelBump }] }]}>
        <TouchableOpacity onPress={handleOpen} activeOpacity={0.8} style={styles.inner}>

          {/* Left: pulsing bolt icon */}
          <Animated.View style={[styles.iconWrap, {
            borderColor: color + '55',
            shadowColor: color,
            shadowOpacity: isElectric ? 0.9 : 0.5,
            shadowRadius: isElectric ? 14 : 7,
            transform: [{ scale: isElectric ? boltPulse : 1 }],
          }]}>
            <Animated.View style={{ opacity: isElectric ? glowAnim : 1 }}>
              <Ionicons name="flash" size={20} color={color} />
            </Animated.View>
          </Animated.View>

          {/* Center: label + bar */}
          <View style={styles.centerBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>VIBE CHARGE</Text>
              <Animated.Text style={[styles.levelText, { color, opacity: isElectric ? glowAnim : 1 }]}>
                {surge.level_label}
              </Animated.Text>
            </View>

            {/* Progress bar */}
            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFill, {
                width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: color,
                shadowColor: color,
                shadowOpacity: isElectric ? 0.9 : 0.5,
                shadowRadius: isElectric ? 10 : 4,
              }]} />
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
        onClose={() => setShowFull(false)}
        onTap={handleCharge}
        tapping={tapping}
        cooldown={cooldown}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container:    { backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C', marginHorizontal: 16, marginTop: 12 },
  inner:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconWrap:     { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 0 } },
  centerBlock:  { flex: 1, gap: 5 },
  labelRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  levelText:    { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  barTrack:     { height: 5, backgroundColor: '#181826', borderRadius: 3, overflow: 'visible' },
  barFill:      { height: 5, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  subText:      { fontSize: 9, color: '#3A3A4E', fontWeight: '500' },
  rightBlock:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotsCol:      { gap: 4, alignItems: 'center' },
  dot:          { width: 6, height: 6, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
});
