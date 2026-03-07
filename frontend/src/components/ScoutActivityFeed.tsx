/**
 * ScoutActivityFeed — Merchant widget showing who's rating the venue.
 * "X scouts rated you in the last hour" — makes the data feel real.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const ENERGY_CONFIG: Record<string, { color: string; label: string }> = {
  peak:    { color: '#FF3366', label: 'Peak' },
  lit:     { color: '#FF6B35', label: 'Lit' },
  warming: { color: '#FF9933', label: 'Warming' },
  chill:   { color: '#9933FF', label: 'Chill' },
  quiet:   { color: '#3399FF', label: 'Quiet' },
};

interface Scout {
  username: string;
  clout: number;
  energy: string;
  vibe_score: number;
  timestamp: string;
  is_last_hour: boolean;
}

interface ActivityData {
  count_1h: number;
  count_24h: number;
  scouts: Scout[];
}

interface Props {
  venueId: string;
  authToken: string;
  demoData?: ActivityData;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.floor(diff / 60)}h ago`;
}

export default function ScoutActivityFeed({ venueId, authToken, demoData }: Props) {
  const [data, setData] = useState<ActivityData | null>(demoData ?? null);
  const [loading, setLoading] = useState(!demoData);
  const [expanded, setExpanded] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (demoData) return;
    try {
      const res = await fetch(`${API_URL}/api/merchant/venues/${venueId}/scout-activity`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [venueId, authToken, demoData]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="small" color="#FF3366" />
      </View>
    );
  }

  if (!data) return null;

  const { count_1h, count_24h, scouts } = data;
  const displayScouts = expanded ? scouts : scouts.slice(0, 4);

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
        <View style={styles.headerLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.title}>LIVE SCOUT ACTIVITY</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#555" />
      </TouchableOpacity>

      {/* Count strip */}
      <View style={styles.countStrip}>
        <View style={styles.countItem}>
          <Text style={[styles.countValue, count_1h > 0 && { color: '#FF3366' }]}>{count_1h}</Text>
          <Text style={styles.countLabel}>last hour</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.countItem}>
          <Text style={styles.countValue}>{count_24h}</Text>
          <Text style={styles.countLabel}>last 24h</Text>
        </View>
        {count_1h === 0 && (
          <Text style={styles.emptyHint}>No ratings in the last hour</Text>
        )}
      </View>

      {/* Scout list */}
      {scouts.length > 0 && (
        <View style={styles.list}>
          {displayScouts.map((s, i) => {
            const energy = ENERGY_CONFIG[s.energy] ?? ENERGY_CONFIG.chill;
            return (
              <View key={i} style={[styles.row, s.is_last_hour && styles.rowHighlight]}>
                <View style={[styles.energyDot, { backgroundColor: energy.color }]} />
                <Text style={styles.username}>{s.username}</Text>
                <Text style={styles.clout}>{s.clout.toLocaleString()} clout</Text>
                <View style={[styles.energyChip, { borderColor: energy.color + '50' }]}>
                  <Text style={[styles.energyLabel, { color: energy.color }]}>{energy.label}</Text>
                </View>
                <Text style={styles.timeAgo}>{timeAgo(s.timestamp)}</Text>
              </View>
            );
          })}
          {!expanded && scouts.length > 4 && (
            <TouchableOpacity onPress={() => setExpanded(true)} style={styles.showMore}>
              <Text style={styles.showMoreText}>+{scouts.length - 4} more scouts</Text>
            </TouchableOpacity>
          )}
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
  loadingWrapper: { padding: 20, alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF3366',
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF3366',
    letterSpacing: 2,
  },
  countStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1A1A25',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  countItem: { alignItems: 'center', gap: 2 },
  countValue: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  countLabel: { fontSize: 9, color: '#555', fontWeight: '600', letterSpacing: 0.5 },
  divider: { width: 1, height: 28, backgroundColor: '#1A1A25' },
  emptyHint: { fontSize: 11, color: '#444', marginLeft: 8 },
  list: { paddingHorizontal: 12, paddingBottom: 12, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  rowHighlight: { backgroundColor: '#FF336608' },
  energyDot: { width: 6, height: 6, borderRadius: 3 },
  username: { fontSize: 13, fontWeight: '700', color: '#FFF', flex: 1 },
  clout: { fontSize: 10, color: '#555' },
  energyChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  energyLabel: { fontSize: 9, fontWeight: '700' },
  timeAgo: { fontSize: 10, color: '#444', minWidth: 44, textAlign: 'right' },
  showMore: { paddingVertical: 8, alignItems: 'center' },
  showMoreText: { fontSize: 11, color: '#555', fontWeight: '600' },
});
