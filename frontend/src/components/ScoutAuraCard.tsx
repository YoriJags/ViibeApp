import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AuraState {
  aura_score: number; aura_level: string; aura_label: string; aura_color: string;
  aura_progress: number; points_to_next: number; next_level_label: string | null;
  checkin_count: number; rating_count: number; bolt_count: number;
  streak_days: number; crew_size: number; perks: string[];
}
export const DEMO_AURA: AuraState = {
  aura_score: 74, aura_level: 'scene_maker', aura_label: 'Scene Maker', aura_color: '#9933FF',
  aura_progress: 0.54, points_to_next: 26, next_level_label: 'Hot Scout',
  checkin_count: 12, rating_count: 18, bolt_count: 31, streak_days: 4, crew_size: 5,
  perks: ['Vibe Oracle early access', 'Squad Surge 1.5x multiplier', 'Scene Report digest'],
};
const LEVEL_ORDER = ['shadow', 'rising', 'scene_maker', 'hot', 'vibe_god'];
const LEVEL_ICONS: Record<string, string> = { shadow: 'eye-off', rising: 'trending-up', scene_maker: 'star', hot: 'flame', vibe_god: 'flash' };
interface Props { userId?: string; isDemoMode?: boolean; }
export default function ScoutAuraCard({ userId, isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [aura, setAura] = useState<AuraState | null>(isDemoMode ? DEMO_AURA : null);
  const [expanded, setExpanded] = useState(false);
  const barAnim    = useRef(new Animated.Value(isDemoMode ? DEMO_AURA.aura_progress : 0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (aura?.aura_level === 'vibe_god') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 700, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 700, useNativeDriver: false }),
      ])).start();
    } else { glowAnim.setValue(0.85); }
  }, [aura?.aura_level]);

  useEffect(() => {
    if (!aura) return;
    Animated.spring(barAnim, { toValue: aura.aura_progress, tension: 60, friction: 12, useNativeDriver: false }).start();
  }, [aura?.aura_progress]);

  const fetchAura = useCallback(async () => {
    if (isDemoMode) { setAura(DEMO_AURA); return; }
    try {
      const url = userId ? API_URL + '/api/users/' + userId + '/aura' : API_URL + '/api/me/aura';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) setAura(await res.json());
    } catch {}
  }, [userId, isDemoMode]);

  useEffect(() => { fetchAura(); }, []);

  const toggleExpand = () => {
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.spring(expandAnim, { toValue, tension: 60, friction: 14, useNativeDriver: false }).start();
  };

  if (!aura) return null;
  const levelIdx = LEVEL_ORDER.indexOf(aura.aura_level);
  const color     = aura.aura_color;
  const isGod     = aura.aura_level === 'vibe_god';
  const iconName  = (LEVEL_ICONS[aura.aura_level] || 'star') as any;
  const stats = [
    { label: 'Check-ins', value: aura.checkin_count, pts: '+3 pts each', icon: 'location' },
    { label: 'Ratings',   value: aura.rating_count,  pts: '+2 pts each', icon: 'star' },
    { label: 'Bolts',     value: aura.bolt_count,     pts: '+1 pt each',  icon: 'flash' },
    { label: 'Streak',    value: aura.streak_days,    pts: '+1.5/day',    icon: 'flame' },
  ];
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.8} style={styles.headerRow}>
        <LinearGradient colors={[color + '22', color + '08']} style={styles.iconCircle}>
          <Ionicons name={iconName} size={20} color={color} />
        </LinearGradient>
        <View style={styles.titleBlock}>
          <Text style={styles.sectionLabel}>SCOUT AURA</Text>
          <Animated.Text style={[styles.levelLabel, { color, opacity: isGod ? glowAnim : 1 }]}>
            {aura.aura_label}
          </Animated.Text>
        </View>
        <View style={styles.rightBlock}>
          <Text style={[styles.scoreText, { color }]}>{aura.aura_score}</Text>
          <Text style={styles.scoreUnit}>pts</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#3A3A4E" style={{ marginLeft: 8 }} />
      </TouchableOpacity>

      <View style={styles.dotsRow}>
        {LEVEL_ORDER.map((lvl, i) => (
          <View key={lvl} style={styles.dotItem}>
            <View style={[styles.dot, i <= levelIdx
              ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 5, elevation: 4 }
              : { backgroundColor: '#1E1E2E' }]} />
            {i < LEVEL_ORDER.length - 1 && (
              <View style={[styles.dotLine, i < levelIdx ? { backgroundColor: color + '60' } : {}]} />
            )}
          </View>
        ))}
      </View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, {
          width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color, shadowColor: color,
          shadowOpacity: isGod ? 0.9 : 0.5, shadowRadius: isGod ? 12 : 5,
        }]} />
      </View>

      {aura.next_level_label && aura.points_to_next > 0 ? (
        <Text style={styles.progressHint}>
          <Text style={{ color: '#555' }}>{aura.points_to_next} pts to </Text>
          <Text style={{ color, fontWeight: '900' }}>{aura.next_level_label}</Text>
        </Text>
      ) : isGod ? (
        <Animated.Text style={[styles.progressHint, { color, opacity: glowAnim }]}>MAXIMUM VIBE UNLOCKED</Animated.Text>
      ) : null}

      <Animated.View style={[styles.expandable, {
        maxHeight: expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
        opacity: expandAnim,
      }]}>
        <View style={styles.divider} />
        <View style={styles.statsGrid}>
          {stats.map(s => (
            <View key={s.label} style={styles.statCell}>
              <Ionicons name={s.icon as any} size={13} color={color} style={{ marginBottom: 4 }} />
              <Text style={[styles.statValue, { color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statPts}>{s.pts}</Text>
            </View>
          ))}
        </View>
        <View style={styles.crewRow}>
          <Ionicons name="people" size={12} color="#555" />
          <Text style={styles.crewText}>Crew: <Text style={{ color }}>{aura.crew_size}</Text> scouts</Text>
        </View>
        {aura.perks.length > 0 && (
          <View style={styles.perksBlock}>
            <Text style={styles.perksTitle}>YOUR PERKS</Text>
            {aura.perks.map((perk, i) => (
              <View key={i} style={styles.perkRow}>
                <Ionicons name="checkmark-circle" size={13} color={color} />
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  container:    { backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C', padding: 14, marginHorizontal: 16, marginTop: 12, overflow: 'hidden' },
  headerRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle:   { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  titleBlock:   { flex: 1, gap: 2 },
  sectionLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  levelLabel:   { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  rightBlock:   { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  scoreText:    { fontSize: 22, fontWeight: '900' },
  scoreUnit:    { fontSize: 11, color: '#555', fontWeight: '600' },
  dotsRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dotItem:      { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot:          { width: 10, height: 10, borderRadius: 5, shadowOffset: { width: 0, height: 0 } },
  dotLine:      { flex: 1, height: 2, backgroundColor: '#1E1E2E', marginHorizontal: 3 },
  barTrack:     { height: 4, backgroundColor: '#181826', borderRadius: 3, marginBottom: 6 },
  barFill:      { height: 4, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  progressHint: { fontSize: 11, color: '#555', fontWeight: '600', marginBottom: 2 },
  divider:      { height: 1, backgroundColor: '#181826', marginVertical: 12 },
  statsGrid:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statCell:     { flex: 1, alignItems: 'center', backgroundColor: '#111120', borderRadius: 10, padding: 8, marginHorizontal: 3 },
  statValue:    { fontSize: 18, fontWeight: '900' },
  statLabel:    { fontSize: 9, color: '#555', fontWeight: '600', letterSpacing: 0.5, marginTop: 1 },
  statPts:      { fontSize: 8, color: '#333', fontWeight: '500', marginTop: 2 },
  crewRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  crewText:     { fontSize: 11, color: '#444', fontWeight: '500' },
  perksBlock:   { backgroundColor: '#111120', borderRadius: 10, padding: 10 },
  perksTitle:   { fontSize: 8, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  perkRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  perkText:     { fontSize: 11, color: '#777', fontWeight: '500', flex: 1 },
  expandable:   { overflow: 'hidden' },
});
