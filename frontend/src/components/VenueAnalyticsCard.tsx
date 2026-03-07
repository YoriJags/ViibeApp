/**
 * VenueAnalyticsCard — Merchant intelligence dashboard.
 * Shows 30-day vibe history, peak hours, slow nights, area rank, top scouts.
 * This is the core data product that venues pay for.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface DayData { day: string; avg_score: number; count: number; }
interface PeakHour { hour: number; label: string; count: number; avg_score: number; }
interface SlowNight { day: string; avg_score: number; tip: string; }
interface TopScout { username: string; rating_count: number; clout: number; }
interface VibeDay { date: string; avg_score: number; rating_count: number; }

interface Analytics {
  venue_name: string;
  vibe_history: VibeDay[];
  peak_hours: PeakHour[];
  day_breakdown: DayData[];
  slow_nights: SlowNight[];
  area_rank: { current_rank: number | null; total_venues: number };
  top_scouts: TopScout[];
  summary: {
    avg_score_30d: number;
    total_ratings_30d: number;
    best_day: string | null;
    worst_day: string | null;
    trend: 'improving' | 'declining' | 'stable';
  };
}

interface Props {
  venueId: string;
  authToken: string;
}

const TREND_CONFIG = {
  improving: { color: '#4CAF50', icon: 'trending-up', label: 'Trending Up' },
  declining: { color: '#FF5252', icon: 'trending-down', label: 'Trending Down' },
  stable:    { color: '#FF9933', icon: 'remove', label: 'Stable' },
};

const SCORE_COLOR = (s: number) =>
  s >= 75 ? '#FF3366' : s >= 55 ? '#FF9933' : s >= 35 ? '#9933FF' : '#3399FF';

export default function VenueAnalyticsCard({ venueId, authToken }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/merchant/venues/${venueId}/analytics`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [venueId, authToken]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="small" color="#FF3366" />
        <Text style={styles.loadingText}>Loading intelligence...</Text>
      </View>
    );
  }

  if (!data) return null;

  const { summary, area_rank, slow_nights, peak_hours, day_breakdown, top_scouts, vibe_history } = data;
  const trend = TREND_CONFIG[summary.trend];
  const sparkline = vibe_history.slice(-14); // last 14 days for bar chart
  const maxScore = Math.max(...sparkline.map(d => d.avg_score), 1);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
        <View>
          <Text style={styles.sectionLabel}>VENUE INTELLIGENCE</Text>
          <Text style={styles.sectionSub}>30-day performance data</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
      </TouchableOpacity>

      {/* Summary strip — always visible */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.avg_score_30d}%</Text>
          <Text style={styles.summaryLabel}>Avg Score</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{summary.total_ratings_30d}</Text>
          <Text style={styles.summaryLabel}>Ratings</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: trend.color }]}>
            {area_rank.current_rank ? `#${area_rank.current_rank}` : '—'}
          </Text>
          <Text style={styles.summaryLabel}>Area Rank</Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name={trend.icon as any} size={18} color={trend.color} />
          <Text style={[styles.summaryLabel, { color: trend.color }]}>{trend.label}</Text>
        </View>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.detail}>

          {/* 14-day sparkline */}
          {sparkline.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>LAST 14 DAYS</Text>
              <View style={styles.sparkline}>
                {sparkline.map((d, i) => (
                  <View key={i} style={styles.sparkBar}>
                    <View
                      style={[
                        styles.sparkFill,
                        {
                          height: Math.max(4, (d.avg_score / maxScore) * 60),
                          backgroundColor: SCORE_COLOR(d.avg_score),
                        },
                      ]}
                    />
                    <Text style={styles.sparkLabel}>
                      {d.date.slice(8)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Best / worst days */}
          <View style={styles.row}>
            {summary.best_day && (
              <LinearGradient colors={['#4CAF5020', '#4CAF5005']} style={styles.dayCard}>
                <Text style={styles.dayEmoji}>🔥</Text>
                <Text style={styles.dayName}>{summary.best_day}</Text>
                <Text style={styles.dayLabel}>Best night</Text>
              </LinearGradient>
            )}
            {summary.worst_day && (
              <LinearGradient colors={['#FF525220', '#FF525205']} style={styles.dayCard}>
                <Text style={styles.dayEmoji}>💤</Text>
                <Text style={styles.dayName}>{summary.worst_day}</Text>
                <Text style={styles.dayLabel}>Slowest night</Text>
              </LinearGradient>
            )}
          </View>

          {/* Peak hours */}
          {peak_hours.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PEAK HOURS</Text>
              <View style={styles.hoursRow}>
                {peak_hours.slice(0, 5).map((h, i) => (
                  <View key={i} style={[styles.hourChip, i === 0 && styles.hourChipTop]}>
                    <Text style={[styles.hourTime, i === 0 && { color: '#FF3366' }]}>{h.label}</Text>
                    <Text style={styles.hourCount}>{h.count} ratings</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Slow nights with blast tip */}
          {slow_nights.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SLOW NIGHTS — ACTION NEEDED</Text>
              {slow_nights.map((sn, i) => (
                <View key={i} style={styles.slowNightRow}>
                  <View style={styles.slowNightLeft}>
                    <Text style={styles.slowDay}>{sn.day}</Text>
                    <Text style={styles.slowScore}>{sn.avg_score}% avg</Text>
                  </View>
                  <Text style={styles.slowTip}>{sn.tip}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Top scouts */}
          {top_scouts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>YOUR TOP SCOUTS (7 DAYS)</Text>
              {top_scouts.map((s, i) => (
                <View key={i} style={styles.scoutRow}>
                  <Text style={styles.scoutRank}>#{i + 1}</Text>
                  <Text style={styles.scoutName}>{s.username}</Text>
                  <Text style={styles.scoutStats}>{s.rating_count} ratings · {s.clout} clout</Text>
                </View>
              ))}
            </View>
          )}

          {/* Area rank context */}
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>
              Ranked{' '}
              <Text style={{ color: '#FF3366', fontWeight: '800' }}>
                #{area_rank.current_rank ?? '—'}
              </Text>
              {' '}of {area_rank.total_venues} venues in your city
            </Text>
          </View>

        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111118',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252530',
    marginVertical: 8,
    overflow: 'hidden',
  },
  loadingWrapper: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: { color: '#555', fontSize: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 2,
  },
  sectionSub: { fontSize: 11, color: '#555', marginTop: 2 },
  summaryStrip: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1A1A25',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryValue: { fontSize: 18, fontWeight: '900', color: '#FFF' },
  summaryLabel: { fontSize: 9, color: '#555', fontWeight: '600', letterSpacing: 0.5 },
  detail: { padding: 16, paddingTop: 4, gap: 16 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#444',
    letterSpacing: 2,
    marginBottom: 4,
  },
  sparkline: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 76,
    gap: 3,
  },
  sparkBar: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  sparkFill: { width: '100%', borderRadius: 2, minHeight: 4 },
  sparkLabel: { fontSize: 8, color: '#444' },
  row: { flexDirection: 'row', gap: 8 },
  dayCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#ffffff08',
  },
  dayEmoji: { fontSize: 20 },
  dayName: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  dayLabel: { fontSize: 10, color: '#666' },
  hoursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hourChip: {
    backgroundColor: '#1A1A25',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#252530',
  },
  hourChipTop: { borderColor: '#FF336640', backgroundColor: '#FF336610' },
  hourTime: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  hourCount: { fontSize: 9, color: '#555', marginTop: 1 },
  slowNightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FF525210',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FF525225',
  },
  slowNightLeft: { minWidth: 70 },
  slowDay: { fontSize: 13, fontWeight: '800', color: '#FF5252' },
  slowScore: { fontSize: 10, color: '#FF525288', marginTop: 2 },
  slowTip: { flex: 1, fontSize: 11, color: '#AAA', lineHeight: 16 },
  scoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A25',
  },
  scoutRank: { fontSize: 11, fontWeight: '800', color: '#FF3366', width: 24 },
  scoutName: { fontSize: 13, fontWeight: '700', color: '#FFF', flex: 1 },
  scoutStats: { fontSize: 10, color: '#555' },
  rankBadge: {
    backgroundColor: '#FF336610',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FF336625',
    alignItems: 'center',
  },
  rankText: { fontSize: 12, color: '#AAA', textAlign: 'center' },
});
