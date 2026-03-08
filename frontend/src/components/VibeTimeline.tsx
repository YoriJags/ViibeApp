/**
 * VibeTimeline - 24-hour vibe history slider
 * Shows score curve with draggable hour selector.
 * Expand button opens fullscreen modal for deep analysis.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { publicTheme, spacing, borderRadius, typography } from '../theme/floors';

const { colors } = publicTheme;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

function energyLabel(score: number): string {
  if (score >= 80) return 'ELECTRIC';
  if (score >= 60) return 'LIT';
  if (score >= 40) return 'CHARGED';
  if (score >= 20) return 'WARMING';
  return 'QUIET';
}

// ── Shared bar chart ───────────────────────────────────────────────────────────
function BarChart({
  timeline,
  selectedIndex,
  onSelect,
  barWidth = 16,
  barMax = 80,
  columnWidth = 28,
}: {
  timeline: TimelinePoint[];
  selectedIndex: number | null;
  onSelect: (i: number | null) => void;
  barWidth?: number;
  barMax?: number;
  columnWidth?: number;
}) {
  const maxScore = Math.max(...timeline.map(t => t.avg_vibe_score), 1);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chartContainer, { paddingHorizontal: 8 }]}
    >
      {timeline.map((point, index) => {
        const h = Math.max((point.avg_vibe_score / maxScore) * barMax, 4);
        const isSelected = selectedIndex === index;
        const color = getBarColor(point.avg_vibe_score);
        return (
          <TouchableOpacity
            key={point.hour}
            style={[styles.barColumn, { width: columnWidth }]}
            onPress={() => onSelect(isSelected ? null : index)}
            activeOpacity={0.7}
          >
            <View style={[styles.bar, { height: h, width: barWidth, backgroundColor: isSelected ? color : `${color}60` }]} />
            <Text style={[styles.hourLabel, isSelected && { color: '#FFF' }]}>{point.hour_label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────────
function DetailPanel({ point, fs = false }: { point: TimelinePoint; fs?: boolean }) {
  const color = getBarColor(point.avg_vibe_score);
  return (
    <View style={[styles.details, fs && styles.detailsFs]}>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Vibe Score</Text>
        <Text style={[styles.detailValue, { color }]}>{Math.round(point.avg_vibe_score)}%</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Energy</Text>
        <Text style={[styles.detailValue, { color }]}>{energyLabel(point.avg_vibe_score)}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Ratings</Text>
        <Text style={styles.detailValue}>{point.rating_count}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Check-ins</Text>
        <Text style={styles.detailValue}>{point.checkin_count}</Text>
      </View>
    </View>
  );
}

export default function VibeTimeline({ timeline, peakHour }: VibeTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  if (timeline.length === 0) return null;

  const selected = selectedIndex !== null ? timeline[selectedIndex] : null;
  const peakPoint = timeline.reduce((a, b) => a.avg_vibe_score > b.avg_vibe_score ? a : b, timeline[0]);

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
          <View style={styles.headerLeft}>
            <Ionicons name="time-outline" size={16} color={colors.text.muted} />
            <Text style={styles.headerText}>Tonight's Timeline</Text>
          </View>
          <View style={styles.headerRight}>
            {peakHour && (
              <View style={styles.peakBadge}>
                <Ionicons name="flame" size={12} color="#FF3366" />
                <Text style={styles.peakText}>Peak: {peakHour}</Text>
              </View>
            )}
            {/* Expand button */}
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

        {/* Mini chart */}
        {expanded && (
          <View style={styles.content}>
            <BarChart timeline={timeline} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
            {selected && <DetailPanel point={selected} />}
          </View>
        )}
      </View>

      {/* Fullscreen Modal */}
      <Modal visible={fullscreen} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => setFullscreen(false)}>
        <View style={styles.fsContainer}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <SafeAreaView style={{ flex: 1 }}>
            {/* FS Header */}
            <View style={styles.fsHeader}>
              <View style={styles.fsHeaderLeft}>
                <Ionicons name="time-outline" size={18} color="#FF9933" />
                <Text style={styles.fsTitle}>TONIGHT'S TIMELINE</Text>
              </View>
              <View style={styles.fsHeaderRight}>
                {peakHour && (
                  <View style={styles.peakBadge}>
                    <Ionicons name="flame" size={12} color="#FF3366" />
                    <Text style={styles.peakText}>Peak: {peakHour}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setFullscreen(false)}>
                  <Ionicons name="close" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.fsContent} showsVerticalScrollIndicator={false}>
              {/* Peak callout */}
              <View style={[styles.fsPeakCallout, { borderColor: getBarColor(peakPoint.avg_vibe_score) + '55' }]}>
                <Text style={styles.fsPeakLabel}>PEAK HOUR</Text>
                <Text style={[styles.fsPeakScore, { color: getBarColor(peakPoint.avg_vibe_score) }]}>
                  {peakPoint.hour_label}
                </Text>
                <Text style={styles.fsPeakSub}>{Math.round(peakPoint.avg_vibe_score)}% vibe · {energyLabel(peakPoint.avg_vibe_score)}</Text>
              </View>

              {/* Full bar chart */}
              <View style={styles.fsChartWrap}>
                <BarChart
                  timeline={timeline}
                  selectedIndex={selectedIndex}
                  onSelect={setSelectedIndex}
                  barWidth={22}
                  barMax={160}
                  columnWidth={38}
                />
              </View>

              {/* Selected detail */}
              {selected ? (
                <DetailPanel point={selected} fs />
              ) : (
                <Text style={styles.fsTapHint}>Tap any bar to see that hour's stats</Text>
              )}

              {/* All hours table */}
              <View style={styles.fsTable}>
                <View style={styles.fsTableHeader}>
                  <Text style={[styles.fsTableCell, { flex: 1 }]}>HOUR</Text>
                  <Text style={styles.fsTableCell}>SCORE</Text>
                  <Text style={styles.fsTableCell}>ENERGY</Text>
                  <Text style={styles.fsTableCell}>RATINGS</Text>
                </View>
                {timeline.map((p, i) => {
                  const color = getBarColor(p.avg_vibe_score);
                  return (
                    <TouchableOpacity
                      key={p.hour}
                      style={[styles.fsTableRow, selectedIndex === i && { backgroundColor: color + '12' }]}
                      onPress={() => setSelectedIndex(selectedIndex === i ? null : i)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.fsTableCell, { flex: 1, color: '#CCC' }]}>{p.hour_label}</Text>
                      <Text style={[styles.fsTableCell, { color, fontWeight: '800' }]}>{Math.round(p.avg_vibe_score)}%</Text>
                      <Text style={[styles.fsTableCell, { color, fontSize: 9 }]}>{energyLabel(p.avg_vibe_score)}</Text>
                      <Text style={[styles.fsTableCell, { color: '#888' }]}>{p.rating_count}</Text>
                    </TouchableOpacity>
                  );
                })}
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  peakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF336615', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  peakText: { fontSize: typography.fontSize.xs, fontWeight: typography.fontWeight.semibold, color: '#FF3366' },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: spacing.sm, gap: 2 },
  barColumn: { alignItems: 'center' },
  bar: { borderRadius: 4, minHeight: 4 },
  hourLabel: { fontSize: 9, color: colors.text.muted, marginTop: 4 },
  details: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: colors.background.elevated,
    borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.sm,
  },
  detailsFs: { marginHorizontal: 16, marginTop: 12 },
  detailRow: { alignItems: 'center' },
  detailLabel: { fontSize: typography.fontSize.xs, color: colors.text.muted, marginBottom: 2 },
  detailValue: {
    fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold,
    color: colors.text.primary, textTransform: 'capitalize',
  },

  // ── Fullscreen ──────────────────────────────────────────────────────────────
  fsContainer: { flex: 1, backgroundColor: '#08080F' },
  fsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(10,10,20,0.9)',
  },
  fsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fsTitle: { fontSize: 13, fontWeight: '900', color: '#FFF', letterSpacing: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  fsContent: { paddingBottom: 32 },
  fsPeakCallout: {
    margin: 16, borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16, alignItems: 'center', gap: 4,
  },
  fsPeakLabel: { fontSize: 9, color: '#666', fontWeight: '800', letterSpacing: 2 },
  fsPeakScore: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  fsPeakSub: { fontSize: 12, color: '#888', fontWeight: '600' },
  fsChartWrap: {
    marginHorizontal: 8, marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12, paddingVertical: 12,
  },
  fsTapHint: { fontSize: 12, color: '#333', textAlign: 'center', marginVertical: 16 },
  fsTable: { marginHorizontal: 16, marginTop: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1A1A28' },
  fsTableHeader: {
    flexDirection: 'row', backgroundColor: '#111120',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  fsTableRow: {
    flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#1A1A28',
  },
  fsTableCell: { fontSize: 11, fontWeight: '700', color: '#555', width: 72, letterSpacing: 0.5 },
});
