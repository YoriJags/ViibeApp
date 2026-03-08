/**
 * VibeTapCard — Scout's bolt-tap contribution tracker.
 *
 * Shows:
 *   - Tonight: taps per venue (cross-location breakdown)
 *   - All-time: total taps + top venue
 *   - 7-night spark history
 *
 * Expand button opens fullscreen VIIBE contribution dashboard.
 * Taps = vibes. Every bolt you fire shapes the surge at a venue.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Modal, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const ACCENT = '#6655FF';

interface TonightVenue {
  venue_id: string;
  venue_name: string;
  venue_area: string;
  tap_count: number;
}

interface TapHistoryData {
  tonight: { total_taps: number; venues: TonightVenue[] };
  all_time: { total_taps: number; top_venue: { venue_name: string; tap_count: number } | null; venues_tapped: number };
  history: { date: string; total_taps: number; venue_count: number }[];
}

const DEMO_DATA: TapHistoryData = {
  tonight: {
    total_taps: 17,
    venues: [
      { venue_id: '1', venue_name: 'DNA Nightclub', venue_area: 'Victoria Island', tap_count: 9 },
      { venue_id: '2', venue_name: 'Club Quilox',   venue_area: 'Victoria Island', tap_count: 5 },
      { venue_id: '3', venue_name: 'Escape Lagos',  venue_area: 'Lekki',           tap_count: 3 },
    ],
  },
  all_time: {
    total_taps: 312,
    top_venue: { venue_name: 'DNA Nightclub', tap_count: 134 },
    venues_tapped: 11,
  },
  history: [
    { date: '2026-03-07', total_taps: 17, venue_count: 3 },
    { date: '2026-03-06', total_taps: 24, venue_count: 4 },
    { date: '2026-03-05', total_taps: 8,  venue_count: 2 },
    { date: '2026-03-04', total_taps: 31, venue_count: 5 },
    { date: '2026-03-03', total_taps: 0,  venue_count: 0 },
    { date: '2026-03-02', total_taps: 19, venue_count: 3 },
    { date: '2026-03-01', total_taps: 12, venue_count: 2 },
  ],
};

interface Props {
  isDemoMode?: boolean;
}

// ── 7-night spark bars ────────────────────────────────────────────────────────
function SparkRow({ history, big = false }: { history: TapHistoryData['history']; big?: boolean }) {
  const spark = history.slice(0, 7).reverse();
  const sparkMax = Math.max(...spark.map(d => d.total_taps), 1);
  return (
    <View style={[sparkSt.row, big && { height: 80, marginBottom: 4 }]}>
      {spark.map((day, i) => {
        const pct = day.total_taps / sparkMax;
        const isToday = i === spark.length - 1;
        return (
          <View key={day.date} style={[sparkSt.col, big && { paddingHorizontal: 2 }]}>
            <View style={sparkSt.barWrap}>
              <View style={[
                sparkSt.bar,
                {
                  height: `${Math.max(pct * 100, 4)}%` as any,
                  backgroundColor: isToday ? ACCENT : day.total_taps > 0 ? '#2A2A4A' : '#111120',
                },
              ]} />
            </View>
            <Text style={[sparkSt.label, isToday && { color: ACCENT }, big && { fontSize: 9 }]}>
              {isToday ? 'now' : new Date(day.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'narrow' })}
            </Text>
            {big && <Text style={[sparkSt.count, isToday && { color: ACCENT }]}>{day.total_taps}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const sparkSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44, marginBottom: 10 },
  col: { flex: 1, alignItems: 'center', height: '100%' },
  barWrap: { flex: 1, justifyContent: 'flex-end', width: '100%' },
  bar: { width: '100%', borderRadius: 3, minHeight: 3 },
  label: { fontSize: 7, color: '#2A2A4A', fontWeight: '600', marginTop: 3 },
  count: { fontSize: 8, color: '#333', fontWeight: '700' },
});

// ── Venue chips ───────────────────────────────────────────────────────────────
function VenueChips({ venues, totalTaps, big = false }: { venues: TonightVenue[]; totalTaps: number; big?: boolean }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {venues.map((v) => {
        const share = totalTaps > 0 ? v.tap_count / totalTaps : 0;
        return (
          <View key={v.venue_id} style={{ borderRadius: 12, overflow: 'hidden' }}>
            <LinearGradient colors={['rgba(102,85,255,0.18)', 'rgba(102,85,255,0.06)']} style={[chipSt.chip, big && { minWidth: 140, paddingVertical: 14 }]}>
              <View style={chipSt.barTrack}>
                <View style={[chipSt.barFill, { width: `${share * 100}%` as any }]} />
              </View>
              <Text style={[chipSt.tapNum, big && { fontSize: 28 }]}>{v.tap_count}</Text>
              <Text style={chipSt.venueName} numberOfLines={1}>{v.venue_name}</Text>
              <Text style={chipSt.venueArea}>{v.venue_area}</Text>
            </LinearGradient>
          </View>
        );
      })}
    </ScrollView>
  );
}

const chipSt = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 10, minWidth: 110, borderWidth: 1, borderColor: 'rgba(102,85,255,0.2)', borderRadius: 12, gap: 4 },
  barTrack: { height: 2, backgroundColor: 'rgba(102,85,255,0.15)', borderRadius: 1, marginBottom: 4, overflow: 'hidden' },
  barFill: { height: 2, backgroundColor: ACCENT, borderRadius: 1 },
  tapNum: { fontSize: 20, fontWeight: '900', color: ACCENT, lineHeight: 22 },
  venueName: { fontSize: 11, fontWeight: '700', color: '#DDD', marginTop: 1 },
  venueArea: { fontSize: 9, color: '#444', fontWeight: '500' },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function VibeTapCard({ isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [data, setData] = useState<TapHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (isDemoMode) { setData(DEMO_DATA); setLoading(false); return; }
    fetch(`${API_URL}/api/me/tap-history`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isDemoMode]);

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color={ACCENT} />
        <Text style={styles.loadingText}>Loading your taps...</Text>
      </View>
    );
  }

  if (!data) return null;

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="flash" size={14} color={ACCENT} />
            </View>
            <View>
              <Text style={styles.sectionLabel}>VIBE TAPS</Text>
              <Text style={styles.subtitle}>Your bolt contributions</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.allTimeBlock}>
              <Text style={styles.allTimeNum}>{data.all_time.total_taps.toLocaleString()}</Text>
              <Text style={styles.allTimeLabel}>all time</Text>
            </View>
            <TouchableOpacity style={styles.expandBtn} onPress={() => setFullscreen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="expand-outline" size={15} color="#555" />
            </TouchableOpacity>
          </View>
        </View>

        <SparkRow history={data.history} />

        {data.tonight.total_taps > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.tonightLabel}>TONIGHT · {data.tonight.total_taps} TAPS</Text>
            <VenueChips venues={data.tonight.venues} totalTaps={data.tonight.total_taps} />
          </>
        )}

        <View style={styles.divider} />
        <View style={styles.footerRow}>
          <View style={styles.footerStat}>
            <Ionicons name="location" size={10} color="#3A3A4E" />
            <Text style={styles.footerNum}>{data.all_time.venues_tapped}</Text>
            <Text style={styles.footerLabel}>venues</Text>
          </View>
          {data.all_time.top_venue && (
            <View style={styles.footerStat}>
              <Ionicons name="trophy" size={10} color="#3A3A4E" />
              <Text style={styles.footerNum} numberOfLines={1}>{data.all_time.top_venue.venue_name}</Text>
              <Text style={styles.footerLabel}>{data.all_time.top_venue.tap_count} taps</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Fullscreen Modal ──────────────────────────────────────────────────── */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <View style={fs.container}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={{ flex: 1 }}>
            <View style={fs.header}>
              <View style={fs.headerLeft}>
                <Ionicons name="flash" size={18} color={ACCENT} />
                <Text style={fs.title}>VIBE TAPS</Text>
                <Text style={fs.subtitle}>VIIBE CONTRIBUTION</Text>
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              {/* Hero stats */}
              <View style={fs.heroRow}>
                <LinearGradient colors={[ACCENT + '25', ACCENT + '0A']} style={[fs.heroCard, { borderColor: ACCENT + '40' }]}>
                  <Ionicons name="flash" size={22} color={ACCENT} />
                  <Text style={[fs.heroNum, { color: ACCENT }]}>{data.all_time.total_taps.toLocaleString()}</Text>
                  <Text style={fs.heroLabel}>TOTAL BOLTS</Text>
                </LinearGradient>
                <LinearGradient colors={['rgba(255,51,102,0.15)', 'rgba(255,51,102,0.05)']} style={[fs.heroCard, { borderColor: '#FF336640' }]}>
                  <Ionicons name="location" size={22} color="#FF3366" />
                  <Text style={[fs.heroNum, { color: '#FF3366' }]}>{data.all_time.venues_tapped}</Text>
                  <Text style={fs.heroLabel}>VENUES HIT</Text>
                </LinearGradient>
                <LinearGradient colors={['rgba(255,215,0,0.15)', 'rgba(255,215,0,0.05)']} style={[fs.heroCard, { borderColor: '#FFD70040' }]}>
                  <Ionicons name="trophy" size={22} color="#FFD700" />
                  <Text style={[fs.heroNum, { color: '#FFD700' }]}>{data.tonight.total_taps}</Text>
                  <Text style={fs.heroLabel}>TONIGHT</Text>
                </LinearGradient>
              </View>

              {/* 7-night spark */}
              <View style={fs.section}>
                <Text style={fs.sectionLabel}>7-NIGHT SPARK HISTORY</Text>
                <SparkRow history={data.history} big />
              </View>

              {/* Tonight venue breakdown */}
              {data.tonight.total_taps > 0 && (
                <View style={fs.section}>
                  <Text style={fs.sectionLabel}>TONIGHT · {data.tonight.total_taps} BOLTS FIRED</Text>
                  <VenueChips venues={data.tonight.venues} totalTaps={data.tonight.total_taps} big />
                </View>
              )}

              {/* All-time top venue */}
              {data.all_time.top_venue && (
                <View style={fs.section}>
                  <Text style={fs.sectionLabel}>YOUR SPOT</Text>
                  <View style={fs.topVenueCard}>
                    <View style={[fs.topVenueIcon, { backgroundColor: ACCENT + '20' }]}>
                      <Ionicons name="flame" size={22} color={ACCENT} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={fs.topVenueName}>{data.all_time.top_venue.venue_name}</Text>
                      <Text style={fs.topVenueDesc}>Your most bolted venue</Text>
                    </View>
                    <View style={fs.topVenueCount}>
                      <Text style={[fs.topVenueNum, { color: ACCENT }]}>{data.all_time.top_venue.tap_count}</Text>
                      <Text style={fs.topVenueCountLabel}>taps</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* VIIBE system info */}
              <View style={fs.infoCard}>
                <Text style={fs.infoTitle}>How your bolts work</Text>
                <View style={fs.infoRow}>
                  <Ionicons name="flash" size={14} color={ACCENT} />
                  <Text style={fs.infoText}>Every tap contributes to the collective venue pulse</Text>
                </View>
                <View style={fs.infoRow}>
                  <Ionicons name="trending-up" size={14} color="#FF9933" />
                  <Text style={fs.infoText}>Tap velocity (how fast you tap) boosts your signal weight</Text>
                </View>
                <View style={fs.infoRow}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={fs.infoText}>1:10 Critical Hit · 1:50 Surge · 1:200 Decisive Voice</Text>
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
  container: { backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C', padding: 14, marginHorizontal: 16, marginTop: 12 },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, padding: 14, backgroundColor: '#0C0C15', borderRadius: 16, borderWidth: 1, borderColor: '#1C1C2C' },
  loadingText: { color: '#3A3A4E', fontSize: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(102,85,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  sectionLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  subtitle: { fontSize: 11, color: '#555', fontWeight: '500', marginTop: 1 },
  allTimeBlock: { alignItems: 'flex-end' },
  allTimeNum: { fontSize: 24, fontWeight: '900', color: ACCENT, lineHeight: 26 },
  allTimeLabel: { fontSize: 8, color: '#3A3A4E', fontWeight: '600', letterSpacing: 0.5 },
  expandBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#111120', marginVertical: 10 },
  tonightLabel: { fontSize: 8, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  footerRow: { flexDirection: 'row', gap: 16 },
  footerStat: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  footerNum: { fontSize: 11, fontWeight: '800', color: '#666', flex: 1 },
  footerLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '500' },
});

const fs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  subtitle: { fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 1.5, backgroundColor: '#1A1A28', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 48 },
  heroRow: { flexDirection: 'row', margin: 16, gap: 10 },
  heroCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 6 },
  heroNum: { fontSize: 22, fontWeight: '900', letterSpacing: -1 },
  heroLabel: { fontSize: 8, color: '#555', fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionLabel: { fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 2, marginBottom: 10 },
  topVenueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(102,85,255,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(102,85,255,0.2)', padding: 16 },
  topVenueIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  topVenueName: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  topVenueDesc: { fontSize: 11, color: '#555' },
  topVenueCount: { alignItems: 'center' },
  topVenueNum: { fontSize: 28, fontWeight: '900' },
  topVenueCountLabel: { fontSize: 9, color: '#555', fontWeight: '700', letterSpacing: 1 },
  infoCard: { marginHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, borderWidth: 1, borderColor: '#1A1A28', padding: 16, gap: 12 },
  infoTitle: { fontSize: 12, fontWeight: '800', color: '#888', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { fontSize: 12, color: '#555', flex: 1, lineHeight: 17 },
});
