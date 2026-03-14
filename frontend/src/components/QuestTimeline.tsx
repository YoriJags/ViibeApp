/**
 * QuestTimeline — Upcoming & active collective venue boost quests.
 *
 * Shows a scrollable strip of scheduled quests so users can anticipate
 * and plan to show up. Active quests show a live countdown.
 * Completing a quest moves the venue to the top of its category for 2h.
 *
 * Displays: venue name, category, target score, countdown, reward.
 * Tapping a quest card navigates to the venue detail screen.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Animated,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface Quest {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_area: string;
  venue_type: string;
  city: string;
  target_score: number;
  current_score: number;
  category: string;
  reward_label: string;
  ranking_boost: boolean;
  status: 'scheduled' | 'active' | 'completed' | 'failed';
  scheduled_at: string | null;
  starts_in_seconds: number | null;
  seconds_remaining: number | null;
  achieved: boolean;
  participant_count: number;
}

// Demo quests shown when isDemoMode = true
const DEMO_QUESTS: Quest[] = [
  {
    id: 'dq1',
    venue_id: '1',
    venue_name: 'DNA Nightclub',
    venue_area: 'Victoria Island',
    venue_type: 'club',
    city: 'lagos',
    target_score: 85,
    current_score: 62,
    category: 'Top Clubs VI',
    reward_label: '1.5× Clout',
    ranking_boost: true,
    status: 'active',
    scheduled_at: null,
    starts_in_seconds: null,
    seconds_remaining: 1840,
    achieved: false,
    participant_count: 12,
  },
  {
    id: 'dq2',
    venue_id: '2',
    venue_name: 'Club Quilox',
    venue_area: 'Victoria Island',
    venue_type: 'club',
    city: 'lagos',
    target_score: 85,
    current_score: 55,
    category: 'Top Clubs VI',
    reward_label: '1.5× Clout',
    ranking_boost: true,
    status: 'scheduled',
    scheduled_at: null,
    starts_in_seconds: 3600,
    seconds_remaining: null,
    achieved: false,
    participant_count: 0,
  },
  {
    id: 'dq3',
    venue_id: '3',
    venue_name: 'The Wheatbaker',
    venue_area: 'Ikoyi',
    venue_type: 'lounge',
    city: 'lagos',
    target_score: 80,
    current_score: 48,
    category: 'Top Lounges Ikoyi',
    reward_label: '2× Clout',
    ranking_boost: true,
    status: 'scheduled',
    scheduled_at: null,
    starts_in_seconds: 7200,
    seconds_remaining: null,
    achieved: false,
    participant_count: 0,
  },
];

function formatCountdown(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function QuestCard({
  quest,
  onPress,
}: {
  quest: Quest;
  onPress: () => void;
}) {
  const [countdown, setCountdown] = useState(
    quest.status === 'active' ? (quest.seconds_remaining ?? 0) : (quest.starts_in_seconds ?? 0),
  );

  const glowAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (quest.status !== 'active') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [quest.status]);

  // Live countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isActive = quest.status === 'active';
  const accentColor = isActive ? '#00E676' : '#FF9933';
  const progress = Math.min((quest.current_score / quest.target_score) * 100, 100);

  return (
    <TouchableOpacity
      style={[styles.card, isActive && { borderColor: accentColor + '50' }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.8}
    >
      {/* Active glow border */}
      {isActive && (
        <Animated.View style={[styles.activeBorderGlow, { opacity: glowAnim, borderColor: accentColor }]} />
      )}

      {/* Status badge */}
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, isActive
          ? { backgroundColor: accentColor + '20', borderColor: accentColor + '50' }
          : { backgroundColor: '#FF990015', borderColor: '#FF990040' }
        ]}>
          {isActive && <View style={[styles.liveDot, { backgroundColor: accentColor }]} />}
          <Text style={[styles.statusLabel, { color: isActive ? accentColor : '#FF9933' }]}>
            {isActive ? 'LIVE' : 'COMING UP'}
          </Text>
        </View>

        <View style={styles.countdownPill}>
          <Ionicons name={isActive ? 'time' : 'alarm-outline'} size={10} color={accentColor} />
          <Text style={[styles.countdownText, { color: accentColor }]}>
            {isActive ? formatCountdown(countdown) + ' left' : 'in ' + formatCountdown(countdown)}
          </Text>
        </View>
      </View>

      {/* Venue info */}
      <Text style={styles.venueName} numberOfLines={1}>{quest.venue_name}</Text>
      <Text style={styles.venueArea}>{quest.venue_area}</Text>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as any, backgroundColor: accentColor }]} />
          <View style={styles.peakLine} />
        </View>
        <Text style={[styles.progressLabel, { color: accentColor }]}>
          {quest.current_score} / {quest.target_score}
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        {quest.ranking_boost && quest.category ? (
          <View style={styles.rankBoostChip}>
            <Ionicons name="trending-up" size={9} color="#9933FF" />
            <Text style={styles.rankBoostText}>Top of {quest.category}</Text>
          </View>
        ) : null}
        <View style={styles.rewardChip}>
          <Ionicons name="flash" size={9} color="#FFD700" />
          <Text style={styles.rewardText}>{quest.reward_label}</Text>
        </View>
        {isActive && quest.participant_count > 0 && (
          <View style={styles.participantChip}>
            <Ionicons name="people" size={9} color="#555" />
            <Text style={styles.participantText}>{quest.participant_count} pushing</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  city?: string;
  isDemoMode?: boolean;
  onVenuePress: (venueId: string) => void;
}

export default function QuestTimeline({ city = 'lagos', isDemoMode, onVenuePress }: Props) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuests = useCallback(async () => {
    if (isDemoMode) { setQuests(DEMO_QUESTS); setLoading(false); return; }
    try {
      const res = await fetch(`${API_URL}/api/quest-timeline?city=${city}&limit=8`);
      if (res.ok) {
        const d = await res.json();
        setQuests(d.quests ?? []);
      }
    } catch {}
    setLoading(false);
  }, [city, isDemoMode]);

  useEffect(() => {
    fetchQuests();
    const interval = setInterval(fetchQuests, 30_000);
    return () => clearInterval(interval);
  }, [fetchQuests]);

  if (loading) return (
    <View style={styles.loadingWrap}><ActivityIndicator size="small" color="#9933FF" /></View>
  );

  if (quests.length === 0) return null;

  const activeCount = quests.filter(q => q.status === 'active').length;

  return (
    <View style={styles.wrapper}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionLeft}>
          <Ionicons name="flash" size={13} color="#9933FF" />
          <Text style={styles.sectionTitle}>QUEST TIMELINE</Text>
          {activeCount > 0 && (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{activeCount} LIVE</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectionSub}>Collective boosts · tap to climb rankings</Text>
      </View>

      {/* Horizontal scroll of quest cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {quests.map(quest => (
          <QuestCard
            key={quest.id}
            quest={quest}
            onPress={() => onVenuePress(quest.venue_id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  loadingWrap: { padding: 20, alignItems: 'center' },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 10,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 9, fontWeight: '800', color: '#9933FF', letterSpacing: 1.5 },
  sectionSub: { fontSize: 9, color: '#333', fontWeight: '600' },
  activeBadge: {
    backgroundColor: '#00E67618', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#00E67630',
  },
  activeBadgeText: { fontSize: 8, fontWeight: '900', color: '#00E676', letterSpacing: 0.5 },

  scrollContent: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },

  card: {
    width: 180, backgroundColor: '#0C0C18',
    borderRadius: 14, borderWidth: 1, borderColor: '#1A1A2A',
    padding: 12, gap: 6, position: 'relative', overflow: 'hidden',
  },
  activeBorderGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14, borderWidth: 1.5,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  countdownText: { fontSize: 9, fontWeight: '700' },

  venueName: { fontSize: 13, fontWeight: '800', color: '#EEE', lineHeight: 16 },
  venueArea: { fontSize: 10, color: '#444', fontWeight: '500', marginTop: -2 },

  progressWrap: { gap: 3 },
  progressTrack: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2, overflow: 'hidden', position: 'relative',
  },
  progressFill: { height: 4, borderRadius: 2 },
  peakLine: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  progressLabel: { fontSize: 11, fontWeight: '800' },

  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  rankBoostChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#9933FF15', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2, borderWidth: 0.5, borderColor: '#9933FF30',
  },
  rankBoostText: { fontSize: 8, color: '#9933FF', fontWeight: '700' },
  rewardChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFD70015', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2, borderWidth: 0.5, borderColor: '#FFD70030',
  },
  rewardText: { fontSize: 8, color: '#FFD700', fontWeight: '700' },
  participantChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  participantText: { fontSize: 8, color: '#555', fontWeight: '600' },
});
