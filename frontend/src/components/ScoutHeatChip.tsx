/**
 * ScoutHeatChip — compact heat level strip for the home feed header.
 * Always visible above the explore feed. Taps through to profile.
 * This is the persistent signal that "you are in a game worth playing."
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVibeStore } from '../store/vibeStore';
import { DEMO_HEAT } from './ScoutHeatCard';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const LEVEL_ICONS: Record<string, string> = {
  shadow: 'eye-off', rising: 'trending-up', scene_maker: 'star', hot: 'flame', vibe_god: 'flash',
};

export default function ScoutHeatChip() {
  const router         = useRouter();
  const user           = useVibeStore(s => s.user);
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const isDemoMode     = useVibeStore(s => s.isDemoMode);

  const [heat, setHeat] = useState(isDemoMode ? DEMO_HEAT : null);
  const barAnim  = useRef(new Animated.Value(isDemoMode ? DEMO_HEAT.heat_progress : 0)).current;
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  const bumpAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isDemoMode) { setHeat(DEMO_HEAT); return; }
    if (!user?.id) return;
    fetch(`${API_URL}/api/users/${user.id}/heat`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setHeat(data); })
      .catch(() => {});
  }, [user?.id, isDemoMode]);

  const _level    = (heat as any)?.heat_level ?? 'cold';
  const _progress = (heat as any)?.heat_progress ?? 0;

  useEffect(() => {
    if (!heat) return;
    Animated.spring(barAnim, { toValue: _progress, tension: 60, friction: 12, useNativeDriver: false }).start();
    Animated.sequence([
      Animated.timing(bumpAnim, { toValue: 1.06, duration: 150, useNativeDriver: true }),
      Animated.spring(bumpAnim, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [_level]);

  // Glow pulse for hot/on_fire
  useEffect(() => {
    if (!heat || !['hot', 'on_fire', 'vibe_god'].includes(_level)) { glowAnim.setValue(0.7); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [_level]);

  if (!heat) return null;

  // The backend emits heat_ keys; aura_ aliases remain only for old clients.
  const d         = heat as any;
  const color     = d.heat_color ?? d.heat_color ?? '#3A3A4E';
  const label     = (d.heat_label ?? d.heat_label ?? 'Cold') as string;
  const level     = (d.heat_level ?? d.heat_level ?? 'cold') as string;
  const progress  = (d.heat_progress ?? d.heat_progress ?? 0) as number;
  const iconName  = (LEVEL_ICONS[level] ?? 'star') as any;
  const pct       = Math.round(progress * 100);

  return (
    <TouchableOpacity
      onPress={() => router.push('/(public)/profile')}
      activeOpacity={0.8}
      style={styles.wrapper}
    >
      <Animated.View style={[styles.chip, {
        borderColor: color + '40',
        transform: [{ scale: bumpAnim }],
        shadowColor: color,
      }]}>
        {/* Icon */}
        <Animated.View style={[styles.iconWrap, { backgroundColor: color + '20', opacity: glowAnim }]}>
          <Ionicons name={iconName} size={13} color={color} />
        </Animated.View>

        {/* Label */}
        <View style={styles.textBlock}>
          <Text style={[styles.levelName, { color }]}>{label.toUpperCase()}</Text>
          <Text style={styles.subLabel}>TONIGHT'S HEAT</Text>
        </View>

        {/* Mini progress bar */}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, {
            width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: color,
          }]} />
        </View>

        {/* Pct */}
        <Text style={[styles.pctText, { color: color + 'BB' }]}>{pct}%</Text>

        <Ionicons name="chevron-forward" size={11} color={color + '66'} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper:   { marginHorizontal: 16, marginTop: 6, marginBottom: 2 },
  chip:      {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0C0C15', borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  iconWrap:  { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  textBlock: { flex: 0 },
  levelName: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, lineHeight: 13 },
  subLabel:  { fontSize: 8, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1 },
  barTrack:  { flex: 1, height: 3, backgroundColor: '#181826', borderRadius: 2, overflow: 'hidden' },
  barFill:   { height: 3, borderRadius: 2 },
  pctText:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
