/**
 * VibeForecast - Predicted energy curve for tonight
 * Shows line-like chart with peak hour badge.
 * Expand button opens fullscreen forecast analysis.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Modal, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VibeForecastProps {
  venueId: string;
  venueName?: string;
}

interface ForecastPoint {
  hour: number;
  hour_label: string;
  predicted_score: number;
  confidence: number;
  predicted_energy: string;
}

interface ForecastData {
  forecast: ForecastPoint[];
  peak_hour: string | null;
  peak_score: number;
  overall_confidence: number;
  weeks_of_data: number;
}

function getBarColor(score: number): string {
  if (score >= 75) return '#FF3366';
  if (score >= 50) return '#FF9933';
  if (score >= 25) return '#9933FF';
  return '#3399FF';
}

function energyDesc(label: string): string {
  switch (label?.toUpperCase()) {
    case 'ELECTRIC': return 'Full energy — peak performance';
    case 'LIT':      return 'High energy — great time to arrive';
    case 'CHARGED':  return 'Building — crowd growing';
    case 'WARMING':  return 'Early — things heating up';
    default:         return 'Quiet — off-peak hours';
  }
}

// ── Shared bar chart ──────────────────────────────────────────────────────────
function ForecastChart({
  hours, peakHour, maxBarHeight = 80, colWidth = 28, barW = 14,
}: {
  hours: ForecastPoint[]; peakHour: string | null;
  maxBarHeight?: number; colWidth?: number; barW?: number;
}) {
  const maxScore = Math.max(...hours.map(p => p.predicted_score), 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chartSt.row}>
      {hours.map((point) => {
        const h = Math.max((point.predicted_score / maxScore) * maxBarHeight, 3);
        const isPeak = point.hour_label === peakHour;
        const col = getBarColor(point.predicted_score);
        return (
          <View key={point.hour} style={[chartSt.col, { width: colWidth }]}>
            {isPeak && <Ionicons name="flame" size={10} color="#FF3366" style={{ marginBottom: 2 }} />}
            <View style={[chartSt.bar, {
              height: h, width: barW, borderRadius: 3,
              backgroundColor: isPeak ? col : `${col}50`,
              borderWidth: isPeak ? 1 : 0, borderColor: col,
            }]} />
            <Text style={[chartSt.label, isPeak && { color: '#FFF', fontWeight: '700' }]}>
              {point.hour_label.slice(0, 2)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const chartSt = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 8, gap: 2 },
  col: { alignItems: 'center' },
  bar: { minHeight: 3 },
  label: { fontSize: 9, color: colors.text.muted, marginTop: 4 },
});

// ── Main component ────────────────────────────────────────────────────────────
export default function VibeForecast({ venueId, venueName }: VibeForecastProps) {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    if ((expanded || fullscreen) && !data && !noData) fetchForecast();
  }, [expanded, fullscreen]);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/forecast/${venueId}`);
      if (res.ok) {
        const result = await res.json();
        if (result.forecast) setData(result);
        else setNoData(true);
      }
    } catch (e) {
      console.error('Error fetching forecast:', e);
    } finally {
      setLoading(false);
    }
  };

  const eveningHours = data?.forecast?.filter(p => p.hour >= 17 || p.hour <= 4) || [];

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={16} color="#FFD700" />
            <Text style={styles.headerText}>Tonight's Forecast</Text>
          </View>
          <View style={styles.headerRight}>
            {data?.peak_hour && !expanded && (
              <View style={styles.peakBadge}>
                <Ionicons name="flame" size={12} color="#FF3366" />
                <Text style={styles.peakText}>Peak: {data.peak_hour}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.expandBtn}
              onPress={() => { setExpanded(true); setFullscreen(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="expand-outline" size={15} color={colors.text.muted} />
            </TouchableOpacity>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.text.muted} />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.content}>
            {loading ? (
              <ActivityIndicator size="small" color="#FFD700" style={{ padding: 20 }} />
            ) : noData ? (
              <Text style={styles.noDataText}>Not enough history to forecast yet. Check back next week!</Text>
            ) : data ? (
              <>
                {data.peak_hour && (
                  <View style={styles.peakCard}>
                    <Ionicons name="flame" size={24} color="#FF3366" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.peakCardTitle}>Predicted peak at {data.peak_hour}</Text>
                      <Text style={styles.peakCardScore}>Expected score: {data.peak_score}%</Text>
                    </View>
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>{data.weeks_of_data}w data</Text>
                    </View>
                  </View>
                )}
                <ForecastChart hours={eveningHours} peakHour={data.peak_hour} />
                <View style={styles.footer}>
                  <Ionicons name="information-circle" size={12} color={colors.text.muted} />
                  <Text style={styles.footerText}>
                    Based on {data.weeks_of_data} week{data.weeks_of_data > 1 ? 's' : ''} of data ({data.overall_confidence}% coverage)
                  </Text>
                </View>
              </>
            ) : null}
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
                <Ionicons name="sparkles" size={18} color="#FFD700" />
                <Text style={fs.title}>TONIGHT'S FORECAST</Text>
                {venueName && <Text style={fs.venueChip}>{venueName.toUpperCase()}</Text>}
              </View>
              <TouchableOpacity style={fs.closeBtn} onPress={() => setFullscreen(false)}>
                <Ionicons name="close" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={fs.content} showsVerticalScrollIndicator={false}>
              {loading ? (
                <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 60 }} />
              ) : noData ? (
                <View style={fs.emptyState}>
                  <Text style={fs.emptyEmoji}>📊</Text>
                  <Text style={fs.emptyTitle}>Not enough data yet</Text>
                  <Text style={fs.emptyDesc}>Check back after this venue gets a few more nights of scouting data.</Text>
                </View>
              ) : data ? (
                <>
                  {/* Peak hero */}
                  {data.peak_hour && (
                    <LinearGradient colors={['rgba(255,51,102,0.12)', 'rgba(255,51,102,0.04)']} style={fs.heroCard}>
                      <View style={fs.heroLeft}>
                        <Ionicons name="flame" size={32} color="#FF3366" />
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={fs.heroLabel}>PEAK TONIGHT</Text>
                        <Text style={fs.heroPeak}>{data.peak_hour}</Text>
                        <Text style={fs.heroSub}>
                          Predicted {data.peak_score}% vibe · {data.overall_confidence}% confidence
                        </Text>
                      </View>
                      <View style={fs.dataBlock}>
                        <Text style={fs.dataNum}>{data.weeks_of_data}</Text>
                        <Text style={fs.dataLabel}>weeks{'\n'}of data</Text>
                      </View>
                    </LinearGradient>
                  )}

                  {/* Big chart */}
                  <View style={fs.chartSection}>
                    <Text style={fs.sectionLabel}>ENERGY CURVE — TONIGHT</Text>
                    <ForecastChart hours={eveningHours} peakHour={data.peak_hour} maxBarHeight={160} colWidth={38} barW={22} />
                  </View>

                  {/* Hour-by-hour table */}
                  <View style={fs.tableSection}>
                    <Text style={fs.sectionLabel}>HOUR BY HOUR</Text>
                    <View style={fs.table}>
                      <View style={fs.tableHeader}>
                        <Text style={[fs.tableCell, { flex: 1 }]}>HOUR</Text>
                        <Text style={[fs.tableCell, { width: 64 }]}>SCORE</Text>
                        <Text style={[fs.tableCell, { flex: 1 }]}>ENERGY</Text>
                        <Text style={[fs.tableCell, { width: 56 }]}>CONF.</Text>
                      </View>
                      {eveningHours.map((p) => {
                        const isPeak = p.hour_label === data.peak_hour;
                        const col = getBarColor(p.predicted_score);
                        return (
                          <View key={p.hour} style={[fs.tableRow, isPeak && { backgroundColor: col + '12' }]}>
                            <Text style={[fs.tableCell, { flex: 1, color: isPeak ? '#FFF' : '#888' }]}>
                              {p.hour_label} {isPeak ? '🔥' : ''}
                            </Text>
                            <Text style={[fs.tableCell, { width: 64, color: col, fontWeight: '800' }]}>
                              {Math.round(p.predicted_score)}%
                            </Text>
                            <Text style={[fs.tableCell, { flex: 1, color: col, fontSize: 9 }]}>
                              {p.predicted_energy?.toUpperCase() ?? energyDesc(p.predicted_energy).split(' ')[0]}
                            </Text>
                            <Text style={[fs.tableCell, { width: 56, color: '#555' }]}>
                              {Math.round(p.confidence)}%
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={fs.footer}>
                    <Ionicons name="information-circle" size={12} color="#444" />
                    <Text style={fs.footerText}>
                      Based on {data.weeks_of_data} week{data.weeks_of_data > 1 ? 's' : ''} of scout data · {data.overall_confidence}% coverage
                    </Text>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card, borderRadius: borderRadius.xl,
    marginHorizontal: spacing.lg, marginTop: spacing.md, overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.text.secondary },
  peakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF336615', paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.sm,
  },
  peakText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: '#FF3366' },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center',
  },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  noDataText: { color: colors.text.muted, fontSize: typography.fontSize.sm, textAlign: 'center', padding: spacing.lg },
  peakCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF336610',
    borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md,
  },
  peakCardTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.text.primary },
  peakCardScore: { fontSize: typography.fontSize.xs, color: colors.text.muted, marginTop: 2 },
  confidenceBadge: { backgroundColor: colors.background.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm },
  confidenceText: { fontSize: 10, color: colors.text.muted, fontWeight: typography.fontWeight.semibold },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  footerText: { fontSize: 10, color: colors.text.muted },
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
    backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  content: { paddingBottom: 48 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  emptyDesc: { fontSize: 13, color: '#555', textAlign: 'center', paddingHorizontal: 32 },
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,51,102,0.25)', padding: 20,
  },
  heroLeft: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,51,102,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroLabel: { fontSize: 9, color: '#FF3366', fontWeight: '800', letterSpacing: 2 },
  heroPeak: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: -1 },
  heroSub: { fontSize: 12, color: '#888' },
  dataBlock: { alignItems: 'center', gap: 2 },
  dataNum: { fontSize: 24, fontWeight: '900', color: '#FFF' },
  dataLabel: { fontSize: 8, color: '#555', fontWeight: '700', letterSpacing: 1, textAlign: 'center' },
  chartSection: { marginHorizontal: 8, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, paddingVertical: 12 },
  sectionLabel: { fontSize: 9, color: '#555', fontWeight: '800', letterSpacing: 2, paddingHorizontal: 16, marginBottom: 4 },
  tableSection: { marginHorizontal: 16, marginBottom: 16 },
  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1A1A28' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#111120', paddingHorizontal: 14, paddingVertical: 8 },
  tableRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1A1A28' },
  tableCell: { fontSize: 11, fontWeight: '700', color: '#555', letterSpacing: 0.5 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, paddingTop: 8 },
  footerText: { fontSize: 10, color: '#333' },
});
