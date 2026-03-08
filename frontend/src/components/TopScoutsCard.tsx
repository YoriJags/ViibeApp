/**
 * TopScoutsCard - Shows the most active raters for a specific venue.
 * "Who knows this spot best?" — top 5 scouts by number of ratings submitted.
 * Expand button opens fullscreen leaderboard with podium for top 3.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, StatusBar, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../store/vibeStore';
import { DEMO_VENUE_TOP_SCOUTS } from '../data/demoData';

interface VenueScout {
  rank: number;
  user_id: string;
  username: string;
  scout_status: string;
  ratings_count: number;
  clout_earned: number;
  tier_color: string;
}

interface TopScoutsCardProps {
  venueId: string;
  venueName?: string;
}

const RANK_ICONS: Record<number, string> = { 1: '👑', 2: '🥈', 3: '🥉' };

const TIER_LABEL: Record<string, string> = {
  elite:   'ELITE',
  scout:   'SCOUT',
  regular: 'REGULAR',
  newbie:  'NEWBIE',
};

const TIER_DESC: Record<string, string> = {
  elite:   'Top-rated, most accurate scout',
  scout:   'Consistent contributor',
  regular: 'Active rater',
  newbie:  'Just getting started',
};

// ── Shared Scout Row ──────────────────────────────────────────────────────────
function ScoutRow({ scout, big = false }: { scout: VenueScout; big?: boolean }) {
  const isTop3 = scout.rank <= 3;
  return (
    <View style={[rowSt.row, big && rowSt.rowBig]}>
      {/* Rank */}
      <View style={rowSt.rankCell}>
        {RANK_ICONS[scout.rank] ? (
          <Text style={rowSt.rankIcon}>{RANK_ICONS[scout.rank]}</Text>
        ) : (
          <Text style={rowSt.rankNumber}>{scout.rank}</Text>
        )}
      </View>

      {/* Avatar */}
      <LinearGradient
        colors={[scout.tier_color + '40', scout.tier_color + '20']}
        style={[rowSt.avatar, big && rowSt.avatarBig]}
      >
        <Text style={[rowSt.avatarInitial, big && { fontSize: 18 }]}>
          {(scout.username ?? '?').charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>

      {/* Name + tier */}
      <View style={rowSt.nameBlock}>
        <Text style={[rowSt.username, big && { fontSize: 15 }]} numberOfLines={1}>
          {scout.username}
        </Text>
        <View style={[rowSt.tierBadge, { borderColor: scout.tier_color + '60' }]}>
          <Text style={[rowSt.tierText, { color: scout.tier_color }]}>
            {TIER_LABEL[scout.scout_status] ?? scout.scout_status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={rowSt.statsBlock}>
        <Text style={[rowSt.ratingCount, big && { fontSize: 18 }]}>{scout.ratings_count}</Text>
        <Text style={rowSt.ratingLabel}>ratings</Text>
      </View>

      <View style={rowSt.cloutBlock}>
        <Text style={[rowSt.cloutCount, big && { fontSize: 18 }]}>{scout.clout_earned}</Text>
        <Text style={rowSt.cloutLabel}>clout</Text>
      </View>
    </View>
  );
}

const rowSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  rowBig: { paddingVertical: 14 },
  rankCell: { width: 28, alignItems: 'center' },
  rankIcon: { fontSize: 18 },
  rankNumber: { color: '#666', fontSize: 14, fontWeight: '700' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarBig: { width: 44, height: 44, borderRadius: 22 },
  avatarInitial: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  nameBlock: { flex: 1, gap: 3 },
  username: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  tierBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tierText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  statsBlock: { alignItems: 'center', minWidth: 40 },
  ratingCount: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  ratingLabel: { color: '#666', fontSize: 9 },
  cloutBlock: { alignItems: 'center', minWidth: 44 },
  cloutCount: { color: '#FF3366', fontSize: 14, fontWeight: '700' },
  cloutLabel: { color: '#666', fontSize: 9 },
});

// ── Podium (top 3) ────────────────────────────────────────────────────────────
function Podium({ scouts }: { scouts: VenueScout[] }) {
  const top3 = scouts.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]].filter(Boolean); // 2nd, 1st, 3rd
  const heights = [80, 110, 60];
  const orderIdx = [1, 0, 2]; // which rank positions

  return (
    <View style={pod.container}>
      {order.map((scout, i) => {
        const height = heights[i];
        const isFirst = orderIdx[i] === 0;
        return (
          <View key={scout.user_id} style={pod.slot}>
            {/* Avatar */}
            <LinearGradient
              colors={[scout.tier_color + '60', scout.tier_color + '30']}
              style={[pod.avatar, isFirst && pod.avatarFirst]}
            >
              <Text style={[pod.avatarText, isFirst && { fontSize: 22 }]}>
                {(scout.username ?? '?').charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
            <Text style={[pod.rankEmoji]}>{RANK_ICONS[scout.rank] ?? scout.rank}</Text>
            <Text style={pod.podUsername} numberOfLines={1}>{scout.username}</Text>
            <Text style={[pod.podRatings, { color: scout.tier_color }]}>{scout.ratings_count}</Text>
            {/* Podium block */}
            <View style={[pod.block, { height, backgroundColor: scout.tier_color + '20', borderColor: scout.tier_color + '40' }]}>
              <Text style={[pod.blockRank, { color: scout.tier_color }]}>#{scout.rank}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const pod = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 8 },
  slot: { flex: 1, alignItems: 'center', gap: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarFirst: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  rankEmoji: { fontSize: 16 },
  podUsername: { fontSize: 10, color: '#CCC', fontWeight: '700', textAlign: 'center', maxWidth: 80 },
  podRatings: { fontSize: 11, fontWeight: '900' },
  block: { width: '100%', borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  blockRank: { fontSize: 13, fontWeight: '900' },
});

// ── Main export ────────────────────────────────────────────────────────────────
export default function TopScoutsCard({ venueId, venueName }: TopScoutsCardProps) {
  const { isDemoMode } = useVibeStore();
  const [scouts, setScouts] = useState<VenueScout[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

  useEffect(() => {
    if (!venueId) return;
    fetchTopScouts();
  }, [venueId]);

  const fetchTopScouts = async () => {
    setLoading(true);
    if (isDemoMode) {
      setTimeout(() => { setScouts(DEMO_VENUE_TOP_SCOUTS); setLoading(false); }, 400);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/venues/${venueId}/top-scouts`);
      if (res.ok) { const data = await res.json(); setScouts(data); }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  if (!loading && scouts.length === 0) return null;

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="trophy" size={16} color="#FFD700" />
            <Text style={styles.title}>Top Scouts</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.subtitle}>Who knows this spot best</Text>
            {scouts.length > 0 && (
              <TouchableOpacity
                style={styles.expandBtn}
                onPress={() => setFullscreen(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="expand-outline" size={15} color="#555" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#FF3366" style={{ marginVertical: 16 }} />
        ) : (
          <View style={styles.list}>
            {scouts.map((scout) => <ScoutRow key={scout.user_id} scout={scout} />)}
          </View>
        )}
      </View>

      {/* ── Fullscreen Modal ──────────────────────────────────────────────────── */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <View style={fs.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={{ flex: 1 }}>
            {/* FS Header */}
            <View style={fs.header}>
              <View style={fs.headerLeft}>
                <Ionicons name="trophy" size={18} color="#FFD700" />
                <Text style={fs.title}>TOP SCOUTS</Text>
                {venueName && <Text style={fs.venueChip}>{venueName.toUpperCase()}</Text>}
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              {/* Podium */}
              {scouts.length >= 3 && (
                <View style={fs.podiumSection}>
                  <Text style={fs.sectionLabel}>HALL OF FAME</Text>
                  <Podium scouts={scouts} />
                </View>
              )}

              {/* Full leaderboard */}
              <View style={fs.leaderboard}>
                <Text style={fs.sectionLabel}>FULL LEADERBOARD</Text>
                <View style={fs.tableHeader}>
                  <Text style={[fs.tableCell, { flex: 1, marginLeft: 38 }]}>SCOUT</Text>
                  <Text style={[fs.tableCell, { width: 60, textAlign: 'center' }]}>RATINGS</Text>
                  <Text style={[fs.tableCell, { width: 60, textAlign: 'center' }]}>CLOUT</Text>
                </View>
                {scouts.map((scout, i) => (
                  <View key={scout.user_id}>
                    <ScoutRow scout={scout} big />
                    {i < scouts.length - 1 && <View style={fs.divider} />}
                  </View>
                ))}
              </View>

              {/* Tier legend */}
              <View style={fs.tierLegend}>
                <Text style={fs.sectionLabel}>TIER GUIDE</Text>
                <View style={fs.tierGrid}>
                  {Object.entries(TIER_LABEL).map(([key, label]) => (
                    <View key={key} style={fs.tierItem}>
                      <View style={[fs.tierDot, { backgroundColor: key === 'elite' ? '#FFD700' : key === 'scout' ? '#FF3366' : key === 'regular' ? '#9933FF' : '#3399FF' }]} />
                      <View>
                        <Text style={[fs.tierName, { color: key === 'elite' ? '#FFD700' : key === 'scout' ? '#FF3366' : key === 'regular' ? '#9933FF' : '#3399FF' }]}>
                          {label}
                        </Text>
                        <Text style={fs.tierDesc}>{TIER_DESC[key]}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginTop: 16, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)', overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,215,0,0.1)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: '#FFD700', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  subtitle: { color: '#666', fontSize: 11 },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  list: { paddingVertical: 6 },
});

const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  venueChip: {
    fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 2,
    backgroundColor: '#1A1A28', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { paddingBottom: 48 },
  podiumSection: { padding: 16 },
  sectionLabel: {
    fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 2,
    marginBottom: 14,
  },
  leaderboard: { marginHorizontal: 16, marginBottom: 24 },
  tableHeader: {
    flexDirection: 'row', backgroundColor: '#111120',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginBottom: 4,
  },
  tableCell: { fontSize: 9, fontWeight: '700', color: '#444', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#1A1A28', marginHorizontal: 14 },
  tierLegend: { marginHorizontal: 16, marginBottom: 16 },
  tierGrid: { gap: 12 },
  tierItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tierDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  tierName: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  tierDesc: { fontSize: 10, color: '#555', marginTop: 1 },
});
