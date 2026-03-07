/**
 * VibeTapCard — Scout's bolt-tap contribution tracker.
 *
 * Shows:
 *   - Tonight: taps per venue (cross-location breakdown)
 *   - All-time: total taps + top venue
 *   - 7-night spark history
 *
 * Taps = vibes. Every bolt you fire shapes the surge at a venue.
 * This is the honest, unfakeable record of your contribution.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVibeStore } from '../store/vibeStore';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

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

// Demo data — realistic Lagos scout night
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

export default function VibeTapCard({ isDemoMode }: Props) {
  const getAuthHeaders = useVibeStore(s => s.getAuthHeaders);
  const [data, setData] = useState<TapHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

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
        <ActivityIndicator size="small" color="#6655FF" />
        <Text style={styles.loadingText}>Loading your taps...</Text>
      </View>
    );
  }

  if (!data) return null;

  const spark7 = data.history.slice(0, 7).reverse();
  const sparkMax = Math.max(...spark7.map(d => d.total_taps), 1);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="flash" size={14} color="#6655FF" />
          </View>
          <View>
            <Text style={styles.sectionLabel}>VIBE TAPS</Text>
            <Text style={styles.subtitle}>Your bolt contributions</Text>
          </View>
        </View>
        {/* All-time total */}
        <View style={styles.allTimeBlock}>
          <Text style={styles.allTimeNum}>{data.all_time.total_taps.toLocaleString()}</Text>
          <Text style={styles.allTimeLabel}>all time</Text>
        </View>
      </View>

      {/* 7-night spark */}
      <View style={styles.sparkRow}>
        {spark7.map((day, i) => {
          const pct = day.total_taps / sparkMax;
          const isToday = i === spark7.length - 1;
          return (
            <View key={day.date} style={styles.sparkCol}>
              <View style={styles.sparkBarWrap}>
                <View style={[
                  styles.sparkBar,
                  {
                    height: `${Math.max(pct * 100, 4)}%`,
                    backgroundColor: isToday ? '#6655FF' : day.total_taps > 0 ? '#2A2A4A' : '#111120',
                  },
                ]} />
              </View>
              <Text style={[styles.sparkDayLabel, isToday && { color: '#6655FF' }]}>
                {isToday ? 'now' : new Date(day.date + 'T12:00:00Z').toLocaleDateString('en', { weekday: 'narrow' })}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Tonight breakdown */}
      {data.tonight.total_taps > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.tonightLabel}>TONIGHT · {data.tonight.total_taps} TAPS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.venueScroll}
          >
            {data.tonight.venues.map((v) => {
              const share = data.tonight.total_taps > 0 ? v.tap_count / data.tonight.total_taps : 0;
              return (
                <View key={v.venue_id} style={styles.venueChip}>
                  <LinearGradient
                    colors={['rgba(102,85,255,0.18)', 'rgba(102,85,255,0.06)']}
                    style={styles.venueChipGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {/* Mini bar representing share */}
                    <View style={styles.venueBarTrack}>
                      <View style={[styles.venueBarFill, { width: `${share * 100}%` }]} />
                    </View>
                    <Text style={styles.venueTapNum}>{v.tap_count}</Text>
                    <Text style={styles.venueName} numberOfLines={1}>{v.venue_name}</Text>
                    <Text style={styles.venueArea}>{v.venue_area}</Text>
                  </LinearGradient>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* All-time footer stats */}
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
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C0C15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1C1C2C',
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#0C0C15',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1C1C2C',
  },
  loadingText: { color: '#3A3A4E', fontSize: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(102,85,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5 },
  subtitle: { fontSize: 11, color: '#555', fontWeight: '500', marginTop: 1 },
  allTimeBlock: { alignItems: 'flex-end' },
  allTimeNum: { fontSize: 24, fontWeight: '900', color: '#6655FF', lineHeight: 26 },
  allTimeLabel: { fontSize: 8, color: '#3A3A4E', fontWeight: '600', letterSpacing: 0.5 },
  // Sparkline
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 44,
    marginBottom: 10,
  },
  sparkCol: { flex: 1, alignItems: 'center', height: '100%' },
  sparkBarWrap: { flex: 1, justifyContent: 'flex-end', width: '100%' },
  sparkBar: { width: '100%', borderRadius: 3, minHeight: 3 },
  sparkDayLabel: { fontSize: 7, color: '#2A2A4A', fontWeight: '600', marginTop: 3 },
  // Tonight
  divider: { height: 1, backgroundColor: '#111120', marginVertical: 10 },
  tonightLabel: { fontSize: 8, color: '#3A3A4E', fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  venueScroll: { gap: 8, paddingRight: 4 },
  venueChip: { borderRadius: 12, overflow: 'hidden' },
  venueChipGrad: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 110,
    borderWidth: 1,
    borderColor: 'rgba(102,85,255,0.2)',
    borderRadius: 12,
    gap: 4,
  },
  venueBarTrack: {
    height: 2,
    backgroundColor: 'rgba(102,85,255,0.15)',
    borderRadius: 1,
    marginBottom: 4,
    overflow: 'hidden',
  },
  venueBarFill: { height: 2, backgroundColor: '#6655FF', borderRadius: 1 },
  venueTapNum: { fontSize: 20, fontWeight: '900', color: '#6655FF', lineHeight: 22 },
  venueName: { fontSize: 11, fontWeight: '700', color: '#DDD', marginTop: 1 },
  venueArea: { fontSize: 9, color: '#444', fontWeight: '500' },
  // Footer
  footerRow: { flexDirection: 'row', gap: 16 },
  footerStat: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  footerNum: { fontSize: 11, fontWeight: '800', color: '#666', flex: 1 },
  footerLabel: { fontSize: 9, color: '#3A3A4E', fontWeight: '500' },
});
