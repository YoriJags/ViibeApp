/**
 * VibeIntelCard - Deep vibe analytics for merchant dashboard
 * Shows energy curve, rating breakdown, vibe killers, scout demographics
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { merchantTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = merchantTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VibeIntelCardProps {
  venueId: string;
  getAuthHeaders: () => Record<string, string>;
}

interface IntelData {
  energy_curve: { hour: number; hour_label: string; avg_score: number; sample_count: number }[];
  rating_breakdown: Record<string, number>;
  peak_hour: string | null;
  peak_score: number;
  vibe_killers: { issue: string; percentage: number; tip: string }[];
  scout_breakdown: Record<string, number>;
  total_unique_scouts: number;
  week_over_week_trend: number;
  trend_direction: string;
  conversion_rate: number;
  total_ratings_this_week: number;
}

export default function VibeIntelCard({ venueId, getAuthHeaders }: VibeIntelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expanded && !data) {
      fetchIntel();
    }
  }, [expanded]);

  const fetchIntel = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/merchant/venue/${venueId}/vibe-intelligence`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error('Error fetching vibe intel:', e);
    } finally {
      setLoading(false);
    }
  };

  const getBarColor = (score: number) => {
    if (score >= 75) return '#FF3366';
    if (score >= 50) return '#FF9933';
    if (score >= 25) return '#9933FF';
    return '#3399FF';
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="analytics" size={20} color={colors.gold} />
          <Text style={styles.headerTitle}>Vibe Intelligence</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.gold} style={{ padding: 20 }} />
          ) : data ? (
            <>
              {/* Trend + Peak Row */}
              <View style={styles.summaryRow}>
                <View style={[styles.summaryBadge, {
                  backgroundColor: data.trend_direction === 'improving' ? '#4CAF5020' : '#FF525220',
                }]}>
                  <Ionicons
                    name={data.trend_direction === 'improving' ? 'trending-up' : 'trending-down'}
                    size={16}
                    color={data.trend_direction === 'improving' ? '#4CAF50' : '#FF5252'}
                  />
                  <Text style={[styles.summaryText, {
                    color: data.trend_direction === 'improving' ? '#4CAF50' : '#FF5252',
                  }]}>
                    {data.week_over_week_trend > 0 ? '+' : ''}{data.week_over_week_trend}% WoW
                  </Text>
                </View>
                {data.peak_hour && (
                  <View style={[styles.summaryBadge, { backgroundColor: '#FF336620' }]}>
                    <Ionicons name="flame" size={14} color="#FF3366" />
                    <Text style={[styles.summaryText, { color: '#FF3366' }]}>
                      Peak: {data.peak_hour} ({data.peak_score}%)
                    </Text>
                  </View>
                )}
              </View>

              {/* Energy Curve Mini Chart */}
              <View style={styles.chartSection}>
                <Text style={styles.chartLabel}>7-Day Energy Curve</Text>
                <View style={styles.chartBars}>
                  {data.energy_curve
                    .filter((_: any, i: number) => i >= 17 || i <= 4) // Show 5PM-4AM
                    .map((point: any) => {
                      const maxScore = Math.max(...data.energy_curve.map((p: any) => p.avg_score), 1);
                      const height = Math.max((point.avg_score / maxScore) * 50, 2);
                      return (
                        <View key={point.hour} style={styles.chartBarCol}>
                          <View
                            style={[styles.chartBar, {
                              height,
                              backgroundColor: getBarColor(point.avg_score),
                            }]}
                          />
                          <Text style={styles.chartHour}>{point.hour_label.slice(0, 2)}</Text>
                        </View>
                      );
                    })}
                </View>
              </View>

              {/* Rating Breakdown */}
              <View style={styles.breakdownSection}>
                <Text style={styles.chartLabel}>Rating Breakdown</Text>
                <View style={styles.breakdownRow}>
                  {Object.entries(data.rating_breakdown).map(([key, pct]) => (
                    <View key={key} style={styles.breakdownItem}>
                      <View style={[styles.breakdownDot, {
                        backgroundColor: key === 'electric' ? '#FF3366' : key === 'popping' ? '#FF9933' : '#4FC3F7',
                      }]} />
                      <Text style={styles.breakdownLabel}>{key}</Text>
                      <Text style={styles.breakdownValue}>{pct}%</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Vibe Killers */}
              {data.vibe_killers.length > 0 && (
                <View style={styles.killersSection}>
                  <Text style={[styles.chartLabel, { color: '#FF5252' }]}>Vibe Killers</Text>
                  {data.vibe_killers.map((killer: any, i: number) => (
                    <View key={i} style={styles.killerItem}>
                      <Ionicons name="warning" size={14} color="#FF5252" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.killerText}>{killer.issue} ({killer.percentage}%)</Text>
                        <Text style={styles.killerTip}>{killer.tip}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Stats Footer */}
              <View style={styles.statsFooter}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data.total_unique_scouts}</Text>
                  <Text style={styles.statLabel}>Scouts</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data.total_ratings_this_week}</Text>
                  <Text style={styles.statLabel}>Ratings</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{data.conversion_rate}%</Text>
                  <Text style={styles.statLabel}>Conversion</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>No intelligence data available yet</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  summaryText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  chartSection: {
    marginBottom: spacing.lg,
  },
  chartLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 60,
  },
  chartBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '80%',
    borderRadius: 2,
    minHeight: 2,
  },
  chartHour: {
    fontSize: 8,
    color: colors.text.muted,
    marginTop: 2,
  },
  breakdownSection: {
    marginBottom: spacing.lg,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  breakdownValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  killersSection: {
    marginBottom: spacing.lg,
  },
  killerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FF525210',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  killerText: {
    fontSize: typography.fontSize.sm,
    color: '#FF5252',
    fontWeight: typography.fontWeight.semibold,
  },
  killerTip: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    padding: spacing.lg,
  },
});
