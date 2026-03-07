/**
 * Tonight's Heat — nightly scout heat card.
 * Resets at 5AM. Every night is a clean slate.
 * Cold → Warming → Hot → On Fire
 *
 * "On Fire" ceremony fires via AuraLevelUp (repurposed).
 * StreakCelebration still fires at streak milestones.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVibeStore } from '../store/vibeStore';
import AuraLevelUp from './AuraLevelUp';
import StreakCelebration from './StreakCelebration';

const STREAK_MILESTONES = [3, 7, 14, 30];
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const HEAT_LEVELS = ['cold', 'warming', 'hot', 'on_fire'];
const HEAT_ICONS: Record<string, string> = {
  cold: 'moon', warming: 'trending-up', hot: 'flame', on_fire: 'flash',
};
const HEAT_PERKS: Record<string, string[]> = {
  warming: ['You showed up. That matters.'],
  hot:     ['You\'re in the scene tonight.', 'Hot Nights count +1'],
  on_fire: ['The scene feels you.', 'Hot Nights count +1', 'Scout radar visibility boost'],
};

interface HeatState {
  heat_score: number;
  heat_level: string;
  heat_label: string;
  heat_color: string;
  heat_progress: number;
  pts_to_next: number;
  next_level_label: string | null;
  checkins_tonight: number;
  ratings_tonight: number;
  bolts_tonight: number;
  hot_nights: number;
  streak_days: number;
}

export const DEMO_AURA: HeatState = {
  heat_score: 14,
  heat_level: 'hot',
  heat_label: 'Hot',
  heat_color: '#FF9933',
  heat_progress: 0.27,
  pts_to_next: 11,
  next_level_label: 'On Fire',
  checkins_tonight: 2,
  ratings_tonight: 1,
  bolts_tonight: 4,
  hot_nights: 12,
  streak_days: 4,
};

interface Props { userId?: string; isDemoMode?: boolean; }

export default function ScoutAuraCard({ userId, isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [heat, setHeat]               = useState<HeatState | null>(isDemoMode ? DEMO_AURA : null);
  const [showOnFire, setShowOnFire]   = useState(false);
  const [showStreak, setShowStreak]   = useState(false);
  const prevLevel  = useRef<string | null>(null);
  const prevStreak = useRef<number>(0);
  const barAnim    = useRef(new Animated.Value(isDemoMode ? DEMO_AURA.heat_progress : 0)).current;
  const glowAnim   = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (heat?.heat_level === 'on_fire') {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 600, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 600, useNativeDriver: false }),
      ])).start();
    } else {
      glowAnim.setValue(0.85);
    }
  }, [heat?.heat_level]);

  useEffect(() => {
    if (!heat) return;
    Animated.spring(barAnim, { toValue: heat.heat_progress, tension: 60, friction: 12, useNativeDriver: false }).start();

    // On Fire detection — fire ceremony when first hitting on_fire tonight
    if (prevLevel.current !== null && prevLevel.current !== heat.heat_level) {
      const oldIdx = HEAT_LEVELS.indexOf(prevLevel.current);
      const newIdx = HEAT_LEVELS.indexOf(heat.heat_level);
      if (newIdx > oldIdx && heat.heat_level === 'on_fire') {
        setShowOnFire(true);
      }
    }
    prevLevel.current = heat.heat_level;

    // Streak milestones
    const streak = heat.streak_days;
    if (STREAK_MILESTONES.includes(streak) && streak > prevStreak.current) {
      setShowStreak(true);
    }
    prevStreak.current = streak;
  }, [heat?.heat_progress, heat?.heat_level, heat?.streak_days]);

  const fetchHeat = useCallback(async () => {
    if (isDemoMode) { setHeat(DEMO_AURA); return; }
    try {
      const url = userId
        ? `${API_URL}/api/users/${userId}/aura`
        : `${API_URL}/api/me/aura`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) setHeat(await res.json());
    } catch {}
  }, [userId, isDemoMode]);

  useEffect(() => { fetchHeat(); }, []);

  if (!heat) return null;

  const color      = heat.heat_color;
  const isOnFire   = heat.heat_level === 'on_fire';
  const iconName   = (HEAT_ICONS[heat.heat_level] ?? 'flame') as any;
  const levelIdx   = HEAT_LEVELS.indexOf(heat.heat_level);

  return (
    <>
      <View style={[styles.container, { borderColor: isOnFire ? color + '55' : '#1C1C2C' }]}>

        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
            <Animated.View style={{ opacity: isOnFire ? glowAnim : 1 }}>
              <Ionicons name={iconName} size={18} color={color} />
            </Animated.View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.sectionLabel}>SCOUT AURA</Text>
            <Animated.Text style={[styles.levelLabel, { color, opacity: isOnFire ? glowAnim : 1 }]}>
              {heat.heat_label.toUpperCase()}
            </Animated.Text>
          </View>

          {/* Hot Nights badge */}
          <View style={[styles.hotNightsBadge, { borderColor: color + '44' }]}>
            <Text style={[styles.hotNightsNum, { color }]}>{heat.hot_nights}</Text>
            <Text style={styles.hotNightsLabel}>hot{'\n'}nights</Text>
          </View>
        </View>

        {/* Level dots */}
        <View style={styles.dotsRow}>
          {HEAT_LEVELS.map((lvl, i) => (
            <View key={lvl} style={styles.dotItem}>
              <View style={[styles.dot,
                i <= levelIdx
                  ? { backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 5, elevation: 4 }
                  : { backgroundColor: '#1E1E2E' }
              ]} />
              {i < HEAT_LEVELS.length - 1 && (
                <View style={[styles.dotLine, i < levelIdx ? { backgroundColor: color + '60' } : {}]} />
              )}
            </View>
          ))}
        </View>

        {/* Progress bar */}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, {
            width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: color,
            shadowColor: color,
            shadowOpacity: isOnFire ? 0.9 : 0.4,
            shadowRadius: isOnFire ? 10 : 4,
          }]} />
        </View>

        {/* Progress hint */}
        {heat.next_level_label && heat.pts_to_next > 0 ? (
          <Text style={styles.progressHint}>
            <Text style={{ color: '#444' }}>{heat.pts_to_next} pts to </Text>
            <Text style={{ color, fontWeight: '900' }}>{heat.next_level_label}</Text>
          </Text>
        ) : isOnFire ? (
          <Animated.Text style={[styles.progressHint, { color, opacity: glowAnim }]}>
            THE SCENE FEELS YOU
          </Animated.Text>
        ) : (
          <Text style={styles.progressHint}>Check in · Rate · Tap the bolt to heat up</Text>
        )}

        {/* Aura stats */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Ionicons name="location" size={11} color={color} />
            <Text style={[styles.statNum, { color }]}>{heat.checkins_tonight}</Text>
            <Text style={styles.statLbl}>check-ins</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="star" size={11} color={color} />
            <Text style={[styles.statNum, { color }]}>{heat.ratings_tonight}</Text>
            <Text style={styles.statLbl}>ratings</Text>
          </View>
          <View style={styles.statPill}>
            <Ionicons name="flash" size={11} color={color} />
            <Text style={[styles.statNum, { color }]}>{heat.bolts_tonight}</Text>
            <Text style={styles.statLbl}>bolts</Text>
          </View>
          {heat.streak_days > 0 && (
            <View style={styles.statPill}>
              <Ionicons name="flame" size={11} color="#FF6633" />
              <Text style={[styles.statNum, { color: '#FF6633' }]}>{heat.streak_days}</Text>
              <Text style={styles.statLbl}>streak</Text>
            </View>
          )}
        </View>

      </View>

      {/* On Fire ceremony */}
      <AuraLevelUp
        visible={showOnFire}
        newLevel="on_fire"
        newLabel="On Fire"
        color="#FF3366"
        perks={HEAT_PERKS['on_fire']}
        onDismiss={() => setShowOnFire(false)}
      />

      {/* Streak celebration */}
      <StreakCelebration
        visible={showStreak}
        streakDays={heat.streak_days}
        onDismiss={() => setShowStreak(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container:    {
    backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1,
    padding: 14, marginHorizontal: 16, marginTop: 12, overflow: 'hidden',
  },
  headerRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  iconCircle:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  titleBlock:   { flex: 1, gap: 2 },
  sectionLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  levelLabel:   { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  hotNightsBadge: {
    alignItems: 'center', borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  hotNightsNum:  { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  hotNightsLabel: { fontSize: 7, color: '#444', fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  dotsRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dotItem:      { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot:          { width: 10, height: 10, borderRadius: 5, shadowOffset: { width: 0, height: 0 } },
  dotLine:      { flex: 1, height: 2, backgroundColor: '#1E1E2E', marginHorizontal: 3 },
  barTrack:     { height: 4, backgroundColor: '#181826', borderRadius: 3, marginBottom: 6 },
  barFill:      { height: 4, borderRadius: 3, shadowOffset: { width: 0, height: 0 } },
  progressHint: { fontSize: 11, color: '#444', fontWeight: '600', marginBottom: 10 },
  statsRow:     { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  statPill:     {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#111120', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
  },
  statNum:      { fontSize: 13, fontWeight: '900' },
  statLbl:      { fontSize: 9, color: '#444', fontWeight: '500' },
});
