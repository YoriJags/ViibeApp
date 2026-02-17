/**
 * VibeTimeline - 24-hour vibe history slider
 * Shows score curve with draggable hour selector
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;

interface TimelinePoint {
  hour: string;
  hour_label: string;
  avg_vibe_score: number;
  peak_score: number;
  energy_level: string;
  rating_count: number;
  checkin_count: number;
}

interface VibeTimelineProps {
  timeline: TimelinePoint[];
  peakHour: string | null;
}

function getBarColor(score: number): string {
  if (score >= 80) return '#FF3366';
  if (score >= 60) return '#FF9933';
  if (score >= 40) return '#9933FF';
  return '#3399FF';
}

export default function VibeTimeline({ timeline, peakHour }: VibeTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (timeline.length === 0) return null;

  const maxScore = Math.max(...timeline.map(t => t.avg_vibe_score), 1);
  const selected = selectedIndex !== null ? timeline[selectedIndex] : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="time-outline" size={16} color={colors.text.muted} />
          <Text style={styles.headerText}>Tonight's Timeline</Text>
        </View>
        {peakHour && (
          <View style={styles.peakBadge}>
            <Ionicons name="flame" size={12} color="#FF3366" />
            <Text style={styles.peakText}>Peak: {peakHour}</Text>
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
          {/* Bar chart */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartContainer}
          >
            {timeline.map((point, index) => {
              const height = Math.max((point.avg_vibe_score / maxScore) * 80, 4);
              const isSelected = selectedIndex === index;
              const barColor = getBarColor(point.avg_vibe_score);

              return (
                <TouchableOpacity
                  key={point.hour}
                  style={styles.barColumn}
                  onPress={() => setSelectedIndex(isSelected ? null : index)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.bar,
                      {
                        height,
                        backgroundColor: isSelected ? barColor : `${barColor}60`,
                      },
                    ]}
                  />
                  <Text style={[
                    styles.hourLabel,
                    isSelected && { color: colors.text.primary },
                  ]}>
                    {point.hour_label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Selected hour details */}
          {selected && (
            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vibe Score</Text>
                <Text style={[styles.detailValue, { color: getBarColor(selected.avg_vibe_score) }]}>
                  {Math.round(selected.avg_vibe_score)}%
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Energy</Text>
                <Text style={styles.detailValue}>{selected.energy_level}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ratings</Text>
                <Text style={styles.detailValue}>{selected.rating_count}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Check-ins</Text>
                <Text style={styles.detailValue}>{selected.checkin_count}</Text>
              </View>
            </View>
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
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: spacing.sm,
    gap: 2,
  },
  barColumn: {
    alignItems: 'center',
    width: 28,
  },
  bar: {
    width: 16,
    borderRadius: 4,
    minHeight: 4,
  },
  hourLabel: {
    fontSize: 9,
    color: colors.text.muted,
    marginTop: 4,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  detailRow: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.muted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
});
