/**
 * VibeForecast - Predicted energy curve for tonight
 * Shows line-like chart with peak hour badge
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface VibeForecastProps {
  venueId: string;
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

export default function VibeForecast({ venueId }: VibeForecastProps) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [noData, setNoData] = useState(false);

  useEffect(() => {
    if (expanded && !data && !noData) {
      fetchForecast();
    }
  }, [expanded]);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/forecast/${venueId}`);
      if (res.ok) {
        const result = await res.json();
        if (result.forecast) {
          setData(result);
        } else {
          setNoData(true);
        }
      }
    } catch (e) {
      console.error('Error fetching forecast:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter to evening hours (5PM - 4AM)
  const eveningHours = data?.forecast?.filter(
    (p) => p.hour >= 17 || p.hour <= 4
  ) || [];

  const maxScore = Math.max(...eveningHours.map(p => p.predicted_score), 1);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={16} color="#FFD700" />
          <Text style={styles.headerText}>Tonight's Forecast</Text>
        </View>
        {data?.peak_hour && !expanded && (
          <View style={styles.peakBadge}>
            <Ionicons name="flame" size={12} color="#FF3366" />
            <Text style={styles.peakText}>Peak: {data.peak_hour}</Text>
          </View>
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.text.muted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFD700" style={{ padding: 20 }} />
          ) : noData ? (
            <Text style={styles.noDataText}>
              Not enough history to forecast yet. Check back next week!
            </Text>
          ) : data ? (
            <>
              {/* Peak info */}
              {data.peak_hour && (
                <View style={styles.peakCard}>
                  <Ionicons name="flame" size={24} color="#FF3366" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.peakCardTitle}>
                      Predicted peak at {data.peak_hour}
                    </Text>
                    <Text style={styles.peakCardScore}>
                      Expected score: {data.peak_score}%
                    </Text>
                  </View>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {data.weeks_of_data}w data
                    </Text>
                  </View>
                </View>
              )}

              {/* Forecast chart */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chartContainer}
              >
                {eveningHours.map((point) => {
                  const height = Math.max((point.predicted_score / maxScore) * 70, 3);
                  const isPeak = point.hour_label === data.peak_hour;
                  const barColor = getBarColor(point.predicted_score);

                  return (
                    <View key={point.hour} style={styles.barColumn}>
                      {isPeak && (
                        <Ionicons name="flame" size={10} color="#FF3366" style={{ marginBottom: 2 }} />
                      )}
                      <View
                        style={[styles.bar, {
                          height,
                          backgroundColor: isPeak ? barColor : `${barColor}50`,
                          borderWidth: isPeak ? 1 : 0,
                          borderColor: barColor,
                        }]}
                      />
                      <Text style={[
                        styles.hourLabel,
                        isPeak && { color: colors.text.primary, fontWeight: '700' as const },
                      ]}>
                        {point.hour_label.slice(0, 2)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Confidence footer */}
              <View style={styles.footer}>
                <Ionicons name="information-circle" size={12} color={colors.text.muted} />
                <Text style={styles.footerText}>
                  Based on {data.weeks_of_data} week{data.weeks_of_data > 1 ? 's' : ''} of data
                  {' '}({data.overall_confidence}% coverage)
                </Text>
              </View>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
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
    flex: 1,
  },
  headerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  peakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF336615',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  peakText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: '#FF3366',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  noDataText: {
    color: colors.text.muted,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    padding: spacing.lg,
  },
  peakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF336610',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  peakCardTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  peakCardScore: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  confidenceBadge: {
    backgroundColor: colors.background.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  confidenceText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: typography.fontWeight.semibold,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: spacing.sm,
    gap: 3,
  },
  barColumn: {
    alignItems: 'center',
    width: 26,
  },
  bar: {
    width: 14,
    borderRadius: 3,
    minHeight: 3,
  },
  hourLabel: {
    fontSize: 9,
    color: colors.text.muted,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  footerText: {
    fontSize: 10,
    color: colors.text.muted,
  },
});
