/**
 * CollectiveVibeQuest — Push to PEAK together.
 *
 * Shows when a venue has ≥2 active scouts and score is 30–84.
 * The whole room taps the VibeReactor to push the city score to PEAK (85+).
 * Everyone who tapped during the quest earns 1.5× clout.
 *
 * States:
 *  active   → animated fill bar, scout count, gap label, "PUSH TOGETHER" CTA
 *  achieved → gold flash celebration, "PEAK UNLOCKED" badge
 *  idle     → renders nothing
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, Animated, StyleSheet, TouchableOpacity, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface QuestState {
  venue_id:         string;
  venue_name:       string;
  active:           boolean;
  achieved:         boolean;
  current_score:    number;
  target_score:     number;
  gap:              number;
  progress_pct:     number;
  active_scouts:    number;
  clout_multiplier: number;
  label:            string;
}

const DEMO_QUEST: QuestState = {
  venue_id:         'demo1',
  venue_name:       'DNA Nightclub',
  active:           true,
  achieved:         false,
  current_score:    62,
  target_score:     85,
  gap:              23,
  progress_pct:     72.9,
  active_scouts:    7,
  clout_multiplier: 1.5,
  label:            '23 pts to PEAK',
};

interface Props {
  venueId:      string;
  isDemoMode?:  boolean;
  onPushPress?: () => void;   // opens VibeReactor / tap screen
}

export default function CollectiveVibeQuest({ venueId, isDemoMode, onPushPress }: Props) {
  const [quest, setQuest] = useState<QuestState | null>(null);

  // Animations
  const fillAnim    = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(0.95)).current;
  const achieveAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  const fetchQuest = useCallback(async () => {
    if (isDemoMode) { setQuest(DEMO_QUEST); return; }
    try {
      const res = await fetch(`${API_URL}/api/vibe-quest/${venueId}`);
      if (res.ok) setQuest(await res.json());
    } catch {}
  }, [venueId, isDemoMode]);

  // Poll every 15 seconds for live updates
  useEffect(() => {
    fetchQuest();
    const interval = setInterval(fetchQuest, 15_000);
    return () => clearInterval(interval);
  }, [fetchQuest]);

  // Animate fill bar when quest data changes
  useEffect(() => {
    if (!quest?.active && !quest?.achieved) return;
    Animated.spring(fillAnim, {
      toValue: (quest.achieved ? 100 : quest.progress_pct) / 100,
      tension: 40, friction: 12, useNativeDriver: false,
    }).start();
  }, [quest?.progress_pct, quest?.achieved]);

  // Entry animation when quest becomes active
  useEffect(() => {
    if (!quest?.active) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 10, useNativeDriver: true }),
      Animated.timing(glowAnim,  { toValue: 1, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: false }),
    ]).start();

    // Subtle pulse on the push button
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
    ])).start();
  }, [quest?.active]);

  // Achievement celebration
  useEffect(() => {
    if (!quest?.achieved) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(achieveAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      Animated.timing(achieveAnim, { toValue: 0.6, duration: 400, useNativeDriver: false }),
      Animated.timing(achieveAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [quest?.achieved]);

  if (!quest || (!quest.active && !quest.achieved)) return null;

  const isAchieved = quest.achieved;
  const accentColor = isAchieved ? '#FFD60A' : '#00E676';

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const borderGlow = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,230,118,0)', 'rgba(0,230,118,0.35)'],
  });

  const achieveBorder = achieveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,214,10,0)', 'rgba(255,214,10,0.8)'],
  });

  return (
    <Animated.View style={[
      styles.container,
      { transform: [{ scale: scaleAnim }] },
      isAchieved && { borderColor: achieveBorder as any },
      !isAchieved && { borderColor: borderGlow as any },
    ]}>
      <LinearGradient
        colors={isAchieved
          ? ['rgba(255,214,10,0.12)', 'rgba(255,214,10,0.04)', 'transparent']
          : ['rgba(0,230,118,0.10)', 'rgba(0,230,118,0.03)', 'transparent']
        }
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons
              name={isAchieved ? 'flash' : 'people'}
              size={13}
              color={accentColor}
            />
            <Text style={[styles.headerLabel, { color: accentColor }]}>
              {isAchieved ? 'PEAK UNLOCKED' : 'COLLECTIVE QUEST'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.multiplierBadge, { color: accentColor }]}>
              {quest.clout_multiplier}× CLOUT
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.trackWrap}>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                { width: fillWidth, backgroundColor: accentColor },
              ]}
            />
            {/* PEAK marker */}
            <View style={styles.peakMarker}>
              <Text style={styles.peakMarkerText}>PEAK</Text>
            </View>
          </View>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreText, { color: accentColor }]}>
              {quest.current_score}
            </Text>
            <Text style={styles.targetText}>/ {quest.target_score}</Text>
          </View>
        </View>

        {/* Status row */}
        <View style={styles.statusRow}>
          <View style={styles.scoutPill}>
            <Ionicons name="people" size={10} color="rgba(255,255,255,0.5)" />
            <Text style={styles.scoutText}>
              {quest.active_scouts} scouts pushing
            </Text>
          </View>
          <Text style={[styles.gapLabel, { color: isAchieved ? accentColor : 'rgba(255,255,255,0.6)' }]}>
            {quest.label}
          </Text>
        </View>

        {/* CTA */}
        {!isAchieved && onPushPress && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.pushBtn, { borderColor: accentColor + '66', backgroundColor: accentColor + '15' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                onPushPress();
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="flash" size={14} color={accentColor} />
              <Text style={[styles.pushBtnText, { color: accentColor }]}>
                PUSH TOGETHER ⚡
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {isAchieved && (
          <View style={styles.achievedRow}>
            <Ionicons name="checkmark-circle" size={14} color={accentColor} />
            <Text style={[styles.achievedText, { color: accentColor }]}>
              You helped push this venue to PEAK. {quest.clout_multiplier}× clout applied.
            </Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
    overflow: 'hidden',
  },
  gradient: { padding: 14, gap: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerRight: {},
  headerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  multiplierBadge: {
    fontSize: 9, fontWeight: '900', letterSpacing: 0.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  trackWrap: { gap: 4 },
  track: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3, overflow: 'hidden', position: 'relative',
  },
  fill: { height: 6, borderRadius: 3 },
  peakMarker: {
    position: 'absolute', right: 0, top: -14,
    paddingHorizontal: 4,
  },
  peakMarkerText: {
    fontSize: 7, color: 'rgba(255,255,255,0.3)',
    fontWeight: '700', letterSpacing: 0.5,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  scoreText: { fontSize: 20, fontWeight: '900', lineHeight: 22 },
  targetText: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoutPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  scoutText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  gapLabel: { fontSize: 11, fontWeight: '700' },
  pushBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: 12,
    paddingVertical: 10,
  },
  pushBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  achievedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achievedText: { fontSize: 11, fontWeight: '600', flex: 1, lineHeight: 16 },
});
