import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';

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
interface Props { venueId: string; venueName: string; isDemoMode?: boolean; onElectric?: () => void; }

export default function VibeSurgeBar({ venueId, isDemoMode, onElectric }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const socket = useVibeStore(s => s.socket);
  const [surge, setSurge] = useState<SurgeState | null>(isDemoMode ? DEMO_SURGE : null);
  const [tapping, setTapping] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [boltFlash, setBoltFlash] = useState(false);
  const prevLevel = useRef<string | null>(null);
  const barAnim   = useRef(new Animated.Value(isDemoMode ? DEMO_SURGE.level_progress : 0)).current;
  const boltScale = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0.5)).current;
  const levelBump = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (surge?.level === 'electric') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 600, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 600, useNativeDriver: false }),
      ])).start();
    } else { glowAnim.setValue(0.65); }
  }, [surge?.level]);

  useEffect(() => {
    if (!surge) return;
    Animated.spring(barAnim, { toValue: surge.level_progress, tension: 60, friction: 12, useNativeDriver: false }).start();
    if (surge.level === 'electric' && prevLevel.current && prevLevel.current !== 'electric') onElectric?.();
    prevLevel.current = surge.level;
  }, [surge?.level_progress, surge?.level]);

  const fetchSurge = useCallback(async () => {
    if (isDemoMode) { setSurge(DEMO_SURGE); return; }
    try {
      const url = API_URL + '/api/venues/' + venueId + '/surge';
      const res = await fetch(url);
      if (res.ok) setSurge(await res.json());
    } catch {}
  }, [venueId, isDemoMode]);

  useEffect(() => { fetchSurge(); }, [venueId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      if (data.venue_id !== venueId) return;
      fetchSurge();
      if (data.new_level === 'electric' && data.prev_level !== 'electric') onElectric?.();
      Animated.sequence([
        Animated.timing(levelBump, { toValue: 1.06, duration: 150, useNativeDriver: true }),
        Animated.timing(levelBump, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]).start();
    };
    socket.on('surge_update', handler);
    return () => { socket.off('surge_update', handler); };
  }, [socket, venueId]);

  const handleBolt = async () => {
    if (cooldown || tapping) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBoltFlash(true); setTimeout(() => setBoltFlash(false), 300);
    Animated.sequence([
      Animated.timing(boltScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(boltScale, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    if (isDemoMode) {
      setSurge(prev => {
        if (!prev) return prev;
        const newCharge = Math.min(prev.charge_pct + 0.03, 1);
        const toElectric = newCharge >= 0.85 && prev.level !== 'electric';
        return { ...prev, charge_pct: newCharge,
          level_progress: Math.min(prev.level_progress + 0.06, 1),
          tap_count: prev.tap_count + 1, taps_to_next: Math.max(0, prev.taps_to_next - 1),
          ...(toElectric ? { level: 'electric', level_label: 'ELECTRIC', level_color: '#FF3366', next_level: null, taps_to_next: 0 } : {}),
        };
      });
      setCooldown(true); setTimeout(() => setCooldown(false), 10000); return;
    }
    setTapping(true);
    try {
      const url = API_URL + '/api/venues/' + venueId + '/bolt';
      const res = await fetch(url, { method: 'POST', headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json(); setSurge(data);
        if (data.is_squad_surge) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (res.status === 429) { setCooldown(true); setTimeout(() => setCooldown(false), 10000); }
    } catch {}
    setTapping(false);
  };

  if (!surge) return null;
  const levelIdx = LEVEL_ORDER.indexOf(surge.level);
  const color = surge.level_color;
  const isElectric = surge.level === 'electric';

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: levelBump }] }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.sectionLabel}>VIBE CHARGE</Text>
          <Animated.Text style={[styles.levelBadge, { color, opacity: isElectric ? glowAnim : 1 }]}>
            {surge.level_label}
          </Animated.Text>
        </View>
        <View style={styles.levelDots}>
          {LEVEL_ORDER.map((_, i) => (
            <View key={i} style={[styles.dot,
              i <= levelIdx
                ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 5, elevation: 4 }
                : { backgroundColor: '#1E1E2E' }]} />
          ))}
        </View>
      </View>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, {
          width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color, shadowColor: color,
          shadowOpacity: isElectric ? 0.9 : 0.5, shadowRadius: isElectric ? 12 : 5,
        }]} />
        <Animated.View style={[styles.barTip, {
          left: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '98%'] }),
          opacity: isElectric ? glowAnim : 0.8,
        }]} />
      </View>
      <View style={styles.bottomRow}>
        <View style={styles.statsBlock}>
          {surge.next_level && surge.taps_to_next > 0 ? (
            <Text style={styles.statsText}>
              <Text style={{ color: '#777' }}>{surge.taps_to_next} taps to </Text>
              <Text style={{ color, fontWeight: '900' }}>{surge.next_level}</Text>
            </Text>
          ) : isElectric ? (
            <Animated.Text style={[styles.statsText, { color, opacity: glowAnim }]}>
              SURGE ACTIVE - keep it alive
            </Animated.Text>
          ) : (
            <Text style={styles.statsText}>Tap to charge the venue</Text>
          )}
          <Text style={styles.subStats}>{surge.tap_count} taps tonight - {surge.total_surges} surges</Text>
        </View>
        <TouchableOpacity onPress={handleBolt} activeOpacity={0.75} disabled={tapping}>
          <Animated.View style={{ transform: [{ scale: boltScale }] }}>
            <LinearGradient
              colors={cooldown ? ['#181820', '#111118'] : isElectric ? [color + '55', color + '22'] : [color + '33', color + '18']}
              style={[styles.boltBtn, { borderColor: cooldown ? '#2A2A38' : boltFlash ? color : color + '55' }]}
            >
              {tapping ? <ActivityIndicator size="small" color={color} /> : <Ionicons name="flash" size={24} color={cooldown ? '#333' : color} />}
              {surge.is_squad_surge && !cooldown && (
                <View style={styles.squadPip}><Text style={styles.squadPipText}>1.5x</Text></View>
              )}
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </View>
      {surge.is_squad_surge && (
        <View style={styles.squadRow}>
          <Ionicons name="people" size={11} color="#9933FF" />
          <Text style={styles.squadText}>SQUAD SURGE - crew taps count 1.5x</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C', padding: 14, marginHorizontal: 16, marginTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  titleBlock: { gap: 2 },
  sectionLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  levelBadge: { fontSize: 17, fontWeight: '900', letterSpacing: 1.5 },
  levelDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, shadowOffset: { width: 0, height: 0 } },
  barTrack: { height: 5, backgroundColor: '#181826', borderRadius: 3, marginBottom: 12, position: 'relative', overflow: 'visible' },
  barFill: { height: 5, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  barTip: { position: 'absolute', top: -2, width: 5, height: 9, borderRadius: 3, backgroundColor: '#FFF', shadowColor: '#FFF', shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  statsBlock: { flex: 1, gap: 4 },
  statsText: { fontSize: 13, color: '#999', fontWeight: '600' },
  subStats: { fontSize: 10, color: '#3A3A4E', fontWeight: '500' },
  boltBtn: { width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10 },
  squadPip: { position: 'absolute', top: -3, right: -3, backgroundColor: '#9933FF', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: '#0C0C15' },
  squadPipText: { fontSize: 8, color: '#FFF', fontWeight: '900' },
  squadRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#181826' },
  squadText: { fontSize: 10, color: '#9933FF', fontWeight: '700', letterSpacing: 0.5 },
});
