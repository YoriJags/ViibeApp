/**
 * ScoutOfTheNight — End-of-night leaderboard ceremony.
 * Top 5 scouts by tonight's activity: bolts dropped, venues visited, ratings.
 * Crown animation for #1. Auto-triggers after midnight.
 * "The scene voted. This is who showed up."
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, Modal,
  StyleSheet, Dimensions, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useVibeStore } from '../store/vibeStore';
import AvatarDisplay from './AvatarDisplay';

const { width: W, height: H } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface ScoutEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_config?: any;
  bolts_tonight: number;
  venues_visited: number;
  ratings_tonight: number;
  score: number;
  heat_level?: string;
}

const DEMO_LEADERBOARD: ScoutEntry[] = [
  { rank: 1, user_id: '1', username: 'nightkingxx', display_name: 'Night King', bolts_tonight: 47, venues_visited: 4, ratings_tonight: 6, score: 220, heat_level: 'on_fire' },
  { rank: 2, user_id: '2', username: 'vibequeen_', display_name: 'Vibe Queen', bolts_tonight: 38, venues_visited: 3, ratings_tonight: 5, score: 178, heat_level: 'on_fire' },
  { rank: 3, user_id: '3', username: 'scoutlekki', display_name: 'Scout Lekki', bolts_tonight: 29, venues_visited: 3, ratings_tonight: 4, score: 141, heat_level: 'hot' },
  { rank: 4, user_id: '4', username: 'lagosnights', bolts_tonight: 21, venues_visited: 2, ratings_tonight: 4, score: 108, heat_level: 'hot' },
  { rank: 5, user_id: '5', username: 'vibe_tester', bolts_tonight: 17, venues_visited: 2, ratings_tonight: 3, score: 88, heat_level: 'warming' },
];

const HEAT_COLORS: Record<string, string> = {
  on_fire: '#FF3366',
  hot:     '#FF8C00',
  warming: '#6655FF',
  cold:    '#3A3A4E',
};

const RANK_LABELS: Record<number, { icon: string; color: string }> = {
  1: { icon: 'trophy', color: '#FFD700' },
  2: { icon: 'medal',  color: '#C0C0C0' },
  3: { icon: 'medal',  color: '#CD7F32' },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  isDemoMode?: boolean;
  city?: string;
}

export default function ScoutOfTheNight({ visible, onClose, isDemoMode, city }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const user           = useVibeStore(s => s.user);
  const [scouts, setScouts] = useState<ScoutEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const slideAnim    = useRef(new Animated.Value(H)).current;
  const bgOpac       = useRef(new Animated.Value(0)).current;
  const crownScale   = useRef(new Animated.Value(0)).current;
  const crownOpac    = useRef(new Animated.Value(0)).current;
  const listOpac     = useRef(new Animated.Value(0)).current;
  const glowLoop     = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    slideAnim.setValue(H);
    bgOpac.setValue(0);
    crownScale.setValue(0);
    crownOpac.setValue(0);
    listOpac.setValue(0);

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 14, useNativeDriver: true }),
        Animated.timing(bgOpac,    { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });

    // Crown pops in after slide
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(crownScale, { toValue: 1, tension: 200, friction: 5, useNativeDriver: true }),
        Animated.timing(crownOpac,  { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    }, 350);

    // List fades in
    setTimeout(() => {
      Animated.timing(listOpac, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, 700);

    loadLeaderboard();
  }, [visible]);

  // Gold glow pulse for #1
  useEffect(() => {
    if (!visible || scouts.length === 0) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowLoop, { toValue: 1,   duration: 900, useNativeDriver: true }),
      Animated.timing(glowLoop, { toValue: 0.3, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, scouts.length]);

  const loadLeaderboard = async () => {
    if (isDemoMode) { setScouts(DEMO_LEADERBOARD); return; }
    setLoading(true);
    try {
      const params = city ? `?city=${city}` : '';
      const res = await fetch(`${API_URL}/api/leaderboard/tonight${params}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setScouts(data.scouts ?? []);
      } else {
        setScouts(DEMO_LEADERBOARD); // fallback to demo
      }
    } catch {
      setScouts(DEMO_LEADERBOARD);
    }
    setLoading(false);
  };

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: H, duration: 300, useNativeDriver: true }),
      Animated.timing(bgOpac,    { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(onClose);
  };

  const top = scouts[0];
  const myEntry = scouts.find(s => s.user_id === user?.id);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: bgOpac }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={dismiss} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Close */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={18} color="#555" />
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Title */}
          <Text style={styles.eyebrow}>TONIGHT'S SCENE</Text>

          {/* Crown + winner */}
          {top && (
            <View style={styles.winnerBlock}>
              {/* Gold glow */}
              <Animated.View style={[styles.winnerGlow, { opacity: glowLoop }]} />

              {/* Crown */}
              <Animated.Text style={[styles.crown, { transform: [{ scale: crownScale }], opacity: crownOpac }]}>
                👑
              </Animated.Text>

              <LinearGradient
                colors={['#1A1400', '#1A1200', '#0A0A0F']}
                style={styles.winnerCard}
              >
                <View style={styles.winnerTop}>
                  <AvatarDisplay
                    config={top.avatar_config}
                    username={top.username}
                    size={64}
                    showBorder
                    borderColor="#FFD700"
                  />
                  <View style={styles.winnerInfo}>
                    <Text style={styles.winnerName}>
                      {top.display_name || `@${top.username}`}
                    </Text>
                    <Text style={styles.winnerHandle}>@{top.username}</Text>
                    <View style={[styles.heatPill, { backgroundColor: (HEAT_COLORS[top.heat_level ?? 'hot']) + '22', borderColor: (HEAT_COLORS[top.heat_level ?? 'hot']) + '55' }]}>
                      <Text style={[styles.heatPillText, { color: HEAT_COLORS[top.heat_level ?? 'hot'] }]}>
                        {top.heat_level?.replace('_', ' ').toUpperCase() ?? 'HOT'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.winnerScore}>
                    <Text style={styles.winnerScoreNum}>{top.score}</Text>
                    <Text style={styles.winnerScoreLbl}>pts</Text>
                  </View>
                </View>

                <View style={styles.winnerStats}>
                  <View style={styles.winnerStat}>
                    <Ionicons name="flash" size={14} color="#FFD700" />
                    <Text style={styles.winnerStatNum}>{top.bolts_tonight}</Text>
                    <Text style={styles.winnerStatLbl}>bolts</Text>
                  </View>
                  <View style={styles.winnerStat}>
                    <Ionicons name="location" size={14} color="#FFD700" />
                    <Text style={styles.winnerStatNum}>{top.venues_visited}</Text>
                    <Text style={styles.winnerStatLbl}>venues</Text>
                  </View>
                  <View style={styles.winnerStat}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.winnerStatNum}>{top.ratings_tonight}</Text>
                    <Text style={styles.winnerStatLbl}>ratings</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Leaderboard rows */}
          <Animated.View style={{ opacity: listOpac }}>
            <Text style={styles.boardLabel}>FULL RANKINGS</Text>

            {loading ? (
              <ActivityIndicator color="#6655FF" size="small" style={{ marginVertical: 24 }} />
            ) : (
              scouts.slice(1).map((s) => {
                const rankMeta = RANK_LABELS[s.rank];
                const heatColor = HEAT_COLORS[s.heat_level ?? 'cold'];
                const isMe = s.user_id === user?.id;
                return (
                  <View key={s.user_id} style={[styles.row, isMe && styles.rowMe]}>
                    {/* Rank */}
                    <View style={styles.rankWrap}>
                      {rankMeta ? (
                        <Ionicons name={rankMeta.icon as any} size={16} color={rankMeta.color} />
                      ) : (
                        <Text style={styles.rankNum}>{s.rank}</Text>
                      )}
                    </View>

                    {/* Avatar */}
                    <AvatarDisplay
                      config={s.avatar_config}
                      username={s.username}
                      size={38}
                      showBorder={isMe}
                      borderColor="#FF3366"
                    />

                    {/* Name + heat */}
                    <View style={styles.rowInfo}>
                      <Text style={[styles.rowName, isMe && { color: '#FF3366' }]} numberOfLines={1}>
                        {s.display_name || `@${s.username}`}
                        {isMe && ' (you)'}
                      </Text>
                      <View style={styles.rowChips}>
                        <View style={[styles.rowHeatPill, { backgroundColor: heatColor + '1A' }]}>
                          <Text style={[styles.rowHeatText, { color: heatColor }]}>
                            {s.heat_level?.replace('_', ' ') ?? 'cold'}
                          </Text>
                        </View>
                        <Text style={styles.rowMini}>{s.bolts_tonight} bolts · {s.venues_visited} venues</Text>
                      </View>
                    </View>

                    {/* Score */}
                    <Text style={styles.rowScore}>{s.score}</Text>
                  </View>
                );
              })
            )}

            {/* My position if not in top 5 */}
            {myEntry && myEntry.rank > 5 && (
              <View style={[styles.row, styles.rowMe, styles.myFooterRow]}>
                <View style={styles.rankWrap}>
                  <Text style={[styles.rankNum, { color: '#FF3366' }]}>{myEntry.rank}</Text>
                </View>
                <AvatarDisplay config={undefined} username={user?.username ?? ''} size={38} showBorder borderColor="#FF3366" />
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: '#FF3366' }]}>@{user?.username} (you)</Text>
                  <Text style={styles.rowMini}>{myEntry.bolts_tonight} bolts · {myEntry.venues_visited} venues</Text>
                </View>
                <Text style={styles.rowScore}>{myEntry.score}</Text>
              </View>
            )}

            {/* Scoring explanation */}
            <View style={styles.scoringNote}>
              <Text style={styles.scoringNoteText}>
                Score = bolts × 3 + venues × 10 + ratings × 5
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: H * 0.88, backgroundColor: '#070710',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  handle:        { width: 40, height: 4, backgroundColor: '#1A1A2C', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  closeBtn:      { position: 'absolute', top: 16, right: 20, padding: 6, zIndex: 10 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 16 },
  eyebrow:       { fontSize: 9, color: '#2A2A4A', fontWeight: '800', letterSpacing: 2, textAlign: 'center', marginBottom: 4 },

  // Winner block
  winnerBlock:   { alignItems: 'center', marginBottom: 24 },
  winnerGlow: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#FFD700', top: 20,
  },
  crown:         { fontSize: 44, marginBottom: -8, zIndex: 2 },
  winnerCard: {
    width: W - 40, borderRadius: 20, borderWidth: 1,
    borderColor: '#FFD70033', overflow: 'hidden',
  },
  winnerTop:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingBottom: 12 },
  winnerInfo:    { flex: 1, gap: 4 },
  winnerName:    { fontSize: 18, fontWeight: '900', color: '#FFD700', lineHeight: 20 },
  winnerHandle:  { fontSize: 11, color: '#5A4A00', fontWeight: '600' },
  heatPill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  heatPillText:  { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  winnerScore:   { alignItems: 'center' },
  winnerScoreNum: { fontSize: 32, fontWeight: '900', color: '#FFD700', lineHeight: 34 },
  winnerScoreLbl: { fontSize: 9, color: '#3A2A00', fontWeight: '600' },
  winnerStats:   { flexDirection: 'row', borderTopWidth: 1, borderColor: '#1A1200' },
  winnerStat:    { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 3, flexDirection: 'row', justifyContent: 'center' },
  winnerStatNum: { fontSize: 16, fontWeight: '900', color: '#EEE', marginLeft: 4 },
  winnerStatLbl: { fontSize: 9, color: '#3A2A00', fontWeight: '600' },

  // Board
  boardLabel:    { fontSize: 8, color: '#2A2A3A', fontWeight: '800', letterSpacing: 2, marginBottom: 12, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0C0C18', borderRadius: 14, borderWidth: 1,
    borderColor: '#111120', padding: 12, marginBottom: 8,
  },
  rowMe:         { borderColor: '#FF336622', backgroundColor: '#FF33660A' },
  myFooterRow:   { marginTop: 8 },
  rankWrap:      { width: 22, alignItems: 'center' },
  rankNum:       { fontSize: 13, fontWeight: '800', color: '#2A2A4A' },
  rowInfo:       { flex: 1, gap: 4 },
  rowName:       { fontSize: 13, fontWeight: '700', color: '#CCC' },
  rowChips:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowHeatPill:   { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  rowHeatText:   { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  rowMini:       { fontSize: 10, color: '#3A3A4E', fontWeight: '500' },
  rowScore:      { fontSize: 16, fontWeight: '900', color: '#EEE' },
  scoringNote:   { marginTop: 20, alignItems: 'center' },
  scoringNoteText: { fontSize: 9, color: '#1C1C2C', fontWeight: '600', letterSpacing: 0.5 },
});
