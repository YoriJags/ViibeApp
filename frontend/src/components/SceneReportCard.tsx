/**
 * SceneReportCard — Morning auto-generated last-night scene recap.
 * Shows the top venue, biggest surge, and the first scout who called it.
 * Only displayed during morning hours (5am–12pm WAT). Shown on home feed.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface SceneReport {
  available: boolean;
  date?: string;
  window_label?: string;
  headline?: string;
  winner?: { venue_name: string; area: string; peak_score: number; avg_score: number };
  surge_venue?: { venue_name: string; surge: number; max_score: number };
  trailblazer?: { username: string; emoji: string };
  message?: string;
}

// Demo data for testing
const DEMO_REPORT: SceneReport = {
  available: true,
  date: 'Monday, 03 Mar',
  window_label: '8PM–4AM WAT',
  headline: 'DNA Nightclub peaked at 94% last night',
  winner: { venue_name: 'DNA Nightclub', area: 'Victoria Island', peak_score: 94, avg_score: 78 },
  surge_venue: { venue_name: 'Club Quilox', surge: 47, max_score: 88 },
  trailblazer: { username: 'vibe_tester', emoji: '🔥' },
};

interface Props {
  isDemoMode?: boolean;
}

export default function SceneReportCard({ isDemoMode }: Props) {
  const [report, setReport] = useState<SceneReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setReport(DEMO_REPORT);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/scene-report`)
      .then(r => r.json())
      .then(d => { setReport(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isDemoMode]);

  if (loading) return null;
  if (!report?.available) return null;
  if (collapsed) return null;

  const { winner, surge_venue, trailblazer } = report;

  return (
    <LinearGradient
      colors={['rgba(255, 51, 102, 0.10)', 'rgba(153, 51, 255, 0.08)', 'rgba(13, 17, 23, 0)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>LAST NIGHT</Text>
          </View>
          {report.window_label && (
            <Text style={styles.windowLabel}>{report.window_label}</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setCollapsed(true)} style={styles.closeBtn}>
          <Ionicons name="close" size={16} color="#555" />
        </TouchableOpacity>
      </View>

      {/* Headline */}
      <Text style={styles.headline}>{report.headline}</Text>

      {/* Winner venue */}
      {winner && (
        <View style={styles.winnerRow}>
          <View style={styles.winnerIcon}>
            <Ionicons name="trophy" size={18} color="#FF3366" />
          </View>
          <View style={styles.winnerInfo}>
            <Text style={styles.winnerName}>{winner.venue_name}</Text>
            <Text style={styles.winnerArea}>{winner.area}</Text>
          </View>
          <View style={styles.winnerScore}>
            <Text style={styles.winnerPeak}>{winner.peak_score}%</Text>
            <Text style={styles.winnerPeakLabel}>PEAK</Text>
          </View>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        {surge_venue && (
          <View style={styles.statChip}>
            <Ionicons name="trending-up" size={13} color="#4CAF50" />
            <Text style={styles.statText}>
              {surge_venue.venue_name} surged +{surge_venue.surge}pts
            </Text>
          </View>
        )}
        {trailblazer && (
          <View style={styles.statChip}>
            <Text style={styles.trailblazerEmoji}>{trailblazer.emoji}</Text>
            <Text style={styles.statText}>
              @{trailblazer.username} called it first
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.18)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(255, 51, 102, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 1.5,
  },
  windowLabel: {
    fontSize: 10,
    color: '#555',
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
  },
  headline: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
    lineHeight: 22,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 51, 102, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  winnerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 51, 102, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerInfo: {
    flex: 1,
  },
  winnerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  winnerArea: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  winnerScore: {
    alignItems: 'center',
  },
  winnerPeak: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FF3366',
  },
  winnerPeakLabel: {
    fontSize: 9,
    color: '#888',
    letterSpacing: 1,
  },
  statsRow: {
    gap: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statText: {
    fontSize: 11,
    color: '#AAA',
    flex: 1,
  },
  trailblazerEmoji: {
    fontSize: 13,
  },
});
